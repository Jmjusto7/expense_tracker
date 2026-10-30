import { planImport, applyImportResolutions, IMPORT_TABLES } from "./importPlan";

const emptyTables = () => Object.fromEntries(IMPORT_TABLES.map((name) => [name, []]));
const at = (iso) => new Date(iso);
const asJson = (tables) => JSON.parse(JSON.stringify(tables));

const OLD = "2026-01-01T00:00:00.000Z";
const NEW = "2026-02-01T00:00:00.000Z";

function dayTables({ yearId = 1, monthId = 1, dayId = 1, createdAt = OLD } = {}) {
    return {
        years: [{ id: yearId, year: 2026, createdAt: at(createdAt) }],
        months: [{ id: monthId, yearId, name: "March", createdAt: at(createdAt) }],
        days: [{ id: dayId, yearId, monthId, day: 5, createdAt: at(createdAt) }],
    };
}

const tx = (fields) => ({ amountBreakdown: [fields.amount], comments: "", travelId: null, accountId: null, ...fields });

describe("planImport", () => {
    it("is a no-op when re-importing an export of the same data", () => {
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            accounts: [{ id: 1, name: "Cash", unit: null, createdAt: at(OLD) }],
            transactions: [tx({ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, accountId: 1, createdAt: at(OLD) })],
            balanceEntries: [
                { id: 1, accountId: 1, date: at(OLD), type: "expense", amount: -10, sourceTransactionId: 1, createdAt: at(OLD) },
            ],
        };

        const plan = planImport(existing, asJson(existing));

        expect(plan.result).toEqual(existing);
        expect(plan.conflicts).toEqual([]);
        expect(Object.values(plan.summary).every((n) => n === 0)).toBe(true);
        expect(Object.values(plan.deletes).every((ids) => ids.length === 0)).toBe(true);
    });

    it("merges the year/month/day hierarchy from two devices", () => {
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            transactions: [tx({ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, createdAt: at(OLD) })],
        };
        const incoming = {
            ...emptyTables(),
            ...dayTables({ yearId: 7, monthId: 8, dayId: 9, createdAt: NEW }),
            transactions: [tx({ id: 10, yearId: 7, monthId: 8, dayId: 9, category: "Taxi", amount: 3, createdAt: NEW })],
        };

        const { result, summary, deletes } = planImport(existing, asJson(incoming));

        expect(result.years.map((y) => y.id)).toEqual([7]);
        expect(result.months.map((m) => m.id)).toEqual([8]);
        expect(result.days.map((d) => d.id)).toEqual([9]);
        expect(result.transactions.map((t) => [t.category, t.yearId, t.monthId, t.dayId])).toEqual([
            ["Food", 7, 8, 9],
            ["Taxi", 7, 8, 9],
        ]);
        expect(summary).toMatchObject({ years: 1, months: 1, days: 1, transactions: 0 });
        expect(deletes).toMatchObject({ years: [1], months: [1], days: [1] });
    });

    it("dedupes same day+category rows with equal amounts, keeping the newest", () => {
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            transactions: [tx({ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, comments: "old", createdAt: at(OLD) })],
        };
        const incoming = {
            ...emptyTables(),
            transactions: [tx({ id: 2, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, comments: "new", createdAt: NEW })],
        };

        const plan = planImport(existing, asJson(incoming));

        expect(plan.conflicts).toEqual([]);
        expect(plan.result.transactions.map((t) => t.comments)).toEqual(["new"]);
        expect(plan.summary.transactions).toBe(1);
    });

    it("reports unequal same day+category rows as a conflict", () => {
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            transactions: [tx({ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, createdAt: at(OLD) })],
        };
        const incoming = {
            ...emptyTables(),
            transactions: [tx({ id: 2, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 25, createdAt: NEW })],
        };

        const plan = planImport(existing, asJson(incoming));

        expect(plan.conflicts).toHaveLength(1);
        expect(plan.conflicts[0].existing.id).toBe(1);
        expect(plan.conflicts[0].incoming.id).toBe(2);
        expect(plan.result.transactions.map((t) => t.id)).toEqual([1]);
        expect(plan.summary.transactions).toBe(0);
    });

    it("does not merge same-name accounts with different units", () => {
        const existing = { ...emptyTables(), accounts: [{ id: 1, name: "Wallet", unit: null, createdAt: at(OLD) }] };
        const incoming = { ...emptyTables(), accounts: [{ id: 2, name: "wallet ", unit: "USD", createdAt: NEW }] };

        const { result } = planImport(existing, asJson(incoming));

        expect(result.accounts.map((a) => a.id)).toEqual([1, 2]);
    });

    it("remaps duplicate account ids on transactions before deduping them", () => {
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            accounts: [{ id: 1, name: "Cash", unit: null, createdAt: at(NEW) }],
            transactions: [tx({ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, accountId: 1, createdAt: at(OLD) })],
            balanceEntries: [
                { id: 1, accountId: 1, date: at(OLD), type: "expense", amount: -10, sourceTransactionId: 1, createdAt: at(OLD) },
            ],
        };
        const incoming = {
            ...emptyTables(),
            accounts: [{ id: 5, name: "Cash", unit: null, createdAt: OLD }],
            transactions: [tx({ id: 6, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, accountId: 5, createdAt: NEW })],
            balanceEntries: [
                { id: 7, accountId: 5, date: NEW, type: "expense", amount: -10, sourceTransactionId: 6, createdAt: NEW },
            ],
        };

        const plan = planImport(existing, asJson(incoming));

        expect(plan.conflicts).toEqual([]);
        expect(plan.result.accounts.map((a) => a.id)).toEqual([1]);
        expect(plan.result.transactions).toHaveLength(1);
        expect(plan.result.transactions[0]).toMatchObject({ id: 6, accountId: 1 });
        expect(plan.result.balanceEntries.map((e) => [e.id, e.accountId, e.sourceTransactionId])).toEqual([[7, 1, 6]]);
    });

    it("dedupes travels and remaps transaction travelIds", () => {
        const trip = { title: "Tokyo", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-03-07T00:00:00.000Z" };
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            travels: [{ id: 1, ...trip, startDate: at(trip.startDate), endDate: at(trip.endDate), createdAt: at(NEW) }],
        };
        const incoming = {
            ...emptyTables(),
            travels: [{ id: 4, ...trip, title: " tokyo", createdAt: OLD }],
            transactions: [tx({ id: 3, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 5, travelId: "4", createdAt: NEW })],
        };

        const { result } = planImport(existing, asJson(incoming));

        expect(result.travels.map((t) => t.id)).toEqual([1]);
        expect(result.transactions[0].travelId).toBe("1");
    });

    it("remaps transfer counterpartAccountId onto the surviving account", () => {
        const existing = {
            ...emptyTables(),
            accounts: [
                { id: 1, name: "Bank", unit: null, createdAt: at(NEW) },
                { id: 2, name: "Savings", unit: null, createdAt: at(NEW) },
            ],
        };
        const incoming = {
            ...emptyTables(),
            accounts: [{ id: 9, name: "Savings", unit: null, createdAt: OLD }],
            balanceEntries: [
                { id: 3, accountId: 1, date: NEW, type: "transfer", amount: -50, transferGroupId: "x", counterpartAccountId: 9 },
            ],
        };

        const { result } = planImport(existing, asJson(incoming));

        expect(result.balanceEntries[0].counterpartAccountId).toBe(2);
    });
});

