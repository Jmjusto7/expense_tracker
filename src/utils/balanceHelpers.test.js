import { getBalanceAsOf } from "./balanceHelpers";

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
