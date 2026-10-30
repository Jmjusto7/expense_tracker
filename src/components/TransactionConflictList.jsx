import { findTagConflict } from "../utils/transactionMerge";
import { formatBreakdownDisplay } from "../utils/amountHelpers";

const IMPORT_LABELS = { existing: "Existing", incoming: "Imported", keepExisting: "Keep existing", keepIncoming: "Keep imported" };

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function describeConflictRow(tx, tables) {
    const travel = tables.travels.find((t) => sameId(t.id, tx.travelId));
    const account = tables.accounts.find((a) => sameId(a.id, tx.accountId));
    return [
        formatBreakdownDisplay(tx),
        tx.comments || null,
        travel ? `Trip: ${travel.title}` : null,
        account ? `Paid from: ${account.name}` : null,
    ]
        .filter(Boolean)
        .join(" · ");
}

function conflictDateLabel(tx, tables) {
    const year = tables.years.find((y) => sameId(y.id, tx.yearId))?.year;
    const month = tables.months.find((m) => sameId(m.id, tx.monthId))?.name;
    const day = tables.days.find((d) => sameId(d.id, tx.dayId))?.day;
    return `${month} ${day}, ${year}`;
}

// Same day + category, different amounts: one radio group per clash.
export default function TransactionConflictList({ conflicts, tables, resolutions, onChange, disabled, labels = IMPORT_LABELS }) {
    const choices = [
        ["existing", labels.keepExisting],
        ["incoming", labels.keepIncoming],
        ["merge", "Merge"],
    ];

    return (
        <div className="mb-4">
            <h3 className="text-sm font-semibold text-ink mb-2">
                {conflicts.length} {conflicts.length === 1 ? "entry needs" : "entries need"} a decision
            </h3>
            <p className="text-xs text-ink-muted mb-3">
                These days already have an entry in the same category with a different amount.
            </p>
            <ul className="flex flex-col gap-3">
                {conflicts.map((c) => {
                    const mergeBlocked = Boolean(findTagConflict(c.existing, c.incoming));
                    return (
                        <li key={c.id} className="border border-border rounded-md p-3">
                            <div className="text-sm font-medium text-ink mb-1">
                                {conflictDateLabel(c.existing, tables)} · {c.existing.category}
                            </div>
                            <div className="text-xs text-ink-muted">{labels.existing}: {describeConflictRow(c.existing, tables)}</div>
                            <div className="text-xs text-ink-muted mb-2">{labels.incoming}: {describeConflictRow(c.incoming, tables)}</div>
                            <div className="flex flex-wrap gap-4">
                                {choices.map(([value, label]) => {
                                    const blocked = value === "merge" && mergeBlocked;
                                    return (
                                        <label
                                            key={value}
                                            className={`flex items-center gap-1.5 text-sm ${blocked ? "text-ink-muted opacity-60" : "text-ink"}`}
                                            title={blocked ? "Can't merge: the entries are tagged to different trips or accounts." : undefined}
                                        >
                                            <input
                                                type="radio"
                                                name={`conflict-${c.id}`}
                                                value={value}
                                                disabled={blocked || disabled}
                                                checked={resolutions[c.id] === value}
                                                onChange={() => onChange({ ...resolutions, [c.id]: value })}
                                            />
                                            {label}
                                        </label>
                                    );
                                })}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
