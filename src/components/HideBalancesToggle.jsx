import { Eye, EyeOff } from "lucide-react";
import { useHideBalances } from "../hooks/useHideBalances";

export default function HideBalancesToggle({ className = "", onDark = false }) {
  const [hidden, setHidden] = useHideBalances();
  const Icon = hidden ? EyeOff : Eye;
  const label = hidden ? "Show balances" : "Hide balances";
  const tone = onDark ? "text-white/80 hover:text-white hover:bg-white/15" : "text-ink-muted hover:text-ink hover:bg-surface-sunken";

  return (
    <button
      type="button"
      onClick={() => setHidden(!hidden)}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={`p-2 rounded-full ${tone} transition-colors ${className}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
