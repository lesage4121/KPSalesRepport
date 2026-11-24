/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plane,
  Sparkles,
  Terminal,
} from "lucide-react";
import { FlightScheduleParseResult } from "../../types";
import { parseFlightSchedule } from "../../utils/flightParser";
import { useLanguage } from "../../context/LanguageContext";

export interface ScheduleImportSimulationState {
  isLoading: boolean;
  fileName: string;
  fileSizeBytes: number;
  linesCount: number;
  progress: number; // 0 - 100
  stageIndex: 0 | 1 | 2 | 3 | 4; // 4 = completed
  detectedSegmentsCount: number;
  detectedKpFlightsCount: number;
  detectedDate: string;
}

const INITIAL_SIMULATION_STATE: ScheduleImportSimulationState = {
  isLoading: false,
  fileName: "",
  fileSizeBytes: 0,
  linesCount: 0,
  progress: 0,
  stageIndex: 0,
  detectedSegmentsCount: 0,
  detectedKpFlightsCount: 0,
  detectedDate: "",
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

interface UseSimulatedScheduleImportOptions {
  onComplete: (parsed: FlightScheduleParseResult, rawText: string) => void;
  onError?: (message: string) => void;
}

export const useSimulatedScheduleImport = ({
  onComplete,
  onError,
}: UseSimulatedScheduleImportOptions) => {
  const { pick } = useLanguage();
  const [simulation, setSimulation] = useState<ScheduleImportSimulationState>(
    INITIAL_SIMULATION_STATE
  );
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);

  const clearScheduledWork = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearScheduledWork();
    };
  }, [clearScheduledWork]);

  const startSimulationWithText = useCallback(
    (text: string, fileName: string, fileSizeBytes?: number) => {
      clearScheduledWork();
      cancelledRef.current = false;

      const trimmed = text.trim();
      if (!trimmed) {
        setSimulation(INITIAL_SIMULATION_STATE);
        onError?.(
          pick(
            "Le fichier sélectionné est vide.",
            "The selected file is empty."
          )
        );
        return;
      }

      const parsed = parseFlightSchedule(text);
      if (parsed.segments.length === 0) {
        setSimulation(INITIAL_SIMULATION_STATE);
        onError?.(
          pick(
            "Aucun tronçon de vol valide n'a été détecté dans ce fichier VDS ou GD*.",
            "No valid flight legs were detected in this VDS or GD* schedule file."
          )
        );
        return;
      }

      const linesCount = text.split(/\r?\n/).filter((l) => l.trim() !== "").length;
      const resolvedSize =
        fileSizeBytes && fileSizeBytes > 0
          ? fileSizeBytes
          : new Blob([text]).size;

      const totalDurationMs = 1550;
      const startTime = performance.now();

      setSimulation({
        isLoading: true,
        fileName,
        fileSizeBytes: resolvedSize,
        linesCount,
        progress: 6,
        stageIndex: 0,
        detectedSegmentsCount: parsed.segments.length,
        detectedKpFlightsCount: parsed.kpUniqueFlightsCount,
        detectedDate: parsed.date,
      });

      const tick = (now: number) => {
        if (cancelledRef.current) return;
        const elapsed = now - startTime;
        const ratio = Math.min(1, elapsed / totalDurationMs);
        // Smooth easeOutCubic curve up to 100%
        const eased = 1 - Math.pow(1 - ratio, 2.4);
        const progress = Math.min(100, Math.max(6, Math.round(eased * 100)));

        let stageIndex: 0 | 1 | 2 | 3 | 4 = 0;
        if (progress >= 100) stageIndex = 4;
        else if (progress >= 78) stageIndex = 3;
        else if (progress >= 50) stageIndex = 2;
        else if (progress >= 24) stageIndex = 1;

        setSimulation((prev) => ({
          ...prev,
          progress,
          stageIndex,
        }));

        if (ratio < 1) {
          rafRef.current = window.requestAnimationFrame(tick);
        } else {
          const doneTimer = window.setTimeout(() => {
            if (cancelledRef.current) return;
            setSimulation(INITIAL_SIMULATION_STATE);
            onComplete(parsed, text);
          }, 260);
          timersRef.current.push(doneTimer);
        }
      };

      rafRef.current = window.requestAnimationFrame(tick);
    },
    [clearScheduledWork, onComplete, onError, pick]
  );

  const importFromFile = useCallback(
    (file: File) => {
      clearScheduledWork();
      cancelledRef.current = false;

      // Immediately show initial reading state while FileReader reads from disk
      setSimulation({
        isLoading: true,
        fileName: file.name,
        fileSizeBytes: file.size,
        linesCount: 0,
        progress: 4,
        stageIndex: 0,
        detectedSegmentsCount: 0,
        detectedKpFlightsCount: 0,
        detectedDate: "",
      });

      const reader = new FileReader();
      reader.onload = (event) => {
        if (cancelledRef.current) return;
        const text = (event.target?.result as string) || "";
        startSimulationWithText(text, file.name, file.size);
      };
      reader.onerror = () => {
        if (cancelledRef.current) return;
        setSimulation(INITIAL_SIMULATION_STATE);
        onError?.(
          pick(
            "Impossible de lire ce fichier sur le disque.",
            "Unable to read this file from disk."
          )
        );
      };
      reader.readAsText(file);
    },
    [clearScheduledWork, onError, pick, startSimulationWithText]
  );

  const cancelImport = useCallback(() => {
    cancelledRef.current = true;
    clearScheduledWork();
    setSimulation(INITIAL_SIMULATION_STATE);
  }, [clearScheduledWork]);

  return {
    simulation,
    importFromFile,
    startSimulationWithText,
    cancelImport,
  };
};

