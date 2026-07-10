import { useState } from "react";
import AddAccountTypeModal from "../components/AddAccountTypeModal";

// Manages the "+ Add Type" flow triggered from inside an account's Type
// dropdown, auto-assigning the newly created type back once saved.
// Mirrors useInlineAddTravel.
//
// onAssign(newTypeId) is called when the type is created.
export function useInlineAddAccountType(onAssign) {
  const [active, setActive] = useState(false);

  const requestAddAccountType = () => setActive(true);

  const inlineAddAccountTypeModal = active ? (
    <AddAccountTypeModal
      onCreated={(newTypeId) => onAssign(newTypeId)}
      onClose={() => setActive(false)}
    />
  ) : null;

  return { requestAddAccountType, inlineAddAccountTypeModal };
}
