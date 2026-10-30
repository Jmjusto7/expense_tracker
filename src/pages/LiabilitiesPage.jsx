import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddLiabilityModal from "../components/AddLiabilityModal";
import EditLiabilityModal from "../components/EditLiabilityModal";
import ConfirmButton from "../components/ConfirmButton";
import { formatCurrency } from "../utils/formatCurrency";
import { getStatementInfo, getTotalBalance } from "../utils/balanceHelpers";

export default function LiabilitiesPage() {
  const { accounts, balanceEntries, accountTypes, removeAccount } = useExpenseContext();

  // Same underlying `accounts` table as Assets - see AccountsPage.jsx.
  const liabilityAccounts = useMemo(() => accounts.filter((a) => a.isLiability), [accounts]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState(null);

  const handleRemoveAccount = async (accountId) => {
    try {
      await removeAccount(accountId);
    } catch (err) {
      alert(err.message || "Failed to delete account.");
    }
  };

  // getTotalBalance already nets every liability's signed balance
  // correctly; flipped here purely for a human-readable figure. If the net
  // across all liabilities is actually positive (more credit than debt),
  // this shows that as a net credit rather than clamping it to zero.
  const netBalance = useMemo(
    () => getTotalBalance(liabilityAccounts, balanceEntries),
    [liabilityAccounts, balanceEntries]
  );
  const isNetCredit = netBalance > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-between items-center mb-6 gap-2">
        <h1 className="font-display text-2xl text-ink">Liabilities</h1>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-alert hover:bg-alert/90 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Liability
        </button>
      </div>

      {liabilityAccounts?.length === 0 && (
        <p className="text-ink-muted">
          No liabilities yet. Add a credit card or loan to start tracking what you owe.
        </p>
      )}

      {liabilityAccounts.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">{isNetCredit ? "Net Credit" : "Total Owed"}</h2>
            <span className={`money text-2xl font-bold ${isNetCredit ? "text-ledger-dark" : "text-alert"}`}>
              {formatCurrency(Math.abs(netBalance))}
            </span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {liabilityAccounts?.map((account) => {
          const info = getStatementInfo(balanceEntries, account, new Date());
          const isCredit = (info.totalBalance ?? 0) > 0;
          const typeName = account.typeId != null
            ? accountTypes.find((t) => t.id === account.typeId)?.name
            : null;

          return (
            <Link
              key={account.id}
              to={`/liabilities/${account.id}`}
              className="group bg-surface rounded-lg border border-border hover:border-alert p-5 transition-colors relative block"
            >
              {/* Edit & Delete Buttons */}
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditAccountId(account.id);
                  }}
                  className="bg-surface border border-border text-ink-muted hover:text-ink rounded-md p-1.5"
                >
                  <Pencil size={14} />
                </button>

                <ConfirmButton
                  onConfirm={() => handleRemoveAccount(account.id)}
                  className="bg-surface border border-border text-ink-muted hover:text-alert rounded-md p-1.5"
                  confirmClassName="bg-alert text-white border border-alert rounded-md p-1.5 text-xs font-medium px-2"
                  title="Delete this liability? Removes its history. Linked transactions survive, unlinked."
                >
                  <Trash2 size={14} />
                </ConfirmButton>
              </div>

              {/* Title */}
              <div className="flex items-center gap-1.5 mb-1 pr-14">
                <CreditCard size={15} className="text-alert shrink-0" />
                <h2 className="text-lg font-semibold text-ink truncate">{account.name}</h2>
              </div>

              {/* Type badge */}
              <div className="mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${typeName
                      ? "bg-ledger-soft text-ledger-dark border-ledger/30"
                      : "bg-surface-sunken text-ink-muted border-border"
                    }`}
                >
                  {typeName || "Unclassified"}
                </span>
              </div>

              {/* Amount owed - or, if overpaid, the credit balance in your
                  favor. Nothing clamps this away; a positive totalBalance
                  is a real, expected state (see getStatementInfo). */}
              <div className={`money text-xl font-bold mb-0.5 ${isCredit ? "text-ledger-dark" : "text-alert"}`}>
                {formatCurrency(Math.abs(info.totalBalance ?? 0))}
              </div>
              <div className="text-xs text-ink-muted mb-2">
                {isCredit ? "Credit balance (they owe you)" : "Owed"}
              </div>
              {account.creditLimit != null && (
                <div className={`text-xs mb-2 ${(info.availableCredit ?? 0) < 0 ? "text-alert" : "text-ink-muted"}`}>
                  {(info.availableCredit ?? 0) < 0
                    ? `Over limit by ${formatCurrency(Math.abs(info.availableCredit))}`
                    : `${formatCurrency(info.availableCredit)} available (limit ${formatCurrency(account.creditLimit)})`}
                </div>
              )}

              {/* Statement summary */}
              {info.cutoffDate ? (
                <div
                  className={`text-xs px-2 py-1 rounded-md inline-block ${info.isPaid ? "bg-ledger-soft text-ledger-dark" : "bg-alert-soft text-alert"
                    }`}
                >
                  {info.isPaid ? "Statement paid" : `${formatCurrency(Math.abs(info.statementBalance ?? 0))} due`}
                </div>
              ) : (
                <div className="text-xs text-ink-muted">No statement logged yet</div>
              )}
            </Link>
          );
        })}
      </div>

      {showAddModal && <AddLiabilityModal onClose={() => setShowAddModal(false)} />}

      {editAccountId && (
        <EditLiabilityModal accountId={editAccountId} onClose={() => setEditAccountId(null)} />
      )}
    </div>
  );
}
