import React, { useState, useEffect } from "react";
import { StationReport } from "../types";
import {  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, Building2, Coins, SearchCheck, ChevronLeft, ChevronRight,Plane, Store, ScrollText, FileText} from "lucide-react";
import { TaxDetailsModal } from "./TaxDetailsModal";
import { SingleTaxExplanationModal } from "./SingleTaxExplanationModal";
import { Skeleton } from "./ui/Skeleton";

interface AuditAnomalyListProps {
  reports: StationReport[];
  loading?: boolean;
}

export const AuditAnomalyList: React.FC<AuditAnomalyListProps> = ({ reports, loading = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTaxReport, setSelectedTaxReport] = useState<StationReport | null>(null);
  const [selectedTaxItem, setSelectedTaxItem] = useState<{ code: string; amount: number; currency: string } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); 

  // Reset page when filter changes or report catalog updates
  useEffect(() => {
    setCurrentPage(1);
  }, [search, reports.length]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-slate-50/50">
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        </div>
        <div className="divide-y divide-slate-100 p-5 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 py-4">
              <div className="flex gap-4 flex-1">
                <Skeleton className="h-3 w-3 rounded-full mt-2" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };
  const filteredReports = reports.filter(rep => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      rep.stationName.toLowerCase().includes(term) ||
      rep.cityName.toLowerCase().includes(term) ||
      rep.stationNumber.includes(term) ||
      rep.dateStr.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
      {/* Search Header */}
      <div id="audit-list-header" className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-slate-50/50">
        <div>
          <h3 className="font-extrabold text-slate-950 text-base md:text-lg">Audit Reports Registry</h3>
          <p className="text-slate-650 text-sm mt-1">Explore detailed financial statements from all station counters.</p>
        </div>
        
        {/* Search Input inline */}
        <div className="relative max-w-md w-full">
          <SearchCheck className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="audit-search-input"
            type="text"
            placeholder="Search by city, station (e.g., LFWCT, Lomé, 03222811)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl pl-10 pr-5 py-2.5.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="p-10 text-center text-slate-600 text-sm font-semibold">
          No audit reports matching the search criteria.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {(() => {
            const indexOfLastReport = currentPage * itemsPerPage;
            const indexOfFirstReport = indexOfLastReport - itemsPerPage;
            const slicedReports = filteredReports.slice(indexOfFirstReport, indexOfLastReport);
            
            return slicedReports.map(rep => {
               const isExpanded = expandedId === rep.id;
              
              return (
                <div 
                  key={rep.id} 
                  className={`transition-all duration-300 text-sm ${
                    isExpanded 
                      ? "bg-green-50 border-y border-green-200 shadow-xs" 
                      : ""
                  }`}
                >
                  {/* Master Summary Line */}
                  <div
                    id={`report-item-${rep.id}`}
                    onClick={() => toggleExpand(rep.id)}
                    className={`flex flex-col lg:flex-row lg:items-center justify-between p-5 cursor-pointer transition-all duration-200 gap-4 border-l-5 ${
                      isExpanded 
                        ? rep.isEmpty 
                          ? "bg-slate-100/90 border-slate-400 text-slate-900" 
                          : rep.hasErrors 
                          ? "bg-rose-50/90 border-rose-500 text-slate-950" 
                          : "bg-emerald-50/80 border-emerald-500 text-slate-950"
                        : "bg-white border-transparent hover:bg-slate-50/60 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Discrepancy Status Bullet Indicator */}
                      <div className="mt-1.5">
                        {rep.isEmpty ? (
                          <div id={`status-badge-empty-${rep.id}`} className="w-3 h-3 rounded-full bg-slate-300" title="Rapport vide (Aucune activité)"></div>
                        ) : rep.hasErrors ? (
                          <div id={`status-badge-error-${rep.id}`} className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" title="Écart ou anomalie financière détectée !"></div>
                        ) : (
                          <div id={`status-badge-ok-${rep.id}`} className="w-3 h-3 rounded-full bg-emerald-500" title="Bilan équilibré & audité conforme"></div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-base md:text-lg">{rep.stationName}</span>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold border border-slate-200">
                            {rep.stationNumber}
                          </span>
                          <span className="text-xs bg-indigo-50/40 text-indigo-900 px-2.5 py-0.5 rounded-md font-mono font-bold border border-indigo-100">
                            • {rep.dateStr}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-sm text-slate-650 mt-1.5">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-800">{rep.cityName}</span>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center gap-1">
                            {rep.stationType === "AP" ? <Plane className="w-3.5 h-3.5 text-slate-400" /> : <Store className="w-3.5 h-3.5 text-slate-400" />}
                            <span className="font-medium text-slate-600">
                              {rep.isEmpty 
                                ? "Empty / No movement" 
                                : rep.stationType === "CT" 
                                ? "City Office - Boutique" 
                                : rep.stationType === "AP" 
                                ? "Airport Counter" 
                                : rep.stationType === "CC"
                                ? "Call Center"
                                : "Sales Office"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Currencies financial details pill */}
                    <div className="flex flex-wrap items-center gap-2">
                      {rep.isEmpty ? (
                        <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-semibold border border-slate-200">
                          Sans mouvement
                        </span>
                      ) : (
                        <>
                          {rep.currencyBlocks.map(block => (
                            <span
                              key={block.currency}
                              className="text-xs bg-indigo-50/80 text-indigo-800 px-3 py-1.5 rounded-xl font-bold font-mono border border-indigo-150/70"
                            >
                              {block.currency} : {block.accountingTotal.toLocaleString("fr-FR")}
                            </span>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Closure & delays */}
                    <div className="flex items-center justify-between lg:justify-end gap-5">
                      {rep.closure ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-650 font-mono bg-slate-100/60 px-2.5 py-1 rounded-lg">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span>
                            {rep.closure.time.substring(0, 2)}h{rep.closure.time.substring(2)} ({rep.closure.operator})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded">—</span>
                      )}

                      <div className="flex items-center gap-2">
                        {rep.isEmpty ? (
                          <span className="hidden md:inline-flex text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold border border-slate-200">
                            Archivé
                          </span>
                        ) : rep.hasErrors ? (
                          <span className="hidden md:inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-800 px-2.5 py-1 rounded-full font-bold border border-rose-200">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            {rep.errorMessages.length} Écart(s)
                          </span>
                        ) : (
                          <span className="hidden md:inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            Conforme
                          </span>
                        )}
                        
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sub Detail Expand Block */}
                  {isExpanded && (
                    <div id={`expanded-content-${rep.id}`} className="bg-slate-50/50 p-6 border-t border-slate-100">
                    {rep.isEmpty ? (
                      <div className="bg-white p-6 rounded-xl border border-slate-150 text-slate-550 text-sm text-center flex items-center justify-center gap-2">
                        <ScrollText className="w-5 h-5 text-slate-400" />
                        The report contains no agent or tax movements. Status: {rep.status || "Blank"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Financial Audit Cards Column */}
                        <div className="col-span-1 lg:col-span-8 space-y-5">
                          {/* Error block if any */}
                          {rep.hasErrors && (
                            <div className="bg-rose-50 border border-rose-250 rounded-xl p-5 text-sm text-rose-850 space-y-2">
                              <h5 className="font-extrabold flex items-center gap-1.5 text-rose-950 text-sm">
                                <AlertCircle className="w-5 h-5 text-rose-700" />
                                Anomalies identified by the auditor:
                              </h5>
                              <ul className="list-disc pl-5 space-y-1 bg-white/40 p-3 rounded-lg border border-rose-100/40">
                                {rep.errorMessages.map((msg, midKey) => (
                                  <li key={midKey} className="font-semibold">{msg}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {rep.currencyBlocks.map(block => (
                            <div key={block.currency} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                              <div className="bg-slate-100/60 px-5 py-3.5 border-b border-slate-150 flex items-center justify-between">
                                <span className="font-black text-slate-800 text-sm uppercase font-mono">
                                  TRANSACTION REGISTRY ({block.currency})
                                </span>
                                {block.commission !== 0 && (
                                  <span className="text-xs text-rose-600 font-extrabold font-mono bg-rose-50 px-2 py-1 rounded">
                                    COM Commission: {block.commission.toLocaleString("en-US")}
                                  </span>
                                )}
                              </div>
                              <div className="p-5 overflow-x-auto">
                                <table className="w-full text-sm text-slate-700 font-mono">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold">
                                        <th className="text-left pb-3 font-sans">Payment Mode</th>
                                        <th className="text-right pb-3 font-sans">Refund</th>
                                        <th className="text-right pb-3 font-sans">Gross Total</th>
                                        <th className="text-right pb-3 font-sans text-emerald-600">Net to Pay</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {block.sales.map((row, rIdx) => {
                                        const isET = row.method === "ET";
                                        return (
                                          <tr key={rIdx} className={`hover:bg-slate-50/70 transition-colors ${isET ? "bg-slate-50/30 opacity-75 italic" : ""}`}>
                                            <td className="py-3 font-bold text-slate-850 font-sans flex items-center gap-2">
                                              {row.method === "CA" ? "Cash (CA)" : row.method === "CK" ? "Cheque (CK)" : row.method === "ET" ? "Electronic Ticket (ET)" : row.method === "IN" ? "Direct Invoicing (IN)" : `Other (${row.method})`}
                                              {isET && <span className="not-italic inline-block bg-slate-200 text-slate-600 text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">Informative</span>}
                                            </td>
                                            <td className="py-3 text-right text-rose-600 font-bold">
                                              {row.refund.toLocaleString("en-US")}
                                            </td>
                                            <td className="py-3 text-right font-medium text-slate-500">
                                              {row.totalAmount.toLocaleString("en-US")}
                                            </td>
                                            <td className={`py-3 text-right font-black ${isET ? "text-slate-300" : "text-emerald-700"}`}>
                                              {isET ? "0" : row.totalAmount.toLocaleString("en-US")}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                      {/* Calculated Totals Row */}
                                      <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-200 text-sm">
                                        <td className="py-3 pl-2 text-slate-550 text-xs font-sans uppercase">Calculated Registry Sum</td>
                                        <td className="py-3 text-right text-rose-600 font-extrabold">
                                          {block.sales.reduce((a, b) => a + b.refund, 0).toLocaleString("en-US")}
                                        </td>
                                        <td className="py-3 text-right text-slate-450 font-black">
                                          {block.sales.reduce((a, b) => a + b.totalAmount, 0).toLocaleString("en-US")}
                                        </td>
                                        <td className="py-3 text-right text-emerald-600 font-black">
                                          {block.accountingTotal.toLocaleString("en-US")}
                                        </td>
                                      </tr>
                                    {/* Proclaimed Totals Row */}
                                    <tr className="font-bold bg-indigo-50/40 text-indigo-950 border-t border-slate-200 text-sm">
                                      <td className="py-3 pl-2 text-xs font-sans uppercase">Reported Total</td>
                                      <td className="py-3 text-right font-black">
                                        {block.refundTotal.toLocaleString("en-US")}
                                      </td>
                                      <td className="py-3 text-right font-black">
                                        {block.netFareTotal.toLocaleString("en-US")}
                                      </td>
                                      <td className="py-3 text-right text-indigo-800 font-black">
                                        {block.amountTotal.toLocaleString("en-US")}
                                      </td>
                                    </tr>

                                    {/* --- ACCOUNTING FORMULAS DISPLAY --- */}
                                    <tr className="font-bold bg-slate-900 text-white border-t border-slate-700 text-sm">
                                      <td className="py-3 pl-3 flex flex-col">
                                        <span className="text-[10px] font-sans uppercase text-slate-400">Remittance to Accounts</span>
                                        <span className="font-black text-xs uppercase tracking-tighter text-emerald-400">Total to Pay</span>
                                      </td>
                                      <td colSpan={2} className="py-3 pr-4 text-right text-xs text-slate-400 italic font-medium font-sans">
                                        (Total Amount - ET Transactions)
                                      </td>
                                      <td className="py-3 text-right pr-4 text-emerald-400 font-black text-base">
                                        {block.accountingTotal.toLocaleString("en-US")}
                                      </td>
                                    </tr>
                                    <tr className="font-bold bg-slate-100 border-t border-slate-200 text-[11px]">
                                      <td className="py-2 pl-3">
                                        <span className="text-[9px] uppercase text-slate-500 block">Audit Net Base</span>
                                        <span className="text-slate-800 font-black tracking-tight">HT (Net Fare)</span>
                                      </td>
                                      <td colSpan={2} className="py-2 pr-4 text-right text-[10px] text-slate-500 font-medium font-sans italic">
                                        (Total - ET) - Total Tax
                                      </td>
                                      <td className="py-2 text-right pr-4 text-slate-900 font-black">
                                        {block.netFareHT.toLocaleString("en-US")}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Taxes block for this currency */}
                              {block.taxes.length > 0 && (
                                <div className="border-t border-slate-150 p-5 bg-slate-50/30">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600 font-bold text-xs uppercase mb-3.5">
                                    <span className="flex items-center gap-1.5 text-slate-700 font-extrabold">
                                      <Coins className="w-4 h-4 text-slate-550" />
                                      <span>Tax Breakdown ({block.currency})</span>
                                    </span>
                                    
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaxReport(rep);
                                      }}
                                      className="text-xs font-black text-indigo-700 hover:text-white hover:bg-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                                      title="Detailed IATA explanation of these taxes"
                                    >
                                      💡 Tax Definitions
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-sm font-mono">
                                    {block.taxes.map((t, tIdx) => (
                                      <div 
                                        key={tIdx} 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTaxItem({ code: t.code, amount: t.amount, currency: block.currency });
                                        }}
                                        className="bg-white hover:bg-indigo-50/60 p-3 rounded-xl border border-slate-200 hover:border-indigo-400 shadow-3xs transition-all duration-150 cursor-pointer flex items-center justify-between group active:scale-97 select-none"
                                        title="Click to decode this IATA tax"
                                      >
                                        <span className="font-extrabold text-slate-500 group-hover:text-indigo-700 transition-colors">{t.code}</span>
                                        <span className={`font-black ${t.amount < 0 ? "text-rose-600" : "text-slate-800 group-hover:text-indigo-950 transition-colors"}`}>
                                          {t.amount.toLocaleString("en-US")}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex flex-col sm:flex-row justify-between sm:items-center mt-4 pt-4 border-t border-slate-150 text-sm gap-2">
                                    <span className="font-bold text-slate-650">Summed Taxes: {block.taxes.reduce((a, b) => a + b.amount, 0).toLocaleString("en-US")}</span>
                                    <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">Declared Total: {block.taxTotal.toLocaleString("en-US")}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Closure Logs & Remarks Column */}
                        <div className="col-span-1 lg:col-span-4 space-y-4">
                          {/* Close details */}
                          <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <h5 className="font-black text-slate-850 text-xs sm:text-sm uppercase mb-4 flex items-center gap-1.5">
                              <Clock className="w-4.5 h-4.5 text-indigo-600" />
                              Station Closure
                            </h5>
                            
                            {rep.closure ? (
                              <div className="space-y-3.5 text-sm text-slate-700">
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                  <span className="font-medium text-slate-500">Closure Time</span>
                                  <span className="font-black font-mono text-slate-900">
                                    {rep.closure.time.substring(0, 2)}:{rep.closure.time.substring(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                  <span className="font-medium text-slate-500">Date</span>
                                  <span className="font-bold font-mono">{rep.closure.date}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                  <span className="font-medium text-slate-500">Operator</span>
                                  <span className="font-extrabold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-mono text-xs border border-indigo-100">
                                    {rep.closure.operator}
                                  </span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                  <span className="font-medium text-slate-500">Closure Type</span>
                                  <span className="font-semibold text-slate-800">
                                    {rep.closure.isAutoClosed ? "Factory Auto-Close" : "Manual Closure"}
                                  </span>
                                </div>

                                {rep.closure.delays.length > 0 && (
                                  <div className="pt-2">
                                    <span className="font-extrabold text-amber-800 text-xs uppercase block mb-1.5">Report Signals (Delay):</span>
                                    <div className="space-y-1.5">
                                      {rep.closure.delays.map((del, dIdx) => (
                                        <div key={dIdx} className="bg-amber-50 text-amber-850 p-2.5 rounded-lg font-mono text-xs border border-amber-250">
                                          {del}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-slate-400 text-sm italic">No closure data identified.</p>
                            )}
                          </div>

                          {/* Raw block explorer */}
                          <div className="bg-slate-900 rounded-xl p-5 text-emerald-400 font-mono text-xs overflow-hidden select-text shadow-inner">
                            <h5 className="font-black text-slate-400 text-xs uppercase mb-2.5 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-slate-550" />
                              Station Raw Log
                            </h5>
                            <pre className="overflow-x-auto max-h-72 leading-relaxed text-slate-350 antialiased pr-2">
                              {rep.rawText}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* Elegant Pagination Controls */}
      {filteredReports.length > 0 && (
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-650">Afficher</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold shadow-3xs cursor-pointer"
            >
              <option value={5}>5 par page</option>
              <option value={10}>10 par page</option>
              <option value={20}>20 par page</option>
              <option value={50}>50 par page</option>
            </select>
            <span className="text-slate-450 font-semibold font-mono">
              [ {Math.min((currentPage - 1) * itemsPerPage + 1, filteredReports.length)} à {Math.min(currentPage * itemsPerPage, filteredReports.length)} sur {filteredReports.length} rapports ]
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white rounded-xl transition cursor-pointer disabled:cursor-not-allowed shadow-3xs"
              title="Page précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {(() => {
              const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
              return Array.from({ length: totalPages }, (_, idx) => idx + 1).map(page => {
                const showPage = totalPages <= 6 || Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;
                if (!showPage) {
                  if (page === 2 || page === totalPages - 1) {
                    return <span key={`ellipsis-${page}`} className="text-slate-400 px-1 text-xs">...</span>;
                  }
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2.5 text-sm font-extrabold rounded-xl transition-all cursor-pointer ${
                      currentPage === page
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-150 border border-indigo-600"
                        : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {page}
                  </button>
                );
              });
            })()}

            <button
              onClick={() => {
                const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
                setCurrentPage(prev => Math.min(prev + 1, totalPages));
              }}
              disabled={currentPage === Math.ceil(filteredReports.length / itemsPerPage)}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white rounded-xl transition cursor-pointer disabled:cursor-not-allowed shadow-3xs"
              title="Page suivante"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* High Fidelity Taxes Dictionary Detail Modal overlay */}
      {selectedTaxReport && (
        <TaxDetailsModal
          isOpen={!!selectedTaxReport}
          onClose={() => setSelectedTaxReport(null)}
          report={selectedTaxReport}
        />
      )}

      {/* Floating single-tax micro explanatory modal */}
      {selectedTaxItem && (
        <SingleTaxExplanationModal
          isOpen={!!selectedTaxItem}
          onClose={() => setSelectedTaxItem(null)}
          taxCode={selectedTaxItem.code}
          amount={selectedTaxItem.amount}
          currency={selectedTaxItem.currency}
        />
      )}
    </div>
  );
};
