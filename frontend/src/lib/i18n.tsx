import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "fr" | "en";
export type Currency = "EUR" | "USD";

type Translations = Record<string, Record<string, string | string[]>>;

const fr: Translations = {
  common: {
    loading: "Chargement...",
    close: "Fermer",
    reduce: "Reduire",
    show: "Afficher",
    hide: "Masquer",
    next: "Suivant",
    letsgo: "C'est parti !",
    back: "Retour",
    copy: "Copier",
    skip: "Passer",
  },
  auth: {
    subtitle: "Oracle Sentinel-2 · Para deforestation",
    password_label: "Mot de passe (mock)",
    login_btn: "Se connecter",
    login_loading: "Connexion...",
    demo_hint: "Demo mock — n'importe quel mail/mdp fonctionne",
    error: "Erreur de connexion. Backend accessible ?",
  },
  map: {
    bets_on_zone: "{n} paris sur cette zone",
  },
  analysis: {
    title: "Analyse NDVI",
    show_details: "Afficher details",
    threshold_label: "Seuil : {value} {unit} · Seuil NDVI : Δ < -{drop}",
    result: "Resultat",
    surface: "Surface deforestee",
    resolve_btn: "Declencher l'oracle",
    resolving: "Resolution en cours...",
    show_zones: "Voir les {n} zones detectees",
    hide_zones: "Masquer les preuves",
    evidence_title: "Preuves",
    sentinel_scenes: "Produits Sentinel-2 : {n} scenes",
  },
  betsheet: {
    resolved_yes: "Resolu · YES",
    resolved_no: "Resolu · NO",
    period: "Periode",
    threshold: "Seuil",
    index: "Indice",
    source: "Source",
    surface: "Surface deforestee",
    surface_measured: "Surface mesuree",
    view_analysis: "Voir l'analyse NDVI",
    view_on_map: "Voir sur la carte",
  },
  market: {
    title: "Marche",
    bets_count: "{n} paris",
    odds: "cote {v}",
    your_position: "Votre position",
    staked: "{amount} mise",
    activity: "Activite du marche",
  },
  verdict: {
    title: "Verdict oracle",
    above: "Deforestation superieure au seuil",
    below: "Deforestation inferieure au seuil",
    detected: "Detecte",
    above_short: "au-dessus",
    below_short: "en-dessous",
    of_threshold: "du seuil",
    geo_sources: "Sources geospatiales",
    payout_split: "Repartition des gains",
    pool_winners: "Pool gagnants",
    winners: "{n} gagnants",
    pool_losers: "Pool perdants",
    losers: "{n} perdants",
    tab_result: "Resultat",
    tab_sources: "Preuves",
    tab_payouts: "Paiements",
  },
  zones: {
    detected: "Zones detectees",
    confidence: "Confiance",
  },
  categories: {
    all: "Tous",
    deforestation: "Deforestation",
    wildfire: "Feux",
    flood: "Inondation",
    mining: "Mines",
    drought: "Secheresse",
    urban: "Urbanisation",
    water_quality: "Qualite eau",
    in_progress: "En cours",
  },
  layers: {
    title: "Couches",
    show_layer: "Afficher",
    hide_layer: "Masquer",
    opacity: "Opacite {pct}%",
    move_up: "Monter",
    move_down: "Descendre",
    basemap: "Fonds de carte",
    satellite: "Imagerie satellite",
    verified: "Cadastres deforestation",
    ndvi: "NDVI / pipeline",
    fire: "Feux actifs",
    vector: "Vecteurs",
  },
  date: {
    months_short: ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"],
    period_start: "Debut periode : {d}",
    period_end: "Fin periode : {d}",
    today: "Aujourd'hui",
    custom_date: "Date personnalisee",
    prev_day: "Jour precedent",
    next_day: "Jour suivant",
    affected: "{n} couche{s} NASA affectee{s}",
    latest_imagery: "Derniere imagerie disponible (J-1)",
  },
  legend: {
    mask_title: "Masque deforestation",
    mask_label: "Δ NDVI < -0.3",
    delta_title: "Δ NDVI (T1 − T0)",
    ndvi_title: "NDVI",
  },
  status: {
    live: "Copernicus LIVE",
    mock: "Mode demo",
  },
  onboarding: {
    step0_title: "Carte interactive",
    step0_desc: "Pincez pour zoomer, glissez pour naviguer dans la zone d'analyse.",
    step1_title: "Retour",
    step1_desc: "Appuyez ici pour revenir a la liste des paris.",
    step2_title: "Selecteur de date",
    step2_desc: "Choisissez T0, T1 ou une date personnalisee pour voir l'evolution des couches satellite.",
    step3_title: "Couches",
    step3_desc: "Activez ou desactivez les couches NDVI, cadastres et imagerie satellite.",
    step4_title: "Details du pari",
    step4_desc: "Glissez vers le bas pour masquer, vers le haut pour afficher les details et le resultat.",
  },
  wallet: {
    title: "Portefeuille",
    balance: "Solde",
    total_won: "Total gagne",
    total_lost: "Total perdu",
    pnl: "PnL",
    roi: "ROI",
    place_bet: "Placer un pari",
    amount: "Montant",
    position: "Position",
    confirm: "Confirmer le placement",
    placing: "Placement en cours...",
    insufficient: "Solde insuffisant",
    success: "Pari place avec succes !",
    potential_payout: "Payout potentiel",
    odds: "Cote",
    reset: "Reinitialiser a 10 000",
    reset_confirm: "Solde reinitialise",
    history: "Historique",
    no_bets: "Aucun pari place",
    leaderboard: "Classement",
    rank: "Rang",
    player: "Joueur",
    simulator: "Simulateur",
  },
};

