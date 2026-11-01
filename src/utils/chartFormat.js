// src/utils/chartFormat.js
import { formatCurrency } from "./formatCurrency";

export const Y_AXIS_WIDTH = 64;

const compactFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export const compactNumber = (value) => compactFormat.format(Number(value || 0));

// Axis ticks stay short (₱1.2M) so large values don't clip; tooltips keep full values.
export const compactCurrency = (value) => {
    const n = Number(value || 0);
    return `${n < 0 ? "-" : ""}₱${compactNumber(Math.abs(n))}`;
};

export const formatUnits = (value, unit) =>
    `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${unit}`;

// Tick + tooltip formatters for a series in pesos (unit null) or in an account's own unit.
export const valueFormatters = (unit = null) =>
    unit
        ? { tick: compactNumber, full: (v) => formatUnits(v, unit) }
        : { tick: compactCurrency, full: (v) => formatCurrency(v) };

// Distinct hues for categorical slices. Excludes alert red and warning amber ("bad"/"pending")
// and the travel orange, which only ever means Travel.
export const TRAVEL_COLOR = "#b8622e";
export const SLICE_COLORS = [
    "#1f6f5c", // ledger green
    "#4f6f8a", // slate blue
    "#7a6a9a", // plum
    "#d4884f", // apricot
    "#5b8fb9", // sky
    "#b05a7a", // berry
    "#8c6d5a", // mocha
];

const isTravelKey = (key) => String(key ?? "").trim().toLowerCase() === "travel";

const hashKey = (key) => {
    const s = String(key ?? "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
};

// Same name -> same colour on every chart and every visit (a string hash, not the slice's rank).
export function colorForKey(key) {
    if (isTravelKey(key)) return TRAVEL_COLOR;
    return SLICE_COLORS[hashKey(key) % SLICE_COLORS.length];
}

// Colours for one chart: each name keeps its hashed colour unless another name already took it,
// so no two slices in the same chart match. Order-independent for the same set of names.
export function colorsForKeys(keys) {
    const names = [...new Set(keys.map((k) => String(k ?? "")))].sort();
    const map = new Map();
    const used = new Set();
    for (const name of names) {
        if (isTravelKey(name)) map.set(name, TRAVEL_COLOR);
    }
    for (const name of names) {
        if (map.has(name)) continue;
        let i = hashKey(name) % SLICE_COLORS.length;
        for (let n = 0; n < SLICE_COLORS.length && used.has(SLICE_COLORS[i]); n++) i = (i + 1) % SLICE_COLORS.length;
        used.add(SLICE_COLORS[i]);
        map.set(name, SLICE_COLORS[i]);
    }
    return (key) => map.get(String(key ?? "")) ?? colorForKey(key);
}
