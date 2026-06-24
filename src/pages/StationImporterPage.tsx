
import React from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Database, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { LogImporter } from "../components/LogImporter";
import { useAudit } from "../context/AuditContext";
import { PageWrapper } from "../components/layout/PageWrapper";

export const StationImporterPage: React.FC = () => {
  const { setRawText } = useAudit();
  const navigate = useNavigate();

  const handleImportLogs = (text: string) => {
    setRawText(text);
    navigate("/audit");
  };

  return (
    <PageWrapper className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Return to menu
        </button>
      </div>

      <header className="space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Stations Reports Importer</h2>
        <p className="text-slate-500 font-medium">Drag and drop your WY*T#STA files or text blocks for analysis.</p>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden hover:border-indigo-200 transition-colors"
      >
        <div className="p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Direct Import Module</h3>
              <p className="text-slate-500 text-sm font-medium uppercase tracking-tight">Loading closure reports</p>
            </div>
          </div>

          <LogImporter onImport={handleImportLogs}/>
        </div>
      </motion.div>
    </PageWrapper>
  );
};
