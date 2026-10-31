// A small, scannable metric card used across analytics views.
// accent picks which token family the value uses - "ledger" (default),
// "travel", or "alert" (for figures that should read as a warning, e.g. a
// negative balance or a negative net/savings).
export default function StatCard({ label, value, sublabel, accent = "ledger", sensitiveSublabel = false }) {
  const valueColor =
    accent === "travel" ? "text-travel-dark" : accent === "alert" ? "text-alert" : "text-ledger-dark";

  return (
    <div className="bg-surface border border-border rounded-lg p-3 sm:p-4 min-w-0">
      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`money text-xl sm:text-2xl font-bold break-words ${valueColor}`}>{value}</div>
      {sublabel && <div className={`text-xs text-ink-muted mt-1 break-words ${sensitiveSublabel ? "sensitive" : ""}`}>{sublabel}</div>}
    </div>
  );
}
