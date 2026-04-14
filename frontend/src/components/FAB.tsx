import type { ReactNode } from "react";

export function FAB({ icon, onClick }: { icon: ReactNode; onClick: () => void }) {
  return (
    <button className="fab" onClick={onClick}>
      {icon}
    </button>
  );
}
