
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Index from "./pages/Index";
import AddressManager from "./pages/AddressManager";
import CamtConverter from "./pages/CamtConverter";
import EntryAnalysis from "./pages/EntryAnalysis";
import DebFactManager from "./pages/DebFactManager";
import BankStatementConverter from "./pages/BankStatementConverter";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center space-x-8">
                  <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                    ExcelToAbacus
                  </Link>
                  <Link to="/address-manager" className="text-gray-600 hover:text-blue-600">
                    Gestion des Adresses
                  </Link>
                  <Link to="/camt-converter" className="text-gray-600 hover:text-blue-600">
                    Convertisseur CAMT
                  </Link>
                  <Link to="/entry-analysis" className="text-gray-600 hover:text-blue-600">
                    Analyse Écritures
                  </Link>
                    <Link to="/DebFactManager" className="text-gray-600 hover:text-blue-600">
                    DebFactManager
                  </Link>
                  <Link to="/bank-converter" className="text-gray-600 hover:text-blue-600">
                    PDF → Excel
                  </Link>
                </div>
              </div>
            </div>
          </nav>
          
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/address-manager" element={<AddressManager />} />
            <Route path="/camt-converter" element={<CamtConverter />} />
            <Route path="/entry-analysis" element={<EntryAnalysis />} />
            <Route path="/DebFactManager" element={<DebFactManager />} />
            <Route path="/bank-converter" element={<BankStatementConverter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          
          <footer className="bg-gray-50 border-t mt-12">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-gray-600">
                © 2025 <a href="https://github.com/Hmz931">Hamza Bouguerra</a> | Internal use only | All rights reserved.                
              </p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
