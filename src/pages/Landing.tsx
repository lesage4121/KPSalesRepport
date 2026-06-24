
import React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Globe, ShieldAlert, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { PageWrapper } from "../components/layout/PageWrapper";

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageWrapper className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-12">
      <header className="text-center space-y-4 mt-6">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-black text-slate-900 tracking-tight"
        >
          KP Sales <span className="text-indigo-600">Analyser</span>
        </motion.h1>
        <p className="text-slate-500 font-medium text-lg mt-6">Choose your data source to start the audit</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-20">
        {/* Stations Reports Button */}
        <motion.button
          whileHover={{ scale: 1.02, translateY: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/import-station")}
          className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-lg hover:border-indigo-300 transition-all text-left flex items-start gap-6 cursor-pointer overflow-hidden"
        >
          <div className="bg-indigo-50 p-6 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Stations Reports</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Import physical sales logs via station terminals (WY*T#STA...).
            </p>
          </div>
          <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 self-center" />
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <ShieldAlert className="w-24 h-24" />
          </div>
        </motion.button>

        {/* Online Reports Button */}
        <motion.button
          whileHover={{ scale: 1.02, translateY: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/import-online")}
          className="group relative bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl hover:border-indigo-500 transition-all text-left flex items-start gap-6 cursor-pointer overflow-hidden"
        >
          <div className="bg-slate-800 p-4 rounded-2xl text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
            <Globe className="w-8 h-8" />
          </div>
          <div className="flex-1 text-white">
            <h3 className="text-xl font-bold mb-1">Online Reports</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Consolidation of digital flows
            </p>
          </div>
          <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-indigo-400 self-center" />
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Globe className="w-24 h-24 text-white" />
          </div>
        </motion.button>
      </div>

      <footer className="pt-8 text-center">
        <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Ready for Internal Audit 
        </div>
      </footer>
    </PageWrapper>
  );
};
