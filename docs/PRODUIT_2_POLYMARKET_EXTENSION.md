# Produit 2 — SpectralViewer (extension visuelle Polymarket)

> **Nature** : Chrome extension + widget embeddable + whitelabel SDK
> **Cible commerciale** : Polymarket (priorite), Kalshi, Manifold
> **Positionnement** : Couche visuelle preuve satellite sur les marches environnementaux
> **Statut** : Spec v1.0 — en attente de validation

---

## 1. VISION & PROPOSITION DE VALEUR

### Probleme utilisateur sur Polymarket

Aujourd'hui quand un utilisateur Polymarket voit une question :

> *"Will Amazon deforestation exceed 4,200 km² in H1 2025?"*

Il voit :
- Un titre texte
- Un prix YES / NO
- Un graphique de volume
- **AUCUNE visualisation de la zone, aucune image satellite, aucune preuve**

L'utilisateur doit :
- Googler "Amazon deforestation H1 2025"
- Aller sur Mongabay, Reuters, news
- Faire confiance a un narratif texte

**Resultat** : faible engagement, pari perçu comme "abstrait", volume limite sur cette categorie.

### Notre solution : SpectralViewer

Un widget qui s'injecte sur les pages de bets Polymarket et affiche :
1. **Une carte satellite interactive** centree sur la region du bet
2. **Des couches de preuve** (PRODES, FIRMS, JRC Water, NDVI) superposables
3. **Un slider temporel** T0 → aujourd'hui
4. **Le verdict attendu** en temps reel (si oracle actif)
5. **Les hashes + CID IPFS** pour verification

**Valeur pour Polymarket** :
- Augmentation engagement (user reste plus longtemps sur la page)
- Augmentation volume sur categorie environnementale
- Badge "Verified by SpectralOracle" = credibilite
- Differenciation vs Kalshi/Manifold

**Valeur pour utilisateurs** :
- Prise de decision informee (pas de FUD)
- Audit visuel impossible ailleurs
- Experience immersive

---

## 2. CIBLE & MARCHE

### 2.1 Clients

| Client | Integration | Prix modele |
|--------|-------------|-------------|
| Polymarket | Widget officiel ou SDK | White-label 10-50k USD/mois |
| Kalshi | SDK + iframe | 5-20k USD/mois |
| Manifold Markets | Open source plugin | Gratuit + donation |
| Augur v3 | Oracle + widget | Licensing 2-10k USD/mois |
| PredictIt | White-label | 5-20k USD/mois |
| Insurely (parametric) | SDK enterprise | 50-200k USD/an |

### 2.2 Users finaux

- **Crypto traders** (~500k MAU Polymarket)
- **Environmental activists** (NGO follow + bet)
- **Journalists / researchers** (verif visuelle)
- **Institutional** (hedge funds, assureurs)

### 2.3 Distribution channels

| Canal | Audience | Cout acquisition |
|-------|----------|------------------|
| Chrome Web Store | 3B+ users | Gratuit |
| npm public | 20M devs | Gratuit |
| Polymarket partnership | 500k MAU | 0 (B2B) |
| Twitter/X crypto | 5M followers | Organic |
| DeFi podcasts | Targeted | 5-20k USD/ep |

---

## 3. ANALYSE ARCHITECTURE

### 3.1 4 modes de distribution

Le meme core de widget est distribue de 4 manieres :

