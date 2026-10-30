import { validateImportShape } from "./importValidation";

const validExport = () => ({
    years: [{ id: 1, year: 2026 }],
    months: [{ id: 1, yearId: 1, name: "March" }],
    days: [{ id: 1, yearId: 1, monthId: 1, day: 5 }],
    transactions: [{ id: 1, yearId: 1, monthId: 1, dayId: 1, category: "Food", amount: 10 }],
    travels: [{ id: 1, title: "Tokyo", startDate: "2026-03-01", endDate: "2026-03-07" }],
    buckets: [{ id: 1, name: "Needs" }],
    bucketAssignments: [{ id: 1, bucketId: 1, category: "Food" }],
    accounts: [{ id: 1, name: "Cash" }],
    balanceEntries: [{ id: 1, accountId: 1, date: "2026-03-05", type: "income", amount: 100 }],
    accountTypes: [{ id: 1, name: "Bank" }],
});

const withRecord = (key, patch) => {
    const data = validExport();
    data[key] = [{ ...data[key][0], ...patch }];
    return data;
};

describe("validateImportShape", () => {
    it("accepts a valid export", () => {
        expect(() => validateImportShape(validExport())).not.toThrow();
    });

    it.each([
        ["transactions", { amount: "10" }, /"transactions\[0\]" has a non-numeric "amount"/],
        ["balanceEntries", { balance: Infinity }, /"balanceEntries\[0\]" has a non-numeric "balance"/],
        ["years", { year: "2026" }, /"years\[0\]" has a non-numeric "year"/],
        ["balanceEntries", { date: "not a date" }, /"balanceEntries\[0\]" has an invalid date in "date"/],
        ["travels", { startDate: "nope" }, /"travels\[0\]" has an invalid date in "startDate"/],
        ["accounts", { name: 42 }, /"accounts\[0\]" has a non-text "name"/],
        ["transactions", { category: ["Food"] }, /"transactions\[0\]" has a non-text "category"/],
        ["months", { name: "Marchember" }, /"months\[0\]" has an unknown month name "Marchember"/],
        ["balanceEntries", { type: "bogus" }, /"balanceEntries\[0\]" has an unknown entry type "bogus"/],
    ])("rejects bad field types in %s", (key, patch, message) => {
        expect(() => validateImportShape(withRecord(key, patch))).toThrow(message);
    });

    it.each([
        ["months", { yearId: 9 }, /"months\[0\]" points to yearId 9/],
        ["days", { monthId: 9 }, /"days\[0\]" points to monthId 9/],
        ["days", { yearId: 9 }, /"days\[0\]" points to yearId 9/],
        ["transactions", { dayId: 9 }, /"transactions\[0\]" points to dayId 9/],
        ["bucketAssignments", { bucketId: 9 }, /"bucketAssignments\[0\]" points to bucketId 9/],
        ["balanceEntries", { accountId: 9 }, /"balanceEntries\[0\]" points to accountId 9/],
    ])("rejects dangling references in %s", (key, patch, message) => {
        expect(() => validateImportShape(withRecord(key, patch))).toThrow(message);
    });

    it("accepts references satisfied by existing data", () => {
        const data = withRecord("balanceEntries", { accountId: 9 });
        expect(() => validateImportShape(data, { accounts: [{ id: 9, name: "Existing" }] })).not.toThrow();
    });
});
