import { markTourSeen, resetTours, setToursEnabled, shouldShowTour, toursEnabled } from "./tours";

describe("first-visit tips", () => {
    beforeEach(() => localStorage.clear());

    it("shows each tour once, can be switched off, and can be reset", () => {
        expect(shouldShowTour("home")).toBe(true);
        markTourSeen("home");
        expect(shouldShowTour("home")).toBe(false);
        expect(shouldShowTour("expenses")).toBe(true);

        setToursEnabled(false);
        expect(toursEnabled()).toBe(false);
        expect(shouldShowTour("expenses")).toBe(false);

        localStorage.setItem("unrelated", "keep");
        resetTours();
        expect(toursEnabled()).toBe(true);
        expect(shouldShowTour("home")).toBe(true);
        expect(localStorage.getItem("unrelated")).toBe("keep");
    });
});
