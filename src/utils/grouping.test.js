import { groupRootsByType, sortRoots, buildAccountTree, UNCLASSIFIED } from "./accountHierarchy";
import { groupTravelsByYear, findTravelForDate } from "./travelHelpers";

describe("groupRootsByType", () => {
    const accounts = [
        { id: "bank", name: "Bank", typeId: "t-bank" },
        { id: "usd", name: "USD wallet", typeId: "t-inv", unit: "USD" },
        { id: "voo", name: "VOO", typeId: "t-inv", unit: "VOO", costCurrencyAccountId: "usd" },
        { id: "cash", name: "Cash", typeId: null },
    ];
    const types = [
        { id: "t-bank", name: "Bank" },
        { id: "t-inv", name: "Investment" },
    ];
    const values = { bank: 1000, usd: 0, voo: 50000, cash: null };

    it("groups by the root's type, counts holdings, and keeps Unclassified last", () => {
        const groups = groupRootsByType(buildAccountTree(accounts), types, (a) => values[a.id]);

        expect(groups.map((g) => [g.name, g.subtotal, g.count, g.unvalued])).toEqual([
            ["Investment", 50000, 2, 0],
            ["Bank", 1000, 1, 0],
            ["Unclassified", 0, 1, 1],
        ]);
        expect(groups[2].key).toBe(UNCLASSIFIED);
    });

    it("sorts roots by value including holdings, or by name", () => {
        const roots = buildAccountTree(accounts);
        const valueOf = (a) => values[a.id];
        const staleDaysOf = () => 0;

        expect(sortRoots(roots, "value", { valueOf, staleDaysOf }).map((r) => r.id)).toEqual(["usd", "bank", "cash"]);
        expect(sortRoots(roots, "name", { valueOf, staleDaysOf }).map((r) => r.id)).toEqual(["bank", "cash", "usd"]);
    });
});

describe("travel grouping", () => {
    const trip = (id, start, end) => ({ id, title: id, startDate: new Date(start), endDate: new Date(end) });
    const travels = [
        trip("bali-24", "2024-05-01", "2024-05-07"),
        trip("tokyo-25", "2025-03-01", "2025-03-10"),
        trip("cebu-25", "2025-11-01", "2025-11-03"),
        trip("seoul-26", "2026-11-20", "2026-11-25"),
    ];

    it("pins current/upcoming trips and groups the rest by year, newest first", () => {
        const { pinned, years } = groupTravelsByYear(travels, new Date(2026, 9, 31));

        expect(pinned.map((t) => t.id)).toEqual(["seoul-26"]);
        expect(years.map((y) => [y.year, y.travels.map((t) => t.id)])).toEqual([
            [2025, ["cebu-25", "tokyo-25"]],
            [2024, ["bali-24"]],
        ]);
    });

    it("finds the trip whose dates contain an expense date", () => {
        expect(findTravelForDate(travels, new Date(2025, 2, 5))?.id).toBe("tokyo-25");
        expect(findTravelForDate(travels, new Date(2025, 5, 5))).toBeNull();
    });
});
