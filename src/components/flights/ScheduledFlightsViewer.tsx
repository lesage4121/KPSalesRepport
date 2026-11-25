/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Upload, 
  FileText, 
  Terminal, 
  Search, 
  Filter, 
  Plane, 
  RotateCcw, 
  Copy, 
  Check, 
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Globe,
  Layers,
  AlertTriangle,
  Eye,
  Trash2,
  Pencil,
  Database,
  Download,
} from "lucide-react";
import {
  FlightScheduleParseResult,
  FlightSegment,
  FlightStatusDetail,
} from "../../types";
import {
  downloadPtrgDetailCommandsAnsi,
  enrichScheduleResultWithStatusDetails,
  generatePtrgDetailCommands,
  loadStoredFlightStatusDetails,
  mergeFlightStatusDetails,
  parseFlightStatusFile,
  removeFlightStatusDetailById,
  resolveFlightStatusDetail,
  saveStoredFlightStatusDetails,
  upsertFlightStatusDetail,
} from "../../utils/flightStatusParser";
import {
  downloadStationsPtrgdAnsi,
  formatDcsDateToIso,
  formatIsoDateToDcs,
  getTodayDcsDate,
  normalizeDcsScheduleDate,
} from "../../utils/flightParser";
import {
  AirportStationRecord,
  getAllStationsFromDb,
} from "../../utils/manifestDb";
import { WincmdExportModal } from "./WincmdExportModal";
import { StationPtrgdModal } from "./StationPtrgdModal";
import { FlightStatusDetailModal } from "./FlightStatusDetailModal";
import { FlightEquipmentEditModal } from "./FlightEquipmentEditModal";
import {
  ScheduleImportProgressCard,
  useSimulatedScheduleImport,
} from "./ScheduleImportProgress";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { FilterOptionField, FilterOptionItem } from "./FilterOptionField";
import { useLanguage } from "../../context/LanguageContext";

interface ScheduledFlightsViewerProps {
  initialText?: string;
  scheduleData?: FlightScheduleParseResult | null;
  onScheduleLoaded?: (data: FlightScheduleParseResult | null) => void;
  flightStatusDetails?: FlightStatusDetail[];
  onFlightStatusLoaded?: (details: FlightStatusDetail[]) => void;
  onUpsertFlightStatusDetail?: (detail: FlightStatusDetail) => void;
  onRemoveManualFlightStatusDetail?: (id: string) => void;
}

