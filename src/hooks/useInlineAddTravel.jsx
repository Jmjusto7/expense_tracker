import { useState } from "react";
import AddTravelModal from "../components/AddTravelModal";

// Manages the "+ Add Travel" flow triggered from inside a transaction row's
// travel dropdown: tracks which row asked for it, and auto-assigns the
// newly created travel back to that row once saved.
//
// onAssign(rowId, newTravelIdAsString) is called when the travel is created.
export function useInlineAddTravel(onAssign) {
  const [activeRowId, setActiveRowId] = useState(null);

  const requestAddTravel = (rowId) => setActiveRowId(rowId);

  const inlineAddTravelModal = activeRowId ? (
    <AddTravelModal
      onCreated={(newTravelId) => onAssign(activeRowId, String(newTravelId))}
      onClose={() => setActiveRowId(null)}
    />
  ) : null;

  return { requestAddTravel, inlineAddTravelModal };
}
