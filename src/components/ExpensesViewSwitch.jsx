import { Link, useSearchParams } from "react-router-dom";
import { readFilters, viewHref } from "../utils/expenseFilters";

// Month statement / overview / years. Each tab returns to where you last were in that view
// and carries the current bucket/category/search filter across.
export default function ExpensesViewSwitch({ current }) {
    const [params] = useSearchParams();
    const filters = readFilters(params);
    const item = (view, fallback, label) => {
        const active = current === view;
        return (
            <Link
                to={viewHref(view, fallback, filters)}
                aria-current={active ? "page" : undefined}
                className={`px-2.5 sm:px-3 py-1 rounded-full transition-colors ${active ? "bg-surface text-ink font-semibold shadow-sm" : "text-ink-muted hover:text-ink"
                    }`}
            >
                {label}
            </Link>
        );
    };
    return (
        <nav aria-label="Expenses view" className="inline-flex items-center rounded-full border border-border bg-surface-sunken p-0.5 text-xs sm:text-sm">
            {item("month", "/expenses", "Month")}
            {item("overview", "/expenses/overview", "Overview")}
            {item("years", "/expenses/years", "Years")}
        </nav>
    );
}