```
┌────────────────────────────────────────────────────────────────┐
│                    spectral-viewer monorepo                     │
│                                                                 │
│              packages/core/  ← React + MapLibre                 │
│                        │                                         │
│     ┌──────────────────┼──────────────────┬─────────────────┐  │
│     │                  │                  │                 │   │
│     ▼                  ▼                  ▼                 ▼   │
│  chrome-ext         iframe-embed       npm-sdk          wl-app │
│  (content script)   (widget.html)      (React component) (prod) │
│                                                                 │
│  User friendly      Polymarket         Devs integrators   White  │
│  zero install       embeds in page     React apps         label  │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Architecture monorepo

```
spectral-viewer/
├── packages/
│   ├── core/                        # React components reutilisables
│   │   ├── src/
│   │   │   ├── SpectralMap.tsx      # Map principale (MapLibre)
│   │   │   ├── LayerPanel.tsx       # QGIS-style layer manager
│   │   │   ├── DateSlider.tsx       # T0 → today slider
│   │   │   ├── VerdictCard.tsx      # YES/NO + hashes
│   │   │   ├── EvidenceList.tsx     # Zones detectees
│   │   │   ├── hooks/
│   │   │   │   ├── useBetConfig.ts
│   │   │   │   ├── useLayers.ts
│   │   │   │   └── useResolution.ts
│   │   │   └── api/
│   │   │       └── spectralOracleClient.ts
│   │   └── package.json             # publie @spectral-viewer/core
│   │
│   ├── chrome-extension/            # Injection automatique sur polymarket.com
│   │   ├── manifest.v3.json
│   │   ├── content/
│   │   │   ├── detector.ts          # Detecte bet pages environnementaux
│   │   │   └── injector.ts          # Inject widget div
│   │   ├── background/
│   │   │   └── service_worker.ts
│   │   ├── popup/
│   │   │   ├── Popup.tsx            # Settings user
│   │   │   └── popup.html
│   │   └── icons/
│   │
│   ├── embed/                       # iframe embed (widget.spectral-oracle.io)
│   │   ├── public/
│   │   │   └── index.html
│   │   ├── src/
│   │   │   └── main.tsx             # Standalone app
│   │   └── vite.config.ts
│   │
│   ├── sdk/                         # npm @spectral-viewer/react
│   │   ├── src/
│   │   │   └── SpectralViewer.tsx   # Wrapper pour devs
│   │   └── package.json
│   │
│   └── whitelabel/                  # App complete pour B2B enterprise
│       ├── src/
│       └── Dockerfile
│
├── landing/                         # Site marketing spectral-viewer.io
│   ├── pages/
│   │   ├── index.tsx                # Hero + demo
│   │   ├── polymarket.tsx           # Case study Polymarket
│   │   ├── pricing.tsx
│   │   └── docs.tsx
│   └── next.config.js
│
├── demo/                            # Demos interactives par categorie
│   ├── deforestation.html
│   ├── wildfire.html
│   ├── flood.html
│   └── glacier.html
│
└── docs/
    ├── INTEGRATION_POLYMARKET.md
    ├── CHROME_EXTENSION.md
    ├── SDK_REFERENCE.md
    └── DESIGN_SYSTEM.md
```

### 3.3 Flux user Chrome extension

```
1. User installe "SpectralViewer" depuis Chrome Web Store
2. User navigue sur polymarket.com
3. Content script detecte la page bet :
   ├─ Regex URL /event/... ou /market/...
   ├─ Parse le titre du bet
   ├─ Call SpectralOracle API : "Quelle BetConfig correspond a ce titre ?"
   └─ Si match > 0.8 confidence → injection widget
4. Widget se greffe sous le panel "About" de Polymarket
5. User scroll, voit :
   ├─ Carte satellite de la zone concernee
   ├─ Bouton "Voir la preuve satellite" → deplie widget full
   ├─ Timeline T0/T1
   ├─ Cadastres officiels (PRODES, FIRMS, etc.)
   └─ Verdict attendu + hashes
6. Si le bet est resolu : lien direct vers preuve IPFS + signature on-chain
```

### 3.4 Flux developpeur SDK

```tsx
// Integration dans un site tiers (ex: Kalshi, site NGO)
import { SpectralViewer } from '@spectral-viewer/react';

function BetDetailPage({ betId }) {
  return (
    <div>
      <h1>Will Amazon deforestation exceed 4,200 km²?</h1>
      <BuySellPanel />

      <SpectralViewer
        betConfigUrl="https://spectral-oracle.io/catalog/para-deforestation-2025-s1.yaml"
        theme="dark"
        height={500}
        onProofLoaded={(proof) => console.log('proof', proof)}
        showVerdict={true}
        showLayers={['prodes-accumulated', 'deter-amz', 'delta-ndvi']}
      />
    </div>
  );
}
```

### 3.5 Flux embed iframe

```html
<!-- Sur n'importe quel site -->
<iframe
  src="https://widget.spectral-oracle.io/embed/para-deforestation-2025-s1?theme=dark"
  width="100%"
  height="500"
  frameborder="0"
  loading="lazy"
