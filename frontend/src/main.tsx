import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n";
import { Login } from "@/pages/Login";
import { CommandPalette } from "@/components/CommandPalette";
import "./styles-tokens.css";
import "./styles.css";

const Home = lazy(() => import("@/pages/Home").then((m) => ({ default: m.Home })));
const MapPage = lazy(() => import("@/pages/Map").then((m) => ({ default: m.MapPage })));
const Analysis = lazy(() => import("@/pages/Analysis").then((m) => ({ default: m.Analysis })));
const Market = lazy(() => import("@/pages/Market").then((m) => ({ default: m.Market })));
const WalletPage = lazy(() => import("@/pages/Wallet").then((m) => ({ default: m.WalletPage })));
const LeaderboardPage = lazy(() => import("@/pages/Leaderboard").then((m) => ({ default: m.LeaderboardPage })));

function RouteFallback() {
  return (
    <div style={{
      height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", color: "var(--fg-faint)", fontFamily: "var(--font-mono, monospace)",
      fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    }}>
      Loading…
    </div>
  );
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("para_token");
  const onboardingPassed = localStorage.getItem("para_onboarding_passed") === "1";
  if (!token && !onboardingPassed) return <Navigate to="/onboarding" replace />;
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("para_token");
  if (!token) return <Navigate to="/login" replace />;
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Login extended />} />
          <Route path="/" element={<GuestRoute><Home /></GuestRoute>} />
          <Route path="/map" element={<GuestRoute><MapPage /></GuestRoute>} />
          <Route path="/analysis/:slug" element={<GuestRoute><Analysis /></GuestRoute>} />
          <Route path="/market/:slug" element={<GuestRoute><Market /></GuestRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<GuestRoute><LeaderboardPage /></GuestRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CommandPalette />
      </BrowserRouter>
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            fontSize: "13px",
          },
        }}
      />
    </I18nProvider>
  </React.StrictMode>
);
