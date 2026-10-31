import { useState } from "react";
import { Upload } from "lucide-react";
import TransactionConflictList from "./TransactionConflictList";
import Dialog from "./Dialog";

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
    <Dialog
      title="Import this file?"
      icon={Upload}
      size={conflicts.length ? "lg" : "md"}
      onClose={onCancel}
      onSubmit={() => onConfirm(resolutions)}
      submitLabel="Import"
      busyLabel="Importing…"
      busy={importing}
      submitDisabled={unresolved > 0}
      error={unresolved > 0 ? `Choose an option for ${unresolved === 1 ? "the entry" : `all ${unresolved} entries`} above first.` : ""}
    >
      <p className="text-sm text-ink-muted mb-4">This file contains:</p>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 mb-4">
        {ROWS.map(([key, label]) => (
          <div key={key} className="bg-surface-sunken rounded-md px-3 py-2 flex justify-between gap-2">
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

      <p className="text-xs text-ink-muted bg-surface-sunken rounded-md px-3 py-2">
        Duplicates (same year/month/day, account, trip, bucket, or an identical amount on the same day and category) are merged
        automatically - counts above are before that.
      </p>
    </Dialog>
  );
}
