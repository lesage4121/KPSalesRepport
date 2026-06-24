
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuditProvider } from "./context/AuditContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Landing } from "./pages/Landing";
import { StationImporterPage } from "./pages/StationImporterPage";
import { OnlineImporterPage } from "./pages/OnlineImporterPage";
import { AuditRegistry } from "./pages/AuditRegistry";
import { Analytics } from "./pages/Analytics";
import { AnimatePresence } from "motion/react";
import { OnlineApp } from "./pages/OnlineApp";
import { ScrollToTop } from "./components/layout/ScrollToTop";

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <div key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/import-station" element={<StationImporterPage />} />
          <Route path="/audit" element={<AuditRegistry />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path = "/import-online" element ={<OnlineApp />} />
        </Routes>
      </div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuditProvider>
        <AppLayout>
          <AnimatedRoutes />
        </AppLayout>
      </AuditProvider>
    </BrowserRouter>
  );
}
