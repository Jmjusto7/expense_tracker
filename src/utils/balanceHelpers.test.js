import {
    getBalanceAsOf,
    getCurrentValuePhp,
    getUnvaluedAccounts,
    suggestNextCutoffDate,
    getNextStatementClose,
} from "./balanceHelpers";

const entry = (fields) => ({ accountId: "acc", date: new Date(2026, 2, 5), amount: null, balance: null, ...fields });

describe("getBalanceAsOf with UUID ids", () => {
    it("orders same-day entries by creation time, not by id", () => {
        const entries = [
            entry({ id: "zzz", type: "income", amount: 5, createdAt: new Date(2026, 2, 5, 8) }),
            entry({ id: "mmm", type: "reconciliation", balance: 100, createdAt: new Date(2026, 2, 5, 9) }),
            entry({ id: "aaa", type: "income", amount: 20, createdAt: new Date(2026, 2, 5, 10) }),
        ];

        expect(getBalanceAsOf(entries, "acc", new Date(2026, 2, 5))).toBe(120);
    });
});

describe("getCurrentValuePhp", () => {
    const accounts = [
        { id: "usd", name: "USD wallet", unit: "USD", costCurrencyAccountId: null },
        { id: "voo", name: "VOO", unit: "VOO", costCurrencyAccountId: "usd" },
        { id: "orphan", name: "No price", unit: "BTC", costCurrencyAccountId: null },
    ];
    const day = new Date(2026, 2, 1);
    const entries = [
        { id: "1", accountId: "usd", date: day, type: "reconciliation", balance: 0 },
        { id: "2", accountId: "usd", date: day, type: "markPrice", pricePerUnit: 58 },
        { id: "3", accountId: "voo", date: day, type: "reconciliation", balance: 10 },
        { id: "4", accountId: "voo", date: day, type: "markPrice", pricePerUnit: 500 },
        { id: "5", accountId: "orphan", date: day, type: "reconciliation", balance: 1 },
    ];

    it("values a USD-priced stock even when the USD account holds nothing", () => {
        expect(getCurrentValuePhp(entries, accounts, "voo", new Date(2026, 2, 2))).toBe(10 * 500 * 58);
    });

    it("lists accounts that can't be valued", () => {
        expect(getUnvaluedAccounts(accounts, entries, new Date(2026, 2, 2)).map((a) => a.id)).toEqual(["orphan"]);
    });
});

describe("suggestNextCutoffDate", () => {
    it("suggests the cutoff after the last logged close", () => {
        expect(suggestNextCutoffDate(15, new Date(2026, 9, 31), new Date(2026, 8, 15))).toEqual(new Date(2026, 9, 15));
    });

    it("treats a close logged a few days late as that cycle", () => {
        expect(suggestNextCutoffDate(31, new Date(2026, 10, 20), new Date(2026, 10, 2))).toEqual(new Date(2026, 10, 30));
    });

    it("without a logged close, suggests the most recent cutoff that has passed", () => {
        expect(suggestNextCutoffDate(25, new Date(2026, 9, 10))).toEqual(new Date(2026, 8, 25));
        expect(suggestNextCutoffDate(5, new Date(2026, 9, 10))).toEqual(new Date(2026, 9, 5));
    });

    it("flags an unlogged cutoff that has passed as overdue", () => {
        const card = { id: "card", isLiability: true, statementCutoffDay: 15 };
        const closes = [{ id: "c", accountId: "card", type: "statementClose", date: new Date(2026, 8, 15) }];
        expect(getNextStatementClose(closes, card, new Date(2026, 9, 20))).toEqual({
            date: new Date(2026, 9, 15),
            overdue: true,
        });
    });
});