/>
```

---

## 4. CAHIER DES CHARGES FONCTIONNEL

### 4.1 Fonctionnalites MVP (v1.0)

| ID | Fonctionnalite | Priorite |
|----|----------------|----------|
| F-01 | Carte MapLibre avec basemap satellite ESRI | P0 |
| F-02 | Rendu du polygon region avec highlight anime | P0 |
| F-03 | Couches proof_layers chargees automatiquement | P0 |
| F-04 | Date slider T0 → aujourd'hui | P0 |
| F-05 | Panel verdict YES/NO avec hashes copiables | P0 |
| F-06 | Theme dark + light | P0 |
| F-07 | Responsive mobile + desktop | P0 |
| F-08 | i18n FR + EN | P1 |
| F-09 | Chrome extension avec auto-detection polymarket.com | P0 |
| F-10 | Widget iframe embed | P0 |
| F-11 | SDK npm @spectral-viewer/react | P1 |
| F-12 | Animation fly-to region au load | P1 |
| F-13 | Split-screen T0 vs T1 (swipe compare) | P1 |
| F-14 | Partage social (Twitter card avec preview) | P2 |
| F-15 | White-label (theming + logo custom) | P2 |
| F-16 | Analytics (Plausible, self-hosted) | P2 |

### 4.2 User stories

**US-01** : *En tant qu'utilisateur Polymarket, je veux voir la carte de la zone concernee quand je lis un bet environnemental, sans quitter la page.*

**US-02** : *En tant que developpeur Kalshi, je veux embarquer un widget avec 3 lignes de code qui montre la preuve satellite du bet.*

**US-03** : *En tant que DAO oracle, je veux rediriger mes users vers un widget public qui prouve la resolution avec IPFS + signature.*

**US-04** : *En tant que journaliste, je veux partager un lien qui affiche la preuve visuelle d'un bet resolu.*

**US-05** : *En tant qu'admin Polymarket, je veux white-labeler le widget aux couleurs de notre brand.*

### 4.3 Critères d'acceptation

- Temps de chargement initial : < 2s
- First paint map : < 1.5s
- Taille bundle SDK : < 150 KB gzipped
- Chrome extension taille : < 500 KB
- Uptime widget iframe : 99.9%
- Accessibility : WCAG AA

---

## 5. CAHIER DES CHARGES TECHNIQUE

### 5.1 Stack

| Layer | Technologie | Justification |
|-------|-------------|---------------|
| Framework | React 18 | Compatible partout |
| Lang | TypeScript 5 | Type safety |
| Build | Vite 5 | Fast HMR |
| Map | MapLibre GL JS 4 | Open source, WebGL |
| Styling | CSS modules + CSS vars | Theming facile |
| State | Zustand | Leger, suffisant |
| HTTP | axios ou fetch | Standard |
| i18n | Meme i18n context que para-oracle | Reuse |
| Chrome ext | Manifest V3 + content_scripts | Standard Chrome |
| Iframe | postMessage API | Communication parent |
| SDK | Tree-shakeable ESM | < 150KB |

### 5.2 Design system

**Palette** (reprise du frontend existant) :
```css
--bg: #0f172a;
--card: #1e293b;
--border: #334155;
--accent: #10b981;
--yes: #34d399;
--no: #f87171;
--warning: #fbbf24;
```

**Typographie** :
- System font stack
- 3 tailles : 11px (micro), 13px (body), 20px (titre)

**Composants** :
- Tout depuis le frontend para-oracle existant (LayerPanel, DateSelector, Legend, VerdictPanel, EvidenceDetail)
- Portables en package `@spectral-viewer/core`

### 5.3 Architecture de communication

#### Chrome extension

```
┌─────────────────────────────────────────┐
│  polymarket.com (page user)              │
│                                          │
│   ┌────────────────┐                     │
│   │  Content Script│                     │
│   │  (injector.ts) │                     │
│   └──────┬─────────┘                     │
│          │ postMessage                   │
│          ▼                               │
│   ┌────────────────┐                     │
│   │  Widget iframe │                     │
│   │  (sandboxed)   │                     │
│   └──────┬─────────┘                     │
└──────────┼───────────────────────────────┘
           │ fetch()
           ▼
  https://api.spectral-oracle.io
  (CORS-enabled)
```

#### Embed iframe

```
Parent page (any domain)
    │ iframe src
    ▼
widget.spectral-oracle.io/embed/:betId
    │ fetch BetConfig
    ▼
api.spectral-oracle.io/v1/catalog/:betId
    │ fetch tiles
    ▼
tiles.spectral-oracle.io/tiles/... (CloudFront)
```

#### React SDK

```tsx
<SpectralViewer betConfigUrl="..." />
    │ mounts component
    ▼
Internally uses @spectral-viewer/core
    │ fetches
    ▼
