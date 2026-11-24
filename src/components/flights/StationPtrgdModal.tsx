/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Calendar,
  Check,
  Copy,
  Database,
  Download,
  Globe,
  Plus,
  RotateCcw,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import {
  AirportStationRecord,
  StationScope,
  deleteStationFromDb,
  getAllStationsFromDb,
  resetStationsInDb,
  upsertStationInDb,
} from "../../utils/manifestDb";
import {
  downloadStationsPtrgdAnsi,
  formatDcsDateToIso,
  formatIsoDateToDcs,
  generateStationsPtrgdText,
  getTodayDcsDate,
  normalizeDcsScheduleDate,
} from "../../utils/flightParser";
import { useLanguage } from "../../context/LanguageContext";

interface StationPtrgdModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDcsDate?: string;
  stations?: AirportStationRecord[];
  onStationsUpdated?: (stations: AirportStationRecord[]) => void;
}

type ModalTab = "commands" | "database";
type ScopeFilter = "KP_OPERATED" | "ALL" | "CODESHARE";

export const StationPtrgdModal: React.FC<StationPtrgdModalProps> = ({
  isOpen,
  onClose,
  initialDcsDate,
  stations: externalStations,
  onStationsUpdated,
}) => {
  const { pick } = useLanguage();
  const [activeTab, setActiveTab] = useState<ModalTab>("commands");
  const [internalStations, setInternalStations] = useState<AirportStationRecord[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);

  const stations = externalStations ?? internalStations;

  const updateStations = (next: AirportStationRecord[]) => {
    setInternalStations(next);
    onStationsUpdated?.(next);
  };

  // Date state (DCS format DDMMM + synchronized ISO YYYY-MM-DD)
  const [dcsDate, setDcsDate] = useState<string>(() =>
    normalizeDcsScheduleDate(initialDcsDate || getTodayDcsDate())
  );
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("KP_OPERATED");
  const [copied, setCopied] = useState(false);
  const [dbSearch, setDbSearch] = useState("");
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  // Add new station form state
  const [newCode, setNewCode] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newScope, setNewScope] = useState<StationScope>("KP_OPERATED");
  const [isSavingStation, setIsSavingStation] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialDcsDate && /^\d{1,2}[A-Z]{3}/i.test(initialDcsDate.trim())) {
      setDcsDate(normalizeDcsScheduleDate(initialDcsDate));
    }
  }, [isOpen, initialDcsDate]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoadingStations(true);
    getAllStationsFromDb()
      .then((list) => {
        if (active) updateStations(list);
      })
      .finally(() => {
        if (active) setIsLoadingStations(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const normalizedDate = normalizeDcsScheduleDate(dcsDate);
  const isDateValid = /^\d{2}[A-Z]{3}$/.test(normalizedDate);
  const isoDateValue = useMemo(
    () => (isDateValid ? formatDcsDateToIso(normalizedDate) : ""),
    [normalizedDate, isDateValid]
  );

  const kpActiveStations = useMemo(
    () => stations.filter((s) => s.active && s.scope === "KP_OPERATED"),
    [stations]
  );
  const codeshareActiveStations = useMemo(
    () => stations.filter((s) => s.active && s.scope === "CODESHARE"),
    [stations]
  );
  const allActiveStations = useMemo(
    () => stations.filter((s) => s.active),
    [stations]
  );

  const targetStations = useMemo(() => {
    if (scopeFilter === "KP_OPERATED") return kpActiveStations;
    if (scopeFilter === "CODESHARE") return codeshareActiveStations;
    return allActiveStations;
  }, [scopeFilter, kpActiveStations, codeshareActiveStations, allActiveStations]);

  const targetCodes = useMemo(
    () => targetStations.map((s) => s.code),
    [targetStations]
  );

  const { commands, text, count } = useMemo(
    () => generateStationsPtrgdText(targetCodes, normalizedDate),
    [targetCodes, normalizedDate]
  );

  const filteredDbStations = useMemo(() => {
    const q = dbSearch.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q)
    );
  }, [stations, dbSearch]);

  const handleCalendarChange = (iso: string) => {
    const converted = formatIsoDateToDcs(iso);
    if (converted) setDcsDate(converted);
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAnsi = () => {
    if (!isDateValid || targetCodes.length === 0) return;
    const prefix =
      scopeFilter === "KP_OPERATED"
        ? "WINCMD_PTRGD_RESEAU_KP"
        : scopeFilter === "CODESHARE"
        ? "WINCMD_PTRGD_CODESHARE"
        : "WINCMD_PTRGD_TOUTES_STATIONS";
    downloadStationsPtrgdAnsi(targetCodes, normalizedDate, prefix);
  };

  const handleToggleStationActive = async (station: AirportStationRecord) => {
    setDbError(null);
    setDbMessage(null);
    try {
      const updated = await upsertStationInDb({
        ...station,
        active: !station.active,
      });
      updateStations(updated);
    } catch (err) {
      setDbError(
        err instanceof Error ? err.message : pick("Erreur lors de la mise à jour.", "Update failed.")
      );
    }
  };

  const handleToggleStationScope = async (station: AirportStationRecord) => {
    setDbError(null);
    setDbMessage(null);
    try {
      const updated = await upsertStationInDb({
        ...station,
        scope: station.scope === "KP_OPERATED" ? "CODESHARE" : "KP_OPERATED",
      });
      updateStations(updated);
    } catch (err) {
      setDbError(
        err instanceof Error ? err.message : pick("Erreur lors de la mise à jour.", "Update failed.")
      );
    }
  };

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbError(null);
    setDbMessage(null);
    const cleanCode = newCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cleanCode)) {
      setDbError(
        pick(
          "Le code IATA de la station doit comporter exactement 3 lettres (ex : LFW).",
          "Station IATA code must be exactly 3 letters (e.g. LFW)."
        )
      );
      return;
    }
    setIsSavingStation(true);
    try {
      const updated = await upsertStationInDb({
        code: cleanCode,
        city: newCity.trim() || cleanCode,
        country: newCountry.trim() || "—",
        isHub: cleanCode === "LFW",
        scope: newScope,
        active: true,
        source: "MANUAL",
      });
      updateStations(updated);
      setNewCode("");
      setNewCity("");
      setNewCountry("");
      setDbMessage(
        pick(
          `Station ${cleanCode} enregistrée dans la base locale.`,
          `Station ${cleanCode} saved to local database.`
        )
      );
    } catch (err) {
      setDbError(
        err instanceof Error ? err.message : pick("Erreur d'ajout.", "Failed to add station.")
      );
    } finally {
      setIsSavingStation(false);
    }
  };

  const handleDeleteStation = async (code: string) => {
    setDbError(null);
    setDbMessage(null);
    try {
      const updated = await deleteStationFromDb(code);
      updateStations(updated);
      setDbMessage(
        pick(`Station ${code} supprimée.`, `Station ${code} deleted.`)
      );
    } catch (err) {
      setDbError(
        err instanceof Error ? err.message : pick("Erreur de suppression.", "Delete failed.")
      );
    }
  };

  const handleResetStations = async () => {
    setDbError(null);
    setDbMessage(null);
    try {
      const updated = await resetStationsInDb();
      updateStations(updated);
      setDbMessage(
        pick(
          `Table réinitialisée avec les ${updated.length} stations issues des vols étudiés.`,
          `Table reset with ${updated.length} studied stations.`
        )
      );
    } catch (err) {
      setDbError(
        err instanceof Error ? err.message : pick("Erreur de réinitialisation.", "Reset failed.")
      );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="station-ptgrd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1209]/65 dark:bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            key="station-ptgrd-panel"
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 360, damping: 28, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#1F1209] w-full max-w-5xl rounded-3xl shadow-2xl shadow-black/40 border border-[#E6D7C3] dark:border-[#5C351B] overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#4C2812] via-[#E89C1D] to-[#4C2812] shrink-0" />

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#E6D7C3] dark:border-[#4C2812] flex flex-wrap items-center justify-between gap-4 bg-[#FAF7F2] dark:bg-[#28170C]">
              <div className="flex items-center gap-3">
                <div className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] p-2.5 rounded-2xl shadow-sm shrink-0">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#321B0A] dark:text-[#FAF7F2] leading-snug">
                    {pick(
                      "Extraction des Vols par Station (PTRGD*)",
                      "Station Flight Extraction (PTRGD*)"
                    )}
                  </h3>
                  <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                    {pick(
                      "Alternative lorsque VDS/date est indisponible sur date antérieure · Format ",
                      "Fallback when VDS/date is unavailable on past dates · Format "
                    )}
                    <code className="font-mono font-bold text-[#4C2812] dark:text-[#F7BA42]">
                      WINCMD(&quot;PTRGD*LFW/{isDateValid ? normalizedDate : "21NOV"}/T0000-2359/ALL‡A&quot;)
                    </code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Tab switcher */}
                <div className="inline-flex bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("commands")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "commands"
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                        : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{pick("Commandes WINCMD", "WINCMD Commands")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("database")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "database"
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                        : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {pick(`Base Stations (${stations.length})`, `Stations DB (${stations.length})`)}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label={pick("Fermer", "Close")}
                  className="text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] p-2 rounded-xl hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            {activeTab === "commands" ? (
              <>
                {/* Controls Bar */}
                <div className="p-6 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#1F1209] space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    {/* Date Inputs (Calendar + DDMMM) */}
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1.5">
                          {pick("Calendrier", "Calendar")}
                        </label>
                        <div className="relative flex items-center">
                          <Calendar className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 pointer-events-none" />
                          <input
                            type="date"
                            value={isoDateValue}
                            onChange={(e) => handleCalendarChange(e.target.value)}
                            className="pl-9 pr-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1.5">
                          {pick("Date DCS (JJMMM)", "DCS Date (DDMMM)")}
                        </label>
                        <input
                          type="text"
                          maxLength={7}
                          value={dcsDate}
                          onChange={(e) => setDcsDate(e.target.value.toUpperCase())}
                          placeholder="21NOV"
                          className={`w-28 px-3 py-2 rounded-xl border font-mono text-xs font-bold uppercase focus:outline-none focus:ring-2 tabular-nums ${
                            isDateValid
                              ? "border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-[#321B0A] dark:text-[#FAF7F2] focus:ring-[#E89C1D]"
                              : "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 focus:ring-rose-500"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Scope Segmented Buttons */}
                    <div>
                      <span className="block text-xs font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1.5">
                        {pick("Périmètre des stations actives", "Active Stations Scope")}
                      </span>
                      <div className="inline-flex bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-1 rounded-xl text-xs">
                        <button
                          type="button"
                          onClick={() => setScopeFilter("KP_OPERATED")}
                          className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                            scopeFilter === "KP_OPERATED"
                              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                              : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42] font-medium"
                          }`}
                        >
                          {pick(
                            `Réseau KP (${kpActiveStations.length})`,
                            `KP Network (${kpActiveStations.length})`
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScopeFilter("ALL")}
                          className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                            scopeFilter === "ALL"
                              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                              : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42] font-medium"
                          }`}
                        >
                          {pick(
                            `Toutes les stations (${allActiveStations.length})`,
                            `All stations (${allActiveStations.length})`
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScopeFilter("CODESHARE")}
                          className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                            scopeFilter === "CODESHARE"
                              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                              : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42] font-medium"
                          }`}
                        >
                          {pick(
                            `Partenaires (${codeshareActiveStations.length})`,
                            `Partners (${codeshareActiveStations.length})`
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Clean Metadata Row (No Pills) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E472B] dark:text-[#DECAB1] pt-1">
                    <div className="flex flex-wrap items-center gap-2 tabular-nums">
                      <span className="font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
                        {count} {pick("commandes générées", "commands generated")}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {pick("Base locale IndexedDB", "IndexedDB stations table")} ({stations.length})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {pick("Encodage ANSI Windows-1252 (‡ = 0x87)", "ANSI Windows-1252 (‡ = 0x87)")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("database")}
                      className="text-xs font-semibold text-[#8C5214] dark:text-[#F7BA42] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {pick("Gérer / Ajouter une station →", "Manage / Add station →")}
                    </button>
                  </div>

                  {!isDateValid && (
                    <div className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                      {pick(
                        "Veuillez saisir une date valide au format JJMMM (exemple : 21NOV) ou choisir un jour dans le calendrier.",
                        "Please enter a valid DDMMM date (e.g. 21NOV) or pick a date from the calendar."
                      )}
                    </div>
                  )}
                </div>

                {/* Terminal Command Preview */}
                <div className="p-6 flex-1 overflow-auto bg-[#231206] font-mono text-xs text-[#FAF7F2] min-h-[240px]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#4C2812] text-[#F3E9D8]">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">
                        {pick("Aperçu du fichier ANSI généré", "Generated ANSI file preview")}
                      </span>
                      <span className="text-[#F7BA42] tabular-nums">
                        · {commands.length} {pick("ligne(s)", "line(s)")}
                      </span>
                    </div>
                    <span className="tabular-nums text-[#DECAB1]">
                      {pick("Date :", "Date:")} {isDateValid ? normalizedDate : "—"}
                    </span>
                  </div>
                  {isLoadingStations ? (
                    <div className="py-10 text-center text-[#DECAB1]">
                      {pick("Chargement de la table stations...", "Loading stations table...")}
                    </div>
                  ) : commands.length === 0 ? (
                    <div className="py-10 text-center text-[#DECAB1]">
                      {pick(
                        "Aucune commande à générer. Vérifiez la date ou activez au moins une station dans la base.",
                        "No commands to generate. Check date or enable at least one station in the DB."
                      )}
                    </div>
                  ) : (
                    <pre className="whitespace-pre overflow-x-auto leading-relaxed select-all">
                      {text}
                    </pre>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] tabular-nums">
                    {targetStations.length > 0 && (
                      <span>
                        {pick("Stations incluses :", "Included stations:")}{" "}
                        <strong className="text-[#321B0A] dark:text-[#FAF7F2] font-mono">
                          {targetCodes.slice(0, 8).join(", ")}
                          {targetCodes.length > 8 ? ` +${targetCodes.length - 8}` : ""}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!text}
                      className="px-4 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-45 text-[#4C2812] dark:text-[#FAF7F2] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copied ? pick("Copié !", "Copied!") : pick("Copier", "Copy")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadAnsi}
                      disabled={!isDateValid || commands.length === 0}
                      className="px-4 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#d48b13] disabled:opacity-45 text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {pick(
                          `Télécharger Fichier Stations ANSI (.txt)`,
                          `Download Stations ANSI File (.txt)`
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Stations Database Management Tab */
              <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#1F1209]">
                {/* Add Station Form + Search + Reset */}
                <div className="p-6 border-b border-[#E6D7C3] dark:border-[#4C2812] space-y-4">
                  <form
                    onSubmit={handleAddStation}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                  >
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1">
                        {pick("Code IATA", "IATA Code")}
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                        placeholder="LFW"
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] font-mono text-xs font-bold uppercase text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1">
                        {pick("Ville / Escales", "City")}
                      </label>
                      <input
                        type="text"
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        placeholder={pick("ex : Lomé", "e.g. Lomé")}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-xs text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1">
                        {pick("Pays", "Country")}
                      </label>
                      <input
                        type="text"
                        value={newCountry}
                        onChange={(e) => setNewCountry(e.target.value)}
                        placeholder={pick("ex : Togo", "e.g. Togo")}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-xs text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1">
                        {pick("Réseau", "Network")}
                      </label>
                      <select
                        value={newScope}
                        onChange={(e) => setNewScope(e.target.value as StationScope)}
                        className="w-full px-2.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                      >
                        <option value="KP_OPERATED">{pick("Réseau KP", "KP Operated")}</option>
                        <option value="CODESHARE">{pick("Codeshare", "Codeshare")}</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={isSavingStation}
                        className="w-full px-3 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#d48b13] text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{pick("Ajouter", "Add")}</span>
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[220px] max-w-sm">
                      <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={dbSearch}
                        onChange={(e) => setDbSearch(e.target.value)}
                        placeholder={pick(
                          "Rechercher code, ville ou pays...",
                          "Search code, city or country..."
                        )}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-xs text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                      />
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[#6E472B] dark:text-[#DECAB1] tabular-nums">
                        {kpActiveStations.length} KP · {codeshareActiveStations.length}{" "}
                        {pick("partenaires actifs", "active partners")}
                      </span>
                      <button
                        type="button"
                        onClick={handleResetStations}
                        className="px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{pick("Réinitialiser (40)", "Reset Defaults (40)")}</span>
                      </button>
                    </div>
                  </div>

                  {dbError && (
                    <div className="text-xs font-medium text-rose-700 dark:text-rose-300">
                      {dbError}
                    </div>
                  )}
                  {dbMessage && (
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {dbMessage}
                    </div>
                  )}
                </div>

                {/* Stations Table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#FAF7F2] dark:bg-[#28170C] border-b border-[#E6D7C3] dark:border-[#4C2812] text-[#4C2812] dark:text-[#F7BA42] z-10">
                      <tr>
                        <th className="py-2.5 px-4 font-bold">{pick("Code", "Code")}</th>
                        <th className="py-2.5 px-4 font-bold">{pick("Ville", "City")}</th>
                        <th className="py-2.5 px-4 font-bold">{pick("Pays", "Country")}</th>
                        <th className="py-2.5 px-4 font-bold">{pick("Réseau", "Network")}</th>
                        <th className="py-2.5 px-4 font-bold">
                          {pick("Commande aperçu", "Command preview")}
                        </th>
                        <th className="py-2.5 px-4 font-bold text-center">
                          {pick("Inclus", "Included")}
                        </th>
                        <th className="py-2.5 px-4 font-bold text-right">
                          {pick("Action", "Action")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                      {filteredDbStations.map((st) => (
                        <tr
                          key={st.code}
                          className={`hover:bg-[#FAF7F2]/70 dark:hover:bg-[#28170C]/60 transition-colors ${
                            !st.active ? "opacity-55" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                            {st.code}
                            {st.isHub && (
                              <span className="ml-1.5 text-[11px] font-sans font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                                (Hub)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-[#321B0A] dark:text-[#FAF7F2] font-medium">
                            {st.city}
                          </td>
                          <td className="py-2.5 px-4 text-[#6E472B] dark:text-[#DECAB1]">
                            {st.country}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleStationScope(st)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:underline cursor-pointer"
                              title={pick("Cliquer pour basculer KP / Codeshare", "Click to toggle KP / Codeshare")}
                            >
                              <Globe className="w-3 h-3" />
                              <span>
                                {st.scope === "KP_OPERATED"
                                  ? pick("Réseau KP", "KP Network")
                                  : pick("Codeshare", "Codeshare")}
                              </span>
                            </button>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-[#6E472B] dark:text-[#DECAB1] whitespace-nowrap">
                            PTRGD*{st.code}/{isDateValid ? normalizedDate : "21NOV"}/T0000-2359/ALL‡A
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleStationActive(st)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                st.active
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700"
                              }`}
                            >
                              {st.active ? pick("Actif", "Active") : pick("Exclu", "Excluded")}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteStation(st.code)}
                              aria-label={pick(`Supprimer ${st.code}`, `Delete ${st.code}`)}
                              className="p-1.5 rounded-lg text-[#6E472B] dark:text-[#DECAB1] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer in DB tab */}
                <div className="px-6 py-4 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#6E472B] dark:text-[#DECAB1]">
                    {pick(
                      "Les modifications sont sauvegardées automatiquement dans IndexedDB.",
                      "Changes are saved automatically in IndexedDB."
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("commands")}
                    className="px-4 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {pick("Voir les commandes générées", "View generated commands")}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
