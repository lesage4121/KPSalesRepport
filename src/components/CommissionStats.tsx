import React from "react";
import { motion } from "motion/react";
import { AuditSummary } from "../types";
import { Building2, Calendar, TrendingDown } from "lucide-react";

interface CommissionStatsProps {
  summary: AuditSummary;
}

export const CommissionStats: React.FC<CommissionStatsProps> = ({ summary }) => {
  // Sort stations by commission volume
  const sortedStations = (Object.entries(summary.commissionsByStation) as [string, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8); // Top 8

  // Sort days
  const sortedDays = (Object.entries(summary.commissionsByDay) as [string, number][])
    .sort(([a], [b]) => a.localeCompare(b));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8"
    >
      {/* Commissions by Agency */}
      <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-rose-100 p-2 rounded-xl text-rose-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 tracking-tight">Commissions by Agency</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Impact on Remittance (XOF Equiv.)</p>
            </div>
          </div>
          <TrendingDown className="w-5 h-5 text-rose-500" />
        </div>
        
        <div className="p-6 flex-1">
          {sortedStations.length > 0 ? (
            <div className="space-y-4">
              {sortedStations.map(([station, volume], idx) => {
                const max = Math.max(...(Object.values(summary.commissionsByStation) as number[]));
                const percentage = (volume / (max || 1)) * 100;
                
                return (
                  <div key={idx} className="group">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-black text-slate-700 truncate max-w-[200px] uppercase tracking-tight">
                        {station}
                      </span>
                      <span className="text-sm font-mono font-black text-rose-600">
                        -{Math.round(volume).toLocaleString("fr-FR")} <span className="text-[10px] text-slate-400">XOF</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className="h-full bg-rose-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <Building2 className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-sm">No commissions detected in current audit</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Commissions by Day */}
      <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 tracking-tight">Daily Commission Burn</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Volume over time</p>
            </div>
          </div>
        </div>

        <div className="p-6 flex-1">
          {sortedDays.length > 0 ? (
            <div className="space-y-3">
              {sortedDays.map(([day, volume], idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5 px-4 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-slate-600 font-mono italic">{day} 2026</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900 font-mono">
                      {Math.round(volume).toLocaleString("fr-FR")}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase">XOF</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <Calendar className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-sm">No daily distribution available</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