api.spectral-oracle.io (or self-hosted)
```

### 5.4 Securite Chrome extension

- Manifest V3 strict
- Permissions minimales : `activeTab`, `storage`
- Host permissions : uniquement `*://polymarket.com/*` et `*://*.spectral-oracle.io/*`
- Pas de `eval`, pas d'inline scripts
- Content Security Policy stricte
- Review Google Chrome Web Store

### 5.5 Performance

- Lazy load MapLibre (< 1.5s LCP)
- Tile cache via service worker
- Pre-fetch tuiles T0/T1 au hover du widget
- React.lazy() pour panels secondaires
- Bundle split : core / optional / themes

---

## 6. INTEGRATION POLYMARKET — STRATEGIE

### 6.1 Voie 1 : Partenariat officiel

- Pitch direct a Polymarket (co-founder ou Head of Product)
- Proposer white-label + revenue share
- SLA : uptime 99.9%, support 24/7
- Contrat 12-36 mois

### 6.2 Voie 2 : Growth hack (extension user)

- Publier Chrome extension "ParaView" (nom nouveau)
- Marketing aupres users Polymarket via Twitter/Discord/Reddit
- Atteindre 10k installs
- Utiliser traction comme levier de negotiation Polymarket

### 6.3 Voie 3 : Open source → adoption viral

- Publier `@spectral-viewer/core` sur GitHub + npm (MIT)
- Communiquer dans cercles DeFi/Web3 builders
- Laisser la communaute integrer sur leurs apps
- Polymarket finit par integrer par pression user

### 6.4 Arguments de vente

**Pour Polymarket Leadership** :
- "30% de vos users abandonnent un bet environnemental faute de preuve visuelle" (hypothese a valider)
- "Un widget +15s temps passe par page = +8% conversion" (A/B test)
- "Differenciation vs Kalshi : pas d'equivalent satellite"
- "SEO boost via contenu riche (crawlable)"
- "Badge 'Satellite verified' augmente trust score"

---

## 7. MODELE BUSINESS

### 7.1 Pricing

| Tier | Prix | Features | Cible |
|------|------|----------|-------|
| **OSS Free** | 0 | Chrome ext + iframe limits | Users / OSS |
| **Pro Dev** | 49 USD/mois | SDK + 10k impressions/mois | Small dev |
| **Pro** | 499 USD/mois | Unlimited + analytics | Mid markets |
| **Enterprise** | Custom | White-label + SLA | Polymarket, Kalshi |
| **Revenue share** | 0.5-2% du volume | Platform deals | Polymarket deal |

### 7.2 Cibles commerciales

| Delai | Objectif |
|-------|----------|
| Semaine 8 | Chrome extension live + 100 installs |
| Semaine 16 | 5 000 installs + premier contrat B2B 2 000 USD/mois |
| Mois 6 | 25 000 installs + contrat Kalshi 10k USD/mois |
| Mois 12 | Deal Polymarket signe 50-200k USD/mois |

### 7.3 Metriques succes

- Chrome Web Store rating : > 4.5 etoiles
- Installs : 25k en 6 mois
- MAU widget : 100k (iframe + extension)
- Temps median passe avec widget : > 20s
- Conversion B2B (SDK → contrat) : > 5%
- Revenue Y1 : 200-500k USD

---

## 8. TODO — ROADMAP PRIORISEE

### Sprint 1 (Semaine 1-2) — Extraction core

- [ ] Creer repo `geoedge/spectral-viewer`
- [ ] Extraire composants depuis `para-oracle/frontend/src/components/` :
  - LayerPanel, DateSelector, Legend, VerdictPanel, EvidenceDetail, StatusBadge
- [ ] Extraire `lib/mapLayers.ts`, `lib/layerCategories.ts`, `lib/i18n.tsx`
- [ ] Package `packages/core/` avec tsup + tree-shaking
- [ ] Publier `@spectral-viewer/core` npm v0.1.0

### Sprint 2 (Semaine 3-4) — Iframe embed

- [ ] Package `packages/embed/` avec Vite
- [ ] Route `/embed/:betId` qui fetch BetConfig + render
- [ ] Deploy sur widget.spectral-oracle.io (Cloudflare Pages ou Vercel)
- [ ] postMessage API pour resize auto
- [ ] Tester integration sur un site tiers demo

### Sprint 3 (Semaine 5-6) — Chrome extension

- [ ] Package `packages/chrome-extension/`
- [ ] Manifest V3 + content_scripts
- [ ] Detecteur URL Polymarket + extraction titre
- [ ] Matcher title → BetConfig via API `/match`
- [ ] Injection widget iframe au bon endroit de la page
- [ ] Icon + popup settings (theme, langue)
- [ ] Soumission Chrome Web Store

