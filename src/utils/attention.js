import { formatDate } from "./dateHelpers";
import { daysSinceLastReconciliation, getNextStatementClose, getStatementInfo, getUnvaluedAccounts } from "./balanceHelpers";

export const STALE_RECONCILIATION_DAYS = 30;
const DUE_SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const accountPath = (account) => `${account.isLiability ? "/liabilities" : "/assets"}/${account.id}`;

// Everything on the dashboard that needs the user to act, most urgent first.
// severity: "alert" (overdue) | "warning" (soon / stale).
export function getAttentionItems(accounts, entries, today = new Date()) {
    const items = [];
    const unvalued = new Set(getUnvaluedAccounts(accounts, entries, today).map((a) => a.id));

    for (const account of accounts) {
        const to = accountPath(account);

        if (account.isLiability) {
            const info = getStatementInfo(entries, account, today);
            if (info.dueDate && (info.remainingDue ?? 0) > 0) {
                const days = Math.round((dayStart(info.dueDate) - dayStart(today)) / DAY_MS);
                if (days < 0) {
                    items.push({ key: `due-${account.id}`, account, to, severity: "alert", text: `Payment ${plural(-days, "day")} overdue` });
                } else if (days <= DUE_SOON_DAYS) {
                    items.push({
                        key: `due-${account.id}`,
                        account,
                        to,
                        severity: "warning",
                        text: days === 0 ? "Payment due today" : `Payment due in ${plural(days, "day")}`,
                    });
                }
            }

            const nextClose = getNextStatementClose(entries, account, today);
            if (nextClose?.overdue) {
                items.push({
                    key: `close-${account.id}`,
                    account,
                    to,
                    severity: "warning",
                    text: `Log the statement that closed ${formatDate(nextClose.date)}`,
                });
            }
        }

        if (unvalued.has(account.id) && account.unit != null) {
            items.push({ key: `price-${account.id}`, account, to, severity: "warning", text: "No price yet - left out of net worth" });
        }

        const days = daysSinceLastReconciliation(entries, account.id, today);
        if (days === null || days > STALE_RECONCILIATION_DAYS) {
            items.push({
                key: `stale-${account.id}`,
                account,
                to,
                severity: "warning",
                text: days === null ? "Never reconciled" : `Reconciled ${days} days ago`,
            });
        }
    }

    return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "alert" ? -1 : 1));
}

const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// One-line payment status for a liability's latest statement.
// tone: "alert" (overdue) | "warning" (due within a week) | "neutral" | "ok" (paid) | "muted" (no statement yet).
export function liabilityStatus(info, today = new Date()) {
    if (!info?.dueDate) return { tone: "muted", label: "No statement yet", short: "No statement" };
    if ((info.remainingDue ?? 0) <= 0) return { tone: "ok", label: "Statement paid", short: "Paid ✓" };
    const days = Math.round((dayStart(info.dueDate) - dayStart(today)) / DAY_MS);
    if (days < 0) return { tone: "alert", label: `Payment ${plural(-days, "day")} overdue`, short: `Overdue ${-days}d`, days };
    if (days === 0) return { tone: "warning", label: "Payment due today", short: "Due today", days };
    if (days <= DUE_SOON_DAYS) return { tone: "warning", label: `Payment due in ${plural(days, "day")}`, short: `Due in ${days}d`, days };
    return { tone: "neutral", label: `Payment due ${shortDate(info.dueDate)}`, short: `Due ${shortDate(info.dueDate)}`, days };
}

// Statement due dates and closes from (overdue) up to `days` ahead, soonest first.
// kind: "due" | "close"; status: "overdue" | "upcoming" | "paid".
export function getUpcomingLiabilityEvents(accounts, entries, today = new Date(), days = 14) {
    const horizon = dayStart(today) + days * DAY_MS;
    const events = [];
    for (const account of accounts.filter((a) => a.isLiability)) {
        const info = getStatementInfo(entries, account, today);
        if (info.dueDate) {
            const owed = (info.remainingDue ?? 0) > 0;
            const past = dayStart(info.dueDate) < dayStart(today);
            if ((owed && past) || (!past && dayStart(info.dueDate) <= horizon)) {
                events.push({
                    key: `due-${account.id}`,
                    account,
                    kind: "due",
                    date: info.dueDate,
                    amount: owed ? info.remainingDue : null,
                    status: !owed ? "paid" : past ? "overdue" : "upcoming",
                });
            }
        }
        const nextClose = getNextStatementClose(entries, account, today);
        if (nextClose && dayStart(nextClose.date) <= horizon) {
            events.push({
                key: `close-${account.id}`,
                account,
                kind: "close",
                date: nextClose.date,
                amount: null,
                status: nextClose.overdue ? "overdue" : "upcoming",
            });
        }
    }
    return events.sort((a, b) => dayStart(a.date) - dayStart(b.date));
}
