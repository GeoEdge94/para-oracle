# M4bis — Challenger bot dispute on-chain (Phase 4)

Le challenger bot passe du mode **log-only** (M4) au mode **réel on-chain** :
quand le fingerprint on-chain diverge des données IPFS, le bot submit une vraie
tx `ParaOracle.dispute(resolutionId)` sur Polygon Amoy, locke un counter-bond
de 500 tUSDC, et la tx est visible publiquement sur Polygonscan.

Ça complète la narrative **mutual verification** : l'oracle ne peut pas mentir
sans être disputé automatiquement par un bot externe qui ne lui fait pas
confiance.

## Architecture

```
┌──────────────────────┐
│ Backend (/oracle)    │
│  submitResolution()  │──────── tx #1 ────► ParaOracle.sol
│  bond 500 tUSDC      │                     (Amoy 0x4bb698ba...)
│  (wallet Oracle)     │
└──────────────────────┘                     ├─ resolutionId
                                             ├─ fingerprint (bytes32)
                                             ├─ dataCID (string)
                                             └─ 48h dispute window

┌──────────────────────┐
│ Challenger bot       │
│  poll /oracle/pending│
│  fetch data.json     │
│  recompute fingerprint│
│  if mismatch:        │
│    dispute_client    │──────── tx #2 ────► ParaOracle.dispute()
│    .dispute_for(tx1) │                     locks counter-bond
│  (wallet Challenger) │                     status: DISPUTED
└──────────────────────┘
```

## Wallets — 3 rôles strictement séparés

| Rôle | Adresse (Amoy testnet) | Fonction |
|---|---|---|
| Deployer | `0x7345C1f74A12E00F18AcE5b624612131D5878828` | Owner contrat, arbitre `resolveDispute()` |
| Oracle | `0x24e866B0b6A3A05944b75bd892366E9Aa8d116Af` | Signe `submitResolution()`, lock le bond |
| Challenger | _(à créer, Phase 4)_ | Signe `dispute()`, lock le counter-bond |

**Sécurité** : si une clé est compromise, on rotate uniquement ce rôle. Le
deployer en particulier sera un Safe multisig 3-of-5 sur mainnet.

## Configuration

`.env` (gitignored) :

```bash
# Déjà configuré par Phase 1/2
USE_MOCK_CHAIN=false
CHAIN_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
PARA_ORACLE_ADDRESS=0x4bb698ba46b26705dbd33ed98cf6bf7cf44b9f02
USDC_ADDRESS=0x6805913b53124e6600b420816bfe23631c187691

# Phase 4 — NEW
CHALLENGER_PRIVATE_KEY=0x...  # wallet distinct de l'Oracle
```

## Provisionnement du wallet challenger

```bash
# 1. Créer un nouveau compte MetaMask ("GeoEdge Challenger")
#    Export sa private key (Settings → Account details → Show private key)

# 2. Fund MATIC testnet
open https://faucet.polygon.technology/     # Amoy, paste l'adresse challenger

# 3. Mint 1000 tUSDC au challenger (le MockERC20 a mint() public sur testnet)
cast send 0x6805913b53124e6600b420816bfe23631c187691 \
  "mint(address,uint256)" \
  <CHALLENGER_ADDRESS> 1000000000 \
  --rpc-url https://rpc-amoy.polygon.technology \
  --private-key $ORACLE_PRIVATE_KEY

# 4. Injecter la clé dans .env puis relancer le bot
echo "CHALLENGER_PRIVATE_KEY=0x..." >> .env
docker compose --profile bot up -d --build bot
```

## Scenarios E2E

### Scénario A — oracle honnête, bot confirme

1. Backend résout un bet → tx `submitResolution` on-chain
2. Bot poll `/oracle/pending` → télécharge `data.json` depuis IPFS
3. Bot run `resolution_script.py` → fingerprint match
4. Bot log `[OK] bet-slug ...` et passe au suivant
5. Après 48h, n'importe qui peut appeler `finalize(resolutionId)` → bond retour oracle

### Scénario B — oracle malicieux, bot dispute

1. Oracle submit un bet avec le mauvais outcome (ex: YES alors que data → NO)
2. Bot recompute → `outcome divergence: claimed=YES recomputed=NO`
3. Bot extrait `resolutionId` depuis l'event `ResolutionSubmitted` de la tx submit
4. Bot check sa balance tUSDC ≥ 500
5. Bot approve max_uint USDC au contrat (une seule fois)
6. Bot submit `dispute(resolutionId)` → tx on-chain
7. Contract locke le counter-bond, status devient `DISPUTED`
8. Log : `[DISPUTE-ONCHAIN] bet-slug tx=0x...`
9. Admin/multisig arbitre via `resolveDispute(resolutionId, challengerWins)`

### Scénario C — tamper data.json

1. Oracle submit un résultat honnête
2. Quelqu'un modifie `data.json` après coup (ex: data/ipfs-mock/<cid>)
3. Bot recompute depuis le fichier modifié → `fingerprint mismatch`
4. Idem Scénario B étape 3+

## Modes d'exécution

```bash
# Mode continu (poll toutes les 30s)
docker compose --profile bot up -d bot

# Mode --once (idéal pour CI + démo)
docker compose --profile bot run --rm bot python challenger.py --once --limit 5

# Mode --dry-run (detect mismatches mais ne submit PAS dispute, même on-chain)
docker compose --profile bot run --rm bot python challenger.py --once --dry-run
```

Exit codes :
- `0` : tout match
- `1` : au moins un dispute détecté
- `2` : erreur (poll failed, --once sans items, etc.)

## Vérifier que ça marche

```bash
# Setup
cp .env.example .env           # remplir CHALLENGER_PRIVATE_KEY + autres
docker compose up -d db backend
docker compose --profile bot build bot

# 1. Resolve un bet (oracle submit)
curl -X POST http://localhost:8000/oracle/resolve/precip-amoy-testnet-01

# 2. Tamper le data.json pour forcer un mismatch
# (voir scripts/e2e_challenger.sh pour le script complet)

# 3. Run bot une fois
docker compose --profile bot run --rm bot python challenger.py --once

# Attendu : exit 1 + log [DISPUTE-ONCHAIN] bet-slug tx=0x...
#           Lien Polygonscan : https://amoy.polygonscan.com/tx/<tx>
```

## Sécurité

- **Aucun secret privilégié** : le bot tourne avec seulement `CHALLENGER_PRIVATE_KEY`,
  zéro accès DB/backend. N'importe qui peut faire tourner son propre bot.
- **Idempotent** : le bot mémorise les `analysis_id` déjà disputés dans la
  session (set in-memory). Pas de double-dispute.
- **Approve max_uint une fois** : économise ~50k gas par dispute ultérieur.
  Trade-off : si la clé challenger est compromise, l'attaquant peut drainer
  les tUSDC qu'on y a déposés (mais pas plus que la balance du wallet).
- **Pas de redémarrage auto** : en prod, wrappé par `systemctl` ou `fly`
  restart policy. En Docker, `restart: unless-stopped`.

## Roadmap mainnet

- Contract owner → Safe multisig 3-of-5 (pas EOA)
- Bond amount recalibré selon gas mainnet (~50€ min pour économiquement
  rentable)
- Bot déployé sur Fly.io / AWS Lambda avec la private key en secret manager
- Alerting Sentry sur chaque `[DISPUTE-ONCHAIN]`
