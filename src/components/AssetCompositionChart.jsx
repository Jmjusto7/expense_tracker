import { getCurrentValuePhp } from "../utils/balanceHelpers";
import DonutChart from "./DonutChart";

// Negative (cards) and unpriced accounts can't be a share of assets, so they're left out.
export default function AssetCompositionChart({ accounts, balanceEntries, heightClassName = "h-56" }) {
  const data = accounts
    .map((acc) => ({ name: acc.name, value: getCurrentValuePhp(balanceEntries, accounts, acc.id) }))
    .filter((d) => d.value != null && d.value > 0);

  if (data.length === 0) {
    return <p className="text-ink-muted text-sm text-center py-10">No positive balances to chart yet.</p>;
  }

  return <DonutChart data={data} heightClassName={heightClassName} />;
}
