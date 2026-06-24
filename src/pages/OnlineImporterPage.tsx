/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ShieldAlert, ChevronLeft, Upload, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { PageWrapper } from "../components/layout/PageWrapper";

export const OnlineImporterPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageWrapper className="max-w-4xl mx-auto space-y-8 pb-12 text-center">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Return to menu
        </button>
      </div>

      <div className="bg-slate-900 text-white rounded-3xl p-16 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 space-y-8">
          <div className="inline-flex bg-slate-800 p-6 rounded-3xl text-indigo-400">
            <Globe className="w-16 h-16" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-black tracking-tight">Online & Auxiliary Reports</h2>
            <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
              Import support for digital flows (Limo, Cargo, Self-Service Kiosks) is currently under development.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-3xl cursor-not-allowed bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-4 text-slate-600" />
                <p className="mb-2 text-sm text-slate-400 font-bold">Select an auxiliary file</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">Next Phase Early Access</p>
              </div>
            </label>
          </div>

          <div className="flex justify-center gap-6 pt-4">
             <div className="flex items-center gap-3 text-indigo-400 font-bold text-xs uppercase tracking-tighter">
               <Sparkles className="w-4 h-4" />
               Omnichannel Validation
             </div>
             <div className={`flex items-center gap-3 text-emerald-400 font-bold text-xs uppercase tracking-tighter`}>
               <ShieldAlert className="w-4 h-4" />
               Transactional Security
             </div>
          </div>
        </div>

        {/* Backdrop visual elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>
    </PageWrapper>
  );
};