const en: Translations = {
  common: {
    loading: "Loading...",
    close: "Close",
    reduce: "Collapse",
    show: "Show",
    hide: "Hide",
    next: "Next",
    letsgo: "Let's go!",
    back: "Back",
    copy: "Copy",
    skip: "Skip",
  },
  auth: {
    subtitle: "Sentinel-2 Oracle · Para deforestation",
    password_label: "Password (mock)",
    login_btn: "Sign in",
    login_loading: "Signing in...",
    demo_hint: "Mock demo — any email/password works",
    error: "Connection error. Is backend reachable?",
  },
  map: {
    bets_on_zone: "{n} bets on this area",
  },
  analysis: {
    title: "NDVI Analysis",
    show_details: "Show details",
    threshold_label: "Threshold: {value} {unit} · NDVI threshold: Δ < -{drop}",
    result: "Result",
    surface: "Deforested area",
    resolve_btn: "Trigger oracle",
    resolving: "Resolving...",
    show_zones: "View {n} detected zones",
    hide_zones: "Hide evidence",
    evidence_title: "Evidence",
    sentinel_scenes: "Sentinel-2 products: {n} scenes",
  },
  betsheet: {
    resolved_yes: "Resolved · YES",
    resolved_no: "Resolved · NO",
    period: "Period",
    threshold: "Threshold",
    index: "Index",
    source: "Source",
    surface: "Deforested area",
    surface_measured: "Measured area",
    view_analysis: "View NDVI analysis",
    view_on_map: "View on map",
  },
  market: {
    title: "Market",
    bets_count: "{n} bets",
    odds: "odds {v}",
    your_position: "Your position",
    staked: "{amount} staked",
    activity: "Market activity",
  },
  verdict: {
    title: "Oracle verdict",
    above: "Deforestation exceeds threshold",
    below: "Deforestation below threshold",
    detected: "Detected",
    above_short: "above",
    below_short: "below",
    of_threshold: "threshold",
    geo_sources: "Geospatial sources",
    payout_split: "Payout distribution",
    pool_winners: "Winners pool",
    winners: "{n} winners",
    pool_losers: "Losers pool",
    losers: "{n} losers",
    tab_result: "Result",
    tab_sources: "Evidence",
    tab_payouts: "Payouts",
  },
  zones: {
    detected: "Detected zones",
    confidence: "Confidence",
  },
  categories: {
    all: "All",
    deforestation: "Deforestation",
    wildfire: "Wildfires",
    flood: "Flooding",
    mining: "Mining",
    drought: "Drought",
    urban: "Urbanization",
    water_quality: "Water quality",
    in_progress: "In progress",
  },
  layers: {
    title: "Layers",
    show_layer: "Show",
    hide_layer: "Hide",
    opacity: "Opacity {pct}%",
    move_up: "Move up",
    move_down: "Move down",
    basemap: "Basemaps",
    satellite: "Satellite imagery",
    verified: "Deforestation cadastres",
    ndvi: "NDVI / pipeline",
    fire: "Active fires",
    vector: "Vectors",
  },
  date: {
    months_short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    period_start: "Period start: {d}",
    period_end: "Period end: {d}",
    today: "Today",
    custom_date: "Custom date",
    prev_day: "Previous day",
    next_day: "Next day",
    affected: "{n} NASA layer{s} affected",
    latest_imagery: "Latest available imagery (D-1)",
  },
  legend: {
    mask_title: "Deforestation mask",
    mask_label: "Δ NDVI < -0.3",
    delta_title: "Δ NDVI (T1 − T0)",
    ndvi_title: "NDVI",
  },
  status: {
    live: "Copernicus LIVE",
    mock: "Demo mode",
  },
  onboarding: {
    step0_title: "Interactive map",
    step0_desc: "Pinch to zoom, drag to navigate the analysis area.",
    step1_title: "Go back",
    step1_desc: "Tap here to return to the bet list.",
    step2_title: "Date selector",
    step2_desc: "Choose T0, T1 or a custom date to view satellite layer changes over time.",
    step3_title: "Layers",
    step3_desc: "Toggle NDVI, cadastre and satellite layers on or off.",
    step4_title: "Bet details",
    step4_desc: "Swipe down to hide, swipe up to show details and results.",
  },
  wallet: {
    title: "Wallet",
    balance: "Balance",
    total_won: "Total won",
    total_lost: "Total lost",
    pnl: "PnL",
    roi: "ROI",
    place_bet: "Place bet",
    amount: "Amount",
    position: "Position",
    confirm: "Confirm placement",
    placing: "Placing...",
    insufficient: "Insufficient balance",
    success: "Bet placed successfully!",
    potential_payout: "Potential payout",
    odds: "Odds",
    reset: "Reset to 10,000",
    reset_confirm: "Balance reset",
    history: "History",
    no_bets: "No bets placed",
    leaderboard: "Leaderboard",
    rank: "Rank",
    player: "Player",
    simulator: "Simulator",
  },
};

