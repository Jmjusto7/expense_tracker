import { useMemo, useState } from "react";
import { Plus, Shapes, X } from "lucide-react";
import Dialog from "../../../components/Dialog";
import BucketTitle from "./BucketTitle";

const chipBase = "inline-flex items-center gap-1 text-sm rounded-full border max-w-full";

function AddCategoriesDialog({ bucket, columns, onClose, onMove }) {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const q = query.trim().toLowerCase();

    const others = columns.filter((c) => c.id !== bucket.id);
    const groups = [
        { title: "Unassigned", items: others.find((c) => c.id === null)?.categories ?? [] },
        {
            title: "In other buckets (will move)",
            items: others.filter((c) => c.id !== null).flatMap((c) => c.categories.map((cat) => ({ cat, from: c.name }))),
        },
    ];

    const toggle = (cat) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });

    return (
        <Dialog
            title={`Add to ${bucket.name}`}
            icon={Shapes}
            onClose={onClose}
            submitLabel={selected.size ? `Add ${selected.size}` : "Add"}
            submitDisabled={selected.size === 0}
            busy={saving}
            onSubmit={async () => {
                setSaving(true);
                for (const cat of selected) await onMove(cat, bucket.id);
                onClose();
            }}
        >
            <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories"
                aria-label="Search categories"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none mb-3"
                data-autofocus
            />
            {groups.map(({ title, items }) => {
                const shown = items.filter((it) => (typeof it === "string" ? it : it.cat).toLowerCase().includes(q));
                if (!shown.length) return null;
                return (
                    <fieldset key={title} className="mb-3">
                        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">{title}</legend>
                        {shown.map((it) => {
                            const cat = typeof it === "string" ? it : it.cat;
                            return (
                                <label key={cat} className="flex items-center gap-3 py-2 border-b border-border last:border-b-0 text-sm text-ink">
                                    <input type="checkbox" className="h-4 w-4 accent-ledger" checked={selected.has(cat)} onChange={() => toggle(cat)} />
                                    <span className="flex-1 min-w-0 break-words">{cat}</span>
                                    {typeof it !== "string" && <span className="text-xs text-ink-muted shrink-0">in {it.from}</span>}
                                </label>
                            );
                        })}
                    </fieldset>
                );
            })}
            {groups.every((g) => g.items.length === 0) && <p className="text-sm text-ink-muted">Every category is already here.</p>}
        </Dialog>
    );
}

function MoveDialog({ category, columns, onClose, onMove }) {
    const [target, setTarget] = useState("");
    const buckets = columns.filter((c) => c.id !== null);
    return (
        <Dialog
            title={`Bucket for ${category}`}
            icon={Shapes}
            onClose={onClose}
            submitLabel="Move"
            submitDisabled={!target}
            onSubmit={async () => {
                await onMove(category, target);
                onClose();
            }}
        >
            {buckets.length === 0 ? (
                <p className="text-sm text-ink-muted">Create a bucket first.</p>
            ) : (
                <fieldset>
                    <legend className="sr-only">Choose a bucket</legend>
                    {buckets.map((b) => (
                        <label key={b.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0 text-sm text-ink">
                            <input type="radio" name="bucket-target" className="h-4 w-4 accent-ledger" checked={target === b.id} onChange={() => setTarget(b.id)} />
                            {b.name}
                        </label>
                    ))}
                </fieldset>
            )}
        </Dialog>
    );
}

// Phone layout: one card per bucket with its categories as chips.
export default function BucketCards({ columns, query, onMove, onRename, onIcon, onRemove, metaFor }) {
    const [addingTo, setAddingTo] = useState(null);
    const [moving, setMoving] = useState(null);
    const q = query.trim().toLowerCase();
    const match = useMemo(() => (cat) => !q || cat.toLowerCase().includes(q), [q]);
    const unassigned = columns.find((c) => c.id === null);
    const buckets = columns.filter((c) => c.id !== null);

    return (
        <div className="flex flex-col gap-3">
            {unassigned.categories.length > 0 && (
                <section aria-label="Unassigned categories" className="bg-warning-soft border border-warning/30 rounded-xl p-3">
                    <h3 className="text-sm font-semibold text-ink">
                        Unassigned <span className="text-ink-muted font-normal">· {unassigned.categories.length}</span>
                    </h3>
                    <p className="text-[11px] text-ink-muted mb-2">Tap one to put it in a bucket.</p>
                    <div className="flex flex-wrap gap-1.5">
                        {unassigned.categories.filter(match).map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setMoving(cat)}
                                className={`${chipBase} bg-surface border-border text-ink px-3 py-1 hover:border-ledger`}
                            >
                                <span className="truncate">{cat}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {buckets.map((bucket) => {
                const shown = bucket.categories.filter(match);
                return (
                    <section key={bucket.id} aria-label={bucket.name} className="bg-surface border border-border rounded-xl shadow-card p-3">
                        <div className="flex mb-2">
                            <BucketTitle bucket={bucket} meta={metaFor(bucket)} onRename={onRename} onIcon={onIcon} onRemove={onRemove} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {shown.map((cat) => (
                                <span key={cat} className={`${chipBase} bg-ledger-soft border-ledger/25 text-ledger-dark pl-3 pr-1 py-0.5`}>
                                    <span className="truncate">{cat}</span>
                                    <button
                                        type="button"
                                        onClick={() => onMove(cat, null)}
                                        aria-label={`Remove ${cat} from ${bucket.name}`}
                                        className="p-1 rounded-full hover:bg-ledger/15"
                                    >
                                        <X size={12} aria-hidden="true" />
                                    </button>
                                </span>
                            ))}
                            {bucket.categories.length === 0 && <span className="text-xs text-ink-muted">No categories yet.</span>}
                            {bucket.categories.length > 0 && shown.length === 0 && <span className="text-xs text-ink-muted">No matches.</span>}
                        </div>
                        <button
                            type="button"
                            onClick={() => setAddingTo(bucket)}
                            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ledger-dark hover:underline"
                        >
                            <Plus size={14} aria-hidden="true" />
                            Add categories
                        </button>
                    </section>
                );
            })}

            {addingTo && <AddCategoriesDialog bucket={addingTo} columns={columns} onClose={() => setAddingTo(null)} onMove={onMove} />}
            {moving && <MoveDialog category={moving} columns={columns} onClose={() => setMoving(null)} onMove={onMove} />}
        </div>
    );
}
