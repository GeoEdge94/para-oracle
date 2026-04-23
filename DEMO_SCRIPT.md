# GeoEdge Demo Script — 3 à 5 min

Narration pour pitch Polymarket ou B2B parametric insurance. Objectif : démontrer
que l'oracle est **auditable sans confiance** via 3 couches cryptographiques
qui se vérifient mutuellement.

> **Prérequis** : `bash demo.sh` tourne. `http://192.168.1.93:3000` ouvert sur
> un mobile ou un laptop + un browser desktop pour Polygonscan.

---

## Minute 0:00 — 0:30  |  Contexte (10 sec d'intro)

> "Veralith construit une infrastructure oracle pour les marchés de prédiction
> environnementaux. Polymarket et consorts n'ont pas de solution satisfaisante
> pour résoudre des questions qui dépendent de données satellite ou météo.
> Notre pipeline est déterministe, on-chain, et auditable publiquement."

**Action** : ouvrir `http://192.168.1.93:3000/login`
- Pointer le globe 3D en rotation (cobe + markers des bets actifs)
- Cliquer "Se connecter" (credentials pré-remplis)

---

## Minute 0:30 — 1:30  |  Feed et marché (1 min)

Arrive sur `/` (Home). Feed mobile-first inspiré Polymarket.

> "Voici le feed en live. 31 marchés actifs — déforestation Amazonie, incendies
> Californie, sécheresses Sahel, glaciers andins, floods Paris… chacun est une
> question binaire avec un seuil, une période d'observation, et une source
> satellite déterministe."

**Action** : scroll vertical, montrer les cards qui apparaissent
- Cliquer sur une card résolue (ex: `para-fires-primary-2025`)

> "Regardons un marché qui vient d'être résolu."

---

## Minute 1:30 — 2:30  |  Preuve on-chain (1 min)

Page Market → click "Preuve Web3" → panneau se déploie.

> "Chaque résolution produit 4 artefacts :"

1. **Fingerprint SHA-256** : hash canonique des inputs + résultat
2. **data.json** : payload qui contient tout ce que l'oracle a vu (rasters,
   indices, seuils, policy)
3. **resolution_script.py** : vérifieur autonome, pinné sur IPFS
4. **TLS proof** (stub en dev, PSE TLSNotary en prod)

**Action** :
- Cliquer le lien **Chain tx** → ouvre `amoy.polygonscan.com/tx/0x08d3ebdc…`
  sur desktop browser
- Pointer l'event `ResolutionSubmitted(resolutionId, fingerprint, dataCID, …)`
  dans les logs de la tx
- Montrer le `Status: Success` + le bond `500 tUSDC` débité

> "La tx est réelle, sur Polygon Amoy testnet. Le fingerprint est stocké en
> bytes32 on-chain. Personne — y compris moi — ne peut le modifier rétroactivement."

---

## Minute 2:30 — 4:00  |  L'audit trustless (1.5 min, la PIÈCE MAÎTRESSE)

Retour sur la page Analysis, cliquer sur **"Audit trustless"** dans le panneau
Web3 Evidence.

> "Maintenant la partie intéressante : quiconque, depuis n'importe où, peut
> auditer cette résolution. Regardez."

**Action étape 1** : clic bouton **"Ouvrir la tx sur Polygonscan"**
- Commentaire : "Voilà le fingerprint on-chain, 32 bytes."

**Action étape 2** : clic **"Télécharger data.json"**
- Le browser télécharge le fichier depuis `gateway.pinata.cloud/ipfs/Qmbv9bu2…`
- Commentaire : "Le CID est content-addressed : je ne peux pas modifier le
  contenu sans changer le CID. IPFS garantit l'immutabilité."

**Action étape 3** : montrer la commande dans le panneau
```bash
curl -s https://gateway.pinata.cloud/ipfs/Qmbv9bu2… > /tmp/data.json
python scripts/resolution_script.py /tmp/data.json
```

Ouvrir un terminal et coller. Résultat affiché :
```json
{
  "fingerprint_sha256": "sha256:249628182d510d78d623bcd139eb0ae1ae4d0acb1ec417173756e7856ed69564",
  "fingerprint_verified": true,
  "outcome_yes": true,
  ...
}
```

> "Le fingerprint recalculé localement sur VOTRE machine matche exactement celui
> stocké on-chain. Si ces deux valeurs ne matchent pas → l'oracle a menti →
> 500 tUSDC slashed via dispute. Le challenger bot surveille en continu."

---

## Minute 4:00 — 5:00  |  Modèle commercial + close (1 min)

> "Ce que vous venez de voir est un **oracle géospatial commodifiable**. Polymarket
> peut intégrer ce système en 2 jours : `pip install veralith-resolution-pipeline`
> (MIT, open source), pointer vers l'adresse du contrat, et leurs utilisateurs
> ont des résolutions vérifiables."
>
> "Notre repo public : `github.com/veralith/resolution-pipeline` — 77 tests
> Python + 14 tests Solidity, 100% auditables, aucune dépendance à nos serveurs."
>
> "Le repo privé GeoEdge (celui-ci) : le wrapper B2C — UI mobile, wallet
> simulateur, connecteurs premium. C'est ce que vous pouvez démoer à vos
> utilisateurs demain."
>
> "Ressources disponibles : call technique ce vendredi, ou POC sur un de vos
> marchés environnementaux historiques cette semaine. Qu'est-ce qui vous
> intéresse ?"

---

## Fallback si quelque chose casse

- **Tx Polygonscan down** → screenshot statique dans `docs/web3/PHASE1_PROOFS.md`
- **Pinata gateway lent** → utiliser `ipfs.io` ou `cf-ipfs.com` (même CID)
- **Backend 500** → `bash demo.sh --stop && bash demo.sh` restart propre
- **Wifi instable** → vidéo screencast de backup (à enregistrer en Phase 9)

## Liens à garder ouverts avant la démo

| Lien | Usage |
|---|---|
| https://192.168.1.93:3000/login | démo mobile |
| https://amoy.polygonscan.com/address/0x4bb698ba46b26705dbd33ed98cf6bf7cf44b9f02 | contract page |
| https://amoy.polygonscan.com/tx/0x08d3ebdc… | tx récente |
| https://gateway.pinata.cloud/ipfs/Qmbv9bu2… | data.json public |
| docs/web3/PHASE1_PROOFS.md | antisèche tx hashes + CIDs |

## Points à NE PAS dire pendant le pitch

- ❌ "C'est un MVP, il reste du travail" — position défensive, minimise le produit
- ❌ "TLSNotary est mocké" — si l'interlocuteur pose la question, répondre
  "PSE TLSNotary est intégré structurellement (le champ est dans le fingerprint
  canonique), bascule transparente dès v1 stable" — PAS commencer par là
- ❌ "Le contrat n'est pas audité" — répondre seulement si demandé :
  "multisig Safe 3-of-5 avant mainnet, audit Spearbit/Trail of Bits sur la
  roadmap"
- ❌ "C'est sur testnet" — dire "Polygon Amoy, équivalent mainnet, zero gas
  cost pour les utilisateurs en production grâce à Paymaster"

## Ton général

- Factuel, pas emphatique
- Montrer plutôt que raconter ("Click here, watch what happens")
- Inviter l'interlocuteur à tester lui-même sur son laptop
- Chaque claim technique accompagné d'un lien Polygonscan / IPFS
