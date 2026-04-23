# Tester la chaine Web3 ParaOracle de bout en bout

Guide pratique pour valider que le pipeline M1→M4 tourne vraiment sur ta
machine. Resultats de verification attendus sont ecrits en dessous de chaque
commande.

Pour un recap **par milestone** de ce qui a ete construit, voir :
- [m1.md](m1.md) — pipeline spectral/weather + canonicalisation
- [m2.md](m2.md) — schema_v1 + resolution_script.py public
- [m3.md](m3.md) — smart contract Foundry + ChainClient mock
- [m4.md](m4.md) — TLSNotary stub + challenge bot + E2E dispute

Pour savoir **ce qui est vraiment branche vs mocke**, voir la section
"Ce qui est reel vs mocke" en bas de ce fichier.

## TL;DR (3 commandes)

```bash
docker compose up -d db backend
docker compose --profile bot build bot
bash scripts/e2e_challenger.sh
```

Attendu : `=== E2E CHALLENGER: PASS ===` apres ~30s.

## Prerequis

- Docker Desktop + `docker compose` v2
- Windows/Mac/Linux : le script E2E ne requiert ni python3 ni jq sur l'hote
  (les helpers tournent dans le container backend)
- Pas besoin de credentials externes (Copernicus, Pinata, Polygon) — tout
  tourne en mock-first par defaut
- **Ne JAMAIS deployer `contracts/script/Deploy.s.sol` avec un vrai
  `PRIVATE_KEY`** sans savoir ce que tu fais — cf. section "Deploiement real".

## E2E complet en 5 minutes

### 1. Stack up

```bash
docker compose up -d db backend frontend
docker compose ps
```

Attendu :
```
para-db        running   Up (healthy)
para-backend   running   Up
para-frontend  running   Up
```

### 2. Verifier le schema DB (colonnes Web3 presentes)

```bash
docker compose exec -T db psql -U paraoracle -d paraoracle \
  -c "\d analyses" | grep -E "tls_proof|chain_tx|dispute_window|bond_amount|fingerprint"
```

Attendu : 5 colonnes (`fingerprint_sha256`, `chain_tx_hash`,
`bond_amount_usdc`, `dispute_window_end`, `tls_proof_cid`).

### 3. Build du challenger bot

```bash
docker compose --profile bot build bot
```

**Note Windows/WSL2** : si tu hits `exec format error` sur `pip install`,
le probleme vient d'une image `python:3.12-slim` mal taggee dans ton cache
local. Le Dockerfile utilise deja `python:3.12-slim-bookworm` pour contourner,
mais si tu modifies le base tu peux repull avec :
```bash
docker rmi python:3.12-slim
docker pull --platform linux/amd64 python:3.12-slim
```

### 4. Lancer le scenario E2E

```bash
bash scripts/e2e_challenger.sh
# Sur Windows git-bash, MSYS_NO_PATHCONV=1 est recommande :
MSYS_NO_PATHCONV=1 bash scripts/e2e_challenger.sh
```

Le script fait 7 etapes :

1. **Reset bet** `precip-amoy-testnet-01` → status OPEN, analyses supprimees
2. **Resolve** via `POST /oracle/resolve/{slug}` → nouveau fingerprint + CIDs
3. **Pending feed** via `GET /oracle/pending` → verifie que les CIDs exposes
   matchent ceux de `resolve`
4. **Bot match case** : `docker compose --profile bot run --rm bot` avec
   `--once`, attend exit 0
5. **Tamper** : modifie `observed_value` dans `./data/ipfs-mock/<data_cid>`
6. **Bot dispute case** : relance le bot, attend exit 1 + message
   `[DISPUTE] ... fingerprint mismatch`
7. **Restore** : remet le `.bak` en place

Attendu final :
```
=== E2E CHALLENGER: PASS ===
  - resolve.fingerprint == pending.fingerprint
  - bot match-case  exit 0
  - tamper detected, bot dispute-case exit 1
  - original data.json restored
```

## Verifications en profondeur (challenge la logique)

> **Windows git-bash** : `export MSYS_NO_PATHCONV=1` une fois au debut de ta
> session. Sinon, les args commencant par `/` (ex: `/scripts/_e2e_helpers.py`,
> `-w /workspace`) sont convertis en `E:/Program Files/Git/...` et les
> commandes echouent silencieusement. Les blocs heredoc (`<<'PY'`) ne sont
> pas affectes.

