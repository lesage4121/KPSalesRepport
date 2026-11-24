import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuditProvider } from "./context/AuditContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Landing } from "./pages/Landing";
import { StationImporterPage } from "./pages/StationImporterPage";
import { OnlineImporterPage } from "./pages/OnlineImporterPage";
import { FlightOperationsPage } from "./pages/FlightOperationsPage";
import { AuditRegistry } from "./pages/AuditRegistry";
import { Analytics } from "./pages/Analytics";
import { AnimatePresence } from "motion/react";

import { ScrollToTop } from "./components/layout/ScrollToTop";
import { OnlineApp } from "./pages/OnlineApp";

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <div key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/import-station" element={<StationImporterPage />} />
          <Route path="/import-online" element={<OnlineApp />} />
          <Route path="/flight-operations" element={<FlightOperationsPage />} />
          <Route path="/audit" element={<AuditRegistry />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <LanguageProvider>
        <ThemeProvider>
          <AuditProvider>
            <AppLayout>
              <AnimatedRoutes />
            </AppLayout>
          </AuditProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
