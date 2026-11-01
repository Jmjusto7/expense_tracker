// Shared bucket/category/search filter for the Expenses views (Month, Overview, Years).
// Lives in the URL (?b=&c=&q=) so switching views, Back and bookmarks keep it.
export const FILTER_PARAMS = ["b", "c", "q"];

export function readFilters(params) {
    return { bucketKeys: params.getAll("b"), categories: params.getAll("c"), query: params.get("q") ?? "" };
}

export const countFilters = (f) => f.bucketKeys.length + f.categories.length + (f.query.trim() ? 1 : 0);

// Writes the filter onto a search string, keeping every other param.
export function withFilters(search, filters) {
    const next = new URLSearchParams(search);
    FILTER_PARAMS.forEach((k) => next.delete(k));
    filters.bucketKeys.forEach((v) => next.append("b", v));
    filters.categories.forEach((v) => next.append("c", v));
    if (filters.query.trim()) next.set("q", filters.query);
    const s = next.toString();
    return s ? `?${s}` : "";
}

const storageKey = (view) => `tracker.expenses.last.${view}`;

// Last URL seen per view, so the view switch returns to the same month/period.
export function rememberView(view, url) {
    try {
        sessionStorage.setItem(storageKey(view), url);
    } catch {
        // Private mode / storage full: the switch just falls back to defaults.
    }
}

export function lastView(view, fallback) {
    try {
        return sessionStorage.getItem(storageKey(view)) || fallback;
    } catch {
        return fallback;
    }
}

// Target for a view link: its last URL, with the current filter applied.
export function viewHref(view, fallback, filters) {
    const [pathname, search = ""] = lastView(view, fallback).split("?");
    return `${pathname}${withFilters(search, filters)}`;
}
