
import React, { useState } from "react";
import { AuditSummary } from "../types";
import { EXCHANGE_RATES_TO_XOF } from "../utils/constants";
import { Coins, ChevronDown, ChevronUp, ScanSearch, CircleDollarSign,BriefcaseBusiness} from "lucide-react";
import { motion, Variants } from "motion/react";
import { Skeleton } from "./ui/Skeleton";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

interface DashboardStatsProps {
  summary: AuditSummary;
  loading?: boolean;
}

interface CurrencyConfig {
  unit: string;
  isPrefix: boolean;
  bgIcon: string;
  textIcon: string;
  locale: string;
  isIntegerOnly: boolean;
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  XOF: {
    unit: "FCFA",
    isPrefix: false,
    bgIcon: "bg-emerald-50",
    textIcon: "text-emerald-600",
    locale: "fr-FR",
    isIntegerOnly: true,
  },
  XAF: {
    unit: "FCFA (XAF)",
    isPrefix: false,
    bgIcon: "bg-teal-50",
    textIcon: "text-teal-600",
    locale: "fr-FR",
    isIntegerOnly: true,
  },
  USD: {
    unit: "$",
    isPrefix: true,
    bgIcon: "bg-rose-50",
    textIcon: "text-rose-600",
    locale: "en-US",
    isIntegerOnly: true,
  },
  NGN: {
    unit: "₦",
    isPrefix: true,
    bgIcon: "bg-green-50",
    textIcon: "text-green-600",
    locale: "en-NG",
    isIntegerOnly: true,
  },
  GHS: {
    unit: "GH₵",
    isPrefix: true,
    bgIcon: "bg-amber-50",
    textIcon: "text-amber-600",
    locale: "en-GH",
    isIntegerOnly: false,
  },
  KES: {
    unit: "KSh",
    isPrefix: false,
    bgIcon: "bg-purple-50",
    textIcon: "text-purple-600",
    locale: "en-KE",
    isIntegerOnly: true,
  },
  CVE: {
    unit: "Esc",
    isPrefix: false,
    bgIcon: "bg-slate-100",
    textIcon: "text-slate-600",
    locale: "pt-CV",
    isIntegerOnly: true,
  },
  EUR: {
    unit: "€",
    isPrefix: true,
    bgIcon: "bg-sky-50",
    textIcon: "text-sky-600",
    locale: "fr-FR",
    isIntegerOnly: false,
  },

"***": {
    unit: "Unknown",
    isPrefix: false,
    bgIcon: "bg-gray-50",
    textIcon: "text-gray-600",
    locale: "fr-FR",
    isIntegerOnly: true,
  },
};

