// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import App from "./App";
import "./index.css";
import { requestPersistentStorage } from "./utils/storagePersistence";
import { applyHideBalances } from "./hooks/useHideBalances";
import "./utils/installPrompt";

applyHideBalances();
requestPersistentStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
