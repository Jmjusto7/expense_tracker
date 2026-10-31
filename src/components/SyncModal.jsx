import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { formatDate } from "../utils/dateHelpers";
import TransactionConflictList from "./TransactionConflictList";
import Dialog from "./Dialog";

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
        choices: [
            ["local", "Keep this device's version"],
            ["remote", "Keep the other device's version"],
        ],
    },
    deletedRemotely: {
        text: "Deleted on the other device, changed on this one",
        choices: [
            ["local", "Keep it"],
            ["remote", "Delete it"],
        ],
    },
    deletedLocally: {
        text: "Deleted on this device, changed on the other one",
        choices: [
            ["remote", "Restore it"],
            ["local", "Keep it deleted"],
        ],
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
        <Dialog
            title="Sync with Google Drive"
            icon={RefreshCw}
            size="lg"
            onClose={onCancel}
            onSubmit={showingRecords ? handleRecordsNext : () => commit(dayResolutions)}
            submitLabel="Sync"
            busyLabel="Syncing…"
            busy={saving}
            submitDisabled={unresolved > 0}
            error={error}
        >
            {showingRecords ? (
                <div>
                    <h3 className="text-sm font-semibold text-ink mb-2">
                        {recordConflicts.length} {recordConflicts.length === 1 ? "entry was" : "entries were"} changed on both devices
                    </h3>
                    <ul className="flex flex-col gap-3">
                        {recordConflicts.map((c) => (
                            <li key={c.id} className="border border-border rounded-md p-3">
                                <div className="text-sm font-medium text-ink mb-1">
                                    {TABLE_LABELS[c.table]} · {KINDS[c.kind].text}
                                </div>
                                <div className="text-xs text-ink-muted break-words">This device: {describeRecord(c.local)}</div>
                                <div className="text-xs text-ink-muted break-words mb-2">Other device: {describeRecord(c.remote)}</div>
                                <div role="radiogroup" aria-label={`${TABLE_LABELS[c.table]} resolution`} className="flex flex-wrap gap-x-4 gap-y-2">
                                    {KINDS[c.kind].choices.map(([value, label]) => (
                                        <label key={value} className="flex items-center gap-1.5 text-sm text-ink py-1">
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
        </Dialog>
    );
}
