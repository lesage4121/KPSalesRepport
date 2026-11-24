/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  TrendingUp,
  Calendar,
  Plane,
  Trash2,
  FolderOpen,
  Search,
  Luggage,
  Users,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  FileDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ManifestParseResult } from "../../types";
import {
  FlightEvolutionPoint,
  FlightKeySummary,
  StoredManifestDaySummary,
  clearAllManifestsFromDb,
  deleteFlightFromDayInDb,
  deleteManifestDayFromDb,
  getFlightEvolutionSeries,
  getSavedManifestDay,
  listAllFlightKeysInDb,
  listSavedManifestDays,
} from "../../utils/manifestDb";
import {
  exportFlightEvolutionStatsToCSV,
  exportFlightEvolutionStatsToPDF,
} from "../../utils/flightStatsExport";
import { ManifestFileMeta } from "./FlightManifestUploader";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

interface LocalArchiveAndEvolutionViewProps {
  onLoadDayManifest: (
    data: ManifestParseResult,
    meta: ManifestFileMeta,
    targetFlightId?: string
  ) => void;
  onGoToUpload: () => void;
  initialSubView?: "ARCHIVE" | "EVOLUTION";
  initialFlightKey?: string; // e.g. "69|NSI"
  refreshNonce?: number;
}

type ArchiveSubView = "ARCHIVE" | "EVOLUTION";

type DbErrorState =
  | { kind: "dbAccess"; detail?: string }
  | { kind: "notFound"; dateKey: string }
  | { kind: "loadFailed" }
  | null;

type FeedbackState =
  | { kind: "deletedDay"; dateKey: string }
  | { kind: "deletedFlight"; label: string; dateKey: string }
  | { kind: "clearedAll" }
  | null;

export const LocalArchiveAndEvolutionView: React.FC<
  LocalArchiveAndEvolutionViewProps
