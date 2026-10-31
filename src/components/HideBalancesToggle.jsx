import { Eye, EyeOff } from "lucide-react";
import { useHideBalances } from "../hooks/useHideBalances";

export default function HideBalancesToggle({ className = "" }) {
  const [hidden, setHidden] = useHideBalances();
  const Icon = hidden ? EyeOff : Eye;
  const label = hidden ? "Show balances" : "Hide balances";

  return (
    <button
      type="button"
      onClick={() => setHidden(!hidden)}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={`p-2 rounded-full text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors ${className}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
