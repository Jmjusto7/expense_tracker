import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import BucketTitle from "./BucketTitle";

// Desktop board: drag categories between columns. Keyboard: Space picks a category up,
// Left/Right moves it to the neighbouring column, Space or Escape puts it down.
export default function BucketBoard({ columns, query, onMove, onRename, onRemove, metaFor }) {
    const [overId, setOverId] = useState(undefined);
    const [picked, setPicked] = useState(null);
    const [announcement, setAnnouncement] = useState("");
    const boardRef = useRef(null);
    const q = query.trim().toLowerCase();

    useEffect(() => {
        if (!picked) return;
        boardRef.current?.querySelector(`[data-cat="${CSS.escape(picked)}"]`)?.focus();
    }, [columns, picked]);

    const columnOf = (category) => columns.findIndex((c) => c.categories.includes(category));

    const handleKeyDown = (e, category) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            const next = picked === category ? null : category;
            setPicked(next);
            setAnnouncement(next ? `Picked up ${category}. Use left and right arrows to move it, Space to drop.` : `Dropped ${category}.`);
        } else if (e.key === "Escape" && picked) {
            setPicked(null);
            setAnnouncement(`Dropped ${category}.`);
        } else if (picked === category && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
            e.preventDefault();
            const target = columns[columnOf(category) + (e.key === "ArrowRight" ? 1 : -1)];
            if (!target) return;
            onMove(category, target.id);
            setAnnouncement(`${category} moved to ${target.name}.`);
        }
    };

    return (
        <div ref={boardRef}>
            <p className="text-xs text-ink-muted mb-3">
                Drag categories between columns. Keyboard: focus a category, press Space, then ← / →.
            </p>
            <div className="grid grid-flow-col auto-cols-[minmax(200px,1fr)] gap-3 overflow-x-auto pb-2">
                {columns.map((col) => {
                    const items = q ? col.categories.filter((c) => c.toLowerCase().includes(q)) : col.categories;
                    const unassigned = col.id === null;
                    return (
                        <section
                            key={col.id ?? "unassigned"}
                            aria-label={`${col.name}, ${col.categories.length} categories`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (overId !== col.id) setOverId(col.id);
                            }}
                            onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) setOverId(undefined);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setOverId(undefined);
                                const category = e.dataTransfer.getData("text/plain");
                                if (category && !col.categories.includes(category)) onMove(category, col.id);
                            }}
                            className={`flex flex-col rounded-xl border p-2 min-h-[16rem] transition-colors ${unassigned ? "bg-warning-soft border-warning/30" : "bg-surface-sunken border-border"
                                } ${overId === col.id ? "ring-2 ring-ledger ring-offset-1" : ""}`}
                        >
                            <div className="flex items-start gap-2 px-1 pb-2">
                                {unassigned ? (
                                    <div>
                                        <h3 className="text-sm font-semibold text-ink">Unassigned</h3>
                                        <p className="text-[11px] text-ink-muted">{col.categories.length} · left out of bucket totals</p>
                                    </div>
                                ) : (
                                    <BucketTitle bucket={col} meta={metaFor(col)} onRename={onRename} onRemove={onRemove} />
                                )}
                            </div>
                            <ul className="flex flex-col gap-1.5 flex-1">
                                {items.map((category) => (
                                    <li key={category}>
                                        <button
                                            type="button"
                                            draggable
                                            data-cat={category}
                                            aria-pressed={picked === category}
                                            aria-roledescription="draggable category"
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData("text/plain", category);
                                                e.dataTransfer.effectAllowed = "move";
                                            }}
                                            onKeyDown={(e) => handleKeyDown(e, category)}
                                            className={`w-full flex items-center gap-1.5 text-left text-sm bg-surface border rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ledger ${picked === category ? "border-ledger ring-2 ring-ledger" : "border-border hover:border-ledger"
                                                }`}
                                        >
                                            <GripVertical size={14} className="text-ink-muted/60 shrink-0" aria-hidden="true" />
                                            <span className="min-w-0 break-words">{category}</span>
                                        </button>
                                    </li>
                                ))}
                                {items.length === 0 && (
                                    <li className="text-xs text-ink-muted text-center border border-dashed border-border rounded-lg py-4 px-2">
                                        {q ? "No matches" : "Drop categories here"}
                                    </li>
                                )}
                            </ul>
                        </section>
                    );
                })}
            </div>
            <p className="sr-only" aria-live="polite">
                {announcement}
            </p>
        </div>
    );
}
