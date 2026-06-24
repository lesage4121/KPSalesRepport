import React, { useState } from "react";
import { StationReport } from "../types";
import { getIataTaxDefinition, IataTaxDefinition } from "../iata_taxes";
import { X, Landmark, Coins, AlertCircle, Copy, Check, FileCheck2, Info, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TaxDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: StationReport;
}

export const TaxDetailsModal: React.FC<TaxDetailsModalProps> = ({ isOpen, onClose, report }) => {
  const [activeCurrencyIdx, setActiveCurrencyIdx] = useState(0);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  // Filter currency blocks that have taxes
  const blocksWithTaxes = report.currencyBlocks.filter(b => b.taxes && b.taxes.length > 0);

  // If there are no taxes in any block, warn nicely
  const hasMultipleTaxes = blocksWithTaxes.length > 0;
  
  // Safe bounded index
  const safeIdx = Math.min(activeCurrencyIdx, Math.max(0, blocksWithTaxes.length - 1));
  const activeBlock = blocksWithTaxes[safeIdx];

  // Map category to aesthetic CSS classes in Tailwind
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Security":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "Airport/Passenger":
        return "bg-sky-50 text-sky-700 border-sky-100";
      case "Government/Solidarity":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Airlines Surcharge":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "Infrastructure":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  const calculateSumOfTaxes = () => {
    if (!activeBlock) return 0;
    return activeBlock.taxes.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleCopyTaxReport = () => {
    if (!activeBlock) return;
    
    let textToCopy = `DETAILED TAX REPORT - STATION ${report.stationName} (${report.stationNumber})\n`;
    textToCopy += `Date: ${report.dateStr} | Currency: ${activeBlock.currency}\n`;
    textToCopy += `---------------------------------------------------------\n`;
    
    activeBlock.taxes.forEach(t => {
      const def = getIataTaxDefinition(t.code);
      textToCopy += `[${t.code}] ${def.name}: ${t.amount.toLocaleString("en-US")} ${activeBlock.currency}\n`;
      textToCopy += `      Category: ${def.category}\n`;
      textToCopy += `      Description: ${def.description}\n\n`;
    });
    
    textToCopy += `---------------------------------------------------------\n`;
    textToCopy += `Sum of calculated taxes: ${calculateSumOfTaxes().toLocaleString("en-US")} ${activeBlock.currency}\n`;
    textToCopy += `Total reported: ${activeBlock.taxTotal.toLocaleString("en-US")} ${activeBlock.currency}\n`;
    
    const diff = activeBlock.taxTotal - calculateSumOfTaxes();
    textToCopy += `Gap difference: ${diff.toLocaleString("en-US")} ${activeBlock.currency}\n`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div id="tax-details-modal-overlay" className="fixed inset-0 z-100 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop background overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Card Layout */}
      <div 
        id="tax-details-modal-box" 
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Section */}
        <div className="bg-gradient-to-r from-indigo-700 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-2xl">
              <Landmark className="w-5.5 h-5.5 text-indigo-100" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-wide flex items-center gap-2">
                IATA Tax Meaning
              </h3>
              <p className="text-xs text-indigo-200 font-mono font-semibold">
                {report.stationName} ({report.stationNumber}) • Report of {report.dateStr}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-xl transition cursor-pointer"
            aria-label="Close window"
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Currency Tabs */}
        {hasMultipleTaxes && blocksWithTaxes.length > 1 && (
          <div className="bg-slate-50 border-b border-slate-150 px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-slate-600 font-black uppercase mr-1.5 flex-shrink-0">
              Detected Currencies:
            </span>
            {blocksWithTaxes.map((b, idx) => (
              <button
                key={b.currency}
                onClick={() => setActiveCurrencyIdx(idx)}
                className={`text-sm px-4 py-2 rounded-lg font-bold font-mono transition cursor-pointer ${
                  idx === safeIdx
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {b.currency}
              </button>
            ))}
          </div>
        )}

        {/* Modal Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!hasMultipleTaxes ? (
            /* Warning if no taxes found in current station report */
            <div className="py-10 text-center text-slate-500 space-y-4">
              <AlertCircle className="w-14 h-14 text-rose-500 mx-auto" strokeWidth={1.5} />
              <div className="space-y-1">
                <p className="text-base font-extrabold text-slate-850">No tax components identified</p>
                <p className="text-sm text-slate-600 max-w-sm mx-auto">
                  The raw log for this counter does not reference any individual tax items in its accounting section.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Financial Recap Row Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs text-slate-600 font-black uppercase block">Summed Taxes</span>
                  <span className="font-extrabold text-lg text-slate-900 font-mono mt-1">
                    {calculateSumOfTaxes().toLocaleString("en-US")} <span className="text-xs font-sans font-bold text-slate-500">{activeBlock.currency}</span>
                  </span>
                </div>
                <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-150/50 flex flex-col justify-between">
                  <span className="text-xs text-indigo-800 font-black uppercase block">Declared Total</span>
                  <span className="font-extrabold text-lg text-indigo-950 font-mono mt-1">
                    {activeBlock.taxTotal.toLocaleString("en-US")} <span className="text-xs font-sans font-bold text-indigo-500">{activeBlock.currency}</span>
                  </span>
                </div>
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  Math.abs(activeBlock.taxTotal - calculateSumOfTaxes()) > 1
                    ? "bg-rose-50 border-rose-200 text-rose-950"
                    : "bg-emerald-50 border-emerald-200 text-emerald-950"
                }`}>
                  <span className="text-xs uppercase font-black text-slate-600 block">Calculation Gap</span>
                  <span className="font-extrabold text-lg font-mono mt-1">
                    {(activeBlock.taxTotal - calculateSumOfTaxes()).toLocaleString("en-US")} <span className="text-xs font-sans font-bold text-slate-500">{activeBlock.currency}</span>
                  </span>
                </div>
              </div>

              {/* Title list */}
              <div>
                <h4 className="font-black text-slate-850 text-sm uppercase text-indigo-950 tracking-wider mb-4">
                  IATA Composition and Explanations
                </h4>

                {/* Taxes Scrollable Feed List */}
                <div className="space-y-4">
                  {activeBlock.taxes.map((t, idx) => {
                    const definition = getIataTaxDefinition(t.code);
                    return (
                      <div 
                        key={idx} 
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-xs transition-all duration-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2">
                            {/* Code Badge */}
                            <span className="bg-indigo-950 text-white font-mono font-extrabold text-sm px-3.5 py-1.5 rounded-lg shadow-sm">
                              {t.code}
                            </span>
                            {/* Category Badge */}
                            <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getCategoryBadgeClass(definition.category)}`}>
                              {definition.category}
                            </span>
                          </div>
                          
                          {/* Amount */}
                          <div className="text-base font-black font-mono text-slate-900 self-start sm:self-auto">
                            {t.amount.toLocaleString("fr-FR")} <span className="text-xs font-sans font-semibold text-slate-500">{activeBlock.currency}</span>
                          </div>
                        </div>

                        <div className="mt-1">
                          <h5 className="font-extrabold text-slate-900 text-sm">
                            {definition.name}
                          </h5>
                          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            {definition.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-6 py-5 border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-650 max-w-sm flex items-center gap-1.5 leading-snug">
            <Info className="w-4.5 h-4.5 text-indigo-600 flex-shrink-0" />
            <span>
              Tax mappings and nomenclature comply with the official IATA annual directory.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasMultipleTaxes && (
              <button
                onClick={handleCopyTaxReport}
                className="text-sm bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy report</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
