import { Pencil, Trash2 } from "lucide-react";
import ConfirmButton from "./ConfirmButton";

// Edit/delete buttons that stay visible on touch screens and only fade on
// devices that can hover. Sits above a card's stretched link (z-10).
export default function CardActions({ onEdit, onDelete, deleteTitle, label, size = 14, compact = false }) {
    const buttonClass = compact
        ? "text-ink-muted hover:text-ink p-1"
        : "bg-surface border border-border text-ink-muted hover:text-ink rounded-md p-1.5";

    return (
        <div className="relative z-10 flex gap-1.5 transition-opacity [@media(hover:hover)]:opacity-70 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} title={`Edit ${label}`} className={buttonClass}>
                <Pencil size={size} aria-hidden="true" />
            </button>
            <ConfirmButton
                onConfirm={onDelete}
                aria-label={`Delete ${label}`}
                className={compact ? "text-ink-muted hover:text-alert p-1" : `${buttonClass} hover:text-alert`}
                confirmClassName={
                    compact
                        ? "text-alert text-[10px] font-medium px-1"
                        : "bg-alert text-white border border-alert rounded-md p-1.5 text-xs font-medium px-2"
                }
                title={deleteTitle}
            >
                <Trash2 size={size} aria-hidden="true" />
            </ConfirmButton>
        </div>
    );
}
