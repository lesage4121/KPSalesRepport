import React from "react";
import { Link, useLocation } from "react-router-dom";
import {  ScanEye, Workflow, LibraryBig, Upload, Trash2 } from "lucide-react";
import { useAudit } from "../../context/AuditContext";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { rawText, clearLogs } = useAudit();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  // The header only appears for the Station Reports workflow
  const showHeader = location.pathname === "/import-station" || 
                     location.pathname === "/audit" || 
                     location.pathname === "/analytics";

  return (
    <div id="root-viewport" className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col justify-between">
      {showHeader && (
        <header id="app-header" className="bg-white border-b border-slate-100 py-4 px-[2px] sticky top-0 z-50 shadow-xs">
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center">
                <ScanEye className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Airline Audit & Accounting</h1>
              </div>
            </Link>

            {rawText.trim() !== "" ? (
              <div className="flex items-center gap-3 flex-wrap">
                <nav id="subtab-container" className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start md:self-auto">
                  <Link
                    id="tab-audit-list"
                    to="/audit"
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive("/audit")
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Workflow className="w-3.5 h-3.5" />
                    Registry & Audit
                  </Link>
                  <Link
                    id="tab-charts"
                    to="/analytics"
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive("/analytics")
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <LibraryBig className="w-3.5 h-3.5" />
                    Statistics
                  </Link>
                  <Link
                    id="tab-importer"
                    to="/import-station"
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive("/import-station")
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Load Journal
                  </Link>
                </nav>

                {/* Clear active dataset work action */}
                <button
                  id="btn-unload-data"
                  onClick={clearLogs}
                  className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-850 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-rose-100"
                  title="Clear current data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-100 text-amber-800 text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start md:self-auto">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                No data loaded
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main Single-screen viewport dashboard */}
      <main id="app-main-workspace" className="flex-1 py-8 px-[2px] w-full mx-auto">
        <div className="w-full px-10">
          {children}
        </div>
      </main>

      {/* Corporate Solid Footer */}
      <footer id="app-footer" className="bg-slate-900 border-t border-slate-850 py-6 px-[2px] text-center text-slate-400 mt-8">
        <div className="w-full flex flex-col md:flex-row items-center justify-between text-sm gap-3 px-2">
          <p className="font-semibold text-slate-400">© 2026 Station Sales Audit System </p>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="hover:text-slate-300 cursor-pointer font-bold">Privacy</span>
            <span className="text-indigo-400 font-extrabold">Powered by Eric ABI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
