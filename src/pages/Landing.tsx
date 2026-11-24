/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Globe, ShieldAlert, ChevronRight, Plane } from "lucide-react";
import { motion } from "motion/react";
import { PageWrapper } from "../components/layout/PageWrapper";
import { LanguageToggleButton, useLanguage } from "../context/LanguageContext";
import { ThemeToggleButton } from "../context/ThemeContext";

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { pick } = useLanguage();

  return (
    <PageWrapper className="relative flex-1 min-h-screen w-full flex flex-col justify-between overflow-hidden">
      {/* Full-bleed ASKY Aircraft Background Photo */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <img
          src=""
          alt="ASKY Airlines Boeing 737-8 above the clouds"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center blur-[1px] scale-105"
        />
        {/* Measured scrim ensuring >=4.5:1 legibility in both Light and ASKY Dark modes */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF7F2]/80 via-[#FAF7F2]/50 to-[#321B0A]/75 dark:from-[#140B05]/85 dark:via-[#1F1209]/70 dark:to-[#0D0703]/92 transition-colors duration-200" />
      </div>

      {/* Top Controls Bar */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <LanguageToggleButton />
        </div>
      </div>

      {/* Main Centered Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col items-center justify-center space-y-7">
        <header className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="bg-white/95 dark:bg-[#1F1209]/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-[#E6D7C3] dark:border-[#5C351B]">
              <img
                src="/assets/aistudio/image_logo_4528d090.png"
                alt="ASKY Logo"
                referrerPolicy="no-referrer"
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </div>
            <motion.h1
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-black text-[#321B0A] dark:text-[#FAF7F2] tracking-tight text-balance drop-shadow-xs"
            >
              Sales, Flight &amp; Manifest Manager
            </motion.h1>
          </div>
          <p className="inline-block bg-white/80 dark:bg-[#1F1209]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-[#E6D7C3]/80 dark:border-[#4C2812] text-[#4C2812] dark:text-[#E6D7C3] font-semibold text-sm sm:text-base shadow-xs">
            {pick(
              "Choisissez votre module pour démarrer",
              "Choose a module to start"
            )}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {/* Stations Reports Button */}
          <motion.button
            whileHover={{ scale: 1.02, translateY: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/import-station")}
            className="group relative bg-white/92 dark:bg-[#1F1209]/92 backdrop-blur-md p-7 rounded-3xl border border-[#E6D7C3] dark:border-[#4C2812] shadow-xl hover:border-[#8C5214] dark:hover:border-[#E89C1D] transition-all text-left flex flex-col justify-between cursor-pointer overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="bg-[#FDF4E3] dark:bg-[#2A180D] p-3.5 rounded-2xl text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#5C351B] group-hover:bg-[#4C2812] group-hover:text-[#F7BA42] dark:group-hover:bg-[#E89C1D] dark:group-hover:text-[#1F1209] transition-colors">
                <LayoutDashboard className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#321B0A] dark:text-[#FAF7F2] mb-1">
                  Stations Reports
                </h3>
                <p className="text-[#6E472B] dark:text-[#DECAB1] text-xs leading-relaxed">
                  {pick(
                    "Clôture de caisse ATO/CTO.",
                    "Station cash closure ATO/CTO."
                  )}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs font-bold text-[#4C2812] dark:text-[#F7BA42]">
              <span>{pick("Accéder au module", "Open module")}</span>
              <ChevronRight className="w-5 h-5 text-[#8C5214] dark:text-[#E89C1D] transition-transform group-hover:translate-x-1" />
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <ShieldAlert className="w-20 h-20 text-[#4C2812] dark:text-[#F7BA42]" />
            </div>
          </motion.button>

          {/* Online Reports Button */}
          <motion.button
            whileHover={{ scale: 1.02, translateY: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/import-online")}
            className="group relative bg-[#321B0A]/92 dark:bg-[#28170C]/94 backdrop-blur-md p-7 rounded-3xl border border-[#4C2812] dark:border-[#5C351B] shadow-xl hover:border-[#E89C1D] transition-all text-left flex flex-col justify-between cursor-pointer overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="bg-[#4C2812] p-3.5 rounded-2xl text-[#F7BA42] group-hover:bg-[#E89C1D] group-hover:text-[#1F1209] transition-colors">
                <Globe className="w-7 h-7" />
              </div>
              <div className="flex-1 text-white">
                <h3 className="text-lg font-bold text-[#FAF7F2] mb-1">
                  Online Reports
                </h3>
                <p className="text-[#E6D7C3] text-xs leading-relaxed">
                  {pick(
                    "Consolidation des flux digitaux.",
                    "Consolidation of digital channels."
                  )}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs font-bold text-[#F7BA42]">
              <span>{pick("Accéder au module", "Open module")}</span>
              <ChevronRight className="w-5 h-5 text-[#E89C1D] transition-transform group-hover:translate-x-1" />
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Globe className="w-20 h-20 text-[#F7BA42]" />
            </div>
          </motion.button>

          {/* Flight Operations & Manifests Button (ASKY Branded) */}
          <motion.button
            whileHover={{ scale: 1.02, translateY: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/flight-operations")}
            className="group relative bg-white/95 dark:bg-[#1F1209]/95 backdrop-blur-md p-7 rounded-3xl border-2 border-[#E89C1D] dark:border-[#E89C1D]/80 shadow-xl hover:border-[#4C2812] dark:hover:border-[#F7BA42] transition-all text-left flex flex-col justify-between cursor-pointer overflow-hidden"
          >
            <div>
              <div className="flex items-start gap-4">
                <div className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] p-3.5 rounded-2xl group-hover:bg-[#321B0A] dark:group-hover:bg-[#F7BA42] transition-colors shadow-md">
                  <Plane className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#321B0A] dark:text-[#FAF7F2] mb-1">
                    {pick("Vols & Manifestes ASKY", "ASKY Flights & Manifests")}
                  </h3>
                  <p className="text-[#6E472B] dark:text-[#DECAB1] text-xs leading-relaxed">
                    {pick(
                      "Programme des vols et manifestes.",
                      "Flight schedule and passenger manifests."
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs font-bold text-[#4C2812] dark:text-[#F7BA42]">
              <span>{pick("Accéder au module", "Open module")}</span>
              <ChevronRight className="w-5 h-5 text-[#8C5214] dark:text-[#F7BA42] transition-transform group-hover:translate-x-1" />
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Plane className="w-20 h-20 text-[#4C2812] dark:text-[#F7BA42]" />
            </div>
          </motion.button>
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="relative z-10 pb-6 text-center px-4">
        <p className="inline-block bg-[#321B0A]/85 dark:bg-[#140B05]/85 backdrop-blur-md px-4 py-1.5 rounded-xl text-[11px] font-semibold tracking-wide text-[#F3E9D8] border border-[#5C351B]/60">
          Eric ABI © 2026 ASKY
        </p>
      </footer>
    </PageWrapper>
  );
};
