/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  CheckCircle2, 
  Download, 
  FileText, 
  Loader2, 
  X, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { downloadAnsiFile } from "../../utils/flightParser";
import { useLanguage } from "../../context/LanguageContext";

export interface SplitProgressData {
  isOpen: boolean;
  step: "idle" | "part1_preparing" | "part1_ready" | "part2_preparing" | "part2_ready" | "completed";
  progress: number; // 0 to 100
  part1Filename: string;
  part2Filename: string;
  part1Count: number;
  part2Count: number;
  part1Content: string;
  part2Content: string;
  error?: string;
}

interface SplitExtractionProgressProps {
  data: SplitProgressData;
  onClose: () => void;
}

export const SplitExtractionProgress: React.FC<SplitExtractionProgressProps> = ({
  data,
  onClose,
}) => {
  const { pick } = useLanguage();
  if (!data.isOpen) return null;

  const isPart1Active = data.step === "part1_preparing";
  const isPart1Done = ["part1_ready", "part2_preparing", "part2_ready", "completed"].includes(data.step);

  const isPart2Active = data.step === "part2_preparing";
  const isPart2Done = ["part2_ready", "completed"].includes(data.step);

  const isAllDone = data.step === "completed";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#321B0A]/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1F1209] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E6D7C3] dark:border-[#4C2812] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between bg-[#FAF7F2] dark:bg-[#28170C]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl shadow-sm transition-colors ${
              isAllDone ? "bg-emerald-600 text-white" : "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
            }`}>
              {isAllDone ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
            </div>
            <div>
              <h3 className="text-base font-black text-[#321B0A] dark:text-[#FAF7F2]">
                {isAllDone
                  ? pick("Extraction Scindée Terminée", "Split Extraction Complete")
                  : pick("Extraction en 2 Fichiers en cours", "Splitting into 2 Files in Progress")}
              </h3>
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-medium">
                {isAllDone 
                  ? pick("Les 2 fichiers WINCMD ANSI sont prêts et téléchargés", "Both WINCMD ANSI files are ready and downloaded")
                  : pick("Génération et encodage ANSI (Windows-1252) des deux moitiés", "Generating & encoding both halves in ANSI (Windows-1252)")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] p-2 rounded-xl hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition-colors cursor-pointer"
            title={pick("Fermer", "Close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Main Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#4C2812] dark:text-[#F7BA42]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E89C1D]" />
                {pick("Progression globale de l'extraction", "Overall extraction progress")}
              </span>
              <span className="font-mono text-[#4C2812] dark:text-[#F7BA42]">{data.progress}%</span>
            </div>
            <div className="w-full bg-[#FAF7F2] dark:bg-[#28170C] rounded-full h-3 overflow-hidden p-0.5 border border-[#E6D7C3] dark:border-[#4C2812]">
              <div 
                className="bg-gradient-to-r from-[#4C2812] dark:from-[#8C5214] to-[#E89C1D] dark:to-[#F7BA42] h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>

          {/* Detailed Steps Indicator */}
          <div className="space-y-3.5">
            {/* Step 1 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isPart1Done 
                ? "bg-emerald-50/60 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/70" 
                : isPart1Active 
                ? "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D] ring-2 ring-[#E89C1D]/25" 
                : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] opacity-60"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isPart1Done 
                      ? "bg-emerald-600 text-white" 
                      : isPart1Active 
                      ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]" 
                      : "bg-[#F3E9D8] dark:bg-[#3A2212] text-[#6E472B] dark:text-[#DECAB1]"
                  }`}>
                    {isPart1Done ? <CheckCircle2 className="w-4 h-4" /> : isPart1Active ? <Loader2 className="w-4 h-4 animate-spin" /> : "1"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                        {pick("Partie 1 : Première moitié des vols", "Part 1: First half of flights")}
                      </h4>
                      <span className="text-[10px] bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] px-2 py-0.5 rounded-full font-mono text-[#4C2812] dark:text-[#F7BA42] font-bold">
                        {data.part1Count} {pick("tronçons", "segments")}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5 font-mono truncate max-w-xs">
                      {data.part1Filename}
                    </p>
                  </div>
                </div>

                <div>
                  {isPart1Done ? (
                    <button
                      onClick={() => downloadAnsiFile(data.part1Filename, data.part1Content)}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                      title={pick("Télécharger à nouveau la Partie 1", "Download Part 1 again")}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{pick("Re-télécharger", "Re-download")}</span>
                    </button>
                  ) : isPart1Active ? (
                    <span className="text-xs font-semibold text-[#8C5214] dark:text-[#F7BA42] animate-pulse flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {pick("Encodage ANSI...", "ANSI encoding...")}
                    </span>
                  ) : (
                    <span className="text-xs text-[#8C5214]/70 dark:text-[#DECAB1]/70">{pick("En attente", "Waiting")}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isPart2Done 
                ? "bg-emerald-50/60 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/70" 
                : isPart2Active 
                ? "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D] ring-2 ring-[#E89C1D]/25" 
                : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] opacity-60"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isPart2Done 
                      ? "bg-emerald-600 text-white" 
                      : isPart2Active 
                      ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]" 
                      : "bg-[#F3E9D8] dark:bg-[#3A2212] text-[#6E472B] dark:text-[#DECAB1]"
                  }`}>
                    {isPart2Done ? <CheckCircle2 className="w-4 h-4" /> : isPart2Active ? <Loader2 className="w-4 h-4 animate-spin" /> : "2"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                        {pick("Partie 2 : Deuxième moitié des vols", "Part 2: Second half of flights")}
                      </h4>
                      <span className="text-[10px] bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] px-2 py-0.5 rounded-full font-mono text-[#4C2812] dark:text-[#F7BA42] font-bold">
                        {data.part2Count} {pick("tronçons", "segments")}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5 font-mono truncate max-w-xs">
                      {data.part2Filename}
                    </p>
                  </div>
                </div>

                <div>
                  {isPart2Done ? (
                    <button
                      onClick={() => downloadAnsiFile(data.part2Filename, data.part2Content)}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                      title={pick("Télécharger à nouveau la Partie 2", "Download Part 2 again")}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{pick("Re-télécharger", "Re-download")}</span>
                    </button>
                  ) : isPart2Active ? (
                    <span className="text-xs font-semibold text-[#8C5214] dark:text-[#F7BA42] animate-pulse flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {pick("Encodage ANSI...", "ANSI encoding...")}
                    </span>
                  ) : (
                    <span className="text-xs text-[#8C5214]/70 dark:text-[#DECAB1]/70">{pick("En attente", "Waiting")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ANSI Compliance badge */}
          <div className="p-3 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl flex items-center gap-2 text-[#6E472B] dark:text-[#DECAB1] text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {pick("Format validé : encodage ", "Validated format: ")}
              <strong className="text-[#321B0A] dark:text-[#FAF7F2]">ANSI Windows-1252</strong>
              {pick(" avec séparateur terminal ", " encoding with terminal separator ")}
              <code className="bg-[#F3E9D8] dark:bg-[#3A2212] px-1 py-0.5 rounded font-mono font-bold text-[#4C2812] dark:text-[#F7BA42]">‡</code> (0x87).
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex items-center justify-between">
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1]">
            {isAllDone ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {pick("2 fichiers téléchargés automatiquement", "2 files downloaded automatically")}
              </span>
            ) : (
              <span>
                {pick("Extraction séquentielle pour éviter le blocage navigateur...", "Sequential extraction to prevent browser blocking...")}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              isAllDone 
                ? "bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] shadow-md" 
                : "bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] text-[#4C2812] dark:text-[#FAF7F2] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
            }`}
          >
            {isAllDone ? pick("Fermer", "Close") : pick("Annuler", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export const INITIAL_SPLIT_PROGRESS: SplitProgressData = {
  isOpen: false,
  step: "idle",
  progress: 0,
  part1Filename: "",
  part2Filename: "",
  part1Count: 0,
  part2Count: 0,
  part1Content: "",
  part2Content: "",
};

/**
 * Executes the sequential download of both parts with progressive visual feedback
 */
export async function triggerTwoHalvesDownloadWithProgress(
  basePrefix: string,
  date: string,
  part1Content: string,
  part2Content: string,
  part1Count: number,
  part2Count: number,
  onUpdate: (state: SplitProgressData) => void
): Promise<void> {
  const part1Filename = `${basePrefix}_${date}_PARTIE_1_ANSI.txt`;
  const part2Filename = `${basePrefix}_${date}_PARTIE_2_ANSI.txt`;

  // Step 1: Starting preparation of Part 1
  onUpdate({
    isOpen: true,
    step: "part1_preparing",
    progress: 15,
    part1Filename,
    part2Filename,
    part1Count,
    part2Count,
    part1Content,
    part2Content,
  });

  await new Promise(resolve => setTimeout(resolve, 350));

  // Trigger download of Part 1
  downloadAnsiFile(part1Filename, part1Content);

  // Step 2: Part 1 Ready & downloaded
  onUpdate({
    isOpen: true,
    step: "part1_ready",
    progress: 50,
    part1Filename,
    part2Filename,
    part1Count,
    part2Count,
    part1Content,
    part2Content,
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 3: Preparing Part 2
  onUpdate({
    isOpen: true,
    step: "part2_preparing",
    progress: 70,
    part1Filename,
    part2Filename,
    part1Count,
    part2Count,
    part1Content,
    part2Content,
  });

  await new Promise(resolve => setTimeout(resolve, 400));

  // Trigger download of Part 2
  downloadAnsiFile(part2Filename, part2Content);

  // Step 4: Part 2 Ready & downloaded
  onUpdate({
    isOpen: true,
    step: "part2_ready",
    progress: 95,
    part1Filename,
    part2Filename,
    part1Count,
    part2Count,
    part1Content,
    part2Content,
  });

  await new Promise(resolve => setTimeout(resolve, 350));

  // Step 5: Fully Completed
  onUpdate({
    isOpen: true,
    step: "completed",
    progress: 100,
    part1Filename,
    part2Filename,
    part1Count,
    part2Count,
    part1Content,
    part2Content,
  });
}

