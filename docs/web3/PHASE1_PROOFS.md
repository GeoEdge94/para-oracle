# Phase 1 — Preuves on-chain + IPFS (2026-04-23)

Cette page fige les artefacts publiquement auditables produits pendant la phase 1
du bet `mvp-prodready-01`. Chaque lien est vérifiable par quiconque, sans dépendance
au backend GeoEdge.

## Stack live durant la démo

| Composant | Statut | Détail |
|---|---|---|
| `USE_MOCK_CHAIN` | `false` | `_real_submit` → web3.py signe et broadcast sur Amoy |
| `USE_MOCK_IPFS` | `false` | Upload réel vers Pinata API, CID public worldwide |
| `USE_MOCK_TLSNOTARY` | `true` | Stub shape-compatible PSE, `tls_proof.cid` dans fingerprint canonique |
| Smart contract | Déployé | `0x4BB698Ba46B26705dBD33ED98CF6Bf7cF44B9F02` (ParaOracle) |
| Bond token | Déployé | `0x6805913b53124e6600b420816bfe23631c187691` (MockERC20 tUSDC) |
| Oracle wallet | Provisionné | `0x24e866B0b6A3A05944b75bd892366E9Aa8d116Af` |

## Transactions on-chain

### Tx 1 — Mint 1000 tUSDC au wallet Oracle

`mint(0x24e866..., 1_000_000_000)` sur MockERC20.

| Field | Value |
|---|---|
| tx hash | `0x3d9dfb73a58d15d30a2e9b930c85ffa73c0cca1370c90825dfb8acb7ec268f6d` |
| block | 37157195 |
| gas used | 51 042 |
| status | 1 (success) |
| Polygonscan | https://amoy.polygonscan.com/tx/0x3d9dfb73a58d15d30a2e9b930c85ffa73c0cca1370c90825dfb8acb7ec268f6d |

### Tx 2 — `submitResolution` pour california-wildfire-2026

Pipeline spectral NBR, outcome YES (12 709 ha brûlés ≥ seuil 10 000 ha).

| Field | Value |
|---|---|
| tx hash | `0x1eb75a2d09b85f4b736c9f22e0feb9888bff27b3584224234a2da7356de33a57` |
| block | 37157326 |
| gas used | 361 859 |
| resolution_id | `0x697ccca7a4f71a98c40bf28b966cc7df92a68df9a732cecd711963b6e508d4de` |
| fingerprint | `sha256:9fa80677b3b617a4d823e50fad807fff05aa3fa708ef0508e154f628ec65fd2c` |
| bond locked | 500 tUSDC |
| dispute window | 48h (jusqu'au 2026-04-25 16:29 UTC) |
| Polygonscan | https://amoy.polygonscan.com/tx/0x1eb75a2d09b85f4b736c9f22e0feb9888bff27b3584224234a2da7356de33a57 |

### Tx 3 — `submitResolution` pour para-fires-primary-2025 (avec Pinata réel)

Pipeline spectral NBR, outcome YES (15 018 ha brûlés ≥ seuil 50 ha seed démo).

| Field | Value |
|---|---|
| tx hash | `0x08d3ebdc15cf49e4d157dbb3f6e70c500c9fbb3492ffd0dc0784da1691840628` |
| block | 37157750 |
| gas used | ~362 000 |
| fingerprint | `sha256:249628182d510d78d623bcd139eb0ae1ae4d0acb1ec417173756e7856ed69564` |
| data CID | `Qmbv9bu2cACPLdacC17GSoP1xRY1ZeXA2ctm6r12LKSQCh` |
| script CID | `QmcLmyyY1osnB7BqbFRMza8vGcsev4eMiL79vBBFR6epab` |
| schema CID | `QmSBue6V949muvJa36X2XcXPC92jjrJ9uYm1R16RNFcw7Y` |
| tls_proof CID | `QmZimSKdWx5ieRwLPg31aYp7JPQpJA7zM9L8dvKGCHg3yS` |
| bond locked | 500 tUSDC |
| Polygonscan | https://amoy.polygonscan.com/tx/0x08d3ebdc15cf49e4d157dbb3f6e70c500c9fbb3492ffd0dc0784da1691840628 |

## IPFS — contenu publiquement consultable

Tous les fichiers sont pinnés sur Pinata (replicas FRA1 + NYC1), accessibles via
n'importe quel gateway IPFS.

| Fichier | URL gateway | Size | HTTP |
|---|---|---|---|
| `data.json` (payload canonique) | https://gateway.pinata.cloud/ipfs/Qmbv9bu2cACPLdacC17GSoP1xRY1ZeXA2ctm6r12LKSQCh | 1 461 B | 200 |
| `resolution_script.py` (audit) | https://gateway.pinata.cloud/ipfs/QmcLmyyY1osnB7BqbFRMza8vGcsev4eMiL79vBBFR6epab | ~6 KB | 200 |
| `schema_v1.json` (JSON Schema) | https://gateway.pinata.cloud/ipfs/QmSBue6V949muvJa36X2XcXPC92jjrJ9uYm1R16RNFcw7Y | — | — |
| `tls_proof.json` (stub PSE) | https://gateway.pinata.cloud/ipfs/QmZimSKdWx5ieRwLPg31aYp7JPQpJA7zM9L8dvKGCHg3yS | — | — |

## Audit trustless (reproducible par quiconque)

```bash
# 1. Télécharge le payload depuis IPFS (pas depuis GeoEdge)
curl -s https://gateway.pinata.cloud/ipfs/Qmbv9bu2cACPLdacC17GSoP1xRY1ZeXA2ctm6r12LKSQCh \
  > /tmp/audit_data.json

# 2. Télécharge le script de vérification depuis IPFS
curl -s https://gateway.pinata.cloud/ipfs/QmcLmyyY1osnB7BqbFRMza8vGcsev4eMiL79vBBFR6epab \
  > /tmp/resolution_script.py

# 3. Recalcule le fingerprint localement
python /tmp/resolution_script.py /tmp/audit_data.json
```

**Résultat attendu** :
```json
{
  "fingerprint_sha256": "sha256:249628182d510d78d623bcd139eb0ae1ae4d0acb1ec417173756e7856ed69564",
  "fingerprint_verified": true,
  "outcome_yes": true,
  ...
}
```

Si ce `fingerprint_sha256` matche celui stocké on-chain (via `getResolution(resolutionId)` sur le contrat ParaOracle), l'oracle n'a pas menti — **preuve cryptographique, aucune confiance en GeoEdge requise**.

## Wallet state post-démo

```
0x24e866B0b6A3A05944b75bd892366E9Aa8d116Af
  MATIC:  ~0.03 POL  (dropped from 0.1 after 3 tx, gas)
  tUSDC:  0          (1000 minted, 500 locked as bond for tx 2 + 500 locked for tx 3)
```

Les 1000 tUSDC sont actuellement bloqués dans le contrat ParaOracle jusqu'à la fin
de la fenêtre de dispute (48h). Si personne ne conteste → `finalize()` les débloque
et le bond revient à l'oracle.

## Ce qui reste mocké (assumé transparent)

- **TLSNotary** : `tls_proof.json` est un stub shape-compatible PSE. Le champ
  `tls_proof.cid` entre bien dans le fingerprint canonique (vérifiable via le
  script d'audit), donc le jour où le vrai notaire PSE est plugué, la bascule
  `USE_MOCK_TLSNOTARY=false` est structurellement transparente — le
  `resolution_id` d'une future vraie proof sera forcément différent, mais le
  mécanisme de verification reste identique.