### A. Determinisme : meme inputs → meme fingerprint

Si un des `FP` est vide, c'est que git-bash a converti le path — relire la
note ci-dessus. L'assertion prend explicitement en compte ce cas pour eviter
un faux `MATCH` (vide == vide).

Copier-coller ce bloc en une fois :

```bash
export MSYS_NO_PATHCONV=1   # inoffensif sur Linux/Mac

docker compose exec -T db psql -U paraoracle -d paraoracle -c \
  "DELETE FROM analyses WHERE bet_id=(SELECT id FROM bets WHERE slug='precip-amoy-testnet-01'); \
   UPDATE bets SET status='OPEN', result_bool=NULL, resolved_value=NULL, resolved_at=NULL \
   WHERE slug='precip-amoy-testnet-01';"

FP1=$(docker compose exec -T backend python /scripts/_e2e_helpers.py resolve \
      http://127.0.0.1:8000/oracle/resolve/precip-amoy-testnet-01 | awk '{print $2}')

docker compose exec -T db psql -U paraoracle -d paraoracle -c \
  "DELETE FROM analyses WHERE bet_id=(SELECT id FROM bets WHERE slug='precip-amoy-testnet-01'); \
   UPDATE bets SET status='OPEN' WHERE slug='precip-amoy-testnet-01';"

FP2=$(docker compose exec -T backend python /scripts/_e2e_helpers.py resolve \
      http://127.0.0.1:8000/oracle/resolve/precip-amoy-testnet-01 | awk '{print $2}')

echo "FP1=[$FP1]"
echo "FP2=[$FP2]"
if [[ -z "$FP1" || -z "$FP2" ]]; then
    echo "ERROR: un fingerprint est vide, le resolve a echoue (verifier MSYS_NO_PATHCONV)"
elif [[ "$FP1" == "$FP2" ]]; then
    echo "MATCH (determinisme confirme)"
else
    echo "DIFF (non-determinisme detecte !)"
fi
```

Attendu : 2 fingerprints non-vides + `MATCH`.

### B. `tls_proof.cid` fait bien partie du fingerprint

```bash
docker compose exec -T backend python <<'PY'
import json, subprocess
from pathlib import Path
from app.services.canonical import fingerprint_sha256

cid = subprocess.check_output([
    "python", "/scripts/_e2e_helpers.py", "pending",
    "http://127.0.0.1:8000/oracle/pending?limit=5", "precip-amoy-testnet-01"
], text=True).split()[0]
d = json.loads((Path("/data/ipfs-mock") / cid).read_bytes())

fp_with = fingerprint_sha256(d)
fp_without = fingerprint_sha256({k:v for k,v in d.items() if k != "tls_proof"})

print("fp with tls_proof   :", fp_with)
print("fp without tls_proof:", fp_without)
print("different           :", fp_with != fp_without)
PY
```

Attendu : `different: True`. Prouve que `tls_proof` (stub aujourd'hui, PSE
demain) entre dans l'input canonique — donc une future vraie proof produira
un `resolution_id` different de l'actuel, distinguable on-chain sans migration.

### C. Oracle menteur (outcome flippe sans toucher data.json)

```bash
# Flip result_bool en DB (simule un backend compromis)
docker compose exec -T db psql -U paraoracle -d paraoracle -c \
  "UPDATE bets SET result_bool = NOT result_bool,
     status = CASE WHEN status='RESOLVED_YES' THEN 'RESOLVED_NO' ELSE 'RESOLVED_YES' END
   WHERE slug='precip-amoy-testnet-01';"

docker compose --profile bot run --rm --no-deps -T bot python challenger.py --once --limit 5
# Attendu : exit 1 + [DISPUTE] ... outcome divergence: claimed=X recomputed=Y
#           avec le meme fingerprint dans expected et computed
# (sans --no-deps, docker recree db+backend et le bot hit Connection refused)

# Restore
docker compose exec -T db psql -U paraoracle -d paraoracle -c \
  "UPDATE bets SET result_bool = NOT result_bool,
     status = CASE WHEN status='RESOLVED_YES' THEN 'RESOLVED_NO' ELSE 'RESOLVED_YES' END
   WHERE slug='precip-amoy-testnet-01';"
```

Prouve que le bot attrape **deux classes d'attaque** distinctes :
1. Tamper des donnees source → `fingerprint mismatch`
2. Oracle menteur (outcome flippe, data intacte) → `outcome divergence`