const LOCALES: Record<Locale, Translations> = { fr, en };

const EUR_USD_RATE = 1.08;

type Localizable = { question: string; question_en?: string | null; description?: string | null; description_en?: string | null };

type I18nCtx = {
  locale: Locale;
  currency: Currency;
  setLocale: (l: Locale) => void;
  setCurrency: (c: Currency) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  ta: (key: string) => string[];
  formatAmount: (eur: number | string) => string;
  betQ: (bet: Localizable) => string;
  betDesc: (bet: Localizable) => string;
};

const I18nContext = createContext<I18nCtx>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => (localStorage.getItem("para_locale") as Locale) || "fr"
  );
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem("para_currency") as Currency) || "EUR"
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("para_locale", l);
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("para_currency", c);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const [ns, k] = key.split(".");
      const val = LOCALES[locale]?.[ns]?.[k];
      if (typeof val !== "string") return key;
      if (!params) return val;
      return Object.entries(params).reduce<string>(
        (s, [pk, pv]) => s.replaceAll(`{${pk}}`, String(pv)),
        val
      );
    },
    [locale]
  );

  const ta = useCallback(
    (key: string): string[] => {
      const [ns, k] = key.split(".");
      const val = LOCALES[locale]?.[ns]?.[k];
      return Array.isArray(val) ? val : [];
    },
    [locale]
  );

  const formatAmount = useCallback(
    (eur: number | string): string => {
      const n = typeof eur === "number" ? eur : Number(eur);
      const safe = Number.isFinite(n) ? n : 0;
      const value = currency === "USD" ? safe * EUR_USD_RATE : safe;
      const symbol = currency === "USD" ? "$" : "€";
      return `${value.toFixed(2)} ${symbol}`;
    },
    [currency]
  );

  const betQ = useCallback(
    (bet: Localizable): string =>
      (locale === "en" && bet.question_en) ? bet.question_en : bet.question,
    [locale]
  );

  const betDesc = useCallback(
    (bet: Localizable): string =>
      (locale === "en" && bet.description_en) ? bet.description_en : (bet.description ?? ""),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, currency, setLocale, setCurrency, t, ta, formatAmount, betQ, betDesc }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
