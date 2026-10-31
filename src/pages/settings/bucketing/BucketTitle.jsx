import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import ConfirmButton from "../../../components/ConfirmButton";

// Bucket title with inline rename and a two-tap remove.
export default function BucketTitle({ bucket, meta, onRename, onRemove }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(bucket.name);

    const cancel = () => {
        setName(bucket.name);
        setEditing(false);
    };

    if (editing) {
        return (
            <form
                className="flex items-center gap-1 min-w-0 flex-1"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (name.trim() && name.trim() !== bucket.name) await onRename(bucket.id, name);
                    setEditing(false);
                }}
            >
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.stopPropagation();
                            cancel();
                        }
                    }}
                    aria-label={`New name for ${bucket.name}`}
                    autoFocus
                    className="flex-1 min-w-0 border border-border rounded-md px-2 py-1 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                />
                <button type="submit" aria-label="Save name" className="p-1 rounded-md text-ledger-dark hover:bg-ledger-soft">
                    <Check size={15} aria-hidden="true" />
                </button>
                <button type="button" aria-label="Cancel rename" onClick={cancel} className="p-1 rounded-md text-ink-muted hover:bg-surface-sunken">
                    <X size={15} aria-hidden="true" />
                </button>
            </form>
        );
    }

    return (
        <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink break-words">{bucket.name}</h3>
                {meta && <p className="text-[11px] text-ink-muted">{meta}</p>}
            </div>
            <div className="flex items-center shrink-0">
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label={`Rename ${bucket.name}`}
                    title="Rename"
                    className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
                >
                    <Pencil size={13} aria-hidden="true" />
                </button>
                <ConfirmButton
                    onConfirm={() => onRemove(bucket.id)}
                    aria-label={`Remove ${bucket.name}`}
                    className="p-1.5 rounded-md text-ink-muted hover:text-alert hover:bg-alert-soft"
                    confirmClassName="text-[11px] font-medium text-white bg-alert rounded-md px-1.5 py-1"
                    confirmLabel="Remove?"
                    title={`Remove "${bucket.name}"? Its categories become Unassigned.`}
                >
                    <Trash2 size={13} aria-hidden="true" />
                </ConfirmButton>
            </div>
        </div>
    );
}
