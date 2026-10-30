import { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { formatDate } from "../utils/dateHelpers";
import TransactionConflictList from "./TransactionConflictList";

const TABLE_LABELS = {
    years: "Year",
    months: "Month",
    days: "Day",
    transactions: "Transaction",
    travels: "Trip",
    buckets: "Bucket",
    bucketAssignments: "Bucket assignment",
    accounts: "Account",
    balanceEntries: "Balance entry",
    accountTypes: "Account type",
};

const KINDS = {
    edit: {
        text: "Changed on both devices",
        choices: [["local", "Keep this device's version"], ["remote", "Keep the other device's version"]],
    },
    deletedRemotely: {
        text: "Deleted on the other device, changed on this one",
        choices: [["local", "Keep it"], ["remote", "Delete it"]],
    },
    deletedLocally: {
        text: "Deleted on this device, changed on the other one",
        choices: [["remote", "Restore it"], ["local", "Keep it deleted"]],
    },
};

const SYNC_LABELS = { existing: "This device", incoming: "Other device", keepExisting: "Keep this device's", keepIncoming: "Keep other device's" };

function describeRecord(row) {
    if (!row) return "Deleted";
    return [
        row.title ?? row.name ?? row.category ?? row.year ?? row.type,
        row.day != null ? `Day ${row.day}` : null,
        row.amount ?? row.balance ?? row.pricePerUnit,
        row.date ? formatDate(row.date) : null,
        row.comments || null,
    ]
        .filter((part) => part != null && part !== "")
        .join(" · ");
}

export default function SyncModal({ prepared, onCancel, onDone }) {
    const { planSync, commitSync } = useExpenseContext();
    const recordConflicts = prepared.merge.recordConflicts;
    const [recordResolutions, setRecordResolutions] = useState({});
    const [plan, setPlan] = useState(() => (recordConflicts.length ? null : planSync(prepared)));
    const [dayResolutions, setDayResolutions] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const commit = async (resolvedDays) => {
        setSaving(true);
        setError("");
        try {
            const { summary } = await commitSync(prepared, recordResolutions, resolvedDays);
            onDone(summary);
        } catch (err) {
            setError(err.message || "Sync failed.");
            setSaving(false);
        }
    };

    const handleRecordsNext = () => {
        const next = planSync(prepared, recordResolutions);
        if (next.conflicts.length) setPlan(next);
        else commit({});
    };

    const showingRecords = plan === null;
    const unresolved = showingRecords
        ? recordConflicts.filter((c) => !recordResolutions[c.id]).length
        : plan.conflicts.filter((c) => !dayResolutions[c.id]).length;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
            <div className="bg-surface w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-6 relative">
                <button onClick={onCancel} disabled={saving} className="absolute top-3 right-3 text-ink-muted hover:text-ink">
                    <X size={18} />
                </button>

                <div className="flex items-center gap-2 mb-4">
                    <RefreshCw size={18} className="text-ledger-dark" />
                    <h2 className="font-display text-xl text-ink">Sync with Google Drive</h2>
                </div>

                {showingRecords ? (
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-ink mb-2">
                            {recordConflicts.length} {recordConflicts.length === 1 ? "entry was" : "entries were"} changed on both devices
                        </h3>
                        <ul className="flex flex-col gap-3">
                            {recordConflicts.map((c) => (
                                <li key={c.id} className="border border-border rounded-md p-3">
                                    <div className="text-sm font-medium text-ink mb-1">
                                        {TABLE_LABELS[c.table]} · {KINDS[c.kind].text}
                                    </div>
                                    <div className="text-xs text-ink-muted">This device: {describeRecord(c.local)}</div>
                                    <div className="text-xs text-ink-muted mb-2">Other device: {describeRecord(c.remote)}</div>
                                    <div className="flex flex-wrap gap-4">
                                        {KINDS[c.kind].choices.map(([value, label]) => (
                                            <label key={value} className="flex items-center gap-1.5 text-sm text-ink">
                                                <input
                                                    type="radio"
                                                    name={`record-${c.id}`}
                                                    value={value}
                                                    disabled={saving}
                                                    checked={recordResolutions[c.id] === value}
                                                    onChange={() => setRecordResolutions((prev) => ({ ...prev, [c.id]: value }))}
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <TransactionConflictList
                        conflicts={plan.conflicts}
                        tables={plan.result}
                        resolutions={dayResolutions}
                        onChange={setDayResolutions}
                        disabled={saving}
                        labels={SYNC_LABELS}
                    />
                )}

                {error && <p className="text-sm text-alert bg-alert-soft rounded-md px-3 py-2 mb-4">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={saving}
                        className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={showingRecords ? handleRecordsNext : () => commit(dayResolutions)}
                        disabled={saving || unresolved > 0}
                        title={unresolved > 0 ? "Choose an option for every entry above first." : undefined}
                        className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors disabled:opacity-60"
                    >
                        {saving ? "Syncing…" : "Sync"}
                    </button>
                </div>
            </div>
        </div>
    );
}
