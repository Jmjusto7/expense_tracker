import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import { ExpenseProvider } from "./context/ExpenseContext";
import { SyncProvider } from "./context/SyncContext";
import Navbar from "./components/Navbar";
import UpdatePrompt from "./components/UpdatePrompt";

function App() {
  return (
    <ExpenseProvider>
      <SyncProvider>
        <BrowserRouter>
          <Navbar />
          {/* Phones: leave room for the fixed bottom tab bar and floating Add button. */}
          <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-0">
            <AppRoutes />
          </main>
          <UpdatePrompt />
        </BrowserRouter>
      </SyncProvider>
    </ExpenseProvider>
  );
}

export default App;