interface ScheduleImportProgressCardProps {
  simulation: ScheduleImportSimulationState;
}

export const ScheduleImportProgressCard: React.FC<
  ScheduleImportProgressCardProps
> = ({ simulation }) => {
  const { pick } = useLanguage();

  const steps = [
    {
      label: pick(
        "Lecture du flux texte brut (VDS / GD*)",
        "Reading raw schedule stream (VDS / GD*)"
      ),
      detail:
        simulation.linesCount > 0
          ? pick(
              `${simulation.linesCount} lignes chargées`,
              `${simulation.linesCount} lines loaded`
            )
          : pick("Ouverture du fichier...", "Opening file..."),
    },
    {
      label: pick(
        "Identification des vols KP & codeshares",
        "Identifying KP & codeshare flights"
      ),
      detail:
        simulation.stageIndex >= 1 && simulation.detectedKpFlightsCount > 0
          ? pick(
              `${simulation.detectedKpFlightsCount} vols propres KP détectés`,
              `${simulation.detectedKpFlightsCount} KP-operated flights detected`
            )
          : pick("Analyse des numéros de vol...", "Parsing flight numbers..."),
    },
    {
      label: pick(
        "Extraction des escales et horaires réels",
        "Extracting stops & actual timings"
      ),
      detail:
        simulation.stageIndex >= 2 && simulation.detectedSegmentsCount > 0
          ? pick(
              `${simulation.detectedSegmentsCount} tronçons · Date ${simulation.detectedDate}`,
              `${simulation.detectedSegmentsCount} legs · Date ${simulation.detectedDate}`
            )
          : pick("Vérification des ajustements...", "Checking schedule adjustments..."),
    },
    {
      label: pick(
        "Génération des commandes WINCMD (ANSI)",
        "Generating WINCMD commands (ANSI)"
      ),
      detail:
        simulation.stageIndex >= 4
          ? pick("Prêt pour affichage", "Ready to display")
          : pick("Préparation des sorties...", "Preparing outputs..."),
    },
  ];

  const isCompleted = simulation.stageIndex === 4;

  return (
    <div className="border-2 border-[#E89C1D]/70 dark:border-[#E89C1D]/60 bg-[#FAF7F2] dark:bg-[#28170C] rounded-3xl p-6 md:p-8 text-left space-y-5 shadow-inner animate-in fade-in duration-200">
      {/* File Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-3 rounded-2xl shrink-0 shadow-sm transition-colors ${
              isCompleted
                ? "bg-emerald-600 text-white"
                : "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Plane className="w-5 h-5 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-[#321B0A] dark:text-[#FAF7F2] truncate max-w-[260px] sm:max-w-sm">
                {simulation.fileName || pick("Programme des vols", "Flight Schedule")}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FDF4E3] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#5C351B]">
                {formatFileSize(simulation.fileSizeBytes)}
              </span>
            </div>
            <p className="text-xs font-medium text-[#6E472B] dark:text-[#DECAB1] mt-0.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#E89C1D] shrink-0" />
              {isCompleted
                ? pick(
                    `Chargement terminé (${simulation.detectedSegmentsCount} tronçons)`,
                    `Import complete (${simulation.detectedSegmentsCount} legs)`
                  )
                : pick(
                    "Importation et analyse du programme de vols en cours...",
                    "Importing and parsing flight schedule..."
                  )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xl font-black font-mono text-[#4C2812] dark:text-[#F7BA42]">
            {simulation.progress}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-3.5 rounded-full bg-white dark:bg-[#140B05] border border-[#E6D7C3] dark:border-[#4C2812] p-0.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4C2812] via-[#8C5214] to-[#E89C1D] dark:from-[#8C5214] dark:via-[#E89C1D] dark:to-[#F7BA42] transition-all duration-100 ease-out"
            style={{ width: `${simulation.progress}%` }}
          />
        </div>
      </div>

      {/* 4 Pipeline Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {steps.map((step, idx) => {
          const isDone = simulation.stageIndex > idx || isCompleted;
          const isActive = simulation.stageIndex === idx && !isCompleted;

          return (
            <div
              key={step.label}
              className={`rounded-2xl px-3.5 py-2.5 border transition-colors flex items-start gap-2.5 ${
                isDone
                  ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50"
                  : isActive
                  ? "bg-white dark:bg-[#1F1209] border-[#E89C1D] shadow-xs"
                  : "bg-white/60 dark:bg-[#1F1209]/55 border-[#E6D7C3]/70 dark:border-[#4C2812]/70 opacity-65"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-[#E89C1D] animate-spin" />
                ) : (
                  <Terminal className="w-4 h-4 text-[#8C5214]/50 dark:text-[#DECAB1]/45" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold leading-tight ${
                    isDone
                      ? "text-emerald-900 dark:text-emerald-200"
                      : isActive
                      ? "text-[#321B0A] dark:text-[#FAF7F2]"
                      : "text-[#6E472B] dark:text-[#DECAB1]"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[11px] font-medium text-[#6E472B] dark:text-[#DECAB1] mt-0.5 truncate">
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#8C5214] dark:text-[#F7BA42]">
        <Sparkles className="w-3.5 h-3.5" />
        <span>
          {pick(
            "Traitement local instantané — aucune donnée envoyée vers un serveur externe",
            "Local processing — no data leaves your browser"
          )}
        </span>
      </div>
    </div>
  );
};
