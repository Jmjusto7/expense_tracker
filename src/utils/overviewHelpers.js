import { ALL_MONTHS, monthIndexOf } from "./dateHelpers";
import { classifyTransactions } from "./transactionClassification";

const pad = (n) => String(n).padStart(2, "0");

// "YYYY-MM" keys sort and compare correctly as plain strings.
export const monthKey = (year, monthIndex) => `${year}-${pad(monthIndex + 1)}`;

export const keyOfDate = (date) => monthKey(date.getFullYear(), date.getMonth());

export function parseMonthKey(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
    if (!m) return null;
    const month = Number(m[2]) - 1;
    if (month < 0 || month > 11) return null;
    return { year: Number(m[1]), month };
}

export const txMonthKey = (t) => (t.yearNumber && t.monthName ? monthKey(t.yearNumber, monthIndexOf(t.monthName)) : null);

export function shiftMonthKey(key, months) {
    const { year, month } = parseMonthKey(key);
    const d = new Date(year, month + months, 1);
    return keyOfDate(d);
}

export function monthsBetween(fromKey, toKey) {
    const out = [];
    for (let key = fromKey; key <= toKey; key = shiftMonthKey(key, 1)) {
        const { year, month } = parseMonthKey(key);
        out.push({ key, year, month });
    }
    return out;
}

export const formatMonthKey = (key, style = "long") => {
    const { year, month } = parseMonthKey(key);
    const name = ALL_MONTHS[month];
    return `${style === "short" ? name.slice(0, 3) : name} ${year}`;
};

export function formatRange(fromKey, toKey) {
    if (fromKey === toKey) return formatMonthKey(fromKey);
    const from = parseMonthKey(fromKey);
    const to = parseMonthKey(toKey);
    if (from.year === to.year) return `${ALL_MONTHS[from.month].slice(0, 3)} - ${ALL_MONTHS[to.month].slice(0, 3)} ${to.year}`;
    return `${formatMonthKey(fromKey, "short")} - ${formatMonthKey(toKey, "short")}`;
}

export const PRESETS = [
    { id: "this-month", label: "This month" },
    { id: "last-month", label: "Last month" },
    { id: "this-year", label: "This year" },
    { id: "last-12", label: "Last 12 months" },
    { id: "all", label: "All time" },
];

export function presetRange(id, today, earliestKey) {
    const current = keyOfDate(today);
    switch (id) {
        case "this-month":
            return { from: current, to: current };
        case "last-month": {
            const last = shiftMonthKey(current, -1);
            return { from: last, to: last };
        }
        case "last-12":
            return { from: shiftMonthKey(current, -11), to: current };
        case "all":
            return { from: earliestKey && earliestKey < current ? earliestKey : current, to: current };
        default:
            return { from: `${today.getFullYear()}-01`, to: current };
    }
}

export const inRange = (t, fromKey, toKey) => {
    const key = txMonthKey(t);
    return key != null && key >= fromKey && key <= toKey;
};

// Rows for the ranked list. group "category" keeps travel-tagged spend under its own category;
// "bucket" uses effective buckets, where Travel is its own bucket. Category rows carry their bucket's icon.
export function groupTotals(transactions, group, buckets = []) {
    const map = new Map();
    const rows = classifyTransactions(transactions, buckets, { ignoreTravelOverride: group !== "bucket" });
    for (const t of rows) {
        const key = group === "bucket" ? String(t.effectiveBucketId ?? "unassigned") : t.category || "Uncategorized";
        const label = group === "bucket" ? t.effectiveBucketLabel : t.category || "Uncategorized";
        if (!map.has(key)) {
            map.set(key, {
                key,
                label,
                icon: t.effectiveBucketIcon ?? null,
                total: 0,
                count: 0,
                bucketId: group === "bucket" ? t.effectiveBucketId ?? null : null,
            });
        }
        const row = map.get(key);
        row.total += Number(t.amount ?? 0);
        row.count += 1;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
}

export const rowKeyOf = (t, group, buckets) =>
    group === "bucket"
        ? String(classifyTransactions([t], buckets)[0].effectiveBucketId ?? "unassigned")
        : t.category || "Uncategorized";

// Narrows to the chosen buckets (effective, so Travel is its own), categories and a text search
// over category + comment; empty values mean "all".
export function applyFilters(transactions, { bucketKeys = [], categories = [], query = "" }, buckets = []) {
    const q = query.trim().toLowerCase();
    if (bucketKeys.length === 0 && categories.length === 0 && !q) return transactions;
    return classifyTransactions(transactions, buckets).filter(
        (t) =>
            (bucketKeys.length === 0 || bucketKeys.includes(String(t.effectiveBucketId ?? "unassigned"))) &&
            (categories.length === 0 || categories.includes(t.category || "Uncategorized")) &&
            (!q || `${t.category ?? ""} ${t.comments ?? ""}`.toLowerCase().includes(q))
    );
}

// Average per calendar month from fromKey to toKey (inclusive), counting months with no spending.
export function monthlyAverage(transactions, fromKey, toKey) {
    const months = monthsBetween(fromKey, toKey).length;
    if (months === 0) return { average: 0, months: 0 };
    const total = transactions.filter((t) => inRange(t, fromKey, toKey)).reduce((s, t) => s + Number(t.amount ?? 0), 0);
    return { average: total / months, months };
}

// Totals per period ("month" -> YYYY-MM, "year" -> YYYY) across the whole range, zeros included.
export function seriesFor(transactions, fromKey, toKey, by = "month") {
    const months = monthsBetween(fromKey, toKey);
    const keys = by === "year" ? [...new Set(months.map((m) => String(m.year)))] : months.map((m) => m.key);
    const totals = new Map(keys.map((k) => [k, 0]));
    for (const t of transactions) {
        const mk = txMonthKey(t);
        if (!mk) continue;
        const k = by === "year" ? mk.slice(0, 4) : mk;
        if (totals.has(k)) totals.set(k, totals.get(k) + Number(t.amount ?? 0));
    }
    return keys.map((key) => ({ key, value: totals.get(key) }));
}
