import { useState } from "react";
import { Check, Pencil, SmilePlus, Trash2, X } from "lucide-react";
import ConfirmButton from "../../../components/ConfirmButton";

const SUGGESTED = ["🍔", "🛒", "☕", "🍽️", "🏠", "💡", "🚗", "🚌", "⛽", "🎬", "🎮", "🎁", "👕", "💊", "🏥", "📚", "💼", "📱", "🐶", "👶", "🏋️", "💳", "🎉", "🛍️"];

// Keeps the first visible character, so a pasted sentence doesn't become an "icon".
const firstGrapheme = (text) => {
    const value = text.trim();
    if (!value) return "";
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
        return new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)[Symbol.iterator]().next().value?.segment ?? "";
    }
    return [...value][0];
};

function IconPicker({ bucket, onPick, onClose }) {
    const [custom, setCustom] = useState("");
    const pick = async (icon) => {
        await onPick(bucket.id, icon);
        onClose();
    };
    return (
        <div
            className="mt-2 rounded-lg border border-border bg-surface p-2"
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            <div className="grid grid-cols-6 gap-1" role="group" aria-label={`Icon for ${bucket.name}`}>
                {SUGGESTED.map((icon) => (
                    <button
                        key={icon}
                        type="button"
                        onClick={() => pick(icon)}
                        aria-pressed={bucket.icon === icon}
                        aria-label={`Use ${icon}`}
                        className={`h-8 rounded-md text-lg leading-none hover:bg-surface-sunken ${bucket.icon === icon ? "ring-2 ring-ledger" : ""}`}
                    >
                        {icon}
                    </button>
                ))}
            </div>
            <form
                className="flex items-center gap-1 mt-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    const icon = firstGrapheme(custom);
                    if (icon) pick(icon);
                }}
            >
                <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Any emoji"
                    aria-label="Type or paste an emoji"
                    className="flex-1 min-w-0 border border-border rounded-md px-2 py-1 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                />
                <button type="submit" className="text-xs font-medium text-ledger-dark px-2 py-1 rounded-md hover:bg-ledger-soft">
                    Use
                </button>
            </form>
            <div className="flex justify-between mt-1">
                {bucket.icon ? (
                    <button type="button" onClick={() => pick("")} className="text-xs text-ink-muted hover:text-alert">
                        Remove icon
                    </button>
                ) : (
                    <span />
                )}
                <button type="button" onClick={onClose} className="text-xs text-ink-muted hover:text-ink">
                    Close
                </button>
            </div>
        </div>
    );
}

// Bucket title with an emoji icon, inline rename and a two-tap remove.
export default function BucketTitle({ bucket, meta, onRename, onIcon, onRemove }) {
    const [editing, setEditing] = useState(false);
    const [picking, setPicking] = useState(false);
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
        <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-start gap-2 min-w-0">
                    {onIcon && (
                        <button
                            type="button"
                            onClick={() => setPicking((v) => !v)}
                            aria-expanded={picking}
                            aria-label={bucket.icon ? `Change icon for ${bucket.name} (${bucket.icon})` : `Add an icon to ${bucket.name}`}
                            title="Icon"
                            className="h-8 w-8 shrink-0 grid place-items-center rounded-lg border border-dashed border-border bg-surface text-lg leading-none text-ink-muted hover:border-ledger"
                        >
                            {bucket.icon || <SmilePlus size={15} aria-hidden="true" />}
                        </button>
                    )}
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-ink break-words">{bucket.name}</h3>
                        {meta && <p className="text-[11px] text-ink-muted">{meta}</p>}
                    </div>
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
            {picking && <IconPicker bucket={bucket} onPick={onIcon} onClose={() => setPicking(false)} />}
        </div>
    );
}