export const ScheduledFlightsViewer: React.FC<ScheduledFlightsViewerProps> = ({
  scheduleData: controlledScheduleData,
  onScheduleLoaded,
  flightStatusDetails: controlledStatusDetails,
  onFlightStatusLoaded,
  onUpsertFlightStatusDetail,
  onRemoveManualFlightStatusDetail,
}) => {
  const { language, pick } = useLanguage();
  const [rawContent, setRawContent] = useState<string>("");
  const [internalParsedData, setInternalParsedData] = useState<FlightScheduleParseResult | null>(null);
  const [internalStatusDetails, setInternalStatusDetails] = useState<FlightStatusDetail[]>(() =>
    loadStoredFlightStatusDetails()
  );
  const rawParsedData = controlledScheduleData !== undefined ? controlledScheduleData : internalParsedData;
  const statusDetails =
    controlledStatusDetails !== undefined ? controlledStatusDetails : internalStatusDetails;
  const parsedData = useMemo(
    () => enrichScheduleResultWithStatusDetails(rawParsedData, statusDetails),
    [rawParsedData, statusDetails]
  );

  const updateParsedData = (data: FlightScheduleParseResult | null) => {
    if (onScheduleLoaded) {
      onScheduleLoaded(data);
    } else {
      setInternalParsedData(data);
    }
  };

  const updateStatusDetails = (details: FlightStatusDetail[]) => {
    saveStoredFlightStatusDetails(details);
    if (onFlightStatusLoaded) {
      onFlightStatusLoaded(details);
    } else {
      setInternalStatusDetails(details);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    simulation,
    importFromFile,
  } = useSimulatedScheduleImport({
    onComplete: (parsed, text) => {
      setImportError(null);
      setRawContent(text);
      updateParsedData(parsed);
    },
    onError: (message) => {
      setImportError(message);
    },
  });
  
  // Filters
  const [carrierFilter, setCarrierFilter] = useState<"KP" | "ALL" | "CODESHARE">("KP");
  const [searchTerm, setSearchTerm] = useState("");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [destinationFilter, setDestinationFilter] = useState("ALL");
  const [registrationFilter, setRegistrationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ptrgStatusFilter, setPtrgStatusFilter] = useState<
    "ALL" | "PDC" | "NON_PDC" | "MISSING_PTRG"
  >("ALL");
  const [segmentFilter, setSegmentFilter] = useState<"ALL" | "MAIN" | "SUB">("ALL");

  // Modals & Stations DB
  const [isWincmdModalOpen, setIsWincmdModalOpen] = useState(false);
  const [isStationPtrgdModalOpen, setIsStationPtrgdModalOpen] = useState(false);
  const [stations, setStations] = useState<AirportStationRecord[]>([]);
  const [quickPtrgdDate, setQuickPtrgdDate] = useState<string>(() => getTodayDcsDate());
  const [quickPtrgdScope, setQuickPtrgdScope] = useState<"KP_OPERATED" | "ALL">("KP_OPERATED");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedDetailSegment, setSelectedDetailSegment] = useState<FlightSegment | null>(null);
  const [editingEquipmentSegment, setEditingEquipmentSegment] = useState<FlightSegment | null>(null);

  useEffect(() => {
    let active = true;
    getAllStationsFromDb().then((list) => {
      if (active) setStations(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const activeKpStations = useMemo(
    () => stations.filter((s) => s.active && s.scope === "KP_OPERATED"),
    [stations]
  );
  const activeAllStations = useMemo(
    () => stations.filter((s) => s.active),
    [stations]
  );
  const quickNormalizedDate = normalizeDcsScheduleDate(quickPtrgdDate);
  const isQuickDateValid = /^\d{2}[A-Z]{3}$/.test(quickNormalizedDate);
  const quickTargetStations =
    quickPtrgdScope === "KP_OPERATED" ? activeKpStations : activeAllStations;

  const handleQuickPtrgdDownload = () => {
    if (!isQuickDateValid || quickTargetStations.length === 0) return;
    downloadStationsPtrgdAnsi(
      quickTargetStations.map((s) => s.code),
      quickNormalizedDate,
      quickPtrgdScope === "KP_OPERATED"
        ? "WINCMD_PTRGD_RESEAU_KP"
        : "WINCMD_PTRGD_TOUTES_STATIONS"
    );
  };

  const handleSaveEquipmentDetail = (updated: FlightStatusDetail) => {
    if (onUpsertFlightStatusDetail) {
      onUpsertFlightStatusDetail(updated);
    } else {
      updateStatusDetails(upsertFlightStatusDetail(statusDetails, updated));
    }
    setStatusFeedback({
      type: "success",
      message: pick(
        `Équipement mis à jour pour KP${updated.flightNumber} (${updated.date} · ${updated.origin}) : ${updated.aircraftType}${updated.registration ? "/" + updated.registration : ""} · ${updated.totalCapacity} sièges.`,
        `Equipment updated for KP${updated.flightNumber} (${updated.date} · ${updated.origin}): ${updated.aircraftType}${updated.registration ? "/" + updated.registration : ""} · ${updated.totalCapacity} seats.`
      ),
    });
  };

  const handleRemoveManualEquipmentDetail = (id: string) => {
    if (onRemoveManualFlightStatusDetail) {
      onRemoveManualFlightStatusDetail(id);
    } else {
      updateStatusDetails(removeFlightStatusDetailById(statusDetails, id));
    }
  };

  // Handle uploaded text file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || simulation.isLoading) return;
    setImportError(null);
    importFromFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || simulation.isLoading) return;
    setImportError(null);
    importFromFile(file);
  };

  // Base segments matching all criteria except ptrgStatusFilter & registrationFilter
  const baseFilteredSegments = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.segments.filter((s) => {
      // 1. Filtrer par opérateur (Vols opérés par KP par défaut)
      if (carrierFilter === "KP" && !s.isKpOperated) return false;
      if (carrierFilter === "CODESHARE" && s.isKpOperated) return false;

      // 2. Recherche textuelle (y compris immatriculation / type appareil si connu)
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesFlt = s.flightNumber.toLowerCase().includes(q);
        const matchesOrigin = s.origin.toLowerCase().includes(q);
        const matchesDest = s.destination.toLowerCase().includes(q);
        const matchesWincmd = s.wincmd.toLowerCase().includes(q);
        const res = resolveFlightStatusDetail(s.flightNumber, s.date, s.origin, statusDetails);
        const matchesReg = (res.detail?.registration || "").toLowerCase().includes(q);
        const matchesType = (res.detail?.aircraftType || "").toLowerCase().includes(q);
        if (!matchesFlt && !matchesOrigin && !matchesDest && !matchesWincmd && !matchesReg && !matchesType) {
          return false;
        }
      }

      // 3. Autres critères
      if (originFilter !== "ALL" && s.origin !== originFilter) return false;
      if (destinationFilter !== "ALL" && s.destination !== destinationFilter) return false;
      if (statusFilter === "INITIAL" && s.hasSystemAdjustment) return false;
      if (statusFilter === "AJUSTE" && !s.hasSystemAdjustment) return false;
      if (segmentFilter === "MAIN" && s.isSubSegment) return false;
      if (segmentFilter === "SUB" && !s.isSubSegment) return false;
      return true;
    });
  }, [parsedData, carrierFilter, searchTerm, originFilter, destinationFilter, statusFilter, segmentFilter, statusDetails]);

  const ptrgAndRegSummary = useMemo(() => {
    let matched = 0;
    let pdc = 0;
    let nonPdc = 0;
    let missing = 0;
    let missingReg = 0;
    const regCounts = new Map<string, number>();

    for (const seg of baseFilteredSegments) {
      const res = resolveFlightStatusDetail(
        seg.flightNumber,
        seg.date,
        seg.origin,
        statusDetails
      );
      const reg = (res.detail?.registration || "").trim().toUpperCase();
      if (!reg) {
        missingReg += 1;
      } else {
        regCounts.set(reg, (regCounts.get(reg) || 0) + 1);
      }

      if (!res.detail || res.detail.isManualOnly) {
        missing += 1;
      } else {
        matched += 1;
        if ((res.resolvedStatus || "").trim().toUpperCase() === "PDC") {
          pdc += 1;
        } else {
          nonPdc += 1;
        }
      }
    }

    const registrations = Array.from(regCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([reg, count]) => ({ reg, count }));

    return { matched, pdc, nonPdc, missing, missingReg, registrations };
  }, [baseFilteredSegments, statusDetails]);

  const filteredSegments = useMemo(() => {
    if (ptrgStatusFilter === "ALL" && registrationFilter === "ALL") {
      return baseFilteredSegments;
    }
    return baseFilteredSegments.filter((s) => {
      const res = resolveFlightStatusDetail(
        s.flightNumber,
        s.date,
        s.origin,
        statusDetails
      );

      if (registrationFilter !== "ALL") {
        const reg = (res.detail?.registration || "").trim().toUpperCase();
        if (registrationFilter === "MISSING") {
          if (reg) return false;
        } else if (reg !== registrationFilter) {
          return false;
        }
      }

      if (ptrgStatusFilter !== "ALL") {
        if (ptrgStatusFilter === "MISSING_PTRG") {
          return !res.detail || Boolean(res.detail.isManualOnly);
        }
        if (!res.detail || res.detail.isManualOnly) return false;
        const isPdc = (res.resolvedStatus || "").trim().toUpperCase() === "PDC";
        if (ptrgStatusFilter === "PDC" && !isPdc) return false;
        if (ptrgStatusFilter === "NON_PDC" && isPdc) return false;
      }

      return true;
    });
  }, [baseFilteredSegments, ptrgStatusFilter, registrationFilter, statusDetails]);

  // Statistics
  const stats = useMemo(() => {
    if (!parsedData) return null;
    const total = parsedData.segments.length;
    const uniqueFlights = parsedData.uniqueFlightsCount;
    const kpSegments = parsedData.kpOperatedSegmentsCount;
    const codeshareSegments = parsedData.codeshareSegmentsCount;
    const kpUniqueFlights = parsedData.kpUniqueFlightsCount;
    const codeshareUniqueFlights = parsedData.codeshareUniqueFlightsCount;
    const withAdjustments = parsedData.segments.filter(s => s.hasSystemAdjustment).length;
    const withoutAdjustments = total - withAdjustments;

    let kpRegisteredCount = 0;
    let kpPdcCount = 0;
    for (const seg of parsedData.segments) {
      if (!seg.isKpOperated) continue;
      const res = resolveFlightStatusDetail(
        seg.flightNumber,
        seg.date,
        seg.origin,
        statusDetails
      );
      if ((res.detail?.registration || "").trim()) {
        kpRegisteredCount += 1;
      }
      if (
        res.detail &&
        !res.detail.isManualOnly &&
        (res.resolvedStatus || "").trim().toUpperCase() === "PDC"
      ) {
        kpPdcCount += 1;
      }
    }

    return {
      total,
      uniqueFlights,
      kpSegments,
      codeshareSegments,
      kpUniqueFlights,
      codeshareUniqueFlights,
      withAdjustments,
      withoutAdjustments,
      kpRegisteredCount,
      kpPdcCount,
    };
  }, [parsedData, statusDetails]);

  const { originOptions, destinationOptions } = useMemo(() => {
    if (!parsedData) {
      return {
        originOptions: [] as FilterOptionItem[],
        destinationOptions: [] as FilterOptionItem[],
      };
    }
    const origMap = new Map<string, number>();
    const destMap = new Map<string, number>();
    for (const seg of parsedData.segments) {
      if (carrierFilter === "KP" && !seg.isKpOperated) continue;
      if (carrierFilter === "CODESHARE" && seg.isKpOperated) continue;
      origMap.set(seg.origin, (origMap.get(seg.origin) || 0) + 1);
      destMap.set(seg.destination, (destMap.get(seg.destination) || 0) + 1);
    }
    return {
      originOptions: parsedData.origins.map((orig) => ({
        value: orig,
        label: orig,
        count: origMap.get(orig) ?? 0,
      })),
      destinationOptions: parsedData.destinations.map((dest) => ({
        value: dest,
        label: dest,
        count: destMap.get(dest) ?? 0,
      })),
    };
  }, [parsedData, carrierFilter]);

  // Quick single copy
  const handleCopyWincmd = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // PTRG* Flight Details Export & Import handlers
  const ptrgExportSummary = useMemo(
    () => generatePtrgDetailCommands(filteredSegments),
    [filteredSegments]
  );

  const handleDownloadPtrgAnsi = () => {
    if (!parsedData) return;
    const prefix = carrierFilter === "KP" ? "WINCMD_DETAILS_KP" : "WINCMD_DETAILS_TOUS";
    const count = downloadPtrgDetailCommandsAnsi(filteredSegments, parsedData.date, prefix);
    if (count > 0) {
      setStatusFeedback({
        type: "success",
        message: pick(
          `${count} commande(s) WINCMD("PTRG*/...") exportée(s) en ANSI (.txt).`,
          `${count} WINCMD("PTRG*/...") command(s) exported in ANSI (.txt).`
        ),
      });
    }
  };

  const processFlightStatusText = (text: string, sourceLabel: string) => {
    const parsedDetails = parseFlightStatusFile(text);
    if (parsedDetails.length === 0) {
      setStatusFeedback({
        type: "error",
        message: pick(
          `Aucun bloc détail vol valide (G*/KP.../D) détecté dans ${sourceLabel}.`,
          `No valid flight detail block (G*/KP.../D) found in ${sourceLabel}.`
        ),
      });
      return;
    }
    const merged = mergeFlightStatusDetails(statusDetails, parsedDetails);
    updateStatusDetails(merged);
    const enrichedAfter = enrichScheduleResultWithStatusDetails(rawParsedData, merged);
    const filledArrivalCount = enrichedAfter
      ? enrichedAfter.segments.filter((s) => s.arrFromPtrg).length
      : 0;
    const previewRegs = parsedDetails
      .map((d) => `KP${d.flightNumber}: ${d.aircraftType}/${d.registration} (${d.seatsRaw || d.totalCapacity})`)
      .slice(0, 4)
      .join(" · ");
    setStatusFeedback({
      type: "success",
      message: pick(
        `${parsedDetails.length} vol(s) importé(s) (${previewRegs}${parsedDetails.length > 4 ? "..." : ""}).${filledArrivalCount > 0 ? ` ${filledArrivalCount} heure(s) d'arrivée complétée(s) depuis PTRG*.` : ""} Capacités synchronisées avec le Manifeste et l'Analyse.`,
        `${parsedDetails.length} flight detail(s) imported (${previewRegs}${parsedDetails.length > 4 ? "..." : ""}).${filledArrivalCount > 0 ? ` ${filledArrivalCount} arrival time(s) completed from PTRG*.` : ""} Capacities synced with Manifest and Analytics.`
      ),
    });
  };

  const handleUploadFlightStatusFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList: File[] = Array.from(files);
    try {
      const texts = await Promise.all(fileList.map((f) => f.text()));
      const combinedText = texts.join("\n");
      processFlightStatusText(
        combinedText,
        fileList.map((f) => f.name).join(", ")
      );
    } catch {
      setStatusFeedback({
        type: "error",
        message: pick(
          "Impossible de lire le fichier de détails des vols.",
          "Unable to read flight details file."
        ),
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleClearFlightStatusDetails = () => {
    updateStatusDetails([]);
    setStatusFeedback({
      type: "success",
      message: pick(
        "Détails avions et capacités réinitialisés.",
        "Aircraft details and capacities cleared."
      ),
    });
  };

  const matchedSegmentsCount = ptrgAndRegSummary.matched;

  const selectedDetailResolution = useMemo(() => {
    if (!selectedDetailSegment) {
      return { detail: null, resolvedStatus: "", matchLevel: "NONE" as const };
    }
    return resolveFlightStatusDetail(
      selectedDetailSegment.flightNumber,
      selectedDetailSegment.date,
      selectedDetailSegment.origin,
      statusDetails
    );
  }, [selectedDetailSegment, statusDetails]);

  const editingEquipmentResolution = useMemo(() => {
    if (!editingEquipmentSegment) {
      return { detail: null, resolvedStatus: "", matchLevel: "NONE" as const };
    }
    return resolveFlightStatusDetail(
      editingEquipmentSegment.flightNumber,
      editingEquipmentSegment.date,
      editingEquipmentSegment.origin,
      statusDetails
    );
  }, [editingEquipmentSegment, statusDetails]);

  return (
    <div className="space-y-8">
      {/* If no data is loaded yet, show the main upload drop area */}
      {!parsedData ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1F1209] rounded-3xl border border-[#E6D7C3] dark:border-[#4C2812] shadow-xl overflow-hidden p-8 md:p-12">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="inline-flex bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-4 rounded-3xl text-[#4C2812] dark:text-[#F7BA42] shadow-sm">
                <Upload className="w-10 h-10 text-[#E89C1D]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-[#321B0A] dark:text-[#FAF7F2] tracking-tight">
                  {pick(
                    "Programme des Vols (VDS ou GD*)",
                    "Flight Schedule (VDS or GD*)"
                  )}
                </h3>
                <p className="text-[#6E472B] dark:text-[#DECAB1] text-xs leading-relaxed">
                  {pick(
                    "Importez un fichier VDS (SCHEDULED FLIGHTS) ou un fichier GD* par station (DAILY DEPARTURE FLIGHT LIST) pour extraire les vols et commandes WINCMD.",
                    "Import a VDS schedule file or a GD* station departure list file (DAILY DEPARTURE FLIGHT LIST) to extract flights and WINCMD commands."
                  )}
                </p>
              </div>

              {importError && (
                <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-2xl px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Drop Zone or Simulated Loading Progress */}
              {simulation.isLoading ? (
                <ScheduleImportProgressCard simulation={simulation} />
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer relative ${
                    isDragging
                      ? "border-[#E89C1D] bg-[#FDF4E3] dark:bg-[#351F11]"
                      : "border-[#D8C3A5] dark:border-[#5C351B] hover:border-[#4C2812] dark:hover:border-[#E89C1D] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#F5EFE6] dark:hover:bg-[#351F11]"
                  }`}
                >
                  <input
                    type="file"
                    accept=".txt,.log,.vds,.dat"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileText className="w-10 h-10 text-[#E89C1D] mb-2.5" />
                  <p className="text-[#321B0A] dark:text-[#FAF7F2] font-bold text-sm mb-1">
                    {pick(
                      "Glissez-déposez le fichier programme ici ou cliquez",
                      "Drag & drop the schedule file here or click"
                    )}
                  </p>
                  <p className="text-xs text-[#6E472B] dark:text-[#DECAB1]">
                    .txt · .log · .vds · .dat
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Fallback Station PTRGD* Command Extraction Card (for past dates when VDS/date is unavailable) */}
          <div className="bg-white dark:bg-[#1F1209] rounded-3xl border border-[#E6D7C3] dark:border-[#4C2812] p-6 md:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                  <Terminal className="w-4 h-4" />
                  <span>
                    {pick(
                      "Date antérieure sans VDS/date disponible",
                      "Past date without VDS/date available"
                    )}
                  </span>
                </div>
                <h4 className="text-base font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                  {pick(
                    "Extraction des vols par station (GD* / PTRGD*)",
                    "Station-by-Station Flight Extraction (GD* / PTRGD*)"
                  )}
                </h4>
                <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] leading-relaxed">
                  {pick(
                    "Générez et téléchargez en ANSI le lot de commandes ",
                    "Generate and download in ANSI the batch of commands "
                  )}
                  <code className="font-mono font-semibold text-[#4C2812] dark:text-[#F7BA42]">
                    WINCMD(&quot;PTRGD*LFW/{isQuickDateValid ? quickNormalizedDate : "21NOV"}/T0000-2359/ALL‡A&quot;)
                  </code>
                  {pick(
                    ` pour l'ensemble des stations enregistrées (${stations.length} stations en base).`,
                    ` across all stored network stations (${stations.length} stations in DB).`
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3 shrink-0">
                {/* Date Calendar + DDMMM */}
                <div>
                  <label className="block text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1">
                    {pick("Date cible", "Target date")}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={isQuickDateValid ? formatDcsDateToIso(quickNormalizedDate) : ""}
                      onChange={(e) => {
                        const dcs = formatIsoDateToDcs(e.target.value);
                        if (dcs) setQuickPtrgdDate(dcs);
                      }}
                      className="px-2.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] tabular-nums"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={quickPtrgdDate}
                      onChange={(e) => setQuickPtrgdDate(e.target.value.toUpperCase())}
                      placeholder="21NOV"
                      className={`w-24 px-2.5 py-2 rounded-xl border font-mono text-xs font-bold uppercase tabular-nums focus:outline-none focus:ring-2 ${
                        isQuickDateValid
                          ? "border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-[#321B0A] dark:text-[#FAF7F2] focus:ring-[#E89C1D]"
                          : "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 focus:ring-rose-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Scope selector */}
                <div>
                  <span className="block text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mb-1">
                    {pick("Stations", "Stations")}
                  </span>
                  <div className="inline-flex bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setQuickPtrgdScope("KP_OPERATED")}
                      className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                        quickPtrgdScope === "KP_OPERATED"
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                          : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A]"
                      }`}
                    >
                      {pick(`Réseau KP (${activeKpStations.length})`, `KP (${activeKpStations.length})`)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickPtrgdScope("ALL")}
                      className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                        quickPtrgdScope === "ALL"
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                          : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A]"
                      }`}
                    >
                      {pick(`Toutes (${activeAllStations.length})`, `All (${activeAllStations.length})`)}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <button
                  type="button"
                  onClick={handleQuickPtrgdDownload}
                  disabled={!isQuickDateValid || quickTargetStations.length === 0}
                  className="px-4 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#d48b13] disabled:opacity-45 text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{pick("Télécharger PTRGD* (.txt)", "Download PTRGD* (.txt)")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStationPtrgdModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Database className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42]" />
                  <span>{pick("Stations & Aperçu", "Stations & Preview")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Data Loaded View */
        <div className="space-y-4">
          {/* Collapsible Header & KPIs */}
          <CollapsiblePanel
            title={pick(
              `Programme du ${parsedData.date}`,
              `Schedule — ${parsedData.date}`
            )}
            subtitle={
              stats
                ? pick(
                    `${parsedData.sourceType === "GD" ? `Liste GD* (${parsedData.stationsWithFlightsCount || 0}/${parsedData.stationsQueriedCount || 0} stations) · ` : ""}${stats.kpSegments} KP (${stats.kpUniqueFlights} vols) · Immatriculés ${stats.kpRegisteredCount}/${stats.kpSegments} · PDC ${stats.kpPdcCount}/${stats.kpSegments}`,
                    `${parsedData.sourceType === "GD" ? `GD* List (${parsedData.stationsWithFlightsCount || 0}/${parsedData.stationsQueriedCount || 0} stations) · ` : ""}${stats.kpSegments} KP (${stats.kpUniqueFlights} flights) · Reg. ${stats.kpRegisteredCount}/${stats.kpSegments} · PDC ${stats.kpPdcCount}/${stats.kpSegments}`
                  )
                : pick(`${parsedData.segments.length} tronçons`, `${parsedData.segments.length} legs`)
            }
            icon={<Plane className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            badge={parsedData.sourceType === "GD" ? "GD*" : pick("Actif", "Active")}
            accent="asky"
            defaultOpen={true}
            rightContent={
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStationPtrgdModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                  title={pick(
                    "Générer les commandes WINCMD PTRGD* par station (date antérieure sans VDS)",
                    "Generate station WINCMD PTRGD* commands (past dates without VDS)"
                  )}
                >
                  <Database className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" />
                  <span>{pick("Stations PTRGD*", "Stations PTRGD*")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWincmdModalOpen(true)}
                  className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#4C2812] via-[#3B1E0D] to-[#281408] dark:from-[#E89C1D] dark:via-[#F0A82E] dark:to-[#D48B13] hover:brightness-110 text-[#F7BA42] dark:text-[#1F1209] border border-[#E89C1D]/55 dark:border-[#F7BA42]/70 text-xs font-extrabold shadow-md shadow-amber-950/15 transition-all cursor-pointer shrink-0"
                  title={pick(
                    "Ouvrir les options Sabre CMD, l'aperçu et les exports (ANSI, Excel, Texte)",
                    "Open Sabre CMD options, preview & exports (ANSI, Excel, Text)"
                  )}
                >
                  <Layers className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Sabre CMD</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#E89C1D]/20 dark:bg-[#1F1209]/15 text-[10px] font-mono font-bold tabular-nums">
                    {filteredSegments.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateParsedData(null);
                    setRawContent("");
                  }}
                  className="text-xs text-[#4C2812] dark:text-[#FAF7F2] hover:text-[#321B0A] dark:hover:text-[#F7BA42] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] border border-[#E6D7C3] dark:border-[#5C351B] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {pick("Changer fichier", "Change file")}
                </button>
              </div>
            }
          >
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-3.5 rounded-2xl">
                  <span className="text-[11px] font-bold text-[#6E472B] dark:text-[#DECAB1] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#E89C1D]" /> {pick("Date", "Date")}
                  </span>
                  <div className="text-xl font-black text-[#4C2812] dark:text-[#FAF7F2] mt-1">{parsedData.date}</div>
                  <span className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">
                    {stats.total} {pick("tronçons", "legs")}
                  </span>
                </div>

                <div className="bg-[#4C2812] dark:bg-[#321B0A] border border-[#321B0A] dark:border-[#E89C1D]/50 p-3.5 rounded-2xl text-white">
                  <span className="text-[11px] font-extrabold text-[#F7BA42] uppercase tracking-wider flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-[#F7BA42]" /> {pick("Vols KP", "KP Flights")}
                  </span>
                  <div className="text-xl font-black text-white mt-1">
                    {stats.kpSegments} <span className="text-xs text-[#F7BA42] font-bold">{pick("tronçons", "legs")}</span>
                  </div>
                  <span className="text-[10px] text-amber-200 font-semibold">
                    {stats.kpUniqueFlights} {pick("vols", "flights")}
                  </span>
                </div>

                <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-3.5 rounded-2xl">
                  <span className="text-[11px] font-bold text-[#6E472B] dark:text-[#DECAB1] uppercase tracking-wider flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" /> {pick("Immatriculés", "Registered")}
                  </span>
                  <div className="text-xl font-black text-[#4C2812] dark:text-[#FAF7F2] mt-1 tabular-nums">
                    {stats.kpRegisteredCount}/{stats.kpSegments}
                  </div>
                </div>

                <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-3.5 rounded-2xl">
                  <span className="text-[11px] font-bold text-[#6E472B] dark:text-[#DECAB1] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E89C1D]" /> PDC
                  </span>
                  <div className="text-xl font-black text-[#8C5214] dark:text-[#F7BA42] mt-1 tabular-nums">
                    {stats.kpPdcCount}/{stats.kpSegments}
                  </div>
                </div>
              </div>
            )}
          </CollapsiblePanel>

          {/* Dedicated Flight Details, Capacity & Registration Workflow Bar (PTRG* ANSI) */}
          <div className="bg-white dark:bg-[#1F1209] rounded-2xl border border-[#E6D7C3] dark:border-[#4C2812] p-3.5 shadow-xs space-y-2.5">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#FDF4E3] dark:bg-[#2E1A0D] border border-[#E89C1D]/40 text-[#4C2812] dark:text-[#F7BA42] shrink-0">
                  <Plane className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-extrabold text-[#321B0A] dark:text-[#FAF7F2]">
                      {pick("Détails Vols", "Flight Details")}
                    </h4>
                    <span className="font-mono text-[11px] font-bold text-[#8C5214] dark:text-[#F7BA42] tabular-nums">
                      {statusDetails.length > 0
                        ? pick(
                            `${statusDetails.length} fiche(s) · ${matchedSegmentsCount}/${baseFilteredSegments.length} associés`,
                            `${statusDetails.length} file(s) · ${matchedSegmentsCount}/${baseFilteredSegments.length} matched`
                          )
                        : pick("Aucun détail importé", "No details imported")}
                    </span>
                    {ptrgAndRegSummary.pdc > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPtrgStatusFilter((prev) => (prev === "PDC" ? "ALL" : "PDC"))
                        }
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border inline-flex items-center gap-1 transition cursor-pointer ${
                          ptrgStatusFilter === "PDC"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-950/80"
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ptrgAndRegSummary.pdc} PDC</span>
                      </button>
                    )}
                    {ptrgAndRegSummary.nonPdc > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPtrgStatusFilter((prev) => (prev === "NON_PDC" ? "ALL" : "NON_PDC"))
                        }
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-extrabold border inline-flex items-center gap-1.5 transition cursor-pointer ${
                          ptrgStatusFilter === "NON_PDC"
                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/80"
                        }`}
                        title={pick(
                          "Cliquer pour filtrer uniquement les vols qui ne sont pas PDC",
                          "Click to filter only non-PDC flights"
                        )}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {ptrgAndRegSummary.nonPdc}{" "}
                          {pick("Non-PDC", "Non-PDC")}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPtrgAnsi}
                  disabled={ptrgExportSummary.uniqueCount === 0}
                  className="px-3.5 py-2 rounded-xl bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] disabled:opacity-50 text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                  title={pick(
                    'Exporter le fichier texte ANSI contenant les commandes WINCMD("PTRG*/KP.../D")',
                    'Export ANSI text file with WINCMD("PTRG*/KP.../D") commands'
                  )}
                >
                  <Terminal className="w-3.5 h-3.5 text-[#E89C1D]" />
                  <span>Sabre CMD</span>
                  <span className="font-mono text-[10px] opacity-85">
                    ({ptrgExportSummary.uniqueCount})
                  </span>
                </button>

                <label className="px-3.5 py-2 rounded-xl bg-[#E89C1D] hover:bg-[#d48b13] text-[#1F1209] text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{pick("Importer Détails (.txt)", "Import Details (.txt)")}</span>
                  <input
                    type="file"
                    multiple
                    accept=".txt,.log,.dat"
                    onChange={handleUploadFlightStatusFile}
                    className="hidden"
                  />
                </label>

                {statusDetails.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFlightStatusDetails}
                    className="p-2 rounded-xl border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title={pick("Effacer les détails vols importés", "Clear imported flight details")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {statusFeedback && (
              <div
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                  statusFeedback.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200"
                }`}
              >
                <span>{statusFeedback.message}</span>
                <button
                  type="button"
                  onClick={() => setStatusFeedback(null)}
                  className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Collapsible Interactive Filters Bar */}
          <CollapsiblePanel
            title={pick("Filtres", "Filters")}
            subtitle={`${filteredSegments.length} / ${parsedData.segments.length} ${pick("tronçons", "legs")}`}
            icon={<Filter className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            defaultOpen={false}
          >
            <div className="space-y-2.5">
              {/* Top Bar: Free Search + Reset */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2" />
                  <input
                    type="text"
                    placeholder={pick("Rechercher vol, aéroport, immat., WINCMD...", "Search flight, airport, reg., WINCMD...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                  />
                </div>

                {(searchTerm || originFilter !== "ALL" || destinationFilter !== "ALL" || registrationFilter !== "ALL" || statusFilter !== "ALL" || ptrgStatusFilter !== "ALL" || segmentFilter !== "ALL" || carrierFilter !== "KP") && (
                  <button
                    type="button"
                    onClick={() => {
                      setCarrierFilter("KP");
                      setSearchTerm("");
                      setOriginFilter("ALL");
                      setDestinationFilter("ALL");
                      setRegistrationFilter("ALL");
                      setStatusFilter("ALL");
                      setPtrgStatusFilter("ALL");
                      setSegmentFilter("ALL");
                    }}
                    className="text-xs text-rose-700 dark:text-rose-400 hover:underline font-bold cursor-pointer px-2 py-1"
                  >
                    {pick("Réinitialiser", "Reset")}
                  </button>
                )}
              </div>

              {/* Searchable Filter Option Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                <FilterOptionField
                  value={carrierFilter}
                  onChange={(v) => setCarrierFilter(v as "KP" | "ALL" | "CODESHARE")}
                  allValue="ALL"
                  allLabel={pick(`Tous (${parsedData.segments.length})`, `All (${parsedData.segments.length})`)}
                  prefixLabel={pick("Opérateur", "Carrier")}
                  options={[
                    {
                      value: "KP",
                      label: pick("Vols KP", "KP Flights"),
                      count: parsedData.kpOperatedSegmentsCount,
                      keywords: "kp asky opere",
                    },
                    {
                      value: "CODESHARE",
                      label: "Codeshares",
                      count: parsedData.codeshareSegmentsCount,
                      keywords: "codeshare partenaire",
                    },
                  ]}
                />

                <FilterOptionField
                  value={originFilter}
                  onChange={setOriginFilter}
                  allValue="ALL"
                  allLabel={pick(`Toutes (${parsedData.origins.length})`, `All (${parsedData.origins.length})`)}
                  prefixLabel={pick("Origine", "Origin")}
                  options={originOptions}
                />

                <FilterOptionField
                  value={destinationFilter}
                  onChange={setDestinationFilter}
                  allValue="ALL"
                  allLabel={pick(`Toutes (${parsedData.destinations.length})`, `All (${parsedData.destinations.length})`)}
                  prefixLabel="Dest."
                  options={destinationOptions}
                />

                <FilterOptionField
                  value={registrationFilter}
                  onChange={setRegistrationFilter}
                  allValue="ALL"
                  allLabel={pick(`Toutes (${ptrgAndRegSummary.registrations.length})`, `All (${ptrgAndRegSummary.registrations.length})`)}
                  prefixLabel={pick("Immat.", "Reg.")}
                  options={[
                    {
                      value: "MISSING",
                      label: pick("Sans immat.", "Missing reg."),
                      count: ptrgAndRegSummary.missingReg,
                      keywords: "sans immat missing aucune",
                    },
                    ...ptrgAndRegSummary.registrations.map(({ reg, count }) => ({
                      value: reg,
                      label: reg,
                      count,
                    })),
                  ]}
                />

                <FilterOptionField
                  value={ptrgStatusFilter}
                  onChange={(v) =>
                    setPtrgStatusFilter(v as "ALL" | "PDC" | "NON_PDC" | "MISSING_PTRG")
                  }
                  allValue="ALL"
                  allLabel={pick("Tous", "All")}
                  prefixLabel="PTRG*"
                  options={[
                    {
                      value: "PDC",
                      label: "PDC",
                      count: ptrgAndRegSummary.pdc,
                    },
                    {
                      value: "NON_PDC",
                      label: "Non-PDC",
                      count: ptrgAndRegSummary.nonPdc,
                      keywords: "non pdc alert",
                    },
                    {
                      value: "MISSING_PTRG",
                      label: pick("Sans PTRG*", "No PTRG*"),
                      count: ptrgAndRegSummary.missing,
                      keywords: "sans ptrg missing",
                    },
                  ]}
                />

                <FilterOptionField
                  value={statusFilter}
                  onChange={setStatusFilter}
                  allValue="ALL"
                  allLabel={pick("Toutes", "All")}
                  prefixLabel={pick("Heures réelles", "Actual")}
                  options={[
                    {
                      value: "AJUSTE",
                      label: pick("Saisies", "Entered"),
                      count: stats?.withAdjustments,
                      keywords: "ajuste saisies entered",
                    },
                    {
                      value: "INITIAL",
                      label: pick("Non renseignées", "Not entered"),
                      count: stats?.withoutAdjustments,
                      keywords: "initial non renseignees",
                    },
                  ]}
                />

                <FilterOptionField
                  value={segmentFilter}
                  onChange={(v) => setSegmentFilter(v as "ALL" | "MAIN" | "SUB")}
                  allValue="ALL"
                  allLabel={pick("Tous", "All")}
                  prefixLabel={pick("Tronçons", "Legs")}
                  options={[
                    {
                      value: "MAIN",
                      label: pick("1er départ", "1st dep."),
                      keywords: "main principal 1er depart",
                    },
                    {
                      value: "SUB",
                      label: pick("Escales", "Stops"),
                      keywords: "sub escales stopover",
                    },
                  ]}
                />
              </div>
            </div>
          </CollapsiblePanel>

          {/* Flights Table */}
          <div className="bg-white dark:bg-[#1F1209] rounded-3xl border border-[#E6D7C3] dark:border-[#4C2812] shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#4C2812] dark:bg-[#2E180A] border-b border-[#321B0A] dark:border-[#5C351B] text-[#F7BA42] uppercase tracking-wider font-extrabold text-[11px]">
                    <th className="py-3.5 px-3 w-10 text-center">#</th>
                    <th className="py-3.5 px-3">{pick("Vol", "Flight")}</th>
                    <th className="py-3.5 px-3">{pick("Type", "Type")}</th>
                    <th className="py-3.5 px-3">{pick("Tronçon", "Sector")}</th>
                    <th className="py-3.5 px-3">{pick("Avion / Immat.", "Aircraft / Reg.")}</th>
                    <th className="py-3.5 px-3">{pick("Statut", "Status")}</th>
                    <th className="py-3.5 px-3">{pick("Estimé", "Sched.")}</th>
                    <th className="py-3.5 px-3">{pick("Réel", "Actual")}</th>
                    <th className="py-3.5 px-3">WINCMD</th>
                    <th className="py-3.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70 font-medium text-[#321B0A] dark:text-[#FAF7F2]">
                  {filteredSegments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[#6E472B] dark:text-[#DECAB1]">
                        {pick(
                          "Aucun vol ne correspond à vos critères de recherche.",
                          "No flights match your search criteria."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSegments.map((segment, index) => {
                      const isEven = index % 2 === 0;
                      const resolution = resolveFlightStatusDetail(
                        segment.flightNumber,
                        segment.date,
                        segment.origin,
                        statusDetails
                      );
                      const detail = resolution.detail;
                      const depStatus = resolution.resolvedStatus;
                      const normStatus = (depStatus || "").trim().toUpperCase();
                      const isPdc = Boolean(detail && !detail.isManualOnly && normStatus === "PDC");
                      const isNonPdc = Boolean(detail && !detail.isManualOnly && !isPdc);
                      const hasRegistration = Boolean((detail?.registration || "").trim());

                      return (
                        <tr 
                          key={segment.id}
                          className={`transition-colors ${
                            isNonPdc
                              ? "bg-rose-50/90 dark:bg-rose-950/45 hover:bg-rose-100/80 dark:hover:bg-rose-950/65 shadow-[inset_4px_0_0_#e11d48]"
                              : !hasRegistration
                              ? "bg-amber-50/45 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/35 shadow-[inset_4px_0_0_#f59e0b]"
                              : isEven
                              ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                              : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                          }`}
                        >
                          {/* Row Number */}
                          <td className="py-3 px-3 text-center text-[#6E472B] dark:text-[#DECAB1] font-mono text-[11px]">
                            {index + 1}
                          </td>

                          {/* Flight Number */}
                          <td className="py-3 px-3 font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-sm font-black ${
                                isNonPdc
                                  ? "text-rose-700 dark:text-rose-300"
                                  : segment.isKpOperated
                                  ? "text-[#4C2812] dark:text-[#F7BA42]"
                                  : "text-[#6E472B] dark:text-[#DECAB1]"
                              }`}>
                                {segment.flightNumber}
                              </span>
                              {segment.isSubSegment && (
                                <span
                                  className="bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                                  title={pick("Segment d'escale du vol", "Flight stopover leg")}
                                >
                                  Leg {segment.segmentIndex + 1}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Flight Carrier Type */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {segment.isKpOperated ? (
                              <span className="inline-flex items-center gap-1 text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-extrabold">
                                <Plane className="w-3 h-3 text-[#E89C1D]" />
                                {pick("Opéré KP", "Operated KP")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#6E472B] dark:text-[#DECAB1] text-[11px] font-semibold">
                                <Globe className="w-2.5 h-2.5 text-[#8C5214] dark:text-[#F7BA42]" />
                                Codeshare
                              </span>
                            )}
                          </td>

                          {/* Route Origin / Destination */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div>
                              <div className="inline-flex items-center gap-1.5 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                <span className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] px-2 py-0.5 rounded-lg border border-[#321B0A] dark:border-[#E89C1D]">
                                  {segment.origin}
                                </span>
                                <ArrowRight className="w-3 h-3 text-[#8C5214] dark:text-[#F7BA42]" />
                                <span className="bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] px-2 py-0.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B]">
                                  {segment.destination}
                                </span>
                              </div>
                              {segment.gdDownlineStations && segment.gdDownlineStations.length > 1 && (
                                <div className="text-[10px] font-mono text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                                  {pick("Suite :", "Via:")}{" "}
                                  {segment.gdDownlineStations.slice(1).join(" → ")}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Aircraft Type & Registration (737/ETBAR) + Missing Registration Signal + Edit trigger */}
                          <td className="py-3 px-3 font-mono whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              {detail ? (
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                    <span>
                                      {detail.aircraftType || segment.gdAircraftType || "—"}
                                      {hasRegistration ? `/${detail.registration}` : ""}
                                    </span>
                                    {!hasRegistration && (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-sans font-extrabold text-[10px]"
                                        title={pick(
                                          "Immatriculation manquante — cliquez sur modifier pour l'assigner",
                                          "Missing aircraft registration — click edit to assign"
                                        )}
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                        {pick("Sans immat.", "No reg.")}
                                      </span>
                                    )}
                                    {detail.isManualOverride && (
                                      <span className="text-[10px] font-sans font-semibold text-indigo-600 dark:text-amber-400">
                                        ({pick("Modifié", "Edited")})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] tabular-nums">
                                    C{detail.businessCapacity}/Y{detail.economyCapacity} ({detail.totalCapacity})
                                  </div>
                                </div>
                              ) : segment.gdAircraftType || segment.gdGate || segment.gdPaxBookedRaw ? (
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                    {segment.gdAircraftType && (
                                      <span>{segment.gdAircraftType}</span>
                                    )}
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-sans font-extrabold text-[10px]"
                                      title={pick(
                                        "Immatriculation non fournie par GD* — importez PTRG* ou modifiez manuellement",
                                        "Registration not in GD* — import PTRG* or edit manually"
                                      )}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                      {pick("Sans immat.", "No reg.")}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1] tabular-nums">
                                    {[
                                      segment.gdGate ? `${pick("Porte", "Gate")} ${segment.gdGate}` : null,
                                      segment.gdPaxBookedRaw ? `Pax ${segment.gdPaxBookedRaw}` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                </div>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-sans font-extrabold text-[10px]"
                                  title={pick(
                                    "Aucune immatriculation ni détail appareil associé à ce vol",
                                    "No aircraft registration or equipment detail matched to this flight"
                                  )}
                                >
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  {pick("Sans immat.", "No reg.")}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setEditingEquipmentSegment(segment)}
                                className="p-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:border-[#E89C1D] text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42] transition cursor-pointer shrink-0"
                                title={pick(
                                  "Modifier l'équipement (type, immatriculation, capacité)",
                                  "Edit equipment (type, registration, capacity)"
                                )}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Departure Station Status (e.g. PDC vs Non-PDC alert) */}
                          <td className="py-3 px-3 font-mono whitespace-nowrap">
                            {detail && !detail.isManualOnly ? (
                              <div>
                                {isPdc ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 font-bold text-[11px]">
                                    {depStatus}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white border border-rose-700 font-extrabold text-[11px] shadow-xs"
                                    title={pick(
                                      "Ce vol n'est pas au statut PDC",
                                      "This flight is not in PDC status"
                                    )}
                                  >
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>{depStatus || "NON-PDC"}</span>
                                  </span>
                                )}
                                {detail?.boardingTimeFormatted && (
                                  <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1] mt-0.5 tabular-nums">
                                    Emb. {detail.boardingTimeFormatted}
                                  </div>
                                )}
                              </div>
                            ) : detail?.isManualOnly ? (
                              <span className="text-[11px] font-sans font-medium text-[#6E472B] dark:text-[#DECAB1]">
                                {pick("Manuel", "Manual")}
                              </span>
                            ) : segment.gdFlightStatus ? (
                              <div>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border font-bold text-[11px] ${
                                    segment.gdFlightStatus === "PDC"
                                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70"
                                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800/70"
                                  }`}
                                >
                                  {segment.gdFlightStatus}
                                </span>
                                {segment.gdGate && (
                                  <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1] mt-0.5 tabular-nums">
                                    {pick("Porte", "Gate")} {segment.gdGate}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#6E472B]/50 dark:text-[#DECAB1]/40">—</span>
                            )}
                          </td>

                          {/* Scheduled Times */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div>
                              <div className="flex items-center gap-1 font-mono text-[#321B0A] dark:text-[#FAF7F2] font-bold tabular-nums">
                                <span>{segment.schedDepFormatted || "--:--"}</span>
                                <span className="text-[#8C5214] dark:text-[#F7BA42]">/</span>
                                <span
                                  className={
                                    segment.arrFromPtrg
                                      ? "text-[#8C5214] dark:text-[#F7BA42]"
                                      : ""
                                  }
                                  title={
                                    segment.arrFromPtrg
                                      ? pick(
                                          "Heure d'arrivée récupérée depuis les détails PTRG*",
                                          "Arrival time resolved from PTRG* flight details"
                                        )
                                      : undefined
                                  }
                                >
                                  {segment.schedArrFormatted || "--:--"}
                                  {segment.arrFromPtrg && segment.arrIsActualFromPtrg ? "*" : ""}
                                </span>
                              </div>
                              {segment.arrFromPtrg && (
                                <div className="text-[10px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                                  {pick("Arr. PTRG*", "Arr. PTRG*")}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actual Times Saisi Système */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {segment.hasSystemAdjustment ? (
                              <div className="flex items-center gap-1 font-mono text-[#8C5214] dark:text-[#F7BA42] font-extrabold">
                                <span>{segment.actualDepFormatted || "--:--"}</span>
                                <span className="text-[#6E472B] dark:text-[#DECAB1] font-normal">/</span>
                                <span>{segment.actualArrFormatted || "--:--"}</span>
                              </div>
                            ) : (
                              <span className="text-[#6E472B]/70 dark:text-[#DECAB1]/70 font-mono text-[11px] italic">
                                {pick("Non renseigné", "Not entered")}
                              </span>
                            )}
                          </td>

                          {/* WINCMD */}
                          <td className="py-3 px-3 font-mono text-[11px] text-[#4C2812] dark:text-[#F7BA42] truncate max-w-[200px]">
                            <span className="bg-[#FAF7F2] dark:bg-[#28170C] px-2 py-1 rounded border border-[#E6D7C3] dark:border-[#5C351B] select-all">
                              {segment.wincmd}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedDetailSegment(segment)}
                                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                  detail
                                    ? "border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] text-[#4C2812] dark:text-[#F7BA42] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212]"
                                    : "border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A]"
                                }`}
                                title={pick(
                                  "Explorer les détails complets du vol (embarquement, porte, escales, règles DCS)",
                                  "Explore full flight details (boarding time, gate, itinerary, DCS rules)"
                                )}
                              >
                                <Eye className="w-3 h-3" />
                                <span>{pick("Détails", "Details")}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyWincmd(segment.wincmd, segment.id)}
                                className="p-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#6E472B] dark:text-[#DECAB1] hover:text-[#4C2812] dark:hover:text-[#F7BA42] transition cursor-pointer"
                                title={pick("Copier la commande WINCMD", "Copy WINCMD command")}
                              >
                                {copiedId === segment.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {parsedData && (
        <WincmdExportModal
          isOpen={isWincmdModalOpen}
          onClose={() => setIsWincmdModalOpen(false)}
          segments={parsedData.segments}
          date={parsedData.date}
        />
      )}

      {/* Station PTRGD* Extraction & Stations Database Modal */}
      <StationPtrgdModal
        isOpen={isStationPtrgdModalOpen}
        onClose={() => setIsStationPtrgdModalOpen(false)}
        initialDcsDate={parsedData?.date || quickNormalizedDate}
        stations={stations}
        onStationsUpdated={setStations}
      />

      {/* Flight Status & Full Details Explorer Modal */}
      <FlightStatusDetailModal
        isOpen={Boolean(selectedDetailSegment)}
        onClose={() => setSelectedDetailSegment(null)}
        segment={selectedDetailSegment}
        statusDetail={selectedDetailResolution.detail}
        resolvedStatus={selectedDetailResolution.resolvedStatus}
        matchLevel={selectedDetailResolution.matchLevel}
        onEditEquipment={(seg) => setEditingEquipmentSegment(seg)}
      />

      {/* Flight Equipment Edit Modal */}
      <FlightEquipmentEditModal
        isOpen={Boolean(editingEquipmentSegment)}
        onClose={() => setEditingEquipmentSegment(null)}
        flightContext={
          editingEquipmentSegment
            ? {
                airline: "KP",
                flightNumber: editingEquipmentSegment.flightNumber,
                date: editingEquipmentSegment.date,
                origin: editingEquipmentSegment.origin,
                destination: editingEquipmentSegment.destination,
                etdHeader: editingEquipmentSegment.actualDep || editingEquipmentSegment.schedDep,
              }
            : null
        }
        existingDetail={editingEquipmentResolution.detail}
        allStatusDetails={statusDetails}
        onSave={handleSaveEquipmentDetail}
        onRemoveManual={handleRemoveManualEquipmentDetail}
      />
    </div>
  );
};
