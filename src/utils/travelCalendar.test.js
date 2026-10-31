import { buildTravelCalendar, travelCalendarYears, tripDays, tripStatus } from "./travelHelpers";

describe("tripDays / tripStatus", () => {
    const trip = { startDate: new Date(2026, 9, 29), endDate: new Date(2026, 10, 2) };

    it("counts days inclusively", () => {
        expect(tripDays(trip)).toBe(5);
        expect(tripDays({ startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 1) })).toBe(1);
        expect(tripDays({})).toBe(0);
    });

    it("knows whether a trip is upcoming, current (with day number) or past", () => {
        expect(tripStatus(trip, new Date(2026, 9, 20))).toEqual({ status: "upcoming", daysUntil: 9 });
        expect(tripStatus(trip, new Date(2026, 9, 31, 15))).toEqual({ status: "current", dayNumber: 3 });
        expect(tripStatus(trip, new Date(2026, 10, 3))).toEqual({ status: "past" });
    });
});

describe("buildTravelCalendar", () => {
    const tokyo = { id: "t1", title: "Tokyo", startDate: new Date(2026, 9, 29), endDate: new Date(2026, 10, 2) };
    const dayTrip = { id: "t2", title: "Day trip", startDate: new Date(2026, 9, 30), endDate: new Date(2026, 9, 30) };

    it("counts travel days per month, splitting trips across months", () => {
        const cal = buildTravelCalendar([tokyo]);
        expect([...cal.get("2026-9").days.keys()]).toEqual([29, 30, 31]);
        expect([...cal.get("2026-10").days.keys()]).toEqual([1, 2]);
        expect(cal.get("2026-10").travels.has(tokyo)).toBe(true);
    });

    it("counts an overlapping day once but keeps both trips", () => {
        const oct = buildTravelCalendar([tokyo, dayTrip]).get("2026-9");
        expect(oct.days.size).toBe(3);
        expect(oct.days.get(30)).toEqual([tokyo, dayTrip]);
        expect(oct.travels.size).toBe(2);
    });

    it("skips undated trips and lists every year touched plus the current one", () => {
        const cal = buildTravelCalendar([tokyo, { id: "x", title: "Undated" }]);
        expect(travelCalendarYears(cal, new Date(2028, 0, 1))).toEqual([2028, 2026]);
    });
});
