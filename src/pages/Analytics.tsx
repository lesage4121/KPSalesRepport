
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SalesCharts } from "../components/SalesCharts";
import { DashboardStats } from "../components/DashboardStats";
import { InteractiveFilters } from "../components/InteractiveFilters";
import { ComparisonMetrics } from "../components/ComparisonMetrics";
import { useAudit } from "../context/AuditContext";
import { computeAuditSummary } from "../parser";
import { motion, AnimatePresence } from "motion/react";
import { Scale, CalendarRange, ArrowLeftRight, Activity } from "lucide-react";
import { ExportButton } from "../components/ui/ExportButton";

import { PageWrapper } from "../components/layout/PageWrapper";

export const Analytics: React.FC = () => {
  const { 
    rawText, 
    filteredReports, 
    filters,
    setFilters,
    availableDates,
    availableStations,
    availableCities,
    availableCurrencies,
    filteredSummary,
    isProcessing,
    reports,
    filterReports
  } = useAudit();
  
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [compareFilters, setCompareFilters] = useState(filters);

  const compareSummary = useMemo(() => {
    if (!isComparisonMode) return null;
    const filtered = filterReports(reports, compareFilters);
    return computeAuditSummary(filtered);
  }, [isComparisonMode, reports, compareFilters, filterReports]);

  const navigate = useNavigate();

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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Statistics & Analytics</h2>
          <p className="text-slate-500 text-sm font-medium">Visualization of sales volumes and trends</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsComparisonMode(!isComparisonMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border shadow-sm ${
              isComparisonMode 
                ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-100" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Scale className="w-4 h-4" />
            {isComparisonMode ? "Disable Comparison" : "Compare Two Periods"}
          </button>
          <ExportButton
          summary={filteredSummary}
          reports={filteredReports}
          filters={filters}
          disabled={isProcessing}
        />
        </div>
      </div>

      <AnimatePresence>
        {isComparisonMode && compareSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-[2rem] mb-8">
               <div className="flex items-center gap-3 mb-6">
                 <div className="bg-indigo-600 p-2 rounded-xl text-white">
                   <ArrowLeftRight className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="font-black text-slate-900">Comparative Analysis</h3>
                   <p className="text-indigo-600 text-[11px] font-bold uppercase tracking-widest">Growth vs Base Period</p>
                 </div>
               </div>
               
               <ComparisonMetrics baseSummary={filteredSummary} compareSummary={compareSummary} />

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-500 ml-2">
                       <CalendarRange className="w-4 h-4" />
                       <span className="text-[11px] font-bold uppercase tracking-wider">Period A (Reference)</span>
                    </div>
                    <InteractiveFilters
                      filters={filters}
                      onFilterChange={setFilters}
                      availableDates={availableDates}
                      availableStations={availableStations}
                      availableCities={availableCities}
                      availableCurrencies={availableCurrencies}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-500 ml-2">
                       <Scale className="w-4 h-4" />
                       <span className="text-[11px] font-bold uppercase tracking-wider">Period B (Target)</span>
                    </div>
                    <div className="ring-2 ring-indigo-500/20 rounded-3xl overflow-hidden shadow-xl shadow-indigo-100/50">
                      <InteractiveFilters
                        filters={compareFilters}
                        onFilterChange={setCompareFilters}
                        availableDates={availableDates}
                        availableStations={availableStations}
                        availableCities={availableCities}
                        availableCurrencies={availableCurrencies}
                      />
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isComparisonMode && (
        <>
          <DashboardStats summary={filteredSummary} loading={isProcessing} />
          <InteractiveFilters
            filters={filters}
            onFilterChange={setFilters}
            availableDates={availableDates}
            availableStations={availableStations}
            availableCities={availableCities}
            availableCurrencies={availableCurrencies}
          />
        </>
      )}

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          {isComparisonMode ? "Variance Visualization (Period B Data)" : "Volume Visualization"}
        </h4>
        <SalesCharts 
          reports={isComparisonMode && compareFilters ? filterReports(reports, compareFilters) : filteredReports} 
          selectedCurrency={isComparisonMode ? compareFilters.currency : filters.currency} 
          loading={isProcessing} 
        />
      </div>
    </PageWrapper>
  );
};
