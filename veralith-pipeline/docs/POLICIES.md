# Veralith Policy DSL

Policies are **declarative YAML files**. No Python code. Versioned. Hash-pinnable.

## File schema

```yaml
id: <unique-policy-id>          # ex: "wildfire-default-v1"
version: <semver>               # ex: "1.0.0"
event_type: <EventType.value>   # wildfire | flood | earthquake | storm | hurricane | tornado

aggregation: <method>           # count | sum_severity | max_severity | weighted_count
threshold: <float>              # YES if aggregated_value > threshold

allowed_sources:                # whitelist sources eligible
  - NASA_FIRMS
  - EFFIS
  - NOAA

min_sources_agree: <int>        # quorum (else INDETERMINATE)
min_confidence: <float>         # filter events: confidence >= this
min_severity: <float>           # filter events: severity >= this (skipped if event.severity is None)
```

## Aggregation methods

| Method | Formule | Quand l'utiliser |
|--------|---------|------------------|
| `count` | `len(events)` | Quand chaque event est equivalent (compter feux detectes) |
| `sum_severity` | `sum(severity)` | Cumul d'intensite (total surface brulee proxy) |
| `max_severity` | `max(severity)` | Un seul event severe suffit (inondation grave, magnitude max) |
| `weighted_count` | `sum(conf × (1 + severity))` | Pondere par fiabilite source ET intensite |

## Outcomes

| Outcome | Condition |
|---------|-----------|
| `YES` | quorum atteint **ET** `aggregated_value > threshold` |
| `NO` | quorum atteint **ET** `aggregated_value <= threshold` |
| `INDETERMINATE` | quorum non atteint (`< min_sources_agree`) |

`INDETERMINATE` doit etre traite par le client comme "non resolu" — pas equivalent a NO.

## Quorum (`min_sources_agree`)

Le pipeline garantit que au moins N sources distinctes ont contribue avec des events eligibles. C'est une protection contre :
- panne d'une source (NASA FIRMS down)
- biais d'une source unique
- attaque par injection (corrompre une seule API)

Pour `earthquake`, `min_sources_agree: 1` car USGS = autorite mondiale unique. Pour `wildfire`, on exige 2+ sources (NASA + EFFIS minimum).

## Versioning + reproductibilite

- Le hash du fichier YAML est inclus dans `EvidenceBundle.canonical_dict()` via `policy_version`
- Toute modif de seuil → bumper `version` et publier comme nouvelle policy
- Les anciennes policies restent valides pour les bets historiques

## Templates fournis

| File | Aggregation | Threshold | Sources | Quorum |
|------|-------------|-----------|---------|--------|
| `wildfire.yaml` | `weighted_count` | 5.0 | NASA_FIRMS, EFFIS, NOAA | 2 |
| `flood.yaml` | `max_severity` | 0.66 | NOAA, VIGICRUES | 1 |
| `earthquake.yaml` | `max_severity` | 0.5 (≈M5.5) | USGS | 1 |

## Custom policy example

```yaml
# Burnt area > 10 000 ha en zone Mediterraneenne, Juillet-Septembre
id: med-wildfire-summer-v2
version: 2.0.0
event_type: wildfire

aggregation: sum_severity      # cumul severite ≈ surface brulee
threshold: 2.0                  # ≈ 10 000 ha (chaque event severity max=1)

allowed_sources:
  - EFFIS                       # priorite EFFIS pour Europe
  - NASA_FIRMS

min_sources_agree: 2
min_confidence: 0.7
min_severity: 0.4
```

## Validation policy

```python
from veralith_pipeline.resolution import Policy

policy = Policy.from_yaml("./my-policy.yaml")
# Pydantic-like dataclass; raises if required fields missing.
```

## Anti-patterns

- ❌ `threshold: 0` → tout est YES, inutile
- ❌ `min_sources_agree: 0` → casse la protection quorum
- ❌ `min_confidence: 0.0` → laisse passer les bruits
- ❌ Multiple policies meme `id` → ambiguite version
