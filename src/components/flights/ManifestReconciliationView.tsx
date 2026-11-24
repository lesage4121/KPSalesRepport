/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Search,
  Copy,
  Check,
  Terminal,
  FileSpreadsheet,
  ArrowRight,
  RotateCcw,
  Calendar,
} from "lucide-react";
import {
  FlightScheduleParseResult,
  FlightSegment,
  ManifestParseResult,
} from "../../types";
import {
  ReconciliationItem,
  ReconciliationStatus,
  downloadMissingWincmdAnsi,
  exportReconciliationToExcel,
  reconcileManifestWithSchedule,
} from "../../utils/manifestReconciliation";
import {
  ScheduleImportProgressCard,
  useSimulatedScheduleImport,
} from "./ScheduleImportProgress";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { useLanguage } from "../../context/LanguageContext";

export interface ManifestReconciliationViewProps {
  manifestData: ManifestParseResult;
  scheduleData: FlightScheduleParseResult | null;
  storedScheduleSegments?: FlightSegment[];
  onScheduleLoaded: (data: FlightScheduleParseResult | null) => void;
  onInspectFlight: (flightId: string) => void;
}

type FilterStatus = "ALL" | ReconciliationStatus;

export const ManifestReconciliationView: React.FC<
  ManifestReconciliationViewProps
