// A small, scannable metric card used across analytics views.
// accent picks which token family the value uses - "ledger" (default),
// "travel", or "alert" (for figures that should read as a warning, e.g. a
// negative balance or a negative net/savings).
export default function StatCard({ label, value, sublabel, accent = "ledger" }) {
  const valueColor =
    accent === "travel" ? "text-travel-dark" : accent === "alert" ? "text-alert" : "text-ledger-dark";

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`money text-2xl font-bold ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-ink-muted mt-1">{sublabel}</div>}
    </div>
  );
}
