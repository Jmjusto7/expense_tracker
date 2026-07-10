// A grid of clickable amount/percent cards, used for drill-down analytics
// (ExpenseAnalytics's bucket/category filter on the Expenses tab,
// TravelDetailPage's bucket/category drill-down). Each item is
// {key, label, amount, percent, disabled?}.
// accent picks "ledger" or "travel" styling to match the page it's on.
export default function BreakdownGrid({ items, activeKeys = [], onItemClick, accent = "ledger" }) {
  const isActive = (item) => activeKeys.includes(item.key);

  const activeBg = accent === "travel" ? "bg-travel border-travel" : "bg-ledger border-ledger";
  const idleBg =
    accent === "travel"
      ? "bg-travel-soft border-travel/20 hover:border-travel"
      : "bg-ledger-soft border-ledger/20 hover:border-ledger";
  const idleAmountColor = accent === "travel" ? "text-travel-dark" : "text-ledger-dark";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[420px]">
      {items.map((item) => {
        const active = isActive(item);
        const clickable = !item.disabled && onItemClick;

        return (
          <button
            key={item.key}
            onClick={() => clickable && onItemClick(item)}
            disabled={!clickable}
            className={`text-left rounded-lg p-3 border transition-colors flex flex-col ${
              active ? activeBg : idleBg
            } ${!clickable ? "cursor-default opacity-70" : ""}`}
          >
            <span className={`font-semibold text-sm ${active ? "text-white" : "text-ink"}`}>
              {item.label}
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
