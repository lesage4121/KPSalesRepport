/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  ScanEye, 
  Workflow, 
  LibraryBig, 
  Upload, 
  Trash2 
} from "lucide-react";
import { useAudit } from "../../context/AuditContext";
import { ThemeToggleButton } from "../../context/ThemeContext";
import { LanguageToggleButton } from "../../context/LanguageContext";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { rawText, clearLogs } = useAudit();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const isLanding = location.pathname === "/";

  // The header only appears for the Station Reports workflow
  const showHeader = location.pathname === "/import-station" || 
                     location.pathname === "/audit" || 
                     location.pathname === "/analytics";

  return (
    <div id="root-viewport" className="min-h-screen bg-[#FAF7F2] dark:bg-[#140B05] text-[#321B0A] dark:text-[#FAF7F2] antialiased font-sans flex flex-col justify-between transition-colors duration-150 ">
      {/* Premium Header */}
      {showHeader && (
        <header id="app-header" className="bg-white dark:bg-[#1F1209] border-b border-[#E6D7C3] dark:border-[#4C2812] py-3.5 px-3 sm:px-6 sticky top-0 z-50 shadow-xs">
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 px-3">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="bg-[#4C2812] text-[#F7BA42] p-2.5 rounded-xl shadow-md flex items-center justify-center">
                <ScanEye className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#321B0A] dark:text-[#FAF7F2] tracking-tight">Airline Audit & Accounting</h1>
                <p className="text-[#6E472B] dark:text-[#DECAB1] text-xs font-medium">Financial audit portal for station closures · 2026</p>
              </div>
            </Link>

            {/* Tab Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {rawText.trim() !== "" ? (
                <>
                  <nav id="subtab-container" className="flex items-center gap-1.5 bg-[#FAF7F2] dark:bg-[#2A180D] border border-[#E6D7C3] dark:border-[#4C2812] p-1.5 rounded-xl self-start md:self-auto">
                    <Link
                      id="tab-audit-list"
                      to="/audit"
                      className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isActive("/audit")
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-sm font-bold"
                          : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                      }`}
                    >
                      <Workflow className="w-3.5 h-3.5" />
                      Registry & Audit
                    </Link>
                    <Link
                      id="tab-charts"
                      to="/analytics"
                      className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isActive("/analytics")
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-sm font-bold"
                          : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                      }`}
                    >
                      <LibraryBig className="w-3.5 h-3.5" />
                      Statistics
                    </Link>
                    <Link
                      id="tab-importer"
                      to="/import-station"
                      className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isActive("/import-station")
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-sm font-bold"
                          : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
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
                    className="text-xs bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-800/70"
                    title="Clear current data"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </>
              ) : (
                <div className="bg-amber-50 dark:bg-[#2A180D] border border-amber-200 dark:border-[#5C351B] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold px-3 py-1.5 rounded-lg self-start md:self-auto">
                  No data loaded
                </div>
              )}

              <ThemeToggleButton />
              <LanguageToggleButton />
            </div>
          </div>
        </header>
      )}

      {/* Main Single-screen viewport dashboard */}
      <main
        id="app-main-workspace"
        className={
          isLanding
            ? "flex-1 w-full flex flex-col"
            : "flex-1 pt-6 pb-24 md:pb-16 px-3 sm:px-5 lg:px-7 w-full mx-auto"
        }
      >
        <div className={isLanding ? "w-full flex-1 flex flex-col" : "w-full"}>
          {children}
        </div>
      </main>

      {/* Corporate Solid Fixed Footer */}
      {!isLanding && (
        <footer
          id="app-footer"
          className="fixed bottom-0 left-0 right-0 z-30 bg-[#321B0A]/95 dark:bg-[#0D0703]/95 backdrop-blur-md border-t border-[#4C2812] py-3 px-4 sm:px-6 text-center text-[#E6D7C3] shadow-[0_-4px_16px_rgba(50,27,10,0.2)]"
        >
          <div className="w-full flex flex-col md:flex-row items-center justify-between text-xs gap-2 px-2">
            <p className="font-semibold text-[#F3E9D8]">© 2026 ASKY Airlines · Station Sales Audit & Flight Operations</p>
            <div className="flex items-center gap-4 text-[#DECAB1]">
              <span>Privacy</span>
              <span>·</span>
              <span>Audit Terms</span>
              <span>·</span>
              <span className="text-[#F7BA42] font-bold">v2.3</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
