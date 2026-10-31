import { ChevronDown } from "lucide-react";

// Collapsible section with a summary line; children render in a card grid.
export default function AccountGroup({ id, title, summary, collapsed, onToggle, children }) {
    const panelId = `group-panel-${id}`;
    return (
        <section className="mb-6">
            <h2 className="mb-3">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={!collapsed}
                    aria-controls={panelId}
                    className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 text-left rounded-md px-1 py-1 hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
                >
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={`text-ink-muted transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    />
                    <span className="font-semibold text-ink">{title}</span>
                    <span className="ml-auto flex flex-wrap items-baseline gap-x-3 text-sm">{summary}</span>
                </button>
            </h2>
            <div id={panelId} hidden={collapsed} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {children}
            </div>
        </section>
    );
}
