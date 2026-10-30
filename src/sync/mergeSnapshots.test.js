import { mergeSnapshots, applyRecordResolutions } from "./mergeSnapshots";
import { buildSnapshot, hashTables, parseSnapshot, hashRecord } from "./snapshot";
import { IMPORT_TABLES } from "../utils/importPlan";

const tables = (overrides = {}) => ({ ...Object.fromEntries(IMPORT_TABLES.map((n) => [n, []])), ...overrides });
const travel = (id, title) => ({ id, title, startDate: new Date("2026-03-01"), endDate: new Date("2026-03-07") });
const ids = (side, table) => side[table].map((r) => r.id).sort();

describe("snapshot", () => {
    it("excludes derived shadow expense entries", () => {
        const snap = buildSnapshot(
            tables({
                balanceEntries: [
                    { id: "a", type: "income", amount: 5 },
                    { id: "b", type: "expense", amount: -5, sourceTransactionId: "t" },
                ],
            })
        );
        expect(snap.tables.balanceEntries.map((e) => e.id)).toEqual(["a"]);
    });

    it("hashes Dates and their JSON form identically", () => {
        const row = travel("t1", "Tokyo");
        expect(hashRecord(JSON.parse(JSON.stringify(row)))).toBe(hashRecord(row));
        expect(hashRecord({ ...row, comments: undefined })).toBe(hashRecord(row));
    });

    it("rejects files that are not sync files", () => {
        expect(() => parseSnapshot("{")).toThrow(/isn't valid JSON/);
        expect(() => parseSnapshot(JSON.stringify({ years: [] }))).toThrow(/isn't an expense tracker sync file/);
        expect(() => parseSnapshot(JSON.stringify({ format: "expense-tracker-sync", version: 99, tables: {} }))).toThrow(
            /newer version/
        );
    });
});

describe("mergeSnapshots", () => {
    const baseData = tables({ travels: [travel("t1", "Tokyo"), travel("t2", "Cebu")] });
    const base = hashTables(baseData);

    it("combines everything on the first sync", () => {
        const merge = mergeSnapshots({
            base: {},
            local: tables({ travels: [travel("t1", "Tokyo")] }),
            remote: tables({ travels: [travel("t9", "Bohol")] }),
        });
        expect(merge.recordConflicts).toEqual([]);
        expect(ids(merge.localSide, "travels")).toEqual(["t1"]);
        expect(ids(merge.remoteSide, "travels")).toEqual(["t9"]);
    });

    it("takes whichever side changed a record", () => {
        const merge = mergeSnapshots({
            base,
            local: tables({ travels: [travel("t1", "Tokyo 2026"), travel("t2", "Cebu")] }),
            remote: tables({ travels: [travel("t1", "Tokyo"), travel("t2", "Cebu trip")] }),
        });
        expect(merge.recordConflicts).toEqual([]);
        expect(merge.localSide.travels.map((t) => t.title)).toEqual(["Tokyo 2026"]);
        expect(merge.remoteSide.travels.map((t) => t.title)).toEqual(["Cebu trip"]);
    });

    it("propagates deletions from either side", () => {
        const merge = mergeSnapshots({
            base,
            local: tables({ travels: [travel("t1", "Tokyo")] }),
            remote: tables({ travels: [travel("t2", "Cebu")] }),
        });
        expect(merge.recordConflicts).toEqual([]);
        expect(ids(merge.localSide, "travels")).toEqual([]);
        expect(ids(merge.remoteSide, "travels")).toEqual([]);
        expect(merge.deleted.travels).toBe(2);
    });

    it("asks when both sides edited the same record", () => {
        const merge = mergeSnapshots({
            base,
            local: tables({ travels: [travel("t1", "Tokyo A"), travel("t2", "Cebu")] }),
            remote: tables({ travels: [travel("t1", "Tokyo B"), travel("t2", "Cebu")] }),
        });
        expect(merge.recordConflicts).toHaveLength(1);
        expect(merge.recordConflicts[0]).toMatchObject({ id: "travels:t1", kind: "edit" });

        const keepRemote = applyRecordResolutions(merge, { "travels:t1": "remote" });
        expect(keepRemote.remoteSide.travels.map((t) => t.title)).toEqual(["Tokyo B"]);
        expect(keepRemote.localSide.travels.map((t) => t.title)).toEqual(["Cebu"]);
    });

    it("asks when one side deleted what the other edited", () => {
        const merge = mergeSnapshots({
            base,
            local: tables({ travels: [travel("t1", "Tokyo edited")] }),
            remote: tables({ travels: [travel("t2", "Cebu edited")] }),
        });
        expect(merge.recordConflicts.map((c) => [c.id, c.kind])).toEqual([
            ["travels:t1", "deletedRemotely"],
            ["travels:t2", "deletedLocally"],
        ]);

        const sides = applyRecordResolutions(merge, { "travels:t1": "remote", "travels:t2": "remote" });
        expect(ids(sides.localSide, "travels")).toEqual([]);
        expect(ids(sides.remoteSide, "travels")).toEqual(["t2"]);
    });

    it("requires a choice for every record conflict", () => {
        const merge = mergeSnapshots({
            base,
            local: tables({ travels: [travel("t1", "A"), travel("t2", "Cebu")] }),
            remote: tables({ travels: [travel("t1", "B"), travel("t2", "Cebu")] }),
        });
        expect(() => applyRecordResolutions(merge, {})).toThrow(/Choose which version/);
    });

    it("restores a deleted parent that a new row still references", () => {
        const day = { id: "d1", yearId: "y1", monthId: "m1", day: 5 };
        const hierarchy = { years: [{ id: "y1", year: 2026 }], months: [{ id: "m1", yearId: "y1", name: "March" }], days: [day] };
        const merge = mergeSnapshots({
            base: hashTables(tables(hierarchy)),
            local: tables({
                ...hierarchy,
                transactions: [{ id: "tx", yearId: "y1", monthId: "m1", dayId: "d1", category: "Food", amount: 5 }],
            }),
            remote: tables(),
        });

        const sides = applyRecordResolutions(merge, {});
        expect(ids(sides.localSide, "days")).toEqual(["d1"]);
        expect(ids(sides.localSide, "months")).toEqual(["m1"]);
        expect(ids(sides.localSide, "years")).toEqual(["y1"]);
    });

    it("ignores shadow expense entries on both sides", () => {
        const shadow = { id: "s", type: "expense", amount: -5, accountId: "a" };
        const merge = mergeSnapshots({
            base: {},
            local: tables({ balanceEntries: [shadow] }),
            remote: tables({ balanceEntries: [{ ...shadow, id: "s2" }] }),
        });
        expect(merge.localSide.balanceEntries).toEqual([]);
        expect(merge.remoteSide.balanceEntries).toEqual([]);
    });
});