### D. Cross-verification backend ↔ resolution_script.py

```bash
docker compose exec -T backend python <<'PY'
import json, subprocess, tempfile
from app.services.canonical import fingerprint_sha256

m = {
    "schema_version": "v1",
    "pipeline_kind": "weather",
    "bet_slug": "test",
    "period": {"start": "2025-01-01", "end": "2025-01-31"},
    "fingerprint_inputs": {"source": "ERA5-Land", "values": [1.0, 2.0]},
    "result": {"observed_value": 35.0, "threshold_value": 30.0,
               "direction": "gte", "threshold_unit": "mm"},
}
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
    json.dump(m, f); tmp = f.name

r = subprocess.run(["python", "/scripts/resolution_script.py", tmp],
                   capture_output=True, text=True)
out = json.loads(r.stdout)

print("backend  :", fingerprint_sha256(m))
print("script   :", out["fingerprint_sha256"])
print("match    :", fingerprint_sha256(m) == out["fingerprint_sha256"])
PY
```

Attendu : `match: True`. Garantit que le bot (qui appelle le script) et le
backend (qui pin) calculent exactement le meme hash.

## Regression : tests unitaires

### Backend pytest

```bash
docker compose exec -T backend pip install pytest
docker compose exec -T backend python -m pytest tests/ --tb=short -q
```

Attendu : **28/28 passed** (spectral pipeline).

### Scripts pytest (resolution_script)

```bash
MSYS_NO_PATHCONV=1 docker compose exec -T -w /scripts backend \
  python -m pytest tests/ --tb=short -q
```

Attendu : **8/9 passed**. Le 9eme (`test_fingerprint_matches_backend_canonical`)
echoue sur un path hardcode qui suppose `scripts/` et `backend/` freres sur
le disque host — infra test, pas bug produit. La verif manuelle dans la
section D ci-dessus prouve la coherence.

### Foundry (smart contract)

Premier run (installe forge-std puis teste) :

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/contracts:/workspace" -w /workspace \
  -e FOUNDRY_DISABLE_NIGHTLY_WARNING=1 \
  --entrypoint sh ghcr.io/foundry-rs/foundry:latest \
  -c "forge install --no-git --shallow foundry-rs/forge-std && forge test -vv"
```

Runs suivants (forge-std deja installe dans `contracts/lib/`) :

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/contracts:/workspace" -w /workspace \
  -e FOUNDRY_DISABLE_NIGHTLY_WARNING=1 \
  --entrypoint sh ghcr.io/foundry-rs/foundry:latest \
  -c "forge test"
```

Attendu : **14/14 passed** (happy path, double-submit, zero-fingerprint,
dispute-lock-bond, finalize-before-window, resolveDispute oracle/challenger
wins, etc).

**Note Windows git-bash** : sans `MSYS_NO_PATHCONV=1`, le `-w /workspace`
est converti en `E:/Program Files/Git/workspace` et docker echoue.

## Frontend TypeScript

```bash
docker compose exec -T frontend npx tsc --noEmit
```

Attendu : seulement des erreurs sur `GlobeView.tsx` (manque `@types/three`,
anterieur a M4). Si tu vois une erreur sur `Web3Evidence.tsx`, `Analysis.tsx`
ou `lib/api.ts` → regression M4 a fixer.

Pour verifier visuellement :
1. Ouvrir `http://localhost:3000`, login demo@para-oracle.app / demo1234
2. Cliquer un pari RESOLVED_* → page Analysis
3. Scroll jusqu'au panneau "Preuves Web3" → tu dois voir :
   - Badge "mock chain" (puisque `USE_MOCK_CHAIN=true`)
   - `chain_tx_hash` shortened avec lien Polygonscan Amoy + bouton copy
   - 4 CIDs (data/script/schema/tls_proof) avec liens Pinata gateway
   - Countdown temps reel `dispute_window_end` qui decremente chaque seconde

## Ce qui est reel vs mocke

