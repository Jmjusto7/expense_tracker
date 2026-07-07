// A small, scannable metric card used across analytics views.
// accent picks which token family the value uses - "ledger" (default)
// or "travel", so the card can sit consistently in either domain.
export default function StatCard({ label, value, sublabel, accent = "ledger" }) {
  const valueColor = accent === "travel" ? "text-travel-dark" : "text-ledger-dark";

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`money text-2xl font-bold ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-ink-muted mt-1">{sublabel}</div>}
    </div>
  );
}