describe("applyImportResolutions", () => {
    const setup = (incomingFields = {}) => {
        const existing = {
            ...emptyTables(),
            ...dayTables(),
            accounts: [{ id: 1, name: "Cash", unit: null, createdAt: at(OLD) }],
            transactions: [
                tx({ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10, comments: "lunch", accountId: 1, createdAt: at(OLD) }),
            ],
            balanceEntries: [
                { id: 1, accountId: 1, date: at(OLD), type: "expense", amount: -10, sourceTransactionId: 1, createdAt: at(OLD) },
            ],
        };
        const incoming = {
            ...emptyTables(),
            transactions: [
                tx({ id: 2, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 25, comments: "dinner", createdAt: NEW, ...incomingFields }),
            ],
        };
        return planImport(existing, asJson(incoming));
    };

    it("keeps the existing row", () => {
        const plan = setup();
        const { tables } = applyImportResolutions(plan, { [plan.conflicts[0].id]: "existing" });
        expect(tables.transactions.map((t) => t.id)).toEqual([1]);
        expect(tables.balanceEntries).toHaveLength(1);
    });

    it("keeps the imported row and drops the existing row's shadow entry", () => {
        const plan = setup();
        const { tables } = applyImportResolutions(plan, { [plan.conflicts[0].id]: "incoming" });
        expect(tables.transactions.map((t) => t.id)).toEqual([2]);
        expect(tables.balanceEntries).toHaveLength(0);
    });

    it("merges both rows into the existing one", () => {
        const plan = setup();
        const { tables, mergedTransactionIds } = applyImportResolutions(plan, { [plan.conflicts[0].id]: "merge" });
        expect(tables.transactions).toHaveLength(1);
        expect(tables.transactions[0]).toMatchObject({
            id: 1,
            amount: 35,
            amountBreakdown: [10, 25],
            comments: "lunch; dinner",
            accountId: 1,
        });
        expect(mergedTransactionIds).toEqual([1]);
    });

    it("refuses to merge rows tagged to different accounts", () => {
        const plan = setup({ accountId: 99 });
        expect(() => applyImportResolutions(plan, { [plan.conflicts[0].id]: "merge" })).toThrow(/tagged differently/);
    });

    it("requires every conflict to be resolved", () => {
        const plan = setup();
        expect(() => applyImportResolutions(plan, {})).toThrow("Resolve every conflict before importing.");
    });
});