| Composant | Statut | Activable ? |
|-----------|--------|-------------|
| Canonicalisation + fingerprint SHA-256 | **reel** | toujours actif |
| resolution_script.py | **reel** | toujours actif |
| Spectral pipeline (NDVI, NBR, ...) | **reel** (mock data par defaut) | `USE_MOCK_SENTINEL=false` + Copernicus credentials |
| Weather pipeline (ERA5-Land) | **reel** | besoin `CDS_API_KEY` |
| Smart contract Solidity | **reel** (compile + tests OK) | **jamais deploye** sur Amoy |
| ChainClient (submit on-chain) | **mock** | `_real_submit` lance NotImplementedError |
| IPFS pinning | **mock** (FS local) | `USE_MOCK_IPFS=false` + `PINATA_JWT` |
| TLSNotary proof | **stub** (enveloppe shape-compatible) | `_real_proof` lance NotImplementedError |
| Challenger bot logique | **reel** | toujours actif |
| Challenger bot dispute on-chain | **mock** (log seulement) | M4bis : besoin `CHALLENGER_PRIVATE_KEY` + contract deployed |

## Deploiement real (Amoy testnet) — NE PAS executer sans savoir

Ces commandes toucheraient la blockchain testnet Polygon Amoy. Gratuites mais
irreversibles (tx enregistrees publiquement). Listees pour memoire M4bis.

Toutes les variables ci-dessous existent deja dans `.env.example` — copie-le
en `.env` a la racine du monorepo (`cp .env.example .env`) et remplis les
valeurs.

```bash
# 1. Ouvrir un wallet MetaMask/Foundry, recuperer la PRIVATE_KEY (hex sans 0x)
#    Fund en MATIC via faucet Amoy : https://faucet.polygon.technology/
#    (select Amoy → paste address)

# 2. Editer .env a la racine :
#    PRIVATE_KEY=abcdef...         # pour Foundry (vm.envUint)
#    ORACLE_PRIVATE_KEY=abcdef...  # pour backend web3.py (M4bis)
#    BOND_AMOUNT_USDC=500.0
#    DISPUTE_WINDOW_SECONDS=172800
#    USDC_ADDRESS=                 # vide → Deploy.s.sol cree un MockERC20

# 3. Deployer ParaOracle.sol
#    Note bash : `source .env` ne rend PAS les vars visibles a forge
#    (child process) sans export explicite. Utiliser `set -a` pour
#    auto-exporter tout ce qui est assigne dans le .env :
set -a
source .env
set +a
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$CHAIN_RPC_URL" \
  --broadcast
# Note les 2 adresses imprimees dans les logs :
#   "Deployed Mock USDC at 0x..."   → USDC_ADDRESS
#   "Deployed ParaOracle at 0x..."  → PARA_ORACLE_ADDRESS

# 4. Editer .env avec les adresses deployees, puis flip le mock off :
#    USE_MOCK_CHAIN=false
#    PARA_ORACLE_ADDRESS=0x...
#    USDC_ADDRESS=0x...

# 5. Implementer _real_submit dans backend/app/services/chain_client.py
#    (M4bis TODO — web3.py + ABI de ParaOracle.sol generee par forge build)

# 6. Restart le backend pour recharger les settings :
docker compose restart backend
```

Ce flow n'a jamais tourne — c'est le prochain jalon.

## Troubleshooting

| Symptome | Cause probable | Fix |
|----------|----------------|-----|
| `exec format error` au build bot | Image base mal taggee dans ton cache | `docker rmi python:3.12-slim-bookworm && docker compose --profile bot build --no-cache bot` |
| `pending.data_cid != resolve.data_cid` | DB pas reset entre runs | Etape 1 du script `e2e_challenger.sh` reset — si tu bypasses, fais manuellement |
| Bot dit `[FATAL] resolution_script.py not found` | Volume `./scripts:/scripts:ro` pas monte | Verifier `docker-compose.yml` ligne 88 |
| `docker compose exec ... python -m pytest /scripts/tests/` echoue avec path bizarre sur Windows | Git-bash convertit les paths absolus | Prefixer avec `MSYS_NO_PATHCONV=1` |
| `[challenger] poll error: ConnectError` | Backend pas pret ou depends_on pas finalise | `docker compose logs backend` puis retry |
| Frontend affiche `tx not found` sur Polygonscan | Mode mock actif — `chain_tx_hash` n'existe que en DB | Deployer reellement (cf. section deploiement real) |

## Pour aller plus loin

- Architecture par milestone : [m1.md](m1.md) / [m2.md](m2.md) / [m3.md](m3.md) / [m4.md](m4.md)
- Plan TLSNotary PSE : [../tlsnotary.md](../tlsnotary.md)
- Schema de donnees canonique : [../../backend/app/services/schema_v1.py](../../backend/app/services/schema_v1.py)
