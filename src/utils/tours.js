// First-visit tips: which tours were seen, plus a global on/off switch (localStorage, per device).
const PREFIX = "tracker.tour.";
const OFF_KEY = `${PREFIX}off`;

const read = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
const write = (key, value) => {
    try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Storage unavailable: tips just show again next time.
    }
};

export const toursEnabled = () => read(OFF_KEY) !== "1";
export const setToursEnabled = (on) => write(OFF_KEY, on ? null : "1");
export const tourSeen = (id) => read(`${PREFIX}${id}`) === "1";
export const markTourSeen = (id) => write(`${PREFIX}${id}`, "1");

export function resetTours() {
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith(PREFIX))
            .forEach((k) => localStorage.removeItem(k));
    } catch {
        // Nothing to reset.
    }
}

export const shouldShowTour = (id) => toursEnabled() && !tourSeen(id);
