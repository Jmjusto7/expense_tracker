import { useState } from "react";
import { useExpenseContext } from "../../context/ExpenseContext";

export default function ClearDBTab() {
  const { clearDB, years, travels, allTransactions, accounts, balanceEntries, accountTypes } = useExpenseContext();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justCleared, setJustCleared] = useState(false);

  const yearCount = years.length;
  const monthCount = years.flatMap((y) => y.months || []).length;
  const transactionCount = allTransactions.length;
  const travelCount = travels.length;
  const accountCount = accounts.length;
  const balanceEntryCount = balanceEntries.length;
  const accountTypeCount = accountTypes.length;

  const handleClear = async () => {
    setLoading(true);
    try {
      await clearDB();
      setConfirming(false);
      setJustCleared(true);
      setTimeout(() => setJustCleared(false), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h2 className="text-lg font-semibold text-ink">Clear Database</h2>
      <p className="text-ink-muted text-sm">
        This will permanently delete all years, months, days, transactions, travels, buckets,
        bucket assignments, accounts, account types, and balance/income entries. This cannot be undone.
      </p>

      {justCleared && (
        <p className="text-ledger-dark text-sm bg-ledger-soft border border-ledger/20 rounded-lg px-3 py-2">
          All data cleared.
        </p>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="bg-alert hover:bg-alert/90 text-white px-4 py-2 rounded-lg w-48 text-sm font-medium transition-colors"
        >
          Clear Database
        </button>
      ) : (
        <div className="border border-alert/40 bg-alert-soft rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm text-ink">
            This will permanently delete{" "}
            <span className="font-semibold">
              {yearCount} year{yearCount === 1 ? "" : "s"}, {monthCount} month{monthCount === 1 ? "" : "s"},{" "}
              {transactionCount} transaction{transactionCount === 1 ? "" : "s"}, {travelCount} travel
              {travelCount === 1 ? "" : "s"}, {accountCount} account{accountCount === 1 ? "" : "s"},{" "}
              {accountTypeCount} account type{accountTypeCount === 1 ? "" : "s"}, and{" "}
              {balanceEntryCount} balance entr{balanceEntryCount === 1 ? "y" : "ies"}
            </span>
            . This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors text-sm disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="bg-alert hover:bg-alert/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? "Clearing…" : "Yes, delete everything"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
