import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import { ExpenseProvider } from "./context/ExpenseContext";
import { FilterProvider } from "./context/FilterContext";
import Navbar from "./components/Navbar";

function App() {
  return (
    <ExpenseProvider>
      <FilterProvider>
        <BrowserRouter>
          <Navbar />
          <main>
            <AppRoutes />
          </main>
        </BrowserRouter>
      </FilterProvider>
    </ExpenseProvider>
  );
}

export default App;
