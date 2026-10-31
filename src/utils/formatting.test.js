import { toDateInputValue } from "./dateHelpers";
import { formatCurrency } from "./formatCurrency";
import { compactCurrency, valueFormatters } from "./chartFormat";

describe("toDateInputValue", () => {
    it("uses the local calendar day, not the UTC day", () => {
        // 00:30 local is still the previous UTC day for any timezone east of UTC.
        expect(toDateInputValue(new Date(2026, 9, 31, 0, 30))).toBe("2026-10-31");
        expect(toDateInputValue(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    });
});

describe("formatters", () => {
    it("puts the minus sign before the peso sign", () => {
        expect(formatCurrency(-2000)).toBe("-₱2,000");
    });

    it("keeps chart ticks short", () => {
        expect(compactCurrency(1250000)).toBe("₱1.3M");
        expect(compactCurrency(-4200)).toBe("-₱4.2K");
    });

    it("formats foreign units as units, not pesos", () => {
        const { full } = valueFormatters("VOO");
        expect(full(12.5)).toBe("12.5 VOO");
        expect(valueFormatters(null).full(1000)).toBe("₱1,000");
    });
});
