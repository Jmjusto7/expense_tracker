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
