import { X } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import CategoryAutocompleteInput from "./CategoryAutocompleteInput";
import TravelSelectCell from "./TravelSelectCell";
import AccountSelectCell from "./AccountSelectCell";
import AmountPreview from "../AmountPreview";

const cellInput =
    "w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50";

// Shared row editor for the Add/Edit day modals: a table from `md` up, stacked cards on phones.
// onChange(rowId, patch) merges `patch` into the row.
// Amount fields stay inputMode="text" - they take comma-separated parts, and many
// Android decimal keypads have no comma key.
export default function TransactionRowsEditor({
    rows,
    onChange,
    onRemove,
    onAddRow,
    onRequestAddTravel,
    categories,
    travels,
    accounts,
    disabled = false,
    inputRefs,
}) {
    const wide = useMediaQuery("(min-width: 768px)");
    const setRef = (key) => (el) => {
        if (inputRefs) inputRefs.current[key] = el;
    };

    const fields = (r, i) => ({
        category: (
            <CategoryAutocompleteInput
                id={`row-${r.id}-category`}
                aria-label={wide ? `Category, row ${i + 1}` : undefined}
                value={r.category}
                onChange={(val) => onChange(r.id, { category: val })}
                categories={categories}
                disabled={disabled}
                inputRef={setRef(`category-${r.id}`)}
            />
        ),
        amount: (
            <>
                <input
                    id={`row-${r.id}-amount`}
                    aria-label={wide ? `Amount, row ${i + 1}` : undefined}
                    type="text"
                    value={r.amount}
                    onChange={(e) => onChange(r.id, { amount: e.target.value })}
                    className={`money ${cellInput}`}
                    placeholder="e.g. 195.5, -130"
                    disabled={disabled}
                />
                <AmountPreview value={r.amount} />
            </>
        ),
        travel: (
            <>
                <TravelSelectCell
                    id={`row-${r.id}-travel`}
                    aria-label={wide ? `Travel, row ${i + 1}` : undefined}
                    value={r.travelId}
                    onChange={(val) => onChange(r.id, { travelId: val, travelAuto: false })}
                    onRequestAdd={() => onRequestAddTravel(r.id)}
                    travels={travels}
                    disabled={disabled}
                />
                {r.travelAuto && r.travelId && <p className="mt-1 text-xs text-travel-dark">Matched by date</p>}
            </>
        ),
        account: (
            <AccountSelectCell
                id={`row-${r.id}-account`}
                aria-label={wide ? `Paid from, row ${i + 1}` : undefined}
                value={r.accountId}
                onChange={(val) => onChange(r.id, { accountId: val })}
                accounts={accounts}
                disabled={disabled}
            />
        ),
        comments: (
            <input
                id={`row-${r.id}-comments`}
                aria-label={wide ? `Comments, row ${i + 1}` : undefined}
                type="text"
                value={r.comments}
                onChange={(e) => onChange(r.id, { comments: e.target.value })}
                onKeyDown={(e) => {
                    if (wide && e.key === "Tab" && !e.shiftKey && i === rows.length - 1) {
                        e.preventDefault();
                        onAddRow();
                    }
                }}
                className={cellInput}
                placeholder="Comments"
                disabled={disabled}
            />
        ),
    });

    const removeButton = (r, i) =>
        onRemove && (
            <button
                type="button"
                onClick={() => onRemove(r.id)}
                disabled={disabled}
                aria-label={`Remove row ${i + 1}`}
                className="p-1.5 rounded-md text-ink-muted hover:text-alert hover:bg-alert-soft"
            >
                <X size={16} aria-hidden="true" />
            </button>
        );

    const addRowButton = (
        <button
            type="button"
            onClick={onAddRow}
            disabled={disabled}
            className="text-sm text-ledger-dark hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
            + Add row
        </button>
    );

    if (!wide) {
        return (
            <div className="flex flex-col gap-3">
                {rows.map((r, i) => {
                    const f = fields(r, i);
                    const label = (field, text) => (
                        <label htmlFor={`row-${r.id}-${field}`} className="block text-xs font-medium text-ink-muted mb-1">
                            {text}
                        </label>
                    );
                    return (
                        <div key={r.id} role="group" aria-label={`Item ${i + 1}`} className="border border-border rounded-lg p-3 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Item {i + 1}</span>
                                {removeButton(r, i)}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    {label("category", "Category")}
                                    {f.category}
                                </div>
                                <div>
                                    {label("amount", "Amount")}
                                    {f.amount}
                                </div>
                            </div>
                            <div>
                                {label("account", "Paid from")}
                                {f.account}
                            </div>
                            <div>
                                {label("travel", "Travel")}
                                {f.travel}
                            </div>
                            <div>
                                {label("comments", "Comments")}
                                {f.comments}
                            </div>
                        </div>
                    );
                })}
                <div>{addRowButton}</div>
            </div>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto mb-3">
                <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                        <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
                            <th className="border border-border px-3 py-2 w-[18%] font-medium">Category</th>
                            <th className="border border-border px-3 py-2 w-[20%] font-medium">Amount</th>
                            <th className="border border-border px-3 py-2 w-[18%] font-medium">Travel</th>
                            <th className="border border-border px-3 py-2 w-[18%] font-medium">Paid From</th>
                            <th className="border border-border px-3 py-2 font-medium">Comments</th>
                            {onRemove && (
                                <th className="border border-border px-2 py-2 w-[48px] font-medium">
                                    <span className="sr-only">Remove</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => {
                            const f = fields(r, i);
                            return (
                                <tr key={r.id} className="align-top">
                                    <td className="border border-border px-3 py-2">{f.category}</td>
                                    <td className="border border-border px-3 py-2">{f.amount}</td>
                                    <td className="border border-border px-3 py-2">{f.travel}</td>
                                    <td className="border border-border px-3 py-2">{f.account}</td>
                                    <td className="border border-border px-3 py-2">{f.comments}</td>
                                    {onRemove && <td className="border border-border px-2 py-2 text-center">{removeButton(r, i)}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {addRowButton}
        </div>
    );
}
