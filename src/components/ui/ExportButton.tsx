
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Download, 
  ChevronDown, 
  FileText, 
  FileSpreadsheet, 
  Database,
  Layers,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { AuditSummary, StationReport } from "@/src/types";
import { FilterState } from "../InteractiveFilters";
import { exportAuditToPDF } from "@/src/utils/pdfExport";
import { 
  exportAllToMultiSheetExcel, 
  exportSummaryToExcel, 
  exportDetailedReportsToExcel, 
  exportTransactionsToExcel 
} from "@/src/utils/ExcelExport";

interface ExportButtonProps {
  summary: AuditSummary;
  reports: StationReport[];
  filters: FilterState;
  disabled?: boolean;
  size?: "sm" | "md";
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  summary,
  reports,
  filters,
  disabled = false,
  size = "md"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExportPDF = () => {
    exportAuditToPDF(summary, reports, filters);
    setIsOpen(false);
  };

  const handleExportAllExcel = () => {
    exportAllToMultiSheetExcel(summary, reports, filters);
    setIsOpen(false);
  };

  const handleExportSummaryExcel = () => {
    exportSummaryToExcel(summary, filters);
    setIsOpen(false);
  };

  const handleExportDetailedReportsExcel = () => {
    exportDetailedReportsToExcel(reports, filters);
    setIsOpen(false);
  };

  const handleExportTransactionsExcel = () => {
    exportTransactionsToExcel(reports, filters);
    setIsOpen(false);
  };

  const buttonClasses = size === "sm"
    ? "flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-2xl font-bold text-xs shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
    : "flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={buttonClasses}
      >
        <Download className={size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5"} />
        <span>Exporter les données</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Formats d'export</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            </div>

            {/* List */}
            <div className="p-2 space-y-1">
              {/* RECOMMENDED MULTI-SHEET EXCEL EXPORT */}
              <button
                onClick={handleExportAllExcel}
                className="w-full flex items-start gap-3 p-3 rounded-xl bg-emerald-50/40 hover:bg-emerald-50/80 transition-colors text-left group border border-emerald-100/30 cursor-pointer"
              >
                <div className="bg-emerald-500 text-white p-2 rounded-lg transition-colors mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-emerald-900 uppercase tracking-tight leading-none">Excel Multi-Onglets</p>
                    <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded leading-none">Recommandé</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">
                    Un seul fichier .xlsx contenant la synthèse, les détails stations et les transactions.
                  </p>
                </div>
              </button>

              <div className="border-t border-slate-100 my-1"></div>

              {/* INDIVIDUAL EXCEL EXPORTS HEADER */}
              <div className="px-3 py-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Feuilles Excel individuelles</span>
              </div>

              {/* EXCEL SUMMARY */}
              <button
                onClick={handleExportSummaryExcel}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
              >
                <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors mt-0.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-none mb-1">Synthèse des Devises</p>
                  <p className="text-[9px] text-slate-500">Totaux à verser, net HT, commissions et remboursements</p>
                </div>
              </button>

              {/* EXCEL DETAILED REPORTS */}
              <button
                onClick={handleExportDetailedReportsExcel}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
              >
                <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors mt-0.5">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-none mb-1">Rapports des Stations</p>
                  <p className="text-[9px] text-slate-500">Audit par station avec détails financiers et anomalies</p>
                </div>
              </button>

              {/* EXCEL DETAILED TRANSACTIONS */}
              <button
                onClick={handleExportTransactionsExcel}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
              >
                <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors mt-0.5">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-none mb-1">Journal des Transactions</p>
                  <p className="text-[9px] text-slate-500">Relevé quotidien par mode de paiement et devise</p>
                </div>
              </button>

              <div className="border-t border-slate-100 my-1"></div>

              {/* PDF EXPORT */}
              <button
                onClick={handleExportPDF}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50/50 transition-colors text-left group cursor-pointer"
              >
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-100 transition-colors mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Rapport PDF Complet</p>
                  <p className="text-[10px] text-slate-500 font-medium">Bilan synthétique imprimable pour l'audit</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
