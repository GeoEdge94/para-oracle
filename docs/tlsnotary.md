# TLSNotary — plan d'integration PSE (M4 stub -> M4bis real)

## Etat MVP

En M4, `TLSNotaryClient` produit une **enveloppe JSON stub** shape-compatible
avec le format PSE v0.x. Elle est pinnee sur IPFS (`tls_proof_cid`) et
referencee dans `data.json` via :

```json
{
  "tls_proof": {
    "cid": "bafybei...",
    "server_name": "cds.climate.copernicus.eu",
    "request_url": "https://cds.climate.copernicus.eu/api/...",
    "response_body_sha256": "sha256:...",
    "mock": true
  }
}
```

Le champ `tls_proof.cid` **fait partie du fingerprint canonique** soumis
on-chain. Ca garantit qu'une future proof reelle produira un fingerprint
different (donc un `resolution_id` different cote contrat, ce qui permet de
distinguer les beta-no-tls-proof des vraies).

Envelope stub (voir `backend/app/services/tlsnotary_client.py`) :

```json
{
  "version": "paraoracle-stub/v1",
  "server_name": "cds.climate.copernicus.eu",
  "tls_version": "TLSv1.2",
  "request_url": "https://.../reanalysis-era5-land/execute",
  "request_body_sha256": "sha256:...",
  "response_body_sha256": "sha256:...",
  "notary": {
    "name": "stub-notary",
    "pubkey": null,
    "signed_at": "2026-04-22T10:00:00Z"
  },
  "signature": "stub"
}
```

## Plan d'integration reelle (M4bis)

**Cible** : notaire public PSE (Ethereum Foundation), github.com/tlsnotary/tlsn
ou self-hosted dans un container dedie.

### Etape 1 — PoC local

1. Deployer `tlsn-verifier` (Rust) en local :
   ```bash
   docker run -p 7047:7047 ghcr.io/tlsnotary/tlsn-notary-server:latest
   ```
2. Utiliser `tlsn-prover` via Node.js ou Python wrapper pour notariser une
   requete test vers `httpbin.org/get`.
3. Sauvegarder la proof JSON et valider avec `tlsn-verifier`.

**Critere de succes** : notarisation end-to-end qui produit un artefact
verifiable offline.

### Etape 2 — Adapter `TLSNotaryClient`

Implementer `_real_proof` :
```python
def _real_proof(self, server_name, request_url, request_body, response_body):
    # 1. Call tlsn-prover subprocess or HTTP MPC protocol
    # 2. Recupere la proof binaire
    # 3. Wrappe dans une enveloppe JSON coherente avec le stub
    # 4. Retourne TLSProof
```

Le shape reste identique au stub ; seuls `signature`, `notary.pubkey`, et un
champ `proof_binary: base64(...)` changent.

### Etape 3 — Endpoint de verification

Ajouter `POST /oracle/verify-tls-proof/{analysis_id}` qui :
1. Recupere l'analyse et le `tls_proof_cid`
2. Telecharge la proof depuis IPFS
3. Appelle `tlsn-verifier` pour valider
4. Retourne `{valid: bool, notary: ..., server: ..., verified_at: ...}`

Le challenge bot appellera cet endpoint (ou fera la verif lui-meme si tlsn-verifier est packageable avec lui).

## Fallback si PSE glisse avant le go-live

Si l'integration PSE n'est pas prete le jour du deploiement Amoy/mainnet :

1. Garder `USE_MOCK_TLSNOTARY=true`
2. Ajouter un flag `beta_no_tls_proof=true` dans chaque bet concerne
3. Afficher dans le frontend : "⚠ Bet beta — TLSNotary proof non-cryptographique"
4. Documenter dans README : "les cautions et disputes fonctionnent, mais la
   garantie d'authenticite de la source est limitee a la confiance dans
   l'infrastructure oracle"

Cette degradation est acceptable pour un MVP demo mais **pas** pour un produit
reellement decentralise. La roadmap doit faire de M4bis une priorite haute.

## Risques & mitigations

- **MPC latency** : TLSNotary ajoute 5-30s de latence par requete. Acceptable
  pour un pipeline qui tourne hors-chemin critique, mais a surveiller.
- **Notary availability** : un seul notaire PSE = SPOF. Roadmap : multi-notaire
  avec seuil de signatures (M5+).
- **Response body size limit** : TLSNotary v0.x supporte ~16KB de response body.
  Les fichiers .tif binaires de SpectralPipeline depassent largement ; c'est
  pour ca qu'on notarize uniquement la **requete STAC search** et on rejoue
  les rasters cote audit (voir `docs/web3/m4.md`).
- **Schema de l'enveloppe** : PSE peut changer le format entre v0.x et v1.0.
  Notre stub est versionne (`"version": "paraoracle-stub/v1"`) ; toute
  migration bumpe ce champ et force les backends a gerer les deux formats
  pendant une transition.

## Ordre recommande M4bis -> M5

1. M4bis.1 — Spike PoC PSE local (1 semaine)
2. M4bis.2 — Integration `_real_proof` avec tests unit (1 semaine)
3. M4bis.3 — Endpoint de verification + challenge bot branche dessus (3 jours)
4. M4bis.4 — Tests E2E : resolve -> pin real proof -> dispute bot verifie la
   proof avant de disputer (1 semaine)
