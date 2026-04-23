import { useEffect, useRef, useState } from "react";

export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(
    typeof document !== "undefined" ? document.visibilityState !== "hidden" : true
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * setInterval that pauses when the tab is hidden. Re-arms on re-show.
 * `fn` is kept in a ref so callers don't need useCallback.
 */
export function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    let id: number | null = null;
    const start = () => {
      if (id !== null) return;
      id = window.setInterval(() => fnRef.current(), ms);
    };
    const stop = () => {
      if (id !== null) { clearInterval(id); id = null; }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
