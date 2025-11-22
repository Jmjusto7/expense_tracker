import AppRoutes from "./routes";
import { ExpenseProvider } from "./context/ExpenseContext";

function App() {
  return (
    <ExpenseProvider>
      <AppRoutes />
    </ExpenseProvider>
  );
}

export default App;
