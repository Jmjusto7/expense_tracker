import {
    applyFilters,
    monthlyAverage,
    formatRange,
    groupTotals,
    inRange,
    monthsBetween,
    parseMonthKey,
    presetRange,
    seriesFor,
    shiftMonthKey,
} from "./overviewHelpers";

const tx = (yearNumber, monthName, category, amount, extra = {}) => ({ yearNumber, monthName, category, amount, ...extra });

describe("overview month keys", () => {
    it("parses, shifts and spans months across a year boundary", () => {
        expect(parseMonthKey("2026-10")).toEqual({ year: 2026, month: 9 });
        expect(parseMonthKey("2026-13")).toBeNull();
        expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
        expect(monthsBetween("2025-11", "2026-02").map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
        expect(formatRange("2026-01", "2026-10")).toBe("Jan - Oct 2026");
        expect(formatRange("2025-11", "2026-10")).toBe("Nov 2025 - Oct 2026");
    });

    it("builds preset ranges from today", () => {
        const today = new Date(2026, 9, 31);
        expect(presetRange("this-year", today)).toEqual({ from: "2026-01", to: "2026-10" });
        expect(presetRange("last-month", today)).toEqual({ from: "2026-09", to: "2026-09" });
        expect(presetRange("last-12", today)).toEqual({ from: "2025-11", to: "2026-10" });
        expect(presetRange("all", today, "2024-03")).toEqual({ from: "2024-03", to: "2026-10" });
    });
});

describe("overview grouping and series", () => {
    const data = [
        tx(2025, "December", "Food", 100),
        tx(2026, "January", "Food", 200),
        tx(2026, "January", "Food", 50, { travelId: "t1" }),
        tx(2026, "February", "Rent", 1000),
    ];

    it("keeps trip spending under its category, or under Travel when grouping by bucket", () => {
        const inJanFeb = data.filter((t) => inRange(t, "2026-01", "2026-02"));
        expect(groupTotals(inJanFeb, "category").map((r) => [r.label, r.total])).toEqual([
            ["Rent", 1000],
            ["Food", 250],
        ]);
        const byBucket = groupTotals(inJanFeb, "bucket", [{ id: "b1", name: "Eating", categories: ["Food"] }]);
        expect(byBucket.map((r) => [r.label, r.total])).toEqual([
            ["Unassigned", 1000],
            ["Eating", 200],
            ["Travel", 50],
        ]);
    });

    it("carries the bucket icon to bucket rows and to that bucket's categories (even on trips)", () => {
        const buckets = [{ id: "b1", name: "Eating", icon: "🍔", categories: ["Food"] }];
        const inJan = data.filter((t) => inRange(t, "2026-01", "2026-01"));
        expect(groupTotals(inJan, "category", buckets).map((r) => [r.label, r.icon])).toEqual([["Food", "🍔"]]);
        expect(groupTotals(inJan, "bucket", buckets).map((r) => [r.label, r.icon])).toEqual([
            ["Eating", "🍔"],
            ["Travel", "✈️"],
        ]);
    });

    it("filters by effective bucket and category, and averages over every calendar month", () => {
        const buckets = [{ id: "b1", name: "Eating", categories: ["Food"] }];
        expect(applyFilters(data, { bucketKeys: ["b1"] }, buckets).map((t) => t.amount)).toEqual([100, 200]);
        expect(applyFilters(data, { bucketKeys: ["__travel__"] }, buckets).map((t) => t.amount)).toEqual([50]);
        expect(applyFilters(data, { categories: ["Food"] }, buckets)).toHaveLength(3);
        expect(applyFilters(data, { query: " REN " }, buckets).map((t) => t.category)).toEqual(["Rent"]);
        expect(monthlyAverage(data, "2025-12", "2026-03")).toEqual({ average: 1350 / 4, months: 4 });
    });

    it("totals by month or by year with zeros for empty periods", () => {
        expect(seriesFor(data, "2025-12", "2026-03")).toEqual([
            { key: "2025-12", value: 100 },
            { key: "2026-01", value: 250 },
            { key: "2026-02", value: 1000 },
            { key: "2026-03", value: 0 },
        ]);
        expect(seriesFor(data, "2025-12", "2026-03", "year")).toEqual([
            { key: "2025", value: 100 },
            { key: "2026", value: 1250 },
        ]);
    });
});
