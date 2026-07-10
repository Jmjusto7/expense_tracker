import { useState } from "react";
import { useExpenseContext } from "../../context/ExpenseContext";
import ConfirmButton from "../../components/ConfirmButton";
import CategoryAutocompleteInput from "../../components/transaction-row/CategoryAutocompleteInput";

const AccountTypesTab = () => {
  const { accountTypes, accounts, addAccountType, updateAccountType, removeAccountType } = useExpenseContext();

  const [newType, setNewType] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [renameError, setRenameError] = useState("");

  const typeNames = accountTypes.map((t) => t.name);

  const handleAdd = async () => {
    if (!newType.trim()) return;
    await addAccountType(newType.trim());
    setNewType("");
  };

  const startEdit = (type) => {
    setEditingId(type.id);
    setEditingName(type.name);
    setRenameError("");
  };

  const handleRename = async (id) => {
    if (!editingName.trim()) return;
    try {
      await updateAccountType(id, { name: editingName.trim() });
      setEditingId(null);
      setRenameError("");
    } catch (err) {
      setRenameError(err.message || "Failed to rename.");
    }
  };

  const countForType = (typeId) => accounts.filter((a) => a.typeId === typeId).length;

  const newTypeExistingMatch = accountTypes.find(
    (t) => t.name.trim().toLowerCase() === newType.trim().toLowerCase()
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-4">Account Types</h2>
      <p className="text-ink-muted text-sm mb-4">
        Classifications like Bank Account, Digital Bank, Investment, or Time Deposit. Assign
        each account to a type from that account's edit form - removing a type here leaves its
        accounts Unclassified rather than deleting them.
      </p>

      {/* Add new type */}
      <div className="flex gap-2 items-start mb-1">
        <div className="w-60">
          <CategoryAutocompleteInput
            value={newType}
            onChange={setNewType}
            categories={typeNames}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <button
          onClick={handleAdd}
          className="bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Add Type
        </button>
      </div>
      <p className="text-xs text-ink-muted mb-1">Press Tab to complete a suggested name.</p>
      {newTypeExistingMatch && newType.trim() && (
        <p className="text-xs text-ledger-dark mb-4">
          "{newTypeExistingMatch.name}" already exists - adding will use it rather than create a duplicate.
        </p>
      )}
      {(!newTypeExistingMatch || !newType.trim()) && <div className="mb-4" />}

      {/* Type list */}
      {accountTypes.length === 0 ? (
        <p className="text-ink-muted text-sm">No account types yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {accountTypes.map((type) => {
            const count = countForType(type.id);
            const isEditing = editingId === type.id;

            return (
              <div key={type.id} className="flex flex-col gap-1">
                <div className="flex justify-between items-center p-3 border border-border rounded-lg">
                  {isEditing ? (
                    <div className="flex-1 mr-3">
                      <CategoryAutocompleteInput
                        value={editingName}
                        onChange={setEditingName}
                        categories={typeNames.filter((n) => n !== type.name)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename(type.id)}
                      />
                    </div>
                  ) : (
                    <div>
                      <span className="text-base font-medium text-ink">{type.name}</span>
                      <span className="text-xs text-ink-muted ml-2">
                        {count} account{count === 1 ? "" : "s"}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleRename(type.id)}
                          className="text-sm text-ledger-dark hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setRenameError("");
                          }}
                          className="text-sm text-ink-muted hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(type)}
                          className="text-sm text-ink-muted hover:text-ink"
                        >
                          Rename
                        </button>
                        <ConfirmButton
                          onConfirm={() => removeAccountType(type.id)}
                          className="text-sm text-alert hover:underline"
                          confirmClassName="text-sm text-white bg-alert px-2 py-0.5 rounded-md"
                          confirmLabel="Confirm remove?"
                          title={`Remove "${type.name}"? ${count} account${count === 1 ? "" : "s"} become Unclassified.`}
                        >
                          Remove
                        </ConfirmButton>
                      </>
                    )}
                  </div>
                </div>

                {isEditing && renameError && (
                  <p className="text-alert text-xs px-1">{renameError}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccountTypesTab;
