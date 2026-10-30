import { describeAmountExpression } from "../utils/amountHelpers";

export default function AmountPreview({ value }) {
    if (!value?.trim()) return null;
    const { text, error } = describeAmountExpression(value);
    return <p className={`mt-1 text-xs ${error ? "text-alert" : "text-ink-muted"}`}>{text}</p>;
}