### Sprint 4 (Semaine 7-8) — SDK React

- [ ] Package `packages/sdk/` avec API simple
- [ ] Composant `<SpectralViewer betConfigUrl=... />`
- [ ] Props documentees (theme, height, layers, callbacks)
- [ ] Tests Jest + Storybook
- [ ] Publier `@spectral-viewer/react` npm v1.0

### Sprint 5 (Semaine 9-10) — Landing + docs

- [ ] Site `spectral-viewer.io` (Next.js)
- [ ] Demos live par categorie (deforestation, wildfire, etc.)
- [ ] Playground interactif (code editor + preview)
- [ ] Docs integration (3 exemples)
- [ ] Pricing page

### Sprint 6 (Semaine 11-12) — Marketing

- [ ] Video demo 90s (Polymarket before/after)
- [ ] Threads Twitter (@polymarket, @kalshi tag)
- [ ] Post Reddit r/Polymarket, r/DeFi
- [ ] Outreach : 20 devs Polymarket-adjacent
- [ ] Launch Chrome extension + HN post
- [ ] Podcast appearance (Unchained, Bankless)

### Sprint 7 (Semaine 13-14) — White-label

- [ ] Package `packages/whitelabel/` avec theming variables
- [ ] Config YAML pour custom brand (colors, logo, fonts)
- [ ] Sales deck B2B (12 slides)
- [ ] Outreach Kalshi + Manifold + PredictIt
- [ ] Premier contrat pilote

### Sprint 8 (Semaine 15-16) — Polymarket pitch

- [ ] Demo personnalisee pour Polymarket (3 bets env actifs)
- [ ] Deck commercial avec ROI (temps, engagement, conversion)
- [ ] Pitch call avec Polymarket team
- [ ] LOI + contrat pilote
- [ ] Integration production

---

## 9. DESIGN MOCKUPS (a produire)

### 9.1 Vue desktop Polymarket avec widget

```
┌─────────────────────────────────────────────────────────────────┐
│  polymarket.com/event/amazon-deforestation-2025          [$]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Will Amazon deforestation exceed 4,200 km² in H1 2025?         │
│                                                                  │
│  ┌────────────────┐  ┌────────────────────────────────────┐    │
│  │  YES 68¢       │  │  [chart volume]                     │    │
│  │  NO  32¢       │  │                                     │    │
│  └────────────────┘  └────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  🛡️ SATELLITE PROOF (SpectralViewer)                  │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  [Interactive MapLibre map]                  │     │    │
│  │  │   - Para region highlighted                  │     │    │
│  │  │   - PRODES layer overlay                     │     │    │
│  │  │   - Date slider: Jan → Jun 2025              │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │  Detected: 5,052 km²  │  Threshold: 4,200 km²        │    │
│  │  Expected outcome: YES  │  [Verify proof] [IPFS link] │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  About this market                                               │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Vue mobile

Widget collapse par defaut, bouton "View satellite proof" qui deplie.

---

## 10. RISQUES & MITIGATION

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Polymarket bloque Chrome ext | Haut | Moyenne | Voie SDK + iframe embed |
| Chrome Web Store rejette | Moyen | Faible | Review strict + permissions minimales |
| Bug widget sur cert bets | Moyen | Moyenne | Monitoring + circuit breaker |
| Polymarket build en interne | Critique | Moyenne | Lock-in via partnership formel |
| Performance sur mobile | Moyen | Moyenne | Service worker + lazy load |
| Rejet SEO Polymarket | Faible | Faible | JSON-LD + SSR du widget |

---

## 11. SYNERGIE AVEC PRODUIT 1

Le Produit 2 (viewer) consomme **le Produit 1** (oracle pipeline) :

```
SpectralOracle (Produit 1)
  │ fournit
  ▼
BetConfig + proof + hashes + IPFS
  │ consomme
  ▼
SpectralViewer (Produit 2)
  │ affiche visuellement
  ▼
User final (Polymarket, Kalshi, ...)
```

**Strategie commerciale combinee** :
- Vendre les 2 ensemble en Enterprise (Polymarket deal global)
- Oracle seul pour on-chain markets (Augur, DAOs)
- Viewer seul pour sites sans logique resolution
- Bundle = 20% discount

**Objectif 12 mois** : 5 clients utilisant les 2 produits, ARR combine 1-2M USD.
