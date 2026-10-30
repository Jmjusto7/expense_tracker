import { useState } from "react";
import { X, Upload } from "lucide-react";
import TransactionConflictList from "./TransactionConflictList";

const ROWS = [
  ["years", "Years"],
  ["months", "Months"],
  ["days", "Days"],
  ["transactions", "Transactions"],
  ["travels", "Travels"],
  ["buckets", "Buckets"],
  ["accounts", "Accounts"],
  ["balanceEntries", "Balance Entries"],
  ["accountTypes", "Account Types"],
];

export default function ImportPreviewModal({ counts, plan, onConfirm, onCancel, importing }) {
  const conflicts = plan?.conflicts ?? [];
  const [resolutions, setResolutions] = useState({});
  const unresolved = conflicts.filter((c) => !resolutions[c.id]).length;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
      <div
        className={`bg-surface w-[90%] ${conflicts.length ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-6 relative`}
      >
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-ink-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Upload size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Import this file?</h2>
        </div>

        <p className="text-sm text-ink-muted mb-4">
          This file contains:
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {ROWS.map(([key, label]) => (
            <div key={key} className="bg-surface-sunken rounded-md px-3 py-2 flex justify-between">
              <span className="text-sm text-ink-muted">{label}</span>
              <span className="text-sm font-semibold text-ink">{counts[key] ?? 0}</span>
            </div>
          ))}
        </div>

        {conflicts.length > 0 && (
          <TransactionConflictList
            conflicts={conflicts}
            tables={plan.result}
            resolutions={resolutions}
            onChange={setResolutions}
            disabled={importing}
          />
        )}

        <p className="text-xs text-alert bg-alert-soft rounded-md px-3 py-2 mb-2">
          Records with matching IDs in your current data will be overwritten. This cannot be undone.
        </p>

        <p className="text-xs text-ink-muted bg-surface-sunken rounded-md px-3 py-2 mb-4">
          Duplicates (same year/month/day, account, trip, bucket, or an identical amount on the same
          day and category) are merged automatically - counts above are before that.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={importing}
            className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(resolutions)}
            disabled={importing || unresolved > 0}
            title={unresolved > 0 ? "Choose an option for every entry above first." : undefined}
            className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors disabled:opacity-60"
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
