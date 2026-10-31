import { useSyncExternalStore } from "react";
import { getInstallState, promptInstall, subscribeInstallState } from "../utils/installPrompt";

export function useInstallApp() {
    const state = useSyncExternalStore(subscribeInstallState, getInstallState, getInstallState);
    return { ...state, promptInstall };
}
