import { rekeyTables, needsRekey } from "./rekey";
import { IMPORT_TABLES } from "./importPlan";

const tables = (overrides) => ({ ...Object.fromEntries(IMPORT_TABLES.map((n) => [n, []])), ...overrides });

const legacy = () =>
    tables({
        years: [{ id: 1, year: 2026 }],
        months: [{ id: 1, yearId: 1, name: "March" }],
        days: [{ id: 1, yearId: 1, monthId: 1, day: 5 }],
        travels: [{ id: 1, title: "Tokyo" }],
        accountTypes: [{ id: 1, name: "Bank" }],
        accounts: [
            { id: 1, name: "Cash", typeId: 1 },
            { id: 2, name: "VOO", typeId: null, costCurrencyAccountId: 1 },
        ],
        buckets: [{ id: 1, name: "Needs" }],
        bucketAssignments: [{ id: 1, bucketId: 1, category: "Food" }],
        transactions: [
            { id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, travelId: "1", accountId: 1, sourceBalanceEntryIds: [null, 2] },
        ],
        balanceEntries: [
            { id: 1, accountId: 1, type: "expense", sourceTransactionId: 1, createdAt: new Date("2026-03-05") },
            { id: 2, accountId: 1, type: "transfer", counterpartAccountId: 2 },
        ],
    });

describe("rekeyTables", () => {
    it("gives every row a string id and rewrites every reference", () => {
        let n = 0;
        const out = rekeyTables(legacy(), () => `id-${++n}`);
        const id = (table, i = 0) => out[table][i].id;

        for (const name of IMPORT_TABLES) {
            for (const row of out[name]) expect(typeof row.id).toBe("string");
        }
        expect(out.months[0].yearId).toBe(id("years"));
        expect(out.days[0]).toMatchObject({ yearId: id("years"), monthId: id("months") });
        expect(out.transactions[0]).toMatchObject({
            yearId: id("years"),
            monthId: id("months"),
            dayId: id("days"),
            travelId: id("travels"),
            accountId: id("accounts"),
            sourceBalanceEntryIds: [null, id("balanceEntries", 1)],
        });
        expect(out.bucketAssignments[0].bucketId).toBe(id("buckets"));
        expect(out.accounts[0].typeId).toBe(id("accountTypes"));
        expect(out.accounts[1]).toMatchObject({ typeId: null, costCurrencyAccountId: id("accounts") });
        expect(out.balanceEntries[0].sourceTransactionId).toBe(id("transactions"));
        expect(out.balanceEntries[1].counterpartAccountId).toBe(id("accounts", 1));
    });

    it("keeps legacy same-day order by deriving missing createdAt from the old id", () => {
        const out = rekeyTables(legacy());
        expect(out.balanceEntries[0].createdAt).toEqual(new Date("2026-03-05"));
        expect(out.balanceEntries[1].createdAt).toEqual(new Date(2));
    });

    it("leaves string ids and their references alone", () => {
        const data = tables({
            years: [{ id: "y1", year: 2026 }],
            months: [{ id: "m1", yearId: "y1", name: "March" }],
        });
        expect(needsRekey(data)).toBe(false);
        expect(rekeyTables(data)).toEqual(data);
    });
});
