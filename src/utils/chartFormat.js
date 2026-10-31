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

// Ledger/travel-family palette for categorical slices. Deliberately excludes the
// alert red and warning amber, which mean "bad"/"pending" elsewhere in the app.
export const SLICE_COLORS = [
    "#1f6f5c",
    "#b8622e",
    "#3d8a76",
    "#d4884f",
    "#164f42",
    "#8a4a1f",
    "#6b8a7f",
    "#4f6f8a",
    "#7a6a9a",
    "#5c7a3d",
];

// Same name -> same colour on every chart and every visit (a string hash, not the slice's rank).
export function colorForKey(key) {
    const s = String(key ?? "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return SLICE_COLORS[h % SLICE_COLORS.length];
}
