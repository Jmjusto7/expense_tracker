import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markTourSeen, setToursEnabled, shouldShowTour } from "../utils/tours";

// Only one tour on screen at a time; later ones wait their turn.
let activeTour = null;

const visibleMatch = (selector) =>
    selector
        ? [...document.querySelectorAll(selector)].find((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        }) ?? null
        : null;

const PAD = 6;
const GAP = 12;
const WIDTH = 320;

/**
 * First-visit walkthrough. steps: [{ target?: CSS selector, title, body }].
 * Steps whose target isn't on screen show centred. Shown once per device per id; Skip or
 * "Turn off tips" ends it.
 */
export default function Tour({ id, steps, delay = 400 }) {
    const [index, setIndex] = useState(-1);
    const [rect, setRect] = useState(null);
    const titleId = useId();
    const nextRef = useRef(null);
    const cardRef = useRef(null);
    const step = index >= 0 ? steps[index] : null;
    const target = step?.target;

    useEffect(() => {
        if (import.meta.env.MODE === "test" || !shouldShowTour(id)) return;
        let timer;
        const tryStart = () => {
            if (activeTour) {
                timer = setTimeout(tryStart, 500);
                return;
            }
            activeTour = id;
            setIndex(0);
        };
        timer = setTimeout(tryStart, delay);
        return () => {
            clearTimeout(timer);
            if (activeTour === id) activeTour = null;
        };
    }, [id, delay]);

    const finish = useCallback(
        ({ allOff = false } = {}) => {
            markTourSeen(id);
            if (allOff) setToursEnabled(false);
            if (activeTour === id) activeTour = null;
            setIndex(-1);
        },
        [id]
    );

    // Measure (and scroll to) the current step's target; re-measure on scroll/resize.
    useLayoutEffect(() => {
        if (index < 0) return;
        const el = visibleMatch(target);
        el?.scrollIntoView({ block: "center", inline: "nearest" });
        const measure = () => {
            const current = visibleMatch(target);
            setRect(current ? current.getBoundingClientRect() : null);
        };
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [index, target]);

    const open = index >= 0;
    useEffect(() => {
        if (!open) return;
        nextRef.current?.focus();
        // Capture phase so open dialogs underneath don't also react to Esc.
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                e.preventDefault();
                finish();
            } else if (e.key === "Tab") {
                const buttons = [...(cardRef.current?.querySelectorAll("button") ?? [])];
                if (!buttons.length) return;
                e.stopPropagation();
                e.preventDefault();
                const i = buttons.indexOf(document.activeElement);
                buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [open, index, finish]);

    if (!step) return null;

    const last = index === steps.length - 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - 24);
    let style;
    if (rect) {
        const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 12), vw - width - 12);
        const below = vh - rect.bottom > 220 || rect.top < 220;
        style = below
            ? { left, width, top: Math.min(rect.bottom + PAD + GAP, vh - 200) }
            : { left, width, top: rect.top - PAD - GAP, transform: "translateY(-100%)" };
    } else {
        style = { left: (vw - width) / 2, width, top: "50%", transform: "translateY(-50%)" };
    }

    return createPortal(
        <div className="fixed inset-0 z-[60]">
            {rect ? (
                <div
                    aria-hidden="true"
                    className="absolute rounded-xl ring-2 ring-white/80 pointer-events-none"
                    style={{
                        left: rect.left - PAD,
                        top: rect.top - PAD,
                        width: rect.width + PAD * 2,
                        height: rect.height + PAD * 2,
                        boxShadow: "0 0 0 9999px rgba(20, 28, 25, 0.55)",
                    }}
                />
            ) : (
                <div aria-hidden="true" className="absolute inset-0 bg-ink/55" />
            )}
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="absolute bg-surface rounded-xl shadow-2xl border border-border p-4"
                style={style}
            >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ledger-dark">
                    Tip {index + 1} of {steps.length}
                </p>
                <h2 id={titleId} className="font-display text-lg text-ink mt-0.5">
                    {step.title}
                </h2>
                <div className="text-sm text-ink-muted mt-1 leading-relaxed">{step.body}</div>
                <div className="flex items-center justify-between gap-2 mt-4">
                    <button type="button" onClick={() => finish()} className="text-sm text-ink-muted hover:text-ink">
                        Skip
                    </button>
                    <div className="flex items-center gap-2">
                        {index > 0 && (
                            <button
                                type="button"
                                onClick={() => setIndex((i) => i - 1)}
                                className="text-sm border border-border text-ink px-3 py-1.5 rounded-lg hover:bg-surface-sunken"
                            >
                                Back
                            </button>
                        )}
                        <button
                            ref={nextRef}
                            type="button"
                            onClick={() => (last ? finish() : setIndex((i) => i + 1))}
                            className="text-sm bg-ledger hover:bg-ledger-dark text-white px-3 py-1.5 rounded-lg"
                        >
                            {last ? "Got it" : "Next"}
                        </button>
                    </div>
                </div>
                {index === 0 && (
                    <button type="button" onClick={() => finish({ allOff: true })} className="mt-3 text-xs text-ink-muted underline hover:text-ink">
                        Don&apos;t show tips anywhere
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}
