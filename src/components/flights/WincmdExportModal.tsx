/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  FileSpreadsheet,
  FileText,
  Layers, 
  Files
} from "lucide-react";
import { FlightSegment } from "../../types";
import { 
  downloadAnsiFile, 
  exportFlightsToExcel,
  exportFlightsToText,
  generateWincmdText,
  splitSegmentsIntoTwoHalves
} from "../../utils/flightParser";
import {
  SplitExtractionProgress,
  SplitProgressData,
  INITIAL_SPLIT_PROGRESS,
  triggerTwoHalvesDownloadWithProgress,
} from "./SplitExtractionProgress";
import { useLanguage } from "../../context/LanguageContext";

interface WincmdExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: FlightSegment[];
  date: string;
}

export const WincmdExportModal: React.FC<WincmdExportModalProps> = ({
  isOpen,
  onClose,
  segments,
  date,
}) => {
  const { language, pick } = useLanguage();
  const [carrierMode, setCarrierMode] = useState<"kp" | "all" | "codeshare">("kp");
  const [filterMode, setFilterMode] = useState<"all" | "primary" | "station">("all");
  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [splitView, setSplitView] = useState<"all" | "part1" | "part2">("all");
  const [copied, setCopied] = useState(false);
  const [splitProgress, setSplitProgress] = useState<SplitProgressData>(INITIAL_SPLIT_PROGRESS);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Compute filtered segments
  const availableStations = Array.from(new Set(segments.map(s => s.origin))).sort();

  const filteredSegments = segments.filter(s => {
    if (carrierMode === "kp" && !s.isKpOperated) return false;
    if (carrierMode === "codeshare" && s.isKpOperated) return false;
    if (filterMode === "primary" && s.isSubSegment) return false;
    if (filterMode === "station" && selectedStation !== "ALL" && s.origin !== selectedStation) return false;
    return true;
  });

  const kpCount = segments.filter(s => s.isKpOperated).length;
  const codeshareCount = segments.filter(s => !s.isKpOperated).length;

  // Split into two halves by unique flights
  const { 
    part1, 
    part2, 
    part1FlightsCount, 
    part2FlightsCount, 
    part1FlightNumbers, 
    part2FlightNumbers 
  } = splitSegmentsIntoTwoHalves(filteredSegments);

  const activeSegments = splitView === "part1" ? part1 : splitView === "part2" ? part2 : filteredSegments;

  const wincmdContent = generateWincmdText(activeSegments);
  const part1Content = generateWincmdText(part1);
  const part2Content = generateWincmdText(part2);

  const basePrefix = carrierMode === "kp" ? "WINCMD_VOLS_KP" : "WINCMD_TOUS_VOLS";

  const handleCopy = () => {
    navigator.clipboard.writeText(wincmdContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download handlers
  const handleDownloadActiveAnsi = () => {
    let suffix = "COMPLET";
    if (splitView === "part1") suffix = "PARTIE_1";
    if (splitView === "part2") suffix = "PARTIE_2";
    const filename = `${basePrefix}_${date}_${suffix}_ANSI.txt`;
    downloadAnsiFile(filename, wincmdContent);
  };

  const handleDownloadPart1Ansi = () => {
    downloadAnsiFile(`${basePrefix}_${date}_PARTIE_1_ANSI.txt`, part1Content);
  };

  const handleDownloadPart2Ansi = () => {
    downloadAnsiFile(`${basePrefix}_${date}_PARTIE_2_ANSI.txt`, part2Content);
  };

  const handleDownloadBothHalvesAnsi = () => {
    triggerTwoHalvesDownloadWithProgress(
      basePrefix,
      date,
      part1Content,
      part2Content,
      part1.length,
      part2.length,
      setSplitProgress
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="wincmd-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1209]/65 dark:bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            key="wincmd-modal-panel"
            initial={{ opacity: 0, scale: 0.94, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: "spring", stiffness: 360, damping: 28, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#1F1209] w-full max-w-4xl rounded-3xl shadow-2xl shadow-black/40 border border-[#E6D7C3] dark:border-[#5C351B] ring-1 ring-[#E89C1D]/25 overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Gold Accent Top Bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#4C2812] via-[#E89C1D] to-[#4C2812] shrink-0" />
            {/* Header */}
            <div className="p-6 border-b border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between bg-[#FAF7F2] dark:bg-[#28170C]">
          <div className="flex items-center gap-3">
            <div className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] p-2.5 rounded-2xl shadow-md">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {pick("Extraction Commandes WINCMD (Encodage ANSI)", "WINCMD Commands Extraction (ANSI Encoding)")}
              </h3>
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-medium">
                {pick("Génération des commandes terminaux avec le caractère séparateur ", "Generate terminal commands using separator character ")}
                <code className="bg-[#F3E9D8] dark:bg-[#3A2212] px-1 py-0.5 rounded text-[#4C2812] dark:text-[#F7BA42] font-mono font-bold">‡</code>{" "}
                {pick("(0x87 en ANSI)", "(0x87 in ANSI)")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] p-2 rounded-xl hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="p-6 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#1F1209] space-y-4">
          {/* 1. Carrier selection */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E6D7C3]/70 dark:border-[#4C2812]/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#4C2812] dark:text-[#F7BA42]">
                {pick("Type de vols :", "Flight type:")}
              </span>
              <div className="inline-flex bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-1 rounded-xl text-xs font-medium">
                <button
                  onClick={() => setCarrierMode("kp")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    carrierMode === "kp"
                      ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold shadow-xs"
                      : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                  }`}
                >
                  <span>✈️ {pick(`Vols Opérés par KP (${kpCount})`, `KP Operated Flights (${kpCount})`)}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    carrierMode === "kp"
                      ? "bg-[#E89C1D] dark:bg-[#1F1209] text-[#321B0A] dark:text-[#F7BA42]"
                      : "bg-[#FDF4E3] dark:bg-[#3A2212] text-[#8C5214] dark:text-[#F7BA42]"
                  }`}>
                    {pick("Prioritaire", "Priority")}
                  </span>
                </button>
                <button
                  onClick={() => setCarrierMode("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    carrierMode === "all"
                      ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold shadow-xs"
                      : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                  }`}
                >
                  {pick(`Tous les vols (${segments.length})`, `All flights (${segments.length})`)}
                </button>
                <button
                  onClick={() => setCarrierMode("codeshare")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    carrierMode === "codeshare"
                      ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold shadow-xs"
                      : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                  }`}
                >
                  {pick(`Codeshares uniquement (${codeshareCount})`, `Codeshares only (${codeshareCount})`)}
                </button>
              </div>
            </div>

            {/* Sub-segment mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#4C2812] dark:text-[#F7BA42]">
                {pick("Tronçons :", "Segments:")}
              </span>
              <div className="inline-flex bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-1 rounded-xl text-xs font-medium">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filterMode === "all"
                      ? "bg-white dark:bg-[#4C2812] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#E89C1D]/50 font-bold shadow-xs"
                      : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                  }`}
                >
                  {pick("Tous tronçons", "All segments")}
                </button>
                <button
                  onClick={() => setFilterMode("primary")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filterMode === "primary"
                      ? "bg-white dark:bg-[#4C2812] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#E89C1D]/50 font-bold shadow-xs"
                      : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                  }`}
                >
                  {pick("Premier départ", "First leg")}
                </button>
                <button
                  onClick={() => setFilterMode("station")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filterMode === "station"
                      ? "bg-white dark:bg-[#4C2812] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#E89C1D]/50 font-bold shadow-xs"
                      : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                  }`}
                >
                  {pick("Par Station", "By Station")}
                </button>
              </div>
            </div>

            {filterMode === "station" && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[#4C2812] dark:text-[#F7BA42]">
                  {pick("Station :", "Station:")}
                </label>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] text-xs font-bold rounded-xl px-3 py-1.5 text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                >
                  <option value="ALL">{pick("Toutes les stations", "All stations")}</option>
                  {availableStations.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. File Split Selector */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#321B0A] dark:text-[#FAF7F2] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />
                {pick(
                  "Scission en Deux Fichiers Distincts (Moitié des vols) :",
                  "Split into Two Separate Files (Half of flights):"
                )}
              </span>
              <span className="text-[11px] font-bold text-[#8C5214] dark:text-[#F7BA42]">
                {pick(
                  `Total sélectionné : ${filteredSegments.length} commandes`,
                  `Selected total: ${filteredSegments.length} commands`
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* Option Complet */}
              <button
                onClick={() => setSplitView("all")}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  splitView === "all"
                    ? "bg-white dark:bg-[#2E1A0D] border-[#4C2812] dark:border-[#E89C1D] shadow-sm ring-2 ring-[#E89C1D]/30"
                    : "bg-white/70 dark:bg-[#1F1209] border-[#E6D7C3] dark:border-[#4C2812] hover:bg-white dark:hover:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                    {pick("Fichier Complet (100%)", "Complete File (100%)")}
                  </span>
                  {splitView === "all" && <Check className="w-3.5 h-3.5 text-[#4C2812] dark:text-[#F7BA42]" />}
                </div>
                <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] mt-1">
                  <strong>{filteredSegments.length}</strong> {pick("commandes au total", "commands total")}
                </div>
              </button>

              {/* Option Partie 1 */}
              <button
                onClick={() => setSplitView("part1")}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  splitView === "part1"
                    ? "bg-white dark:bg-[#2E1A0D] border-[#4C2812] dark:border-[#E89C1D] shadow-sm ring-2 ring-[#E89C1D]/30"
                    : "bg-white/70 dark:bg-[#1F1209] border-[#E6D7C3] dark:border-[#4C2812] hover:bg-white dark:hover:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                    {pick("1ère Moitié (Partie 1)", "1st Half (Part 1)")}
                  </span>
                  {splitView === "part1" && <Check className="w-3.5 h-3.5 text-[#4C2812] dark:text-[#F7BA42]" />}
                </div>
                <div className="text-[11px] text-[#8C5214] dark:text-[#F7BA42] font-semibold mt-1">
                  <strong>{part1.length}</strong> {pick("commandes", "commands")} • {part1FlightsCount} {pick("vols", "flights")}
                  {part1FlightNumbers.length > 0 && ` (${part1FlightNumbers[0]}...${part1FlightNumbers[part1FlightNumbers.length - 1]})`}
                </div>
              </button>

              {/* Option Partie 2 */}
              <button
                onClick={() => setSplitView("part2")}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  splitView === "part2"
                    ? "bg-white dark:bg-[#2E1A0D] border-[#4C2812] dark:border-[#E89C1D] shadow-sm ring-2 ring-[#E89C1D]/30"
                    : "bg-white/70 dark:bg-[#1F1209] border-[#E6D7C3] dark:border-[#4C2812] hover:bg-white dark:hover:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                    {pick("2ème Moitié (Partie 2)", "2nd Half (Part 2)")}
                  </span>
                  {splitView === "part2" && <Check className="w-3.5 h-3.5 text-[#4C2812] dark:text-[#F7BA42]" />}
                </div>
                <div className="text-[11px] text-[#8C5214] dark:text-[#F7BA42] font-semibold mt-1">
                  <strong>{part2.length}</strong> {pick("commandes", "commands")} • {part2FlightsCount} {pick("vols", "flights")}
                  {part2FlightNumbers.length > 0 && ` (${part2FlightNumbers[0]}...${part2FlightNumbers[part2FlightNumbers.length - 1]})`}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Code / Text Preview */}
        <div className="p-6 flex-1 overflow-auto bg-[#231206] font-mono text-xs text-[#FAF7F2]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#4C2812] text-[#F3E9D8]">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">
                {splitView === "all"
                  ? pick("Aperçu du Fichier Complet", "Complete File Preview")
                  : splitView === "part1"
                  ? pick("Aperçu Fichier Partie 1 (1ère moitié)", "Part 1 File Preview (1st half)")
                  : pick("Aperçu Fichier Partie 2 (2ème moitié)", "Part 2 File Preview (2nd half)")}
              </span>
              <span className="bg-[#4C2812] text-[#F7BA42] px-2 py-0.5 rounded text-[11px] font-mono">
                {activeSegments.length} {pick("ligne(s)", "line(s)")}
              </span>
            </div>
            <span>{pick("Date :", "Date:")} {date}</span>
          </div>
          <pre className="whitespace-pre overflow-x-auto leading-relaxed select-all">
            {wincmdContent}
          </pre>
        </div>

        {/* Modal Footer actions */}
        <div className="p-6 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] flex items-center gap-1.5 font-medium">
            <span>{pick("Fichier visualisé :", "Active file:")}</span>
            <strong className="text-[#4C2812] dark:text-[#F7BA42]">
              {splitView === "all"
                ? pick("Complet", "Complete")
                : splitView === "part1"
                ? pick("Partie 1 (1ère moitié)", "Part 1 (1st half)")
                : pick("Partie 2 (2ème moitié)", "Part 2 (2nd half)")}{" "}
              ({activeSegments.length} cmds)
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? pick("Copié !", "Copied!") : pick("Copier", "Copy")}</span>
            </button>

            {/* Quick Part 1 download */}
            <button
              onClick={handleDownloadPart1Ansi}
              className="px-3.5 py-2.5 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={pick("Télécharger directement la 1ère moitié des vols", "Download 1st half of flights directly")}
            >
              <Download className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" />
              <span>{pick(`Partie 1 (${part1.length})`, `Part 1 (${part1.length})`)}</span>
            </button>

            {/* Quick Part 2 download */}
            <button
              onClick={handleDownloadPart2Ansi}
              className="px-3.5 py-2.5 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={pick("Télécharger directement la 2ème moitié des vols", "Download 2nd half of flights directly")}
            >
              <Download className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" />
              <span>{pick(`Partie 2 (${part2.length})`, `Part 2 (${part2.length})`)}</span>
            </button>

            {/* Download BOTH halves sequentially */}
            <button
              onClick={handleDownloadBothHalvesAnsi}
              className="px-4 py-2.5 rounded-xl bg-[#E89C1D] hover:bg-[#d48b13] border border-[#d48b13] text-[#321B0A] text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={pick(
                "Télécharge automatiquement les 2 fichiers séparés (Partie 1 + Partie 2)",
                "Automatically download both split files (Part 1 + Part 2)"
              )}
            >
              <Files className="w-4 h-4 text-[#321B0A]" />
              <span>{pick("Télécharger les 2 Fichiers (Lot 1 & 2)", "Download Both Files (Batch 1 & 2)")}</span>
            </button>

            {/* Download Complete File */}
            <button
              onClick={handleDownloadActiveAnsi}
              className="px-4 py-2.5 rounded-xl bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              title={pick(
                "Télécharger le fichier affiché actuellement en encodage ANSI",
                "Download currently previewed file in ANSI encoding"
              )}
            >
              <Download className="w-4 h-4" />
              <span>
                {splitView === "all"
                  ? pick("Télécharger Fichier Complet (.txt)", "Download Complete File (.txt)")
                  : splitView === "part1"
                  ? pick("Télécharger Partie 1 (.txt)", "Download Part 1 (.txt)")
                  : pick("Télécharger Partie 2 (.txt)", "Download Part 2 (.txt)")}
              </span>
            </button>

            <div className="w-px h-6 bg-[#E6D7C3] dark:bg-[#4C2812] hidden sm:block" />

            {/* Excel export */}
            <button
              onClick={() =>
                exportFlightsToExcel(
                  activeSegments,
                  pick(`Vols_${date}.xlsx`, `Flights_${date}.xlsx`),
                  language
                )
              }
              className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (.xlsx)</span>
            </button>

            {/* Standard text report export */}
            <button
              onClick={() => {
                const text = exportFlightsToText(activeSegments, date, language);
                const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = pick(
                  `Vols_${date}_FormatTexte.txt`,
                  `Flights_${date}_TextReport.txt`
                );
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3.5 py-2.5 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileText className="w-4 h-4 text-[#6E472B] dark:text-[#DECAB1]" />
              <span>{pick("Texte (.txt)", "Text (.txt)")}</span>
            </button>
          </div>
        </div>
          </motion.div>

          {/* Split Extraction Progress Indicator Modal */}
          <SplitExtractionProgress
            data={splitProgress}
            onClose={() => setSplitProgress(INITIAL_SPLIT_PROGRESS)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
