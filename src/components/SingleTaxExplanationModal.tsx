
import React, { useEffect } from "react";
import { getIataTaxDefinition } from "../iata_taxes";
import { X, Landmark, Coins, Scale, Check, Info, ShieldAlert, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SingleTaxExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxCode: string;
  amount: number;
  currency: string;
}

export const SingleTaxExplanationModal: React.FC<SingleTaxExplanationModalProps> = ({
  isOpen,
  onClose,
  taxCode,
  amount,
  currency,
}) => {
  // Prevent body scrolling when the overlay is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const definition = getIataTaxDefinition(taxCode);

  // Styling helpers
  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "Security":
        return {
          bg: "bg-rose-50/80 text-rose-700 border-rose-150",
          iconBg: "bg-rose-500",
          pill: "bg-rose-100/70 border-rose-200",
          gradient: "from-rose-500/10 via-transparent to-transparent",
          shine: "text-rose-500",
        };
      case "Airport/Passenger":
        return {
          bg: "bg-sky-50/80 text-sky-700 border-sky-150",
          iconBg: "bg-sky-500",
          pill: "bg-sky-100/70 border-sky-200",
          gradient: "from-sky-500/10 via-transparent to-transparent",
          shine: "text-sky-500",
        };
      case "Government/Solidarity":
        return {
          bg: "bg-emerald-50/80 text-emerald-700 border-emerald-150",
          iconBg: "bg-emerald-500",
          pill: "bg-emerald-100/70 border-emerald-200",
          gradient: "from-emerald-500/10 via-transparent to-transparent",
          shine: "text-emerald-500",
        };
      case "Airlines Surcharge":
        return {
          bg: "bg-amber-50/80 text-amber-700 border-amber-150",
          iconBg: "bg-amber-500",
          pill: "bg-amber-100/70 border-amber-200",
          gradient: "from-amber-500/10 via-transparent to-transparent",
          shine: "text-amber-500",
        };
      case "Infrastructure":
        return {
          bg: "bg-indigo-50/80 text-indigo-700 border-indigo-150",
          iconBg: "bg-indigo-500",
          pill: "bg-indigo-100/70 border-indigo-200",
          gradient: "from-indigo-500/10 via-transparent to-transparent",
          shine: "text-indigo-500",
        };
      default:
        return {
          bg: "bg-slate-50/80 text-slate-700 border-slate-150",
          iconBg: "bg-slate-500",
          pill: "bg-slate-100/70 border-slate-200",
          gradient: "from-slate-500/10 via-transparent to-transparent",
          shine: "text-slate-500",
        };
    }
  };

  const theme = getCategoryTheme(definition.category);

  return (
    <AnimatePresence>
      <div 
        id={`tax-explanation-portal-${taxCode}`}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto"
      >
        {/* Animated Background Backdrop with high quality blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Floating Glassmorphic Dialog Box */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25 
          }}
          className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 z-10 flex flex-col"
        >
          {/* Accent colored atmospheric background graphic */}
          <div className={`absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${theme.gradient} pointer-events-none`} />

          {/* Header Row */}
          <div className="relative px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              <div className={`${theme.iconBg} text-white p-2.5 rounded-2xl shadow-sm flex items-center justify-center`}>
                <Landmark className="w-5.5 h-5.5" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase text-slate-400 tracking-widest font-mono">
                  Air Tax Decoding
                </span>
                <h3 className="font-mono font-black text-2xl text-slate-900 tracking-tight leading-none mt-0.5">
                  Code {taxCode}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 p-2 rounded-full transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Inner Content Area */}
          <div className="relative p-6 space-y-6">
            {/* Currency and Amount Giant Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-15">
                <Coins className="w-20 h-20 text-indigo-400" />
              </div>
              <span className="text-xs font-bold text-slate-450 uppercase tracking-wider block">
                Accounting Amount
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black font-mono tracking-tight text-white select-all">
                  {amount.toLocaleString("en-US")}
                </span>
                <span className="text-base font-black text-indigo-400 font-mono tracking-widest">
                  {currency}
                </span>
              </div>
            </div>

            {/* Tax Nomenclature explanation */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  IATA Classification
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-black px-3.5 py-1.5 rounded-full border ${theme.bg}`}>
                    {definition.category}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                    2026 Compliant Database
                  </span>
                </div>
              </div>

              <div className="pt-1.5">
                <h4 className="font-extrabold text-slate-950 text-base lg:text-lg tracking-tight leading-snug">
                  {definition.name}
                </h4>
                <p className="text-sm text-slate-650 mt-2 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-150">
                  {definition.description}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Action Area */}
          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
              <span>Double-check discrepancy</span>
            </div>

            <button
              id="tax-explanation-close-btn"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white hover:shadow-md rounded-xl text-sm font-black transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