> = ({
  manifestData,
  scheduleData,
  storedScheduleSegments = [],
  onScheduleLoaded,
  onInspectFlight,
}) => {
  const { language, pick } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const {
    simulation,
    importFromFile,
  } = useSimulatedScheduleImport({
    onComplete: (parsed) => {
      setImportError(null);
      onScheduleLoaded(parsed);
    },
    onError: (message) => {
      setImportError(message);
    },
  });

  const reconciliation = useMemo(() => {
    if (!scheduleData && storedScheduleSegments.length === 0) return null;
    return reconcileManifestWithSchedule(
      scheduleData,
      manifestData,
      storedScheduleSegments
    );
  }, [scheduleData, manifestData, storedScheduleSegments]);

  const handleUploadSchedule = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || simulation.isLoading) return;
    setImportError(null);
    importFromFile(file);
  };

  const handleDropSchedule = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || simulation.isLoading) return;
    setImportError(null);
    importFromFile(file);
  };

  const handleCopyWincmd = async (cmd: string, id: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const filteredItems = useMemo<ReconciliationItem[]>(() => {
    if (!reconciliation) return [];
    let base: ReconciliationItem[] = [];
    if (statusFilter === "CODESHARE_INFO") {
      base = reconciliation.codeshareItems;
    } else if (statusFilter === "ALL") {
      base = reconciliation.items;
    } else {
      base = reconciliation.items.filter((i) => i.status === statusFilter);
    }

    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase().trim();
    return base.filter((i) =>
      [
        i.flightNumber,
        i.origin,
        i.destination,
        i.scheduledDate || "",
        i.manifestDate || "",
        i.wincmdMissing || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [reconciliation, statusFilter, searchTerm]);

  if ((!scheduleData && storedScheduleSegments.length === 0) || !reconciliation) {
    return (
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-8 md:p-10">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#FDF4E3] dark:bg-[#2E1A0D] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#4C2812]">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base font-bold text-[#321B0A] dark:text-[#FAF7F2]">
              {pick(
                "Rapprochement Programme des Vols (Optionnel)",
                "Flight Schedule Match (Optional)"
              )}
            </h4>
            <p className="text-xs text-[#6E472B] dark:text-[#DECAB1]">
              {pick(
                `${manifestData.totalFlights} tronçons (${manifestData.totalPassengers} pax · ${manifestData.manifestDate || "N/D"}) prêts. Importez le programme (VDS) pour vérifier les vols manquants.`,
                `${manifestData.totalFlights} legs (${manifestData.totalPassengers} pax · ${manifestData.manifestDate || "N/A"}) ready. Import the schedule (VDS) to check missing flights.`
              )}
            </p>
          </div>

          {importError && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-2xl px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{importError}</span>
            </div>
          )}

          {simulation.isLoading ? (
            <ScheduleImportProgressCard simulation={simulation} />
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropSchedule}
              className={`border-2 border-dashed rounded-2xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer relative ${
                isDragging
                  ? "border-[#E89C1D] bg-[#FDF4E3] dark:bg-[#351F11]"
                  : "border-[#D8C3A5] dark:border-[#5C351B] hover:border-[#4C2812] dark:hover:border-[#E89C1D] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3]/70 dark:hover:bg-[#351F11]"
              }`}
            >
              <input
                type="file"
                accept=".txt,.csv,.log,.vds,.dat"
                onChange={handleUploadSchedule}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-8 h-8 text-[#4C2812] dark:text-[#E89C1D] mb-2" />
              <span className="text-sm font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
                {pick(
                  "Importer le fichier Programme des Vols (.txt)",
                  "Import Flight Schedule File (.txt)"
                )}
              </span>
              <span className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-1">
                {pick(
                  "Synchronisé automatiquement avec l'onglet « 1. Programme des Vols »",
                  "Automatically synced with tab \"1. Flight Schedule\""
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visible Date Mismatch Warning whenever Schedule Dates != Manifest Dates */}
      {reconciliation.dateMismatch && (
        <div className="bg-[#FDF4E3] dark:bg-[#2E1A0D] border border-[#E89C1D]/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#321B0A] dark:text-[#FAF7F2]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div>
                {pick(
                  <>
                    <strong>Écart de dates :</strong> Programme(s){" "}
                    <span className="font-mono font-bold">
                      {reconciliation.scheduleDate || "—"}
                    </span>{" "}
                    vs Manifeste(s){" "}
                    <span className="font-mono font-bold">
                      {reconciliation.manifestDate || "—"}
                    </span>
                    .
                  </>,
                  <>
                    <strong>Date mismatch:</strong> Schedule(s){" "}
                    <span className="font-mono font-bold">
                      {reconciliation.scheduleDate || "—"}
                    </span>{" "}
                    vs Manifest(s){" "}
                    <span className="font-mono font-bold">
                      {reconciliation.manifestDate || "—"}
                    </span>
                    .
                  </>
                )}
              </div>
              <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                {pick(
                  "Rapprochement strict par clé unique (Date de départ · N° Vol · Origine) : aucune correspondance croisée entre dates différentes.",
                  "Strict matching by unique key (Departure Date · Flight No. · Origin): flights from different dates are never cross-matched."
                )}
              </div>
            </div>
          </div>

          <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E89C1D]/60 hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            {pick(
              `Charger programme (${reconciliation.manifestDate})`,
              `Load ${reconciliation.manifestDate} schedule`
            )}
            <input
              type="file"
              accept=".txt,.csv,.log,.vds,.dat"
              onChange={handleUploadSchedule}
              className="hidden"
            />
          </label>
        </div>
      )}

      <CollapsiblePanel
        title={pick(
          `Bilan Rapprochement (${reconciliation.coveragePercent}%), Actions WINCMD & Indicateurs`,
          `Reconciliation Summary (${reconciliation.coveragePercent}%), WINCMD Actions & KPIs`
        )}
        subtitle={pick(
          `${reconciliation.matchedCount}/${reconciliation.totalKpScheduled} tronçons KP importés · ${reconciliation.missingCount} manquant(s) · ${reconciliation.extraCount} hors programme${reconciliation.dateMismatch ? ` · Écart date (${reconciliation.scheduleDate} vs ${reconciliation.manifestDate})` : ""}`,
          `${reconciliation.matchedCount}/${reconciliation.totalKpScheduled} KP legs imported · ${reconciliation.missingCount} missing · ${reconciliation.extraCount} unscheduled${reconciliation.dateMismatch ? ` · Date mismatch (${reconciliation.scheduleDate} vs ${reconciliation.manifestDate})` : ""}`
        )}
        icon={<Terminal className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={false}
      >
        <div className="space-y-4">

      {/* Overall Completeness Banner */}
      <div
        className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          reconciliation.allKpCovered
            ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-200"
            : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] text-[#321B0A] dark:text-[#FAF7F2]"
        }`}
      >
        <div className="flex items-start gap-3">
          {reconciliation.allKpCovered ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="text-sm font-bold">
              {reconciliation.allKpCovered
                ? pick(
                    `100% couvert — ${reconciliation.totalKpScheduled} tronçons KP (${reconciliation.scheduleDate})`,
                    `100% covered — ${reconciliation.totalKpScheduled} KP legs (${reconciliation.scheduleDate})`
                  )
                : pick(
                    `${reconciliation.matchedCount}/${reconciliation.totalKpScheduled} tronçons KP importés (${reconciliation.scheduleDate}) · ${reconciliation.missingCount} manquant(s)`,
                    `${reconciliation.matchedCount}/${reconciliation.totalKpScheduled} KP legs imported (${reconciliation.scheduleDate}) · ${reconciliation.missingCount} missing`
                  )}
            </h4>
            {reconciliation.totalCodeshareScheduled > 0 && (
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                {reconciliation.totalCodeshareScheduled} Codeshares
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {reconciliation.missingCount > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadMissingWincmdAnsi(
                  reconciliation.missingItems,
                  reconciliation.manifestDate || reconciliation.scheduleDate
                )
              }
              className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              {pick("WINCMD manquants (.txt ANSI)", "Missing WINCMD (.txt ANSI)")}
            </button>
          )}

          <button
            type="button"
            onClick={() => exportReconciliationToExcel(reconciliation, undefined, language)}
            className="px-3.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            {pick("Excel", "Excel")}
          </button>

          <label className="px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            {pick("Changer programme", "Change schedule")}
            <input
              type="file"
              accept=".txt,.csv,.log"
              onChange={handleUploadSchedule}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 4 Reconciliation KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-3.5">
          <div className="text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
            {pick("Couverture KP", "KP Coverage")}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1">
            {reconciliation.coveragePercent}%
          </div>
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono mt-0.5">
            {reconciliation.matchedCount} / {reconciliation.totalKpScheduled}
          </div>
        </div>

        <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-3.5">
          <div className="text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
            {pick("Importés", "Imported")}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {reconciliation.matchedCount}
          </div>
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
            {pick("Analysés", "Analyzed")}
          </div>
        </div>

        <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-3.5">
          <div className="text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
            {pick("Manquants", "Missing")}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">
            {reconciliation.missingCount}
          </div>
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
            WINCMD
          </div>
        </div>

        <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-3.5">
          <div className="text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
            {pick("Hors Programme", "Unscheduled")}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#8C5214] dark:text-[#F7BA42] mt-1">
            {reconciliation.extraCount}
          </div>
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
            {pick("Manifeste seul", "Manifest only")}
          </div>
        </div>
      </div>
        </div>
      </CollapsiblePanel>

      {/* Collapsible Filters */}
      <CollapsiblePanel
        title={pick("Filtres de Rapprochement & Recherche", "Reconciliation Filters & Search")}
        subtitle={pick(
          `Statut : ${statusFilter} · ${filteredItems.length} vol(s) affiché(s)`,
          `Status: ${statusFilter} · ${filteredItems.length} flight(s) shown`
        )}
        icon={<Search className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={false}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: "ALL" as const,
              label: pick(
                `Tous KP (${reconciliation.items.length})`,
                `All KP (${reconciliation.items.length})`
              ),
            },
            {
              id: "MISSING_IN_MANIFEST" as const,
              label: pick(
                `Manquants (${reconciliation.missingCount})`,
                `Missing (${reconciliation.missingCount})`
              ),
            },
            {
              id: "IMPORTED" as const,
              label: pick(
                `Importés (${reconciliation.matchedCount})`,
                `Imported (${reconciliation.matchedCount})`
              ),
            },
            {
              id: "EXTRA_IN_MANIFEST" as const,
              label: pick(
                `Hors Programme (${reconciliation.extraCount})`,
                `Unscheduled (${reconciliation.extraCount})`
              ),
            },
            {
              id: "CODESHARE_INFO" as const,
              label: pick(
                `Codeshares Info (${reconciliation.totalCodeshareScheduled})`,
                `Codeshares Info (${reconciliation.totalCodeshareScheduled})`
              ),
            },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                statusFilter === opt.id
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                  : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={pick("Vol, origine, destination...", "Flight, origin, destination...")}
            className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
          />
        </div>
        </div>
      </CollapsiblePanel>

      {/* Reconciliation Table */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6E472B] dark:text-[#DECAB1]">
            {pick(
              "Aucun vol ne correspond au filtre sélectionné.",
              "No flights match the selected filter."
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] border-b border-[#321B0A] dark:border-[#5C351B] text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 pl-5 pr-3">{pick("Statut Contrôle", "Audit Status")}</th>
                  <th className="py-3 px-3">{pick("Vol & Station Départ", "Flight & Departure Station")}</th>
                  <th className="py-3 px-3">{pick("Tronçon Programme (Liste Vols)", "Scheduled Sector (VDS)")}</th>
                  <th className="py-3 px-3">{pick("Manifeste & Destinations Pax", "Manifest & Pax Destinations")}</th>
                  <th className="py-3 px-3">{pick("Charge (Pax / Bagages)", "Load (Pax / Baggage)")}</th>
                  <th className="py-3 pr-5 pl-3 text-right">{pick("Action", "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                {filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.status === "MISSING_IN_MANIFEST"
                        ? idx % 2 === 0
                          ? "bg-rose-50/55 dark:bg-rose-950/35 hover:bg-rose-100/65 dark:hover:bg-rose-950/55 border-l-4 border-l-rose-500"
                          : "bg-rose-100/45 dark:bg-rose-950/45 hover:bg-rose-100/75 dark:hover:bg-rose-950/65 border-l-4 border-l-rose-500"
                        : idx % 2 === 0
                        ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                        : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                    }`}
                  >
                    <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                      {item.status === "IMPORTED" && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          {pick("Importé & Analysé", "Imported & Analyzed")}
                        </span>
                      )}
                      {item.status === "MISSING_IN_MANIFEST" && (
                        <span className="inline-flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {pick("Manquant dans Manifeste", "Missing in Manifest")}
                        </span>
                      )}
                      {item.status === "EXTRA_IN_MANIFEST" && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                          {pick(
                            `Hors Programme (${item.manifestDate})`,
                            `Unscheduled (${item.manifestDate})`
                          )}
                        </span>
                      )}
                      {item.status === "CODESHARE_INFO" && (
                        <span className="text-[#6E472B] dark:text-[#DECAB1] font-medium">
                          {pick("Codeshare (Informatif)", "Codeshare (Info)")}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                      KP {item.flightNumber} ·{" "}
                      <span className="text-[#6E472B] dark:text-[#DECAB1]">
                        {item.scheduledDate || item.manifestDate || "—"}
                      </span>{" "}
                      · {pick("Départ", "Dep.")}{" "}
                      <span className="text-[#8C5214] dark:text-[#F7BA42]">{item.origin}</span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[#6E472B] dark:text-[#DECAB1] tabular-nums whitespace-nowrap">
                      {item.segment ? (
                        <div>
                          <span className="font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
                            {item.origin} → {item.destination}
                          </span>{" "}
                          <span className="text-[#6E472B] dark:text-[#DECAB1]">
                            ({item.scheduledDep || "--:--"}/{item.scheduledArr || "--:--"} · {item.scheduledDate})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#8C5214]/70 dark:text-[#DECAB1]/70">
                          {pick("Absent de la liste des vols", "Not in flight schedule")}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono text-[#4C2812] dark:text-[#F3E9D8] tabular-nums">
                      {item.manifestFlight ? (
                        <div>
                          <div>
                            {item.manifestDep} · {item.aircraftType} (
                            {item.isPureEconomy
                              ? pick(`Pure Éco ${item.configRaw}`, `All-Economy ${item.configRaw}`)
                              : item.configRaw || "—"}
                            ) · {item.manifestDate}
                          </div>
                          {item.manifestDestinationsSummary && (
                            <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                              Pax → {item.manifestDestinationsSummary}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-[#6E472B] dark:text-[#DECAB1]">{pick("Non importé", "Not imported")}</span>
                          {item.otherOriginsInManifest && (
                            <div className="text-[11px] text-[#8C5214] dark:text-[#F7BA42]">
                              {pick(
                                `Vol KP ${item.flightNumber} trouvé au départ de : ${item.otherOriginsInManifest.join(", ")}`,
                                `Flight KP ${item.flightNumber} found departing from: ${item.otherOriginsInManifest.join(", ")}`
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap text-[#321B0A] dark:text-[#FAF7F2]">
                      {item.manifestFlight ? (
                        <div>
                          <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                            {item.passengersCount} pax
                          </span>{" "}
                          <span className="text-[#6E472B] dark:text-[#DECAB1]">
                            ({item.businessCount}C / {item.economyCount}Y)
                          </span>{" "}
                          · {item.bagsCount} pcs ({item.totalWeight} kg)
                        </div>
                      ) : (
                        <span className="text-[#8C5214]/60 dark:text-[#DECAB1]/60">—</span>
                      )}
                    </td>

                    <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
                      {item.manifestFlight ? (
                        <button
                          type="button"
                          onClick={() => onInspectFlight(item.manifestFlight!.id)}
                          className="text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {pick("Voir le manifeste", "View manifest")}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : item.wincmdMissing ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyWincmd(item.wincmdMissing!, item.id)
                          }
                          className="px-2.5 py-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] font-mono text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          title={item.wincmdMissing}
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              {pick("WINCMD copié", "WINCMD copied")}
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              {pick("Copier WINCMD", "Copy WINCMD")}
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[#8C5214]/60 dark:text-[#DECAB1]/60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
