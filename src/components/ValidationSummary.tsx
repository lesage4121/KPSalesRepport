
import React from "react";
import { StationReport } from "../types";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ValidationSummaryProps {
  reports: StationReport[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ reports, onConfirm, onCancel }) => {
  const reportsWithErrors = reports.filter(r => r.hasErrors);
  const errorCount = reportsWithErrors.length;
  const totalReports = reports.length;
  
  const allMessages = reportsWithErrors.flatMap(r => 
    r.errorMessages.map(msg => ({ 
      station: `${r.stationName} (${r.stationNumber})`, 
      message: msg,
      id: r.id 
    }))
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[600px] shadow-xl">
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${errorCount > 0 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
            {errorCount > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Validation d'Importation</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {totalReports} rapports identifiés • {errorCount} avec anomalies
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        <AnimatePresence mode="wait">
          {errorCount > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-rose-900 font-bold text-sm">Des incohérences ont été détectées</p>
                  <p className="text-rose-700 text-xs mt-1 leading-relaxed">
                    Les calculs internes ne correspondent pas aux totaux déclarés dans le fichier pour certains rapports. 
                    Vous pouvez tout de même importer pour les examiner en détail plus tard.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Liste des Anomalies par Station</p>
                {reportsWithErrors.map((report) => (
                  <div key={report.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100/50 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{report.stationName} - {report.stationNumber}</span>
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded uppercase">{report.errorMessages.length} Erreur(s)</span>
                    </div>
                    <ul className="p-3 space-y-2">
                      {report.errorMessages.map((msg, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-600 font-medium">
                          <span className="text-rose-400 font-bold">•</span>
                          {msg}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="bg-emerald-100 p-4 rounded-full text-emerald-600 mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-slate-900 font-black text-lg">Intégrité des Données Validée</h4>
              <p className="text-slate-500 text-sm max-w-sm mt-2 leading-relaxed">
                Tous les rapports sont cohérents. Les totaux calculés à partir des lignes de transaction correspondent exactement aux totaux déclarés.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 font-sans">
        <button 
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
        >
          Annuler
        </button>
        <button 
          onClick={onConfirm}
          className={`px-6 py-2 text-xs font-black rounded-xl shadow-lg transition transform active:scale-95 ${
            errorCount > 0 
              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
          }`}
        >
          {errorCount > 0 ? "Importer malgré tout" : "Confirmer l'Importation"}
        </button>
      </div>
    </div>
  );
};
