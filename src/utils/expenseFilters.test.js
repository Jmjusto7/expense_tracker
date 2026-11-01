import { countFilters, lastView, readFilters, rememberView, viewHref, withFilters } from "./expenseFilters";

describe("expense filters in the URL", () => {
    it("reads, counts and writes the shared filter without touching other params", () => {
        const params = new URLSearchParams("from=2026-01&b=b1&c=Food&c=Coffee&q=latte");
        const filters = readFilters(params);
        expect(filters).toEqual({ bucketKeys: ["b1"], categories: ["Food", "Coffee"], query: "latte" });
        expect(countFilters(filters)).toBe(4);
        expect(withFilters("view=calendar&b=old", { bucketKeys: [], categories: ["Food"], query: " " })).toBe("?view=calendar&c=Food");
        expect(withFilters("", { bucketKeys: [], categories: [], query: "" })).toBe("");
    });

    it("returns each view to its last URL, with the current filter applied", () => {
        sessionStorage.clear();
        expect(lastView("overview", "/expenses/overview")).toBe("/expenses/overview");
        rememberView("overview", "/expenses/overview?from=2025-01&to=2025-12&c=Rent&sel=Rent");
        expect(viewHref("overview", "/expenses/overview", { bucketKeys: [], categories: ["Food"], query: "" })).toBe(
            "/expenses/overview?from=2025-01&to=2025-12&sel=Rent&c=Food"
        );
        expect(viewHref("years", "/expenses/years", { bucketKeys: ["b1"], categories: [], query: "" })).toBe("/expenses/years?b=b1");
    });
});
