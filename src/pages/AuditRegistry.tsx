/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardStats } from "../components/DashboardStats";
import { InteractiveFilters } from "../components/InteractiveFilters";
import { AuditAnomalyList } from "../components/AuditAnomalyList";
import { useAudit } from "../context/AuditContext";
import { motion } from "motion/react";
import { Download } from "lucide-react";
import { exportAuditToPDF } from "../utils/pdfExport";

import { PageWrapper } from "../components/layout/PageWrapper";
import { ExportButton } from "../components/ui/ExportButton";

export const AuditRegistry: React.FC = () => {
  const { rawText, filteredSummary, filters, setFilters,availableDates,availableStations,availableCities, availableCurrencies,
    filteredReports,
    isProcessing
  } = useAudit();
  
  const navigate = useNavigate();

  // Redirect to home if no data loaded
  useEffect(() => {
    if (!rawText.trim() && !isProcessing) {
      navigate("/");
    }
  }, [rawText, navigate, isProcessing]);

  if (!rawText.trim() && !isProcessing) return null;

  return (
    <PageWrapper className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Audit Registry</h2>
          <p className="text-slate-500 text-sm font-medium">Detailed analysis of station session closures</p>
        </div>
        <ExportButton
          summary={filteredSummary}
          reports={filteredReports}
          filters={filters}
          disabled={isProcessing}
        />
      </div>

      <DashboardStats summary={filteredSummary} loading={isProcessing} />

      <InteractiveFilters
        filters={filters}
        onFilterChange={setFilters}
        availableDates={availableDates}
        availableStations={availableStations}
        availableCities={availableCities}
        availableCurrencies={availableCurrencies}
      />

      <AuditAnomalyList reports={filteredReports} loading={isProcessing} />
    </PageWrapper>
  );
};
