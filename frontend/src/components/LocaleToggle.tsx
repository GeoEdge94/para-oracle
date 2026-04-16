import { useI18n, type Locale, type Currency } from "@/lib/i18n";
import { Globe, DollarSign } from "lucide-react";

export function LocaleToggle() {
  const { locale, currency, setLocale, setCurrency } = useI18n();

  function toggleLocale() {
    setLocale(locale === "fr" ? "en" : "fr");
  }

  function toggleCurrency() {
    setCurrency(currency === "EUR" ? "USD" : "EUR");
  }

  return (
    <div className="locale-toggle">
      <button onClick={toggleLocale} className="locale-btn" title={locale === "fr" ? "Switch to English" : "Passer en français"}>
        <Globe size={12} />
        <span>{locale === "fr" ? "FR" : "EN"}</span>
      </button>
      <span className="locale-sep" />
      <button onClick={toggleCurrency} className="locale-btn" title={currency === "EUR" ? "Switch to USD" : "Passer en EUR"}>
        <DollarSign size={12} />
        <span>{currency}</span>
      </button>
    </div>
  );
}
