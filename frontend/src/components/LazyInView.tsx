import { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  rootMargin?: string;
  minHeight?: number | string;
  fallback?: React.ReactNode;
};

/**
 * Renders children only once scrolled near the viewport. Below-fold heavy
 * components (echarts, three, recharts) stay unmounted until needed.
 */
export function LazyInView({ children, rootMargin = "200px", minHeight = 400, fallback = null }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : fallback}
    </div>
  );
}
