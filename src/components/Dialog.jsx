// src/components/Dialog.jsx
import { createContext, useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { registerOpenDialog } from "../utils/dialogRegistry";

const SIZES = {
    md: "sm:max-w-md",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-6xl",
};

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only the top-most dialog reacts to Esc / Tab when dialogs are stacked: the
// deepest in the React tree (children mount before parents), then the newest.
const stack = [];
let seq = 0;
let scrollLocks = 0;
const DepthContext = createContext(0);
const topPanel = () =>
    stack.reduce((top, e) => (!top || e.depth > top.depth || (e.depth === top.depth && e.seq > top.seq) ? e : top), null)?.panel;

/**
 * Accessible modal: full-screen sheet on phones, centred card from `sm` up.
 * Esc closes, Ctrl/Cmd+Enter submits, focus is trapped and restored.
 */
export default function Dialog({
    title,
    icon,
    onClose,
    onSubmit,
    onSubmitAnother,
    submitLabel = "Save",
    busyLabel = "Saving…",
    submitClassName = "bg-ledger hover:bg-ledger-dark",
    cancelLabel = "Cancel",
    busy = false,
    submitDisabled = false,
    error = "",
    size = "md",
    footer,
    footerStart,
    children,
}) {
    const titleId = useId();
    const depth = useContext(DepthContext) + 1;
    const panelRef = useRef(null);
    const bodyRef = useRef(null);
    const latest = useRef({ onClose, onSubmit, busy, submitDisabled });
    useEffect(() => {
        latest.current = { onClose, onSubmit, busy, submitDisabled };
    });

    useEffect(() => {
        const panel = panelRef.current;
        const previouslyFocused = document.activeElement;
        const releaseRegistry = registerOpenDialog();
        const entry = { panel, depth, seq: seq++ };
        stack.push(entry);
        if (scrollLocks++ === 0) document.body.style.overflow = "hidden";

        if (topPanel() === panel) {
            const first =
                panel.querySelector("[data-autofocus]") ?? bodyRef.current?.querySelector(FOCUSABLE) ?? panel.querySelector(FOCUSABLE);
            (first ?? panel).focus();
        }

        const onKeyDown = (e) => {
            if (topPanel() !== panel) return;
            const { onClose: close, onSubmit: submit, busy: isBusy, submitDisabled: blocked } = latest.current;
            if (e.key === "Escape" && !isBusy) {
                e.preventDefault();
                close();
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit && !isBusy && !blocked) {
                e.preventDefault();
                submit();
            } else if (e.key === "Tab") {
                const focusables = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
                if (focusables.length === 0) return;
                const firstEl = focusables[0];
                const lastEl = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                } else if (!e.shiftKey && document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            stack.splice(stack.indexOf(entry), 1);
            if (--scrollLocks === 0) document.body.style.overflow = "";
            releaseRegistry();
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
        };
    }, [depth]);

    const Icon = icon;
    const defaultFooter = (
        <>
            <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-60"
            >
                {cancelLabel}
            </button>
            {onSubmitAnother && (
                <button
                    type="button"
                    onClick={onSubmitAnother}
                    disabled={busy || submitDisabled}
                    className="border border-border text-ink px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-60"
                >
                    Save &amp; add another
                </button>
            )}
            {onSubmit && (
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={busy || submitDisabled}
                    className={`text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${submitClassName}`}
                >
                    {busy ? busyLabel : submitLabel}
                </button>
            )}
        </>
    );

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-ink/40">
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={`bg-surface shadow-lg flex flex-col w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:w-[90%] sm:rounded-xl focus:outline-none ${SIZES[size] ?? SIZES.md}`}
            >
                <div className="flex items-center gap-2 px-4 sm:px-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-5 pb-3 border-b border-border sm:border-0">
                    {Icon && <Icon size={18} className="text-ledger-dark shrink-0" aria-hidden="true" />}
                    <h2 id={titleId} className="font-display text-xl text-ink flex-1 min-w-0 break-words">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                        className="p-1 -mr-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                    <DepthContext.Provider value={depth}>{children}</DepthContext.Provider>
                </div>

                <div className="border-t border-border sm:border-0 px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-5">
                    {error && (
                        <p role="alert" className="text-sm text-alert bg-alert-soft rounded-md px-3 py-2 mb-3">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {footerStart && <div className="mr-auto">{footerStart}</div>}
                        {footer ?? defaultFooter}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Labelled form row; `htmlFor` ties the label to its input.
export function Field({ label, htmlFor, hint, children }) {
    return (
        <div>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-muted mb-1">
                {label}
            </label>
            {children}
            {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
        </div>
    );
}

export const inputClass =
    "w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50";
