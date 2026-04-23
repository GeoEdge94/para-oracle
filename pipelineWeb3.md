# Oracle Environnemental — Schéma du Pipeline

## Contexte

On construit un oracle de vérification environnementale on-chain. L'oracle ne prédit pas — il vérifie si un seuil observé sur des données publiques a été atteint. La question est toujours binaire. L'objectif est de rendre chaque résolution auditable par n'importe qui.

Les clients cibles sont Polymarket (résolution de marchés de prédiction climatiques) et des assureurs paramétriques (déclenchement automatique d'indemnisations sur seuil météo).

---

## Étape 1 — Ingestion Copernicus + TLSNotary

On télécharge les données météo depuis l'API Copernicus CDS (ERA5-Land, EFAS/GloFAS). Les fichiers bruts font plusieurs gigaoctets — on ne télécharge pas le fichier complet, on fait une requête API avec des paramètres précis (zone géographique en bounding box, date, variable) qui retourne uniquement le découpage qui nous intéresse, soit 50-200 Ko.

Le problème c'est que sans preuve, n'importe qui peut dire qu'on a modifié les données entre le téléchargement et le hachage. TLSNotary résout ça : c'est un protocole MPC qui s'insère dans le handshake TLS et permet à un notaire tiers d'attester que la réponse HTTP vient bien du serveur Copernicus sans altération. Le notaire public actuel c'est PSE (équipe Ethereum Foundation), open-source et self-hostable.

Ce qu'on prouve avec TLSNotary c'est la requête API exacte — zone, date, variable — pas le fichier brut complet. N'importe qui peut rejouer la même requête API et obtenir les mêmes données.

Output de cette étape : les données découpées + un TLS proof JSON signé par le notaire.

Ce qui est public : les données Copernicus (publiques de toute façon) et le TLS proof.
Ce qui est privé : l'infrastructure qui orchestre tout ça.

---

## Étape 2 — Normalisation canonique + Fingerprint SHA256

Les datasets Copernicus ont des métadonnées qui varient légèrement selon comment on les télécharge. Sans normalisation stricte, deux personnes qui téléchargent les mêmes données obtiennent des hashes différents et le système de vérification s'effondre.

On définit un schéma de normalisation strict et versionné : sort_keys=True, séparateurs fixes sans espaces, 6 décimales maximum pour les floats. On applique ce schéma sur toutes les couches ingérées, on sérialise en JSON canonique, et on fait un SHA256 de ce JSON. Ça produit un fingerprint unique et reproductible.

Les couches ingérées par défaut : total_precipitation (ERA5-Land), volumetric_soil_water (ERA5-Land SWI), river_discharge (EFAS/GloFAS), 2m_temperature (ERA5-Land).

Point critique : tout changement de version du schéma casse la compatibilité avec les audits précédents. Le schéma doit être versionné, documenté, et figé avant la mise en production.

Output : le fingerprint SHA256 + les données normalisées en JSON.

Ce qui est public : le schéma de normalisation (publié sur IPFS avec le resolution script).
Ce qui est privé : l'orchestration du pipeline.

---

## Étape 3 — Publication IPFS

On publie trois objets sur IPFS, chacun avec son propre CID (Content Identifier). IPFS adresse le contenu par son hash — impossible de modifier un fichier sans changer son CID, ce qui garantit l'immuabilité.

Les trois objets publiés :
- data.json : les données normalisées + le TLS proof + le fingerprint. C'est le seul fichier qui change à chaque résolution. Taille ~50-200 Ko après découpage sur la zone.
- resolution_script.py : le code de vérification du seuil, open-source. Publié une seule fois, référencé ensuite à chaque résolution.
- schema_v1.json : le schéma de normalisation canonique. Publié une seule fois.

Le coût de pinning est négligeable — quelques centimes par mois chez Pinata pour les volumes qu'on va générer.

Output : dataCID, scriptCID, tlsProofCID — ces trois CIDs sont ce qu'on ancre on-chain à l'étape suivante.

Tout est public sur IPFS. L'infrastructure de pinning est privée.

---

## Étape 4 — Vérification du seuil (resolution script)

Pas de modèle d'IA dans cette étape. On vérifie uniquement si une valeur observée dans les données dépasse un seuil prédéfini. C'est binaire : oui ou non.

La logique de base : on prend les valeurs de la couche concernée, on calcule le max sur la zone, on compare au seuil. Exemple : max(precipitation_values) >= 80.0 retourne True si le seuil de 80mm a été atteint.

Le script vérifie aussi l'intégrité des données : il recompute le fingerprint SHA256 depuis les données récupérées sur IPFS et vérifie que ça correspond au fingerprint soumis on-chain. Si ça ne correspond pas, c'est une preuve de falsification.

Ce script est public sur IPFS. N'importe qui peut le télécharger et l'exécuter pour vérifier n'importe quelle résolution. C'est ça qui rend le challenge automatisable.

Exemples de conditions vérifiables : précipitations > 80mm sur 24h, température > 40°C pendant 3 jours consécutifs, débit rivière > seuil d'alerte, humidité du sol < seuil de sécheresse agricole.

Output : result (bool) + observed_value (float).

---

## Étape 5 — Soumission on-chain (Polygon)

On déploie un smart contract sur Polygon. Choix de Polygon pour la compatibilité native avec Polymarket, les frais de gas bas (moins de 0.01$ par transaction), et la disponibilité d'UMA Optimistic Oracle V3.

La fonction submitResolution() ancre dans le contrat : le fingerprint SHA256 des données, le CID des données complètes sur IPFS, le CID du resolution script, le CID du TLS proof, le résultat (bool), le seuil utilisé, et le timestamp. L'oracle dépose une caution USDC en soumettant (500-1500$ selon la configuration).

La résolution est stockée en état PENDING — la dispute window s'ouvre immédiatement.

Trois pointeurs sont ainsi ancrés on-chain de façon immuable : le hash des données, les données complètes, et le code qui a produit le résultat. Ça permet à n'importe qui d'auditer la chaîne complète.

Ce qui est on-chain : tout (public et immuable).
Ce qui est privé : les clés de signing de l'opérateur oracle.

---

## Étape 6 — Dispute window

On gère notre propre dispute window via le smart contract (UMA uniquement en backstop). Ça nous évite de payer les frais UMA sur chaque résolution normale et nous donne plus de contrôle sur les délais.

La fenêtre dure 48h. Pendant cette période, n'importe qui peut challenger la résolution en déposant une caution USDC égale à celle de l'oracle. Si personne ne challenge dans les 48h, la résolution passe automatiquement en état FINALIZED et la caution de l'oracle lui est rendue.

Pour encourager les challenges légitimes, on publie un challenge bot open-source. Le bot surveille les événements ResolutionSubmitted on-chain, télécharge le resolution script depuis IPFS, rejoue la vérification avec les mêmes données, et dispute automatiquement si le résultat diverge. N'importe qui peut faire tourner ce bot.

Si quelqu'un challenge : la résolution passe en état DISPUTED et on escalade vers UMA. Les holders UMA votent et tranchent en dernier ressort. Si le challenger gagne, il récupère sa caution plus celle de l'oracle. S'il perd, il perd sa caution.

Une fois FINALIZED : le paiement de l'assurance paramétrique se déclenche automatiquement, ou le marché Polymarket se résout.

Ce qui est public : le challenge bot (open-source), la finalisation on-chain.
Ce qui est privé : le contrat de dispute window interne.

---

## Résumé public vs privé

Public et auditable par n'importe qui : les données Copernicus (source publique), le TLS proof, le schéma de normalisation, les données normalisées sur IPFS, le resolution script sur IPFS, le challenge bot, tout ce qui est on-chain.

Privé et avantage opérationnel : l'infrastructure d'ingestion et d'orchestration, le système de monitoring et d'alertes, la garantie d'uptime, les clés de signing.

Le resolution script est public parce que c'est ce qui garantit l'auditabilité. L'infrastructure est privée parce que c'est ce qu'on vend — la capacité à faire tourner ça de façon fiable, rapide, avec des garanties de disponibilité.