import { useSyncExternalStore } from "react";

const KEY = "tracker.hideBalances";
const listeners = new Set();

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

// The blur itself is CSS keyed on this attribute (see index.css), so hidden values never flash on load.
export function applyHideBalances(hidden = read()) {
  document.documentElement.toggleAttribute("data-hide-balances", hidden);
}

export function setHideBalances(hidden) {
  try {
    localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {
    // Storage unavailable (private mode): still hide for this session.
  }
  applyHideBalances(hidden);
  listeners.forEach((notify) => notify());
}

function subscribe(notify) {
  const onStorage = (e) => {
    if (e.key !== KEY) return;
    applyHideBalances();
    notify();
  };
  listeners.add(notify);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function useHideBalances() {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  return [hidden, setHideBalances];
}
