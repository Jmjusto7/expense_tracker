import { getAttentionItems } from "./attention";
import { buildRowUpserts, blankRow, getLastPaidFrom, rememberPaidFrom } from "./transactionRows";
import { colorForKey, SLICE_COLORS } from "./chartFormat";

const today = new Date(2026, 9, 20);

describe("getAttentionItems", () => {
    it("flags overdue payments first, plus stale reconciliations and unlogged statements", () => {
        const accounts = [
            { id: "bank", name: "Bank" },
            { id: "card", name: "Card", isLiability: true, statementCutoffDay: 15, dueDateOffsetDays: 10 },
            { id: "fresh", name: "Fresh" },
        ];
        const entries = [
            { id: "1", accountId: "bank", type: "reconciliation", balance: 100, date: new Date(2026, 6, 1) },
            { id: "2", accountId: "fresh", type: "reconciliation", balance: 5, date: new Date(2026, 9, 18) },
            { id: "3", accountId: "card", type: "reconciliation", balance: -500, date: new Date(2026, 8, 1) },
            { id: "4", accountId: "card", type: "statementClose", date: new Date(2026, 8, 5) },
            { id: "5", accountId: "card", type: "reconciliation", balance: -500, date: new Date(2026, 9, 19) },
        ];

        const items = getAttentionItems(accounts, entries, today);

        expect(items[0]).toMatchObject({ key: "due-card", severity: "alert", to: "/liabilities/card" });
        expect(items.map((i) => i.key)).toEqual(expect.arrayContaining(["stale-bank", "close-card"]));
        expect(items.find((i) => i.key === "stale-bank").to).toBe("/assets/bank");
        expect(items.some((i) => i.account.id === "fresh")).toBe(false);
    });

    it("flags a foreign account with no price", () => {
        const accounts = [{ id: "usd", name: "USD", unit: "USD" }];
        const entries = [{ id: "1", accountId: "usd", type: "reconciliation", balance: 10, date: new Date(2026, 9, 19) }];
        expect(getAttentionItems(accounts, entries, today).map((i) => i.key)).toEqual(["price-usd"]);
    });
});

describe("buildRowUpserts", () => {
    const ctx = { dateLabel: "Oct 20, 2026", travels: [], accounts: [] };

    it("skips blank rows, parses comma parts and keeps ids only for existing rows", () => {
        const rows = [
            blankRow({ category: " Food ", amount: "120, 30" }),
            blankRow(),
            { ...blankRow({ category: "Taxi", amount: "80" }), id: "tx1", isNew: false },
        ];
        const { upserts, error } = buildRowUpserts(rows, ctx);
        expect(error).toBeUndefined();
        expect(upserts).toEqual([
            expect.objectContaining({ category: "Food", amount: 150, amountBreakdown: [120, 30] }),
            expect.objectContaining({ id: "tx1", category: "Taxi", amount: 80 }),
        ]);
        expect(upserts[0]).not.toHaveProperty("id");
    });

    it("returns an error for a bad amount", () => {
        expect(buildRowUpserts([blankRow({ category: "Food", amount: "12x" })], ctx).error).toMatch(/Food/);
    });
});

describe("last Paid From", () => {
    it("remembers the last linked account for the session, if it still exists", () => {
        const accounts = [{ id: "a1", unit: null }];
        expect(getLastPaidFrom(accounts)).toBeNull();
        rememberPaidFrom([{ accountId: null }, { accountId: "a1" }]);
        expect(getLastPaidFrom(accounts)).toBe("a1");
        expect(getLastPaidFrom([])).toBeNull();
    });
});

describe("colorForKey", () => {
    it("is stable per name and from the palette", () => {
        expect(colorForKey("Food")).toBe(colorForKey("Food"));
        expect(SLICE_COLORS).toContain(colorForKey("Transport"));
    });
});
