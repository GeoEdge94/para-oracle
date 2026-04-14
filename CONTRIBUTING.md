# Contributing — ParaOracle

## Workflow agents Claude Code

Chaque feature = 1 bet Notion = 1 branche git = 1+ commit + 1 PR.

### 1. Piocher une task

Aller sur [Notion Tasks database](https://app.notion.com/p/3425a7366eb181a8bde9fde00781641e)
- Filtrer : `Status = Not started` + `Assignee = you`
- Prendre le ticket avec priorite P0 d'abord
- Passer le status a `In progress`

### 2. Creer la branche

Format : `<type>/<bet-id>-<short-description>`

```bash
git checkout main
git pull
git checkout -b feat/bet-lancement-02-rioxarray-pipeline
```

Types autorises :
- `feat/` — nouvelle feature
- `fix/` — bug fix
- `refactor/` — refactoring sans changement comportement
- `docs/` — documentation uniquement
- `test/` — tests uniquement
- `chore/` — config, build, CI, deps
- `data/` — seeds, migrations, fixtures

### 3. Conventions de commits

Format : `<type>(bet-<id>): <description courte>`

```
feat(bet-lancement-02): real NDVI pipeline with rioxarray
fix(bet-design-02): CORS headers for production domain
docs(bet-analyse-01): clarify NDVI threshold convention
test(bet-controle-01): reproducibility 3 runs same hashes
chore(bet-design-04): upgrade GDAL to 3.8.1
data(bet-controle-02): import PRODES 2025 ground-truth
```

Un commit peut referencer **un seul bet**. Si tu dois toucher 2 bets → 2 commits separes.

### 4. Push granulaire

**Push a CHAQUE task completee** (pas a la fin du bet) :

```bash
# Task 1 du bet
git add backend/app/services/ndvi_pipeline.py
git commit -m "feat(bet-lancement-02): download Sentinel-2 B04/B08 assets from CDSE S3"
git push

# Task 2 du bet
git add backend/app/services/ndvi_pipeline.py
git commit -m "feat(bet-lancement-02): compute NDVI composite with xarray median"
git push
```

### 5. Mettre a jour Notion

Apres chaque commit :
1. Ouvrir la task correspondante dans Notion
2. Copier le hash du commit dans la colonne `Commit Hash`
3. Passer `Status = Done` si la task est finie
4. Remplir `Actual (h)` (temps reel passe)

### 6. PR pour cloturer le bet

Quand toutes les tasks d'un bet sont `Done` :

```bash
gh pr create --base main --head feat/bet-lancement-02-rioxarray-pipeline \
  --title "[BET-LANCEMENT-02] Real NDVI pipeline with rioxarray" \
  --body "$(cat <<'EOF'
## Bet
https://app.notion.com/p/3425a7366eb181369804f2d3b8719e53

## Hypothese
Avec credentials Copernicus, on peut telecharger, calculer NDVI et arriver au meme resultat YES/NO qu'avec des rasters de reference.

## Changes
- Download B04/B08 assets depuis CDSE S3
- Composite mediane temporelle via xarray
- Reprojection SIRGAS 2000 pour surface precise
- Clip Para polygon

## Success criteria
- [x] Pipeline retourne surface > 4000 km2
- [x] Resultat coherent avec PRODES/MapBiomas
- [x] Tests reproductibilite green

## Tasks cloturees
- Implementer NDVIPipeline._real_compute (16h)
- Gerer CRS et reprojection Para EPSG:5880 (4h)

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

Coller l'URL de la PR dans le champ `PR URL` du bet Notion.

## Branches principales

| Branche | Role |
|---|---|
| `main` | Production — protected, PR obligatoire |
| `develop` | Integration — merge des features PRs |
| `feat/*`, `fix/*`, etc. | Branches de travail |

## CI/CD

Chaque push declenche :
1. Lint backend (ruff) + frontend (eslint)
2. Type check (mypy, tsc)
3. Tests (pytest, vitest)
4. Build Docker images
5. Sur merge `main` → deploy auto

## Checklist avant merge

- [ ] Toutes les tasks du bet sont `Done` dans Notion
- [ ] CI green
- [ ] Tests ecrits pour la nouvelle feature
- [ ] Doc mise a jour si API change
- [ ] Bet status = `Done` dans Notion
- [ ] PR URL copiee dans le bet Notion
