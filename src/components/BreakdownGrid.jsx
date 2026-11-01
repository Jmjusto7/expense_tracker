import { colorsForKeys } from "../utils/chartFormat";

// A grid of clickable amount/percent cards, used for TravelDetailPage's
// bucket/category drill-down. Each item is
// {key, label, amount, percent, disabled?}. The swatch matches the item's
// pie slice colour, so the grid doubles as the chart legend.
// accent picks "ledger" or "travel" styling to match the page it's on.
export default function BreakdownGrid({ items, activeKeys = [], onItemClick, accent = "ledger" }) {
  const isActive = (item) => activeKeys.includes(item.key);
  // Same name set as the pie, so swatches match its colours.
  const colorFor = colorsForKeys(items.map((i) => i.label));

  const activeBg = accent === "travel" ? "bg-travel border-travel" : "bg-ledger border-ledger";
  const idleBg =
    accent === "travel"
      ? "bg-travel-soft border-travel/20 hover:border-travel"
      : "bg-ledger-soft border-ledger/20 hover:border-ledger";
  const idleAmountColor = accent === "travel" ? "text-travel-dark" : "text-ledger-dark";

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 md:overflow-y-auto md:max-h-[420px]">
      {items.map((item) => {
        const active = isActive(item);
        const clickable = !item.disabled && onItemClick;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => clickable && onItemClick(item)}
            disabled={!clickable}
            aria-pressed={clickable ? active : undefined}
            title={item.label}
            className={`text-left rounded-lg p-3 border transition-colors flex flex-col min-w-0 ${active ? activeBg : idleBg
              } ${!clickable ? "cursor-default opacity-70" : ""}`}
          >
            <span className={`flex items-start gap-1.5 font-semibold text-sm break-words ${active ? "text-white" : "text-ink"}`}>
              <span
                className="mt-1 h-2.5 w-2.5 rounded-sm shrink-0 ring-1 ring-white/60"
                style={{ backgroundColor: colorFor(item.label) }}
                aria-hidden="true"
              />
              <span className="min-w-0">{item.label}</span>
            </span>
            <span className={`money text-lg font-bold ${active ? "text-white" : idleAmountColor}`}>
              {item.amountDisplay}
            </span>
            {item.percent !== undefined && (
              <span className={`text-xs ${active ? "text-white/80" : "text-ink-muted"}`}>
                {item.percent}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