export const DashboardStats: React.FC<DashboardStatsProps> = ({ summary, loading = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  // Sort currencies: keep XOF, then USD first, and others alphabetically
  const activeCurrencies = Object.keys(summary.totalTaxByCurrency).filter(cur => {
    const s = summary.totalSalesByCurrency[cur];
    return s && (s.total > 0 || s.refund > 0 || s.commission !== 0);
  }).sort((a, b) => {
    if (a === "XOF") return -1;
    if (b === "XOF") return 1;
    if (a === "USD") return -1;
    if (b === "USD") return 1;
    return a.localeCompare(b);
  });

  // Unified estimation in XOF using robust estimated rates
  const estimatedTotalXOF = Object.keys(summary.totalSalesByCurrency).reduce((sum, cur) => {
    const stats = summary.totalSalesByCurrency[cur];
    const rate = EXCHANGE_RATES_TO_XOF[cur] || 1;
    return sum + (stats.total * rate);
  }, 0);

  const estimatedAccountingXOF = Object.keys(summary.totalSalesByCurrency).reduce((sum, cur) => {
    const stats = summary.totalSalesByCurrency[cur];
    const rate = EXCHANGE_RATES_TO_XOF[cur] || 1;
    return sum + (stats.accountingTotal * rate);
  }, 0);
  
  console.log(summary.totalSalesByCurrency["USD"])

  if (loading) {
    return (
      <div className="space-y-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
          ))}
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <Skeleton className="h-10 w-10 rounded-xl" />
               <div className="space-y-1">
                 <Skeleton className="h-5 w-48" />
                 <Skeleton className="h-4 w-64" />
               </div>
             </div>
             <Skeleton className="h-6 w-6" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Primary Audit Indicators Row */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Total Reports Parsed */}
        <motion.div 
          id="stat-total-reports"
          variants={itemVariants}
          whileHover={{ scale: 1.015, y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between transition-colors hover:border-indigo-100 group relative"
        >
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1.5">Audited Reports</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800">{summary.totalSalesCount + summary.emptyReportsCount}</h3>
            <p className="text-slate-650 text-sm mt-1.5">
              <span className="font-extrabold text-emerald-600">{summary.totalSalesCount} active</span> • {summary.emptyReportsCount} empty
            </p>

          </div>
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600 flex-shrink-0">
            <ScanSearch className="w-6.5 h-6.5" />
          </div>
        </motion.div>

        {/* Audited Stations */}
        <motion.div 
          id="stat-stations" 
          variants={itemVariants}
          whileHover={{ scale: 1.015, y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between transition-colors hover:border-indigo-100 group relative"
        >
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1.5">Active Stations</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800">{summary.activeStationsCount}</h3>
            <p className="text-slate-600 text-sm mt-1.5 font-medium">Unified Africa offices</p>

          </div>
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600 flex-shrink-0">
            <BriefcaseBusiness className="w-6.5 h-6.5" />
          </div>
        </motion.div>

        {/* Total Accounting Remittance Estimation in XOF */}
        <motion.div 
          id="stat-total-estimation" 
          variants={itemVariants}
          whileHover={{ scale: 1.015, y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-100 transition-all duration-200 group relative"
        >
          <div className="flex-1">
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1.5">Acc. Remittance (XOF)</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 font-mono">
              {Math.round(estimatedAccountingXOF).toLocaleString("fr-FR")} <span className="text-xs font-sans text-slate-500 font-bold">FCFA</span>
            </h3>
            <p className="text-slate-550 text-xs mt-1.5 font-medium leading-relaxed">
              Total to pay to accounting (Gross - ET). <br/>
              <span className="text-[10px] text-slate-400">Gross Volume: {Math.round(estimatedTotalXOF).toLocaleString("fr-FR")} FCFA</span>
            </p>
            
            {/* Tooltip with Exchange Rates */}
            <div className="invisible group-hover:visible absolute left-5 top-full mt-2 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl z-25 w-72 border border-slate-800 pointer-events-none transition-all duration-205">
              <p className="font-bold mb-1.5 text-indigo-400">Applied Conversion Rates:</p>
              <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                <li>• 1 USD = 600 FCFA</li>
                <li>• 1 EUR = 655.957 FCFA</li>
                <li>• 1 XAF = 1 FCFA</li>
                <li>• 1 GHS = 40 FCFA</li>
                <li>• 1 NGN = 0.4 FCFA</li>
                <li>• 1 KES = 4.5 FCFA</li>
                <li>• 1 CVE = 5.95 FCFA</li>
              </ul>
              <p className="mt-2 text-[10px] text-slate-400 font-sans italic">The calculation sums all consolidated gross sales volumes.</p>
            </div>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 flex-shrink-0 self-start mt-1">
            <CircleDollarSign className="w-6.5 h-6.5" />
          </div>
        </motion.div>
      </motion.div>

      {/* Currency Section Header (Collapsible) */}
      {activeCurrencies.length > 0 && ( 
        <div className="bg-slate-50/30 rounded-2xl border border-slate-100 shadow-xs overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-5 bg-white border-b border-slate-100 hover:bg-slate-100 hover:shadow-sm transition-all duration-200 cursor-pointer text-left focus:outline-none"
          id="toggle-currency-panel"
           aria-expanded={isOpen}
         >
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-650 flex-shrink-0">
                <Coins className="w-5.5 h-5.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-800">
                    Sales Volume by Currency
                  </h4>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full font-mono">
                    {activeCurrencies.length} actives
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 sm:block hidden">
                  Total cumulative financial volumes per audit currency (refunds and commissions included)
                </p>
              </div>
            </div>
            <div className="text-slate-400 hover:text-slate-700 transition-colors p-1">
              {isOpen ? ( <ChevronUp className="w-8 h-8 stroke-[2.5]" /> ) : (<ChevronDown className="w-8 h-8 stroke-[2.5]" />)}
            </div>
          </button>

          {isOpen && (
            <div className="p-5">
              {/* Dynamic Currencies Grid */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              >
                {activeCurrencies.map((cur) => {
                  const stats = summary.totalSalesByCurrency[cur];
                  const config = CURRENCY_CONFIGS[cur] || {
                    unit: cur,
                    isPrefix: false,
                    bgIcon: "bg-indigo-50",
                    textIcon: "text-indigo-600",
                    locale: "fr-FR",
                    isIntegerOnly: false,
                  };

                  const totalVal = Math.round(stats.accountingTotal);
                  const refundVal = Math.round(stats.refund);
                  const commVal = Math.round(Math.abs(stats.commission));
                  const htVal = Math.round(stats.netFareHT);

                  const formattedTotal = config.isPrefix
                    ? `${config.unit}${totalVal.toLocaleString(config.locale)}`
                    : `${totalVal.toLocaleString(config.locale)} ${config.unit}`;

                  const formattedHT = config.isPrefix
                    ? `${config.unit}${htVal.toLocaleString(config.locale)}`
                    : `${htVal.toLocaleString(config.locale)} ${config.unit}`;

                  const formattedRefund = config.isPrefix
                    ? `${config.unit}${refundVal.toLocaleString(config.locale)}`
                    : `${refundVal.toLocaleString(config.locale)} ${config.unit}`;

                  const formattedCommission = config.isPrefix
                    ? `${config.unit}${commVal.toLocaleString(config.locale)}`
                    : `${commVal.toLocaleString(config.locale)} ${config.unit}`;

                  return (
                    <motion.div 
                      key={cur}
                      id={`stat-sales-${cur.toLowerCase()}`} 
                      variants={itemVariants}
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-100 transition-all duration-200 group relative"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Sales {cur}</p>
                        <h3 className="text-lg sm:text-xl font-black text-emerald-600 font-mono truncate">
                          {formattedTotal}
                        </h3>                      
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Net amount HT</span>
                            <span className="text-slate-700 font-black text-xs font-mono">{formattedHT}</span>
                          </div>

                          {(stats.commission !== 0 || stats.refund > 0) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {stats.commission !== 0 && (
                                <div className="bg-rose-50 px-2 py-1 rounded-lg border border-rose-100/50">
                                  <p className="text-[9px] text-rose-400 font-bold uppercase leading-none mb-1">Commission</p>
                                  <p className="text-rose-600 font-black text-[10px] font-mono leading-none">-{formattedCommission}</p>
                                </div>
                              )}
                              {stats.refund > 0 && (
                                <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100/50">
                                  <p className="text-[9px] text-slate-500 font-bold uppercase leading-none mb-1">Refund</p>
                                  <p className="text-slate-600 font-black text-[10px] font-mono leading-none">{formattedRefund}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`${config.bgIcon} p-2.5 rounded-xl ${config.textIcon} flex-shrink-0 ml-3 self-start`}>
                        <Coins className="w-6 h-6" />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
