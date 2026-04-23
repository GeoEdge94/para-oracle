# Security Policy — GeoEdge / Veralith

## Reporting a vulnerability

Report suspected vulnerabilities privately to **matthieu.barraque@efrei.net**.
Do NOT open a public GitHub issue for security matters.

We acknowledge reports within 48 hours and aim to ship a fix within 14 days
for high-severity issues. Coordinated disclosure is preferred; we will credit
reporters unless anonymity is requested.

## Secret management policy

This project handles three kinds of secrets:

| Tier | Examples | Where it lives |
|---|---|---|
| T0 — private keys | `ORACLE_PRIVATE_KEY`, `CHALLENGER_PRIVATE_KEY`, `PRIVATE_KEY` (Foundry) | Local `.env` (dev), Fly.io secrets (prod), never in repo, never in CI logs |
| T1 — API tokens | `PINATA_JWT`, `CDS_API_KEY`, `SENTINEL_HUB_CLIENT_SECRET` | Local `.env`, Fly.io secrets, never in repo |
| T2 — dev defaults | `JWT_SECRET` placeholder, `POSTGRES_PASSWORD=paraoracle_dev` | `.env.example` allowed (clearly labelled "change me in prod") |

### Operational rules

- `.env` is git-ignored and MUST NEVER be tracked (`.gitignore` enforces)
- Every environment variable that takes a T0/T1 value is declared EMPTY in `.env.example`
- `scripts/security/audit-secrets.sh` runs in CI and blocks merges on leak patterns
- Pre-commit hook (`detect-secrets`) runs locally to catch leaks before push
- Oracle, deployer and challenger use **three distinct wallets**. If one is
  compromised, rotation affects only that role

### Rotation procedure

If a T0 secret is suspected leaked:

1. **Immediately** generate a new wallet / token (do NOT reuse the compromised one)
2. Transfer remaining tUSDC / MATIC to the new wallet via a fresh tx
3. Update `.env` (dev) or `fly secrets set` (prod)
4. Force-clean git history if leak committed:
   ```bash
   bfg --delete-files .env --no-blob-protection
   git push --force --all
   git push --force --tags
   ```
5. For on-chain roles: if `ORACLE_PRIVATE_KEY` was used to `submitResolution`, the
   resolutions it produced remain valid on-chain — do NOT attempt to dispute them
   retroactively. Just retire the wallet from submitting new ones
6. File an incident note in `docs/security/incidents/YYYY-MM-DD.md` (private repo
   only, not the public one)

## Deployment security baseline

Before any production deploy:

- [ ] `bash scripts/security/audit-secrets.sh` returns exit 0
- [ ] `pip-audit` and `npm audit` report 0 high/critical vulnerabilities
- [ ] Container runs as non-root (`USER 1000` in Dockerfile)
- [ ] TLS enforced via HSTS preload header
- [ ] CSP header restricts `script-src` to `'self'`, `connect-src` whitelists
      Pinata + Polygon RPC + Polygonscan only
- [ ] CORS whitelist limited to `geoedge.app` and `localhost:3000` (dev)
- [ ] Rate limiting active on `/auth/login` (5 req/min) and `/oracle/resolve/{slug}`
      (10 req/h per IP)
- [ ] Contract ownership on mainnet → multisig Safe 3-of-5 (Amoy testnet MAY
      stay EOA-owned)
- [ ] `JWT_SECRET` is a 32-byte random value set via secret manager, not in
      `.env`

## Smart contract trust model

**On Polygon Amoy testnet (chainId 80002):**
- `ParaOracle` at `0x4bb698ba46b26705dbd33ed98cf6bf7cf44b9f02` — owner is an EOA
  (`0x7345C1f74A12E00F18AcE5b624612131D5878828`). Owner can resolve disputes
  but CANNOT seize the 500 tUSDC bond without going through the dispute flow.
- `MockERC20` (tUSDC) at `0x6805913b53124e6600b420816bfe23631c187691` — mintable
  test token, zero real-money value.

**Before mainnet deploy:**
- Contract ownership MUST be transferred to a multisig (Gnosis Safe 3-of-5)
- USDC address MUST be the canonical Polygon USDC, not a mock
- Bond amount MAY be recalibrated to reflect gas cost + acceptable challenger
  incentive
- External audit recommended (Spearbit, Trail of Bits, OpenZeppelin) for any
  contract holding real user funds

## Dependencies

Automated scanning via `pip-audit` (Python) and `npm audit` (Node) runs on
every CI build. Dependency upgrades are automated via Dependabot with
grouped minor/patch PRs (weekly).

We do NOT auto-merge security updates for on-chain libraries (`web3.py`,
`eth-account`, `foundry`, `hardhat`) — these require manual review because
subtle API changes can alter the determinism of the resolution pipeline.

## Audit trail

Every published oracle resolution is publicly auditable:

1. Read `resolution.fingerprint` from `ParaOracle.resolutions()` on-chain
2. Download `data.json` from Pinata gateway via `resolution.dataCID`
3. Run `python scripts/resolution_script.py data.json`
4. Compare the printed `fingerprint_sha256` with the on-chain value

If the hashes match, the oracle did not tamper with the outcome. If they
mismatch, a challenger bot (`bot/challenger.py`) will submit a `dispute()`
call within the 48-hour window, locking a counter-bond. The contract owner
(multisig in prod) arbitrates and the losing side forfeits the bond.