> = ({
  onLoadDayManifest,
  onGoToUpload,
  initialSubView = "ARCHIVE",
  initialFlightKey = "",
  refreshNonce = 0,
}) => {
  const { language, locale, pick } = useLanguage();
  const { isDark } = useTheme();
  const [subView, setSubView] = useState<ArchiveSubView>(initialSubView);
  const [savedDays, setSavedDays] = useState<StoredManifestDaySummary[]>([]);
  const [flightKeys, setFlightKeys] = useState<FlightKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbErrorState, setDbErrorState] = useState<DbErrorState>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(null);

  const dbError = dbErrorState
    ? dbErrorState.kind === "dbAccess"
      ? dbErrorState.detail ||
        pick(
          "Impossible d'accéder à la base locale du navigateur.",
          "Unable to access the browser local database."
        )
      : dbErrorState.kind === "notFound"
      ? pick(
          `Aucune donnée trouvée pour la journée ${dbErrorState.dateKey}.`,
          `No data found for day ${dbErrorState.dateKey}.`
        )
      : pick(
          "Erreur lors du chargement des données depuis la base locale.",
          "Error loading data from local database."
        )
    : null;

  const feedbackMsg = feedbackState
    ? feedbackState.kind === "deletedDay"
      ? pick(
          `Journée ${feedbackState.dateKey} supprimée de la base locale.`,
          `Day ${feedbackState.dateKey} deleted from local database.`
        )
      : feedbackState.kind === "deletedFlight"
      ? pick(
          `Vol ${feedbackState.label} (${feedbackState.dateKey}) retiré de la base locale.`,
          `Flight ${feedbackState.label} (${feedbackState.dateKey}) removed from local database.`
        )
      : pick(
          "Toute la base locale a été nettoyée.",
          "Entire local database has been cleared."
        )
    : null;

  // Archive selection & filtering
  const [selectedDateKey, setSelectedDateKey] = useState<string>("");
  const [dayFlightSearch, setDayFlightSearch] = useState<string>("");
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const [confirmDeleteDayKey, setConfirmDeleteDayKey] = useState<string | null>(
    null
  );

  // Evolution curve selection
  const [selectedFlightKey, setSelectedFlightKey] = useState<string>(
    initialFlightKey
  );
  const [flightKeyFilter, setFlightKeyFilter] = useState<string>("");
  const [evolutionPoints, setEvolutionPoints] = useState<FlightEvolutionPoint[]>(
    []
  );

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  useEffect(() => {
    if (initialFlightKey) {
      setSelectedFlightKey(initialFlightKey);
    }
  }, [initialFlightKey]);

  const loadArchiveMetadata = useCallback(async () => {
    try {
      setIsLoading(true);
      setDbErrorState(null);
      const [days, keys] = await Promise.all([
        listSavedManifestDays(),
        listAllFlightKeysInDb(),
      ]);
      setSavedDays(days);
      setFlightKeys(keys);

      setSelectedDateKey((prev) => {
        if (prev && days.some((d) => d.dateKey === prev)) return prev;
        return days[0]?.dateKey || "";
      });

      setSelectedFlightKey((prev) => {
        if (prev && keys.some((k) => k.key === prev)) return prev;
        return keys[0]?.key || "";
      });
    } catch (err) {
      setDbErrorState({
        kind: "dbAccess",
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchiveMetadata();
  }, [loadArchiveMetadata, refreshNonce]);

  useEffect(() => {
    if (!selectedFlightKey) {
      setEvolutionPoints([]);
      return;
    }
    const [flightNumber, origin] = selectedFlightKey.split("|");
    if (!flightNumber || !origin) return;
    let cancelled = false;
    void getFlightEvolutionSeries(flightNumber, origin).then((pts) => {
      if (!cancelled) setEvolutionPoints(pts);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFlightKey, savedDays]);

  const showTempFeedback = (fb: Exclude<FeedbackState, null>) => {
    setFeedbackState(fb);
    setTimeout(() => {
      setFeedbackState((curr) => (curr === fb ? null : curr));
    }, 3500);
  };

  const activeDay = useMemo(() => {
    return savedDays.find((d) => d.dateKey === selectedDateKey) || savedDays[0] || null;
  }, [savedDays, selectedDateKey]);

  const filteredDayFlights = useMemo(() => {
    if (!activeDay) return [];
    if (!dayFlightSearch.trim()) return activeDay.flights;
    const q = dayFlightSearch.toLowerCase().trim();
    return activeDay.flights.filter((f) =>
      [f.airline, f.flightNumber, `${f.airline}${f.flightNumber}`, f.origin, f.aircraftType]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [activeDay, dayFlightSearch]);

  const filteredFlightKeys = useMemo(() => {
    if (!flightKeyFilter.trim()) return flightKeys;
    const q = flightKeyFilter.toLowerCase().trim();
    return flightKeys.filter((k) =>
      [k.airline, k.flightNumber, `${k.airline}${k.flightNumber}`, k.origin]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [flightKeys, flightKeyFilter]);

  const activeFlightKeyMeta = useMemo(() => {
    return flightKeys.find((k) => k.key === selectedFlightKey) || null;
  }, [flightKeys, selectedFlightKey]);

  const evolutionStats = useMemo(() => {
    if (evolutionPoints.length === 0) return null;
    const n = evolutionPoints.length;
    const sumPax = evolutionPoints.reduce((s, p) => s + p.passengersTotal, 0);
    const sumC = evolutionPoints.reduce((s, p) => s + p.businessCount, 0);
    const sumY = evolutionPoints.reduce((s, p) => s + p.economyCount, 0);
    const sumBags = evolutionPoints.reduce((s, p) => s + p.bagsCount, 0);
    const sumWeight = evolutionPoints.reduce((s, p) => s + p.totalWeight, 0);
    const minPax = Math.min(...evolutionPoints.map((p) => p.passengersTotal));
    const maxPax = Math.max(...evolutionPoints.map((p) => p.passengersTotal));
    const minWeight = Math.min(...evolutionPoints.map((p) => p.totalWeight));
    const maxWeight = Math.max(...evolutionPoints.map((p) => p.totalWeight));

    const first = evolutionPoints[0];
    const last = evolutionPoints[n - 1];
    const paxDelta = n >= 2 ? last.passengersTotal - first.passengersTotal : 0;
    const weightDelta = n >= 2 ? last.totalWeight - first.totalWeight : 0;

    return {
      daysCount: n,
      avgPax: Math.round(sumPax / n),
      avgC: (sumC / n).toFixed(1),
      avgY: (sumY / n).toFixed(1),
      avgBags: Math.round(sumBags / n),
      avgWeight: Math.round(sumWeight / n),
      minPax,
      maxPax,
      minWeight,
      maxWeight,
      paxDelta,
      weightDelta,
    };
  }, [evolutionPoints]);

  const handleOpenDay = async (dateKey: string, targetFlightId?: string) => {
    try {
      const record = await getSavedManifestDay(dateKey);
      if (!record) {
        setDbErrorState({ kind: "notFound", dateKey });
        return;
      }
      onLoadDayManifest(
        record.data,
        {
          name: `${record.sourceFileName} (Archive ${record.dateKey})`,
          size: 0,
          uploadedAt: new Date(record.savedAt).toLocaleString(locale),
          linesCount: record.data.totalFlights,
        },
        targetFlightId
      );
    } catch {
      setDbErrorState({ kind: "loadFailed" });
    }
  };

  const handleDeleteDay = async (dateKey: string) => {
    await deleteManifestDayFromDb(dateKey);
    setConfirmDeleteDayKey(null);
    await loadArchiveMetadata();
    showTempFeedback({ kind: "deletedDay", dateKey });
  };

  const handleDeleteSingleFlight = async (dateKey: string, flightId: string, label: string) => {
    await deleteFlightFromDayInDb(dateKey, flightId);
    await loadArchiveMetadata();
    showTempFeedback({ kind: "deletedFlight", label, dateKey });
  };

  const handleClearAll = async () => {
    await clearAllManifestsFromDb();
    setConfirmClearAll(false);
    await loadArchiveMetadata();
    showTempFeedback({ kind: "clearedAll" });
  };

  const handleJumpToEvolution = (flightNumber: string, origin: string) => {
    setSelectedFlightKey(`${flightNumber}|${origin}`);
    setSubView("EVOLUTION");
  };

  const totalDbStats = useMemo(() => {
    return {
      days: savedDays.length,
      flights: savedDays.reduce((s, d) => s + d.totalFlights, 0),
      passengers: savedDays.reduce((s, d) => s + d.totalPassengers, 0),
      weight: savedDays.reduce((s, d) => s + d.totalWeight, 0),
    };
  }, [savedDays]);

  return (
    <div className="space-y-5">
      {/* Top Bar: Mode Switch + DB Summary + Refresh */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[#4C2812] dark:text-[#F7BA42] shrink-0" />
            <h3 className="text-base font-bold text-[#321B0A] dark:text-[#FAF7F2]">
              {pick(
                "Base Locale Navigateur & Évolution des Vols",
                "Browser Local Database & Flight Trends"
              )}
            </h3>
          </div>
          <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums">
            {pick(
              `${totalDbStats.days} journée(s) archivée(s) · ${totalDbStats.flights} tronçons · ${totalDbStats.passengers.toLocaleString(locale)} passagers · ${totalDbStats.weight.toLocaleString(locale)} kg enregistrés localement`,
              `${totalDbStats.days} archived day(s) · ${totalDbStats.flights} segments · ${totalDbStats.passengers.toLocaleString(locale)} passengers · ${totalDbStats.weight.toLocaleString(locale)} kg stored locally`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-[#FAF7F2] dark:bg-[#28170C] rounded-xl border border-[#E6D7C3] dark:border-[#4C2812]">
            <button
              type="button"
              onClick={() => setSubView("ARCHIVE")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                subView === "ARCHIVE"
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                  : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              {pick(
                `Journées & Vols (${savedDays.length})`,
                `Days & Flights (${savedDays.length})`
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubView("EVOLUTION")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                subView === "EVOLUTION"
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                  : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {pick(
                `Courbes d'Évolution (${flightKeys.length} vols)`,
                `Evolution Trends (${flightKeys.length} flights)`
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadArchiveMetadata()}
            className="p-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] cursor-pointer"
            title={pick("Actualiser depuis la base locale", "Refresh from local database")}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {dbError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {dbError}
          </span>
          <button
            type="button"
            onClick={() => setDbErrorState(null)}
            className="text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && savedDays.length === 0 ? (
        <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#FDF4E3] dark:bg-[#2E1A0D] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#4C2812]">
            <Database className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h4 className="text-base font-bold text-[#321B0A] dark:text-[#FAF7F2]">
              {pick(
                "Aucune journée archivée dans le navigateur",
                "No archived days in browser"
              )}
            </h4>
            <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] leading-relaxed">
              {pick(
                "Chaque manifeste importé dans l'onglet « 2. Manifeste de Tous les Vols » est automatiquement sauvegardé dans la base locale (IndexedDB) de votre navigateur par journée. Importez un premier fichier pour commencer l'historique et tracer les courbes d'évolution.",
                "Every manifest imported in the \"2. All Flights Manifest\" tab is automatically saved by day in your browser's local database (IndexedDB). Import a first file to build history and plot trend charts."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToUpload}
            className="px-4 py-2.5 rounded-xl bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {pick("Importer un manifeste", "Import a manifest")}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* SUB-VIEW 1: BROWSER DATABASE ARCHIVE & CLEANUP */}
      {savedDays.length > 0 && subView === "ARCHIVE" && (
        <div className="space-y-4">
          {/* Collapsible Day Picker & Local DB Cleanup */}
          <CollapsiblePanel
            title={pick(
              `Journées Enregistrées & Nettoyage Base Locale (${savedDays.length})`,
              `Saved Days & Local DB Cleanup (${savedDays.length})`
            )}
            subtitle={
              activeDay
                ? pick(
                    `Journée sélectionnée : ${activeDay.dateKey} (${activeDay.totalFlights} vols · ${activeDay.totalPassengers} pax · ${activeDay.totalWeight.toLocaleString(locale)} kg)`,
                    `Selected day: ${activeDay.dateKey} (${activeDay.totalFlights} flights · ${activeDay.totalPassengers} pax · ${activeDay.totalWeight.toLocaleString(locale)} kg)`
                  )
                : pick("Sélectionner une journée", "Select a day")
            }
            icon={<Database className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6D7C3]/70 dark:border-[#4C2812]/70">
                <span className="text-xs font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                  {pick(
                    "Cliquez sur une journée pour afficher ses vols dans le tableau ci-dessous, ou ouvrez-la directement dans le rapport.",
                    "Click a day to display its flights in the table below, or open it directly in the report."
                  )}
                </span>

                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="text-xs font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {pick("Tout nettoyer", "Clear all")}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleClearAll()}
                      className="px-2.5 py-1 rounded bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      {pick("Confirmer suppression totale", "Confirm full deletion")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2.5 py-1 rounded bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold cursor-pointer"
                    >
                      {pick("Annuler", "Cancel")}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {savedDays.map((day) => {
                  const isSelected = activeDay?.dateKey === day.dateKey;
                  const isConfirmingDel = confirmDeleteDayKey === day.dateKey;
                  return (
                    <div
                      key={day.dateKey}
                      onClick={() => setSelectedDateKey(day.dateKey)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D]"
                          : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] hover:bg-[#FDF4E3]/60 dark:hover:bg-[#351F11]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono font-bold text-sm text-[#321B0A] dark:text-[#FAF7F2]">
                          {day.dateKey}
                        </div>
                        <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                          {day.totalFlights} {pick("vol(s)", "flight(s)")} · {day.totalPassengers} pax
                        </div>
                      </div>

                      <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums">
                        {day.totalBags} pcs · {day.totalWeight.toLocaleString(locale)} kg
                        {day.totalUncoveredDeviations > 0 && (
                          <span className="text-rose-700 dark:text-rose-400 font-semibold">
                            {" "}
                            · {day.totalUncoveredDeviations} {pick("écart(s)", "deviation(s)")}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#8C5214]/80 dark:text-[#F7BA42]/80 truncate mt-1">
                        {day.sourceFileName} ·{" "}
                        {new Date(day.savedAt).toLocaleString(locale)}
                      </div>

                      <div
                        className="mt-3 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => void handleOpenDay(day.dateKey)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/40 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen className="w-3 h-3 text-[#E89C1D]" />
                          {pick("Consulter la journée", "View day")}
                        </button>

                        {!isConfirmingDel ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDayKey(day.dateKey)}
                            className="p-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-200 dark:hover:border-rose-700 text-[#6E472B] dark:text-[#DECAB1] hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
                            title={pick(`Supprimer la journée ${day.dateKey}`, `Delete day ${day.dateKey}`)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDeleteDay(day.dateKey)}
                              className="px-2 py-1 rounded bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {pick("Supprimer", "Delete")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDayKey(null)}
                              className="px-2 py-1 rounded bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#FAF7F2] text-[11px] font-semibold cursor-pointer"
                            >
                              {pick("Non", "No")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsiblePanel>

          {activeDay && (
            <>
              {/* Collapsible Day Search & Open Bar */}
              <CollapsiblePanel
                title={pick(
                  `Filtre & Ouverture Journée — ${activeDay.dateKey}`,
                  `Filter & Open Day — ${activeDay.dateKey}`
                )}
                subtitle={`${filteredDayFlights.length} / ${activeDay.totalFlights} ${pick("vols affichés", "flights shown")}`}
                icon={<Search className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
                defaultOpen={false}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={dayFlightSearch}
                      onChange={(e) => setDayFlightSearch(e.target.value)}
                      placeholder={pick("N° vol ou départ (ex. 69, LFW)...", "Flight # or dep. (e.g. 69, LFW)...")}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleOpenDay(activeDay.dateKey)}
                    className="px-3.5 py-2 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    {pick(`Tout ouvrir (${activeDay.dateKey})`, `Open all (${activeDay.dateKey})`)}
                  </button>
                </div>
              </CollapsiblePanel>

              {/* Full-Width Flights Table of Selected Day */}
              <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                    {pick(
                      `Tableau des Vols du ${activeDay.dateKey} (${filteredDayFlights.length} tronçons)`,
                      `Flights Table for ${activeDay.dateKey} (${filteredDayFlights.length} segments)`
                    )}
                  </h4>
                  <span className="text-xs font-mono text-[#6E472B] dark:text-[#DECAB1]">
                    {activeDay.totalPassengers} pax · {activeDay.totalWeight.toLocaleString(locale)} kg
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] border-b border-[#321B0A] dark:border-[#5C351B] text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 pl-5 pr-3">{pick("Vol & Départ", "Flight & Dep.")}</th>
                        <th className="py-3 px-3">{pick("Heure / Avion", "Time / Aircraft")}</th>
                        <th className="py-3 px-3">{pick("Passagers (C/Y)", "Passengers (C/Y)")}</th>
                        <th className="py-3 px-3">{pick("Bagages & Poids", "Baggage & Weight")}</th>
                        <th className="py-3 pr-5 pl-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                      {filteredDayFlights.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#6E472B] dark:text-[#DECAB1]">
                            {pick("Aucun vol trouvé pour ce filtre.", "No flights found for this filter.")}
                          </td>
                        </tr>
                      ) : (
                        filteredDayFlights.map((flt, idx) => (
                          <tr
                            key={flt.id}
                            className={`transition-colors ${
                              idx % 2 === 0
                                ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                                : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                            }`}
                          >
                            <td className="py-3 pl-5 pr-3 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                              {flt.airline} {flt.flightNumber} · {pick("Départ", "Dep.")}{" "}
                              <span className="text-[#8C5214] dark:text-[#F7BA42]">{flt.origin}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[#6E472B] dark:text-[#DECAB1] tabular-nums whitespace-nowrap">
                              {flt.departureTimeFormatted} · {flt.aircraftType}{" "}
                              <span className="text-[#8C5214]/70 dark:text-[#F7BA42]/75">
                                ({flt.isPureEconomy ? `${pick("Pure Éco", "Pure Eco")} ${flt.configRaw}` : flt.configRaw || "—"})
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                              <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                {flt.passengersCount} pax
                              </span>{" "}
                              <span className="text-[#6E472B] dark:text-[#DECAB1]">
                                ({flt.businessCount}C / {flt.economyCount}Y)
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap text-[#321B0A] dark:text-[#FAF7F2]">
                              {flt.bagsCount} pcs ·{" "}
                              <span className="font-bold">
                                {flt.totalWeight.toLocaleString(locale)} kg
                              </span>
                            </td>
                            <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleOpenDay(activeDay.dateKey, flt.id)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/40 text-[11px] font-semibold cursor-pointer"
                                >
                                  {pick("Consulter vol", "View flight")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleJumpToEvolution(flt.flightNumber, flt.origin)
                                  }
                                  className="px-2.5 py-1 rounded-lg border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  title={pick("Voir la courbe d'évolution de ce vol", "View evolution curve for this flight")}
                                >
                                  <TrendingUp className="w-3 h-3 text-[#8C5214] dark:text-[#F7BA42]" />
                                  {pick("Courbe", "Trend")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDeleteSingleFlight(
                                      activeDay.dateKey,
                                      flt.id,
                                      `${flt.airline} ${flt.flightNumber} (${flt.origin})`
                                    )
                                  }
                                  className="p-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-200 dark:hover:border-rose-700 text-[#8C5214] dark:text-[#DECAB1] hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
                                  title={pick("Retirer ce vol de la base locale", "Remove this flight from local database")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: FLIGHT EVOLUTION CHARTS (N° Vol + Origine) */}
      {savedDays.length > 0 && subView === "EVOLUTION" && (
        <div className="space-y-4">
          {/* Collapsible Flight Picker (Numéro + Origine) */}
          <CollapsiblePanel
            title={pick(
              `Sélecteur de Vol — ${activeFlightKeyMeta ? `${activeFlightKeyMeta.airline} ${activeFlightKeyMeta.flightNumber} · Départ ${activeFlightKeyMeta.origin}` : "Choisir un vol"}`,
              `Flight Selector — ${activeFlightKeyMeta ? `${activeFlightKeyMeta.airline} ${activeFlightKeyMeta.flightNumber} · Dep. ${activeFlightKeyMeta.origin}` : "Choose a flight"}`
            )}
            subtitle={
              activeFlightKeyMeta
                ? pick(
                    `${activeFlightKeyMeta.daysCount} jour(s) suivi(s) (${activeFlightKeyMeta.dates.join(", ")}) · Moy. ${activeFlightKeyMeta.avgPassengers} pax / ${activeFlightKeyMeta.avgWeight} kg`,
                    `${activeFlightKeyMeta.daysCount} tracked day(s) (${activeFlightKeyMeta.dates.join(", ")}) · Avg. ${activeFlightKeyMeta.avgPassengers} pax / ${activeFlightKeyMeta.avgWeight} kg`
                  )
                : pick(`${flightKeys.length} vols disponibles`, `${flightKeys.length} available flights`)
            }
            icon={<Plane className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            defaultOpen={false}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={flightKeyFilter}
                    onChange={(e) => setFlightKeyFilter(e.target.value)}
                    placeholder={pick("Filtrer vol (ex. 69, LFW, NSI)...", "Filter flight (e.g. 69, LFW, NSI)...")}
                    className="w-full pl-8 pr-3 py-2 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-xl text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                  />
                </div>

                <select
                  value={selectedFlightKey}
                  onChange={(e) => setSelectedFlightKey(e.target.value)}
                  className="flex-1 min-w-[260px] px-3.5 py-2 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-xl text-xs font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                >
                  {filteredFlightKeys.map((fk) => (
                    <option key={fk.key} value={fk.key}>
                      {fk.airline} {fk.flightNumber} · {pick("Départ", "Dep.")} {fk.origin} ({fk.daysCount}{" "}
                      {pick(`jour${fk.daysCount > 1 ? "s" : ""}`, `day${fk.daysCount > 1 ? "s" : ""}`)} ·{" "}
                      {pick("moy.", "avg.")} {fk.avgPassengers} pax / {fk.avgWeight} kg)
                    </option>
                  ))}
                </select>
              </div>

              {activeFlightKeyMeta && (
                <div className="text-xs font-mono text-[#6E472B] dark:text-[#DECAB1]">
                  {pick("Dates suivies :", "Tracked dates:")}{" "}
                  <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                    {activeFlightKeyMeta.dates.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </CollapsiblePanel>

          {/* Collapsible Evolution KPIs & Charts */}
          <CollapsiblePanel
            title={pick(
              `Indicateurs & Courbes d'Évolution (${activeFlightKeyMeta?.airline || "KP"} ${activeFlightKeyMeta?.flightNumber || ""} · ${activeFlightKeyMeta?.origin || ""})`,
              `KPIs & Evolution Curves (${activeFlightKeyMeta?.airline || "KP"} ${activeFlightKeyMeta?.flightNumber || ""} · ${activeFlightKeyMeta?.origin || ""})`
            )}
            subtitle={
              evolutionStats
                ? pick(
                    `${evolutionStats.daysCount} jour(s) · Moy. ${evolutionStats.avgPax} pax · Moy. ${evolutionStats.avgBags} pcs (${evolutionStats.avgWeight.toLocaleString(locale)} kg)`,
                    `${evolutionStats.daysCount} day(s) · Avg. ${evolutionStats.avgPax} pax · Avg. ${evolutionStats.avgBags} pcs (${evolutionStats.avgWeight.toLocaleString(locale)} kg)`
                  )
                : pick("Courbes Passagers & Bagages", "Passengers & Baggage Curves")
            }
            icon={<TrendingUp className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {evolutionPoints.length === 1 && (
                <div className="p-3.5 rounded-xl bg-[#FDF4E3] dark:bg-[#2E1A0D] border border-[#E89C1D]/50 text-[#321B0A] dark:text-[#FAF7F2] text-xs">
                  <span className="font-bold text-[#4C2812] dark:text-[#F7BA42]">
                    {pick(
                      `1 seule journée enregistrée pour ce vol (${evolutionPoints[0].dateKey}) :`,
                      `Only 1 day recorded for this flight (${evolutionPoints[0].dateKey}):`
                    )}
                  </span>{" "}
                  {pick(
                    "importez les manifestes d'autres journées (ex. 12NOV, 13NOV) dans l'onglet « 2. Manifeste de Tous les Vols » pour visualiser la courbe d'évolution multi-jours.",
                    "import manifests from other days (e.g. 12NOV, 13NOV) in the \"2. All Flights Manifest\" tab to view the multi-day evolution trend."
                  )}
                </div>
              )}

              {/* KPI Strip for Selected Flight */}
              {evolutionStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                      <span>{pick("Jours Analysés", "Analyzed Days")}</span>
                      <Plane className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1.5">
                      {evolutionStats.daysCount}
                    </div>
                    <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono mt-1">
                      {activeFlightKeyMeta?.airline} {activeFlightKeyMeta?.flightNumber} ·{" "}
                      {pick("Départ", "Dep.")} {activeFlightKeyMeta?.origin}
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                      <span>{pick("Moyenne Passagers / Vol", "Avg. Passengers / Flight")}</span>
                      <Users className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1.5">
                      {evolutionStats.avgPax}
                      {evolutionStats.daysCount >= 2 && (
                        <span
                          className={`ml-2 text-xs font-bold ${
                            evolutionStats.paxDelta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {evolutionStats.paxDelta >= 0 ? "+" : ""}
                          {evolutionStats.paxDelta}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums mt-1">
                      {pick("Moy.", "Avg.")} {evolutionStats.avgC}C / {evolutionStats.avgY}Y · Min{" "}
                      {evolutionStats.minPax} / Max {evolutionStats.maxPax}
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                      <span>{pick("Moyenne Bagages (Pièces)", "Avg. Baggage (Pieces)")}</span>
                      <Luggage className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42]" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1.5">
                      {evolutionStats.avgBags}{" "}
                      <span className="text-xs font-semibold text-[#6E472B] dark:text-[#DECAB1]">pcs</span>
                    </div>
                    <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums mt-1">
                      {evolutionStats.avgPax > 0
                        ? (evolutionStats.avgBags / evolutionStats.avgPax).toFixed(2)
                        : "0"}{" "}
                      {pick("pcs / passager", "pcs / passenger")}
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                      <span>{pick("Poids Bagages Moyen", "Avg. Baggage Weight")}</span>
                      <TrendingUp className="w-4 h-4 text-[#E89C1D]" />
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1.5">
                      {evolutionStats.avgWeight.toLocaleString(locale)}{" "}
                      <span className="text-xs font-semibold text-[#6E472B] dark:text-[#DECAB1]">kg</span>
                      {evolutionStats.daysCount >= 2 && (
                        <span
                          className={`ml-2 text-xs font-bold ${
                            evolutionStats.weightDelta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {evolutionStats.weightDelta >= 0 ? "+" : ""}
                          {evolutionStats.weightDelta} kg
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums mt-1">
                      Min {evolutionStats.minWeight} kg / Max {evolutionStats.maxWeight} kg
                    </div>
                  </div>
                </div>
              )}

              {/* Charts: Passengers Curve & Baggage Curve */}
              {evolutionPoints.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Chart 1: Passengers Evolution */}
                  <div className="bg-white dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                        {pick(
                          `Courbe d'Évolution Passagers (${activeFlightKeyMeta?.airline} ${activeFlightKeyMeta?.flightNumber} · ${activeFlightKeyMeta?.origin})`,
                          `Passenger Evolution Curve (${activeFlightKeyMeta?.airline} ${activeFlightKeyMeta?.flightNumber} · ${activeFlightKeyMeta?.origin})`
                        )}
                      </h4>
                      <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                        {pick(
                          "Total passagers et répartition Business (C) / Économie (Y) par journée",
                          "Total passengers and Business (C) / Economy (Y) breakdown by day"
                        )}
                      </p>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={evolutionPoints}
                          margin={{ top: 10, right: 16, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={isDark ? "#4C2812" : "#E6D7C3"}
                          />
                          <XAxis
                            dataKey="dateKey"
                            tick={{
                              fontSize: 11,
                              fill: isDark ? "#DECAB1" : "#6E472B",
                              fontFamily: "monospace",
                            }}
                            axisLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            tickLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{
                              fontSize: 11,
                              fill: isDark ? "#DECAB1" : "#6E472B",
                              fontFamily: "monospace",
                            }}
                            axisLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            tickLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#321B0A",
                              border: "1px solid #6E472B",
                              borderRadius: "10px",
                              color: "#FAF7F2",
                              fontSize: "12px",
                              fontFamily: "monospace",
                            }}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: "12px",
                              color: isDark ? "#FAF7F2" : "#321B0A",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="passengersTotal"
                            name={pick("Total Passagers", "Total Passengers")}
                            stroke={isDark ? "#FAF7F2" : "#4C2812"}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: isDark ? "#FAF7F2" : "#4C2812" }}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="economyCount"
                            name={pick("Économie (Y)", "Economy (Y)")}
                            stroke={isDark ? "#D4A373" : "#8C5214"}
                            strokeWidth={2}
                            dot={{ r: 3.5, fill: isDark ? "#D4A373" : "#8C5214" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="businessCount"
                            name="Business (C)"
                            stroke={isDark ? "#F7BA42" : "#E89C1D"}
                            strokeWidth={2}
                            dot={{ r: 3.5, fill: isDark ? "#F7BA42" : "#E89C1D" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Baggage Evolution (Weight + Pieces) */}
                  <div className="bg-white dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-5 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                        {pick(
                          `Courbe d'Évolution Bagages (${activeFlightKeyMeta?.airline} ${activeFlightKeyMeta?.flightNumber} · ${activeFlightKeyMeta?.origin})`,
                          `Baggage Evolution Curve (${activeFlightKeyMeta?.airline} ${activeFlightKeyMeta?.flightNumber} · ${activeFlightKeyMeta?.origin})`
                        )}
                      </h4>
                      <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                        {pick(
                          "Poids total enregistré (kg) et nombre de bagages (pièces) par journée",
                          "Total checked weight (kg) and baggage count (pieces) by day"
                        )}
                      </p>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={evolutionPoints}
                          margin={{ top: 10, right: 12, left: -4, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={isDark ? "#4C2812" : "#E6D7C3"}
                          />
                          <XAxis
                            dataKey="dateKey"
                            tick={{
                              fontSize: 11,
                              fill: isDark ? "#DECAB1" : "#6E472B",
                              fontFamily: "monospace",
                            }}
                            axisLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            tickLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                          />
                          <YAxis
                            yAxisId="left"
                            tick={{
                              fontSize: 11,
                              fill: isDark ? "#F7BA42" : "#4C2812",
                              fontFamily: "monospace",
                            }}
                            axisLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            tickLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            unit=" kg"
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            allowDecimals={false}
                            tick={{
                              fontSize: 11,
                              fill: isDark ? "#D4A373" : "#8C5214",
                              fontFamily: "monospace",
                            }}
                            axisLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            tickLine={{ stroke: isDark ? "#5C351B" : "#D4BC9E" }}
                            unit=" pcs"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#321B0A",
                              border: "1px solid #6E472B",
                              borderRadius: "10px",
                              color: "#FAF7F2",
                              fontSize: "12px",
                              fontFamily: "monospace",
                            }}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: "12px",
                              color: isDark ? "#FAF7F2" : "#321B0A",
                            }}
                          />
                          <Bar
                            yAxisId="right"
                            dataKey="bagsCount"
                            name={pick("Pièces bagages", "Baggage Pieces")}
                            fill={isDark ? "#5C351B" : "#FDE6B8"}
                            stroke={isDark ? "#D4A373" : "#8C5214"}
                            radius={[6, 6, 0, 0]}
                            barSize={28}
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="totalWeight"
                            name={pick("Poids Total (kg)", "Total Weight (kg)")}
                            stroke={isDark ? "#F7BA42" : "#4C2812"}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: isDark ? "#F7BA42" : "#4C2812" }}
                            activeDot={{ r: 6 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CollapsiblePanel>

          {/* Chronological Data Table */}
          {evolutionPoints.length > 0 && (
            <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                  {pick(
                    `Détail Chronologique du Vol ${activeFlightKeyMeta?.airline} ${activeFlightKeyMeta?.flightNumber} · Départ ${activeFlightKeyMeta?.origin}`,
                    `Chronological Breakdown — Flight ${activeFlightKeyMeta?.airline} ${activeFlightKeyMeta?.flightNumber} · Dep. ${activeFlightKeyMeta?.origin}`
                  )}
                </h4>
                {activeFlightKeyMeta && (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        exportFlightEvolutionStatsToPDF(
                          activeFlightKeyMeta,
                          evolutionPoints,
                          language
                        )
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                      title={pick(
                        "Exporter les statistiques d'évolution en PDF",
                        "Export evolution statistics as PDF"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5 text-[#E89C1D] dark:text-[#1F1209]" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportFlightEvolutionStatsToCSV(
                          activeFlightKeyMeta,
                          evolutionPoints,
                          language
                        )
                      }
                      className="px-2.5 py-1.5 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                      title={pick(
                        "Exporter les statistiques d'évolution en CSV",
                        "Export evolution statistics as CSV"
                      )}
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>CSV</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] border-b border-[#321B0A] dark:border-[#5C351B] text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 pl-5 pr-3">Date</th>
                      <th className="py-3 px-3">{pick("Départ / Avion", "Dep. / Aircraft")}</th>
                      <th className="py-3 px-3">{pick("Passagers", "Passengers")}</th>
                      <th className="py-3 px-3">{pick("Variation Pax", "Pax Change")}</th>
                      <th className="py-3 px-3">{pick("Bagages (pcs / kg)", "Baggage (pcs / kg)")}</th>
                      <th className="py-3 px-3">{pick("Moy. kg/pax", "Avg. kg/pax")}</th>
                      <th className="py-3 pr-5 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                    {evolutionPoints.map((pt, idx) => {
                      const prev = idx > 0 ? evolutionPoints[idx - 1] : null;
                      const diffPax = prev ? pt.passengersTotal - prev.passengersTotal : null;
                      return (
                        <tr
                          key={`${pt.dateKey}-${pt.flightId}`}
                          className={`transition-colors ${
                            idx % 2 === 0
                              ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                              : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                          }`}
                        >
                          <td className="py-3 pl-5 pr-3 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                            {pt.dateKey}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#6E472B] dark:text-[#DECAB1] tabular-nums whitespace-nowrap">
                            {pt.departureTimeFormatted} · {pt.aircraftType}{" "}
                            <span className="text-[#8C5214]/70 dark:text-[#F7BA42]/75">
                              ({pt.isPureEconomy ? `${pick("Pure Éco", "Pure Eco")} ${pt.configRaw}` : pt.configRaw || "—"})
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                            <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                              {pt.passengersTotal} pax
                            </span>{" "}
                            <span className="text-[#6E472B] dark:text-[#DECAB1]">
                              ({pt.businessCount}C / {pt.economyCount}Y)
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                            {diffPax === null ? (
                              <span className="text-[#8C5214]/70 dark:text-[#DECAB1]/70">{pick("Base", "Baseline")}</span>
                            ) : (
                              <span
                                className={`font-bold ${
                                  diffPax > 0
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : diffPax < 0
                                    ? "text-rose-700 dark:text-rose-400"
                                    : "text-[#6E472B] dark:text-[#DECAB1]"
                                }`}
                              >
                                {diffPax > 0 ? `+${diffPax}` : diffPax}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap text-[#321B0A] dark:text-[#FAF7F2]">
                            {pt.bagsCount} pcs ·{" "}
                            <span className="font-bold">
                              {pt.totalWeight.toLocaleString(locale)} kg
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-[#6E472B] dark:text-[#DECAB1]">
                            {pt.avgWeightPerPax} kg/pax
                          </td>
                          <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void handleOpenDay(pt.dateKey, pt.flightId)}
                              className="text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {pick("Consulter ce vol", "View this flight")}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
