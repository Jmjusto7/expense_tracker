import { getCurrentValuePhp } from "../utils/balanceHelpers";
import DonutChart from "./DonutChart";

export default function AssetAllocationByTypeChart({ accounts, accountTypes, balanceEntries, heightClassName = "h-56" }) {
  const typeNameById = Object.fromEntries(accountTypes.map((t) => [t.id, t.name]));

  const groups = {};
  accounts.forEach((acc) => {
    const value = getCurrentValuePhp(balanceEntries, accounts, acc.id);
    if (value == null || value <= 0) return; // same exclusions as AssetCompositionChart
    const label = (acc.typeId != null && typeNameById[acc.typeId]) || "Unclassified";
    groups[label] = (groups[label] || 0) + value;
  });

  const data = Object.entries(groups).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <p className="text-ink-muted text-sm text-center py-10">No positive balances to allocate yet.</p>;
  }

  return <DonutChart data={data} heightClassName={heightClassName} />;
}
