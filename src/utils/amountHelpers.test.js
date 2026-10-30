import { parseAmountExpression, describeAmountExpression } from "./amountHelpers";

describe("parseAmountExpression", () => {
    it.each([
        ["150", 150, [150]],
        ["150, 200.5", 350.5, [150, 200.5]],
        [" 195.5 , -130 ,25.25 ", 90.75, [195.5, -130, 25.25]],
        [".5", 0.5, [0.5]],
        ["-20", -20, [-20]],
    ])("parses %j", (input, total, breakdown) => {
        const result = parseAmountExpression(input);
        expect(result.error).toBeNull();
        expect(result.total).toBeCloseTo(total);
        expect(result.breakdown).toEqual(breakdown);
    });

    it.each([
        ["1,000", "Did you mean 1000? Commas separate amounts."],
        ["5,000,000", "Did you mean 5000000? Commas separate amounts."],
        ["1,,2", "Remove the empty amount between commas."],
        ["1,", "Remove the empty amount between commas."],
        ["-", "\"-\" isn't a valid number."],
        [".", "\".\" isn't a valid number."],
        ["abc", "\"abc\" isn't a valid number."],
        ["1.2.3", "\"1.2.3\" isn't a valid number."],
        ["0", "Amounts can't be zero."],
        ["5,-5", "Amounts add up to zero."],
        ["", "Enter an amount."],
    ])("rejects %j", (input, error) => {
        const result = parseAmountExpression(input);
        expect(result.error).toBe(error);
        expect(Number.isNaN(result.total)).toBe(true);
        expect(result.breakdown).toEqual([]);
    });
});

describe("describeAmountExpression", () => {
    it("shows the breakdown and total", () => {
        expect(describeAmountExpression("150, 200.5")).toEqual({ text: "= 150 + 200.5 → 350.5", error: false });
    });

    it("shows the parse error", () => {
        expect(describeAmountExpression("1,000")).toEqual({
            text: "Did you mean 1000? Commas separate amounts.",
            error: true,
        });
    });
});
