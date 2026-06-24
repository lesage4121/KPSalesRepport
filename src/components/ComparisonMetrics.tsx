/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AuditSummary } from "../types";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { motion } from "motion/react";

interface ComparisonMetricsProps {
  baseSummary: AuditSummary;
  compareSummary: AuditSummary;
}

export const ComparisonMetrics: React.FC<ComparisonMetricsProps> = ({ baseSummary, compareSummary }) => {
  // Exchange rates for XOF estimation (matching DashboardStats)
  const EXCHANGE_RATES: Record<string, number> = {
    XOF: 1, XAF: 1, USD: 600, EUR: 655.957, NGN: 0.4, GHS: 40, KES: 4.5, CVE: 5.95,
  };

  const getEstimatedXOF = (summary: AuditSummary) => {
    return Object.entries(summary.totalSalesByCurrency).reduce((sum, [cur, stats]) => {
      const rate = EXCHANGE_RATES[cur] || 1;
      return sum + (stats.total * rate);
    }, 0);
  };

  const baseSales = getEstimatedXOF(baseSummary);
  const compareSales = getEstimatedXOF(compareSummary);

  const calculateDelta = (base: number, compare: number) => {
    if (base === 0) return compare === 0 ? 0 : 100;
    return ((compare - base) / base) * 100;
  };

  const metrics = [
    {
      label: "Coordinated Sales Volume (est. XOF)",
      base: baseSales,
      compare: compareSales,
      delta: calculateDelta(baseSales, compareSales),
      format: (val: number) => val.toLocaleString() + " F",
    },
    {
      label: "Active Reports Count",
      base: baseSummary.totalSalesCount,
      compare: compareSummary.totalSalesCount,
      delta: calculateDelta(baseSummary.totalSalesCount, compareSummary.totalSalesCount),
      format: (val: number) => `${val} sessions`,
    },
    {
      label: "Detected Anomalies",
      base: baseSummary.errorCount,
      compare: compareSummary.errorCount,
      delta: calculateDelta(baseSummary.errorCount, compareSummary.errorCount),
      format: (val: number) => `${val} errors`,
      inverseColor: true, // fewer errors is better
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {metrics.map((m, idx) => {
        const isGrowth = m.delta > 0;
        const isBetter = m.inverseColor ? !isGrowth : isGrowth;
        const colorClass = m.delta === 0 ? "text-slate-400" : isBetter ? "text-emerald-500" : "text-rose-500";
        const bgClass = m.delta === 0 ? "bg-slate-50" : isBetter ? "bg-emerald-50" : "bg-rose-50";
        const Icon = m.delta === 0 ? Minus : isBetter ? ArrowUpRight : ArrowDownRight;

        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <Activity className="w-12 h-12" />
            </div>
            
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">{m.label}</p>
            
            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900">{m.format(m.compare)}</span>
                  <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${bgClass} ${colorClass}`}>
                    <Icon className="w-3 h-3" />
                    {Math.abs(m.delta).toFixed(1)}%
                  </div>
                </div>
                <p className="text-slate-400 text-[10px] font-medium">vs {m.format(m.base)} previously</p>
              </div>
            </div>

            <div className="mt-4 h-1 w-full bg-slate-50 rounded-full overflow-hidden">
               <div 
                 className={`h-full rounded-full transition-all duration-1000 ${m.delta === 0 ? "bg-slate-200" : isBetter ? "bg-emerald-400" : "bg-rose-400"}`}
                 style={{ width: `${Math.min(100, Math.max(10, 50 + m.delta))}%` }}
               ></div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
