import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Upload,
  RotateCcw,
  Download,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Luggage,
  Award,
  ArrowRight,
  Users,
  Layers,
  LayoutDashboard,
  Plane,
  GitCompareArrows,
  Plus,
  Database,
  FolderOpen,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  FileDown,
  Trash2,
  CheckSquare,
  Square,
  BarChart3,
  Check,
  X,
  Pencil,
  CreditCard,
} from "lucide-react";
import {
  EmdDocumentDetail,
  FlightScheduleParseResult,
  FlightSegment,
  FlightStatusDetail,
  ManifestFlight,
  ManifestParseResult,
  TransportedPassengerReport,
} from "../../types";
import {
  removeFlightStatusDetailById,
  resolveFlightStatusDetail,
  saveStoredFlightStatusDetails,
  upsertFlightStatusDetail,
} from "../../utils/flightStatusParser";
import {
  computeTransportedPassengerReport,
  downloadTextFile,
  exportManifestToExcel,
  generateEnhancedManifestText,
  getDcsFlightDateSortOrder,
  getFlightWebCheckinCount,
  isPassengerNoShow,
  mergeManifestResults,
  normalizeDcsFlightDate,
  parseManifestFile,
} from "../../utils/manifestParser";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";
import { reconcileManifestWithSchedule } from "../../utils/manifestReconciliation";
import {
  StoredManifestDaySummary,
  clearAllManifestsFromDb,
  deleteManifestDayFromDb,
  getSavedManifestDay,
  listSavedManifestDays,
  loadCombinedManifestForDates,
  saveManifestToDb,
} from "../../utils/manifestDb";
import {
  exportManifestOverviewReportToCSV,
  exportManifestOverviewReportToPDF,
} from "../../utils/flightStatsExport";
import { EnhancedManifestModal } from "./EnhancedManifestModal";
import { FlightEquipmentEditModal } from "./FlightEquipmentEditModal";
import { EmdAuditWincmdModal } from "./EmdAuditWincmdModal";
import {
  clearStoredEmdDetails,
  extractUniqueEmdsFromFlights,
  loadStoredEmdDetails,
  saveStoredEmdDetails,
  upsertEmdDetails,
} from "../../utils/emdAudit";
import { ManifestFlightDetailView } from "./ManifestFlightDetailView";
import { MultiFlightPassengersView } from "./MultiFlightPassengersView";
import { ManifestAuditView } from "./ManifestAuditView";
import { ManifestReconciliationView } from "./ManifestReconciliationView";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { useLanguage } from "../../context/LanguageContext";

export interface ManifestFileMeta {
  name: string;
  size: number;
  uploadedAt: string;
  linesCount: number;
}

export type ManifestPageTab =
  | "OVERVIEW"
  | "FLIGHT_DETAIL"
  | "ALL_PASSENGERS"
  | "AUDIT"
  | "RECONCILIATION";

interface FlightManifestUploaderProps {
  scheduleData?: FlightScheduleParseResult | null;
  storedScheduleSegments?: FlightSegment[];
  onScheduleLoaded?: (data: FlightScheduleParseResult | null) => void;
  flightStatusDetails?: FlightStatusDetail[];
  onUpsertFlightStatusDetail?: (detail: FlightStatusDetail) => void;
  onRemoveManualFlightStatusDetail?: (id: string) => void;
  manifestData?: ManifestParseResult | null;
  manifestFileMeta?: ManifestFileMeta | null;
  onManifestLoaded?: (
    data: ManifestParseResult | null,
    meta: ManifestFileMeta | null
  ) => void;
  requestedFlightId?: string | null;
  onRequestedFlightConsumed?: () => void;
  onOpenAnalytics?: (flightNumber?: string, origin?: string) => void;
  onSavedToDb?: () => void;
  activeSubPage?: ManifestPageTab;
  onChangeSubPage?: (
    sub: ManifestPageTab,
    options?: { flightId?: string; replace?: boolean }
  ) => void;
  selectedFlightId?: string;
  onChangeSelectedFlightId?: (
    flightId: string,
    options?: { replace?: boolean }
  ) => void;
}

export const FlightManifestUploader: React.FC<FlightManifestUploaderProps> = ({
  scheduleData: controlledScheduleData,
  storedScheduleSegments = [],
  onScheduleLoaded,
  flightStatusDetails: controlledFlightStatusDetails = [],
  onUpsertFlightStatusDetail,
  onRemoveManualFlightStatusDetail,
  manifestData: controlledManifestData,
  manifestFileMeta: controlledFileMeta,
  onManifestLoaded,
  requestedFlightId,
  onRequestedFlightConsumed,
  onOpenAnalytics,
  onSavedToDb,
  activeSubPage: controlledActiveSubPage,
  onChangeSubPage,
  selectedFlightId: controlledSelectedFlightId,
  onChangeSelectedFlightId,
}) => {
  // Local fallbacks if used standalone
  const [internalManifest, setInternalManifest] =
    useState<ManifestParseResult | null>(null);
  const [internalMeta, setInternalMeta] = useState<ManifestFileMeta | null>(
    null
  );
  const [internalSchedule, setInternalSchedule] =
    useState<FlightScheduleParseResult | null>(null);
  const [internalStatusDetails, setInternalStatusDetails] = useState<FlightStatusDetail[]>(
    controlledFlightStatusDetails
  );
  const [editingEquipmentFlight, setEditingEquipmentFlight] =
    useState<ManifestFlight | null>(null);

  const flightStatusDetails = onUpsertFlightStatusDetail
    ? controlledFlightStatusDetails
    : internalStatusDetails.length > 0
    ? internalStatusDetails
    : controlledFlightStatusDetails;

  const handleSaveFlightEquipment = (updated: FlightStatusDetail) => {
    if (onUpsertFlightStatusDetail) {
      onUpsertFlightStatusDetail(updated);
    } else {
      const next = upsertFlightStatusDetail(flightStatusDetails, updated);
      saveStoredFlightStatusDetails(next);
      setInternalStatusDetails(next);
    }
  };

  const handleRemoveFlightEquipment = (id: string) => {
    if (onRemoveManualFlightStatusDetail) {
      onRemoveManualFlightStatusDetail(id);
    } else {
      const next = removeFlightStatusDetailById(flightStatusDetails, id);
      saveStoredFlightStatusDetails(next);
      setInternalStatusDetails(next);
    }
  };

  const parsedResult =
    controlledManifestData !== undefined
      ? controlledManifestData
      : internalManifest;
  const fileMeta =
    controlledFileMeta !== undefined ? controlledFileMeta : internalMeta;
  const scheduleData =
    controlledScheduleData !== undefined
      ? controlledScheduleData
      : internalSchedule;

  const setManifestState = (
    data: ManifestParseResult | null,
    meta: ManifestFileMeta | null
  ) => {
    if (onManifestLoaded) {
      onManifestLoaded(data, meta);
    } else {
      setInternalManifest(data);
      setInternalMeta(meta);
    }
  };

  const setScheduleState = (data: FlightScheduleParseResult | null) => {
    if (onScheduleLoaded) {
      onScheduleLoaded(data);
    } else {
      setInternalSchedule(data);
    }
  };

  const { language, locale, pick } = useLanguage();
  const [internalSubPage, setInternalSubPage] =
    useState<ManifestPageTab>("OVERVIEW");
  const [internalSelectedFlightId, setInternalSelectedFlightId] =
    useState<string>("");

  const activeSubPage = controlledActiveSubPage ?? internalSubPage;
  const selectedFlightId =
    controlledSelectedFlightId !== undefined
      ? controlledSelectedFlightId
      : internalSelectedFlightId;

  const setActiveSubPage = (
    nextSub: ManifestPageTab,
    options?: { flightId?: string; replace?: boolean }
  ) => {
    if (options?.flightId !== undefined) {
      setInternalSelectedFlightId(options.flightId);
    }
    setInternalSubPage(nextSub);
    onChangeSubPage?.(nextSub, options);
  };

  const setSelectedFlightId = (
    nextId: string,
    options?: { replace?: boolean }
  ) => {
    setInternalSelectedFlightId(nextId);
    onChangeSelectedFlightId?.(nextId, options);
  };
  const [preselectedPaxDates, setPreselectedPaxDates] = useState<
    string[] | null
  >(null);
  const [preselectedPaxFlightNumbers, setPreselectedPaxFlightNumbers] =
    useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedDbInfo, setSavedDbInfo] = useState<{
    kind: "saved" | "loaded" | "deleted";
    detail: string;
  } | null>(null);
  const [quickSavedDays, setQuickSavedDays] = useState<
    StoredManifestDaySummary[]
  >([]);
  const [selectedBackupDates, setSelectedBackupDates] = useState<string[]>([]);
  const [confirmDeleteDayKey, setConfirmDeleteDayKey] = useState<string | null>(
    null
  );
  const [confirmClearAllBackups, setConfirmClearAllBackups] =
    useState<boolean>(false);

  const savedDbStatus = savedDbInfo
    ? savedDbInfo.kind === "saved"
      ? pick(
          `Sauvegardé en base locale (${savedDbInfo.detail})`,
          `Saved to local database (${savedDbInfo.detail})`
        )
      : savedDbInfo.kind === "deleted"
      ? pick(
          `Sauvegarde supprimée (${savedDbInfo.detail})`,
          `Backup deleted (${savedDbInfo.detail})`
        )
      : pick(
          `Chargé depuis la base locale (${savedDbInfo.detail})`,
          `Loaded from local database (${savedDbInfo.detail})`
        )
    : null;
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    scope: "SINGLE" | "ALL";
    flight: ManifestFlight | null;
  }>({ isOpen: false, scope: "ALL", flight: null });
  const [emdAuditModalFlights, setEmdAuditModalFlights] = useState<
    ManifestFlight[] | null
  >(null);
  const [emdAuditInitialFlightId, setEmdAuditInitialFlightId] = useState<
    string | undefined
  >(undefined);
  const [emdDetailsMap, setEmdDetailsMap] = useState<
    Record<string, EmdDocumentDetail>
  >(() => loadStoredEmdDetails());

  const handleImportEmdDetails = useCallback((emds: EmdDocumentDetail[]) => {
    setEmdDetailsMap((prev) => {
      const next = upsertEmdDetails(prev, emds);
      saveStoredEmdDetails(next);
      return next;
    });
  }, []);

  const handleClearEmdDetails = useCallback(() => {
    clearStoredEmdDetails();
    setEmdDetailsMap({});
  }, []);

  // Multi-criteria filters & date grouping for the Overview flights table
  const [overviewDateFilter, setOverviewDateFilter] = useState<string>("ALL");
  const [overviewFlightNumFilter, setOverviewFlightNumFilter] =
    useState<string>("ALL");
  const [overviewOriginFilter, setOverviewOriginFilter] =
    useState<string>("ALL");
  const [overviewDestFilter, setOverviewDestFilter] = useState<string>("ALL");
  const [overviewAircraftFilter, setOverviewAircraftFilter] =
    useState<string>("ALL");
  const [overviewRegistrationFilter, setOverviewRegistrationFilter] =
    useState<string>("ALL");
  const [overviewAuditFilter, setOverviewAuditFilter] = useState<string>("ALL");
  const [overviewSearchTerm, setOverviewSearchTerm] = useState<string>("");
  const [collapsedDateGroups, setCollapsedDateGroups] = useState<
    Record<string, boolean>
  >({});

  const resetOverviewFilters = () => {
    setOverviewDateFilter("ALL");
    setOverviewFlightNumFilter("ALL");
    setOverviewOriginFilter("ALL");
    setOverviewDestFilter("ALL");
    setOverviewAircraftFilter("ALL");
    setOverviewRegistrationFilter("ALL");
    setOverviewAuditFilter("ALL");
    setOverviewSearchTerm("");
  };

  const refreshQuickDays = useCallback(() => {
    void listSavedManifestDays()
      .then((days) => setQuickSavedDays(days))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshQuickDays();
  }, [refreshQuickDays]);

  useEffect(() => {
    if (requestedFlightId && parsedResult) {
      const match = parsedResult.flights.find((f) => f.id === requestedFlightId);
      if (match) {
        setActiveSubPage("FLIGHT_DETAIL", { flightId: match.id, replace: true });
      }
      onRequestedFlightConsumed?.();
    }
  }, [requestedFlightId, parsedResult, onRequestedFlightConsumed]);

  const persistManifestToBrowserDb = (
    data: ManifestParseResult,
    sourceName: string
  ) => {
    void saveManifestToDb(data, sourceName)
      .then((dates) => {
        if (dates.length > 0) {
          setSavedDbInfo({ kind: "saved", detail: dates.join(", ") });
        }
        refreshQuickDays();
        onSavedToDb?.();
      })
      .catch(() => {
        // Ignore IndexedDB errors if private mode blocks storage
      });
  };

  const handleOpenSavedDay = async (dateKey: string) => {
    try {
      const rec = await getSavedManifestDay(dateKey);
      if (!rec) return;
      const meta: ManifestFileMeta = {
        name: `${rec.sourceFileName} (Archive ${rec.dateKey})`,
        size: 0,
        uploadedAt: new Date(rec.savedAt).toLocaleString(locale),
        linesCount: rec.data.totalFlights,
      };
      setManifestState(rec.data, meta);
      setActiveSubPage("OVERVIEW", {
        flightId: rec.data.flights[0]?.id || "",
        replace: true,
      });
      setSavedDbInfo({ kind: "loaded", detail: rec.dateKey });
      setLoadError(null);
      resetOverviewFilters();
      setCollapsedDateGroups({});
    } catch {
      setLoadError(
        pick(
          "Erreur lors du chargement de la journée archivée.",
          "Error loading archived day."
        )
      );
    }
  };

  const handleLoadBackupDates = async (dates: string[] | "ALL") => {
    try {
      const combined = await loadCombinedManifestForDates(dates);
      if (!combined) {
        setLoadError(
          pick(
            "Aucune donnée trouvée pour les dates sélectionnées.",
            "No data found for the selected dates."
          )
        );
        return;
      }
      const meta: ManifestFileMeta = {
        name:
          dates === "ALL"
            ? pick(
                `Toutes les sauvegardes (${combined.loadedDates.length} jours)`,
                `All saved backups (${combined.loadedDates.length} days)`
              )
            : combined.sourceLabel,
        size: 0,
        uploadedAt: new Date(combined.latestSavedAt).toLocaleString(locale),
        linesCount: combined.data.totalFlights,
      };
      setManifestState(combined.data, meta);
      setActiveSubPage("OVERVIEW", {
        flightId: combined.data.flights[0]?.id || "",
        replace: true,
      });
      setSavedDbInfo({
        kind: "loaded",
        detail:
          dates === "ALL"
            ? pick(
                `Toutes les dates (${combined.loadedDates.length})`,
                `All dates (${combined.loadedDates.length})`
              )
            : combined.loadedDates.join(", "),
      });
      setLoadError(null);
      resetOverviewFilters();
      setCollapsedDateGroups({});
    } catch {
      setLoadError(
        pick(
          "Erreur lors du chargement des journées sélectionnées.",
          "Error loading selected archived dates."
        )
      );
    }
  };

  const toggleBackupDateSelection = (dateKey: string) => {
    setSelectedBackupDates((prev) =>
      prev.includes(dateKey)
        ? prev.filter((d) => d !== dateKey)
        : [...prev, dateKey]
    );
  };

  const handleDeleteSavedDay = async (dateKey: string) => {
    try {
      await deleteManifestDayFromDb(dateKey);
      setConfirmDeleteDayKey(null);
      setSelectedBackupDates((prev) => prev.filter((d) => d !== dateKey));
      refreshQuickDays();
      onSavedToDb?.();
      setSavedDbInfo({ kind: "deleted", detail: dateKey });
    } catch {
      setLoadError(
        pick(
          `Impossible de supprimer la sauvegarde du ${dateKey}.`,
          `Failed to delete backup for ${dateKey}.`
        )
      );
    }
  };

  const handleClearAllSavedDays = async () => {
    try {
      await clearAllManifestsFromDb();
      setConfirmClearAllBackups(false);
      setSelectedBackupDates([]);
      refreshQuickDays();
      onSavedToDb?.();
      setSavedDbInfo({
        kind: "deleted",
        detail: pick("Base locale vidée", "Local DB cleared"),
      });
    } catch {
      setLoadError(
        pick(
          "Impossible de vider la base locale.",
          "Failed to clear local database."
        )
      );
    }
  };

  const processManifestContent = (
    content: string,
    name: string,
    size: number
  ) => {
    const result = parseManifestFile(content);
    if (result.flights.length === 0) {
      setLoadError(
        pick(
          "Aucun vol DCS valide détecté dans ce fichier. Vérifiez qu'il s'agit bien d'un manifeste de vols (ex. G*L...).",
          "No valid DCS flights detected in this file. Please ensure it is a flight manifest (e.g. G*L...)."
        )
      );
      return;
    }
    const meta: ManifestFileMeta = {
      name,
      size,
      uploadedAt: new Date().toLocaleTimeString(locale),
      linesCount: content.split(/\r?\n/).length,
    };
    setManifestState(result, meta);
    setActiveSubPage("OVERVIEW", {
      flightId: result.flights[0]?.id || "",
      replace: true,
    });
    setLoadError(null);
    resetOverviewFilters();
    setCollapsedDateGroups({});
    persistManifestToBrowserDb(result, name);
  };

  const processManifestFiles = async (files: File[], append: boolean) => {
    if (files.length === 0) return;
    try {
      const contents = await Promise.all(files.map((file) => file.text()));
      const merged = append
        ? mergeManifestResults(parsedResult, contents)
        : mergeManifestResults(null, contents);

      if (merged.flights.length === 0) {
        setLoadError(
          pick(
            "Aucun vol DCS valide détecté dans le(s) fichier(s) sélectionné(s).",
            "No valid DCS flights detected in the selected file(s)."
          )
        );
        return;
      }

      const newNames = files.map((f) => f.name).join(" + ");
      const totalSize =
        (append && fileMeta ? fileMeta.size : 0) +
        files.reduce((sum, f) => sum + f.size, 0);
      const totalLines =
        (append && fileMeta ? fileMeta.linesCount : 0) +
        contents.reduce((sum, c) => sum + c.split(/\r?\n/).length, 0);

      const mergedName =
        append && fileMeta ? `${fileMeta.name} + ${newNames}` : newNames;

      const meta: ManifestFileMeta = {
        name: mergedName,
        size: totalSize,
        uploadedAt: new Date().toLocaleTimeString(locale),
        linesCount: totalLines,
      };

      setManifestState(merged, meta);
      if (!append || !selectedFlightId) {
        setActiveSubPage("OVERVIEW", {
          flightId: merged.flights[0]?.id || "",
          replace: true,
        });
      }
      setLoadError(null);
      persistManifestToBrowserDb(merged, mergedName);
    } catch {
      setLoadError(
        pick(
          "Erreur lors de la lecture des fichiers manifeste.",
          "Error reading manifest file(s)."
        )
      );
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    append = false
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    void processManifestFiles(Array.from(fileList), append);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;
    void processManifestFiles(Array.from(fileList), false);
  };

  const handleReset = () => {
    setManifestState(null, null);
    setActiveSubPage("OVERVIEW", { flightId: "", replace: true });
    resetOverviewFilters();
    setCollapsedDateGroups({});
  };

  const activeFlight = useMemo(() => {
    if (!parsedResult || parsedResult.flights.length === 0) return null;
    return (
      parsedResult.flights.find((f) => f.id === selectedFlightId) ||
      parsedResult.flights[0]
    );
  }, [parsedResult, selectedFlightId]);

  // Metadata for Overview flights table filters
  const overviewFilterMeta = useMemo(() => {
    if (!parsedResult) {
      return {
        dates: [] as { date: string; sortOrder: number; count: number }[],
        flightNumbers: [] as { num: string; count: number }[],
        origins: [] as { code: string; count: number }[],
        destinations: [] as { code: string; count: number }[],
        aircrafts: [] as { code: string; count: number }[],
        registrations: [] as { reg: string; count: number }[],
        unassignedRegCount: 0,
      };
    }

    const dateMap = new Map<string, { sortOrder: number; count: number }>();
    const flightNumCounts: Record<string, number> = {};
    const originCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const aircraftCounts: Record<string, number> = {};
    const regCounts: Record<string, number> = {};
    let unassignedRegCount = 0;

    for (const f of parsedResult.flights) {
      const normDate = normalizeDcsFlightDate(f.date);
      const sortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
      const dEntry = dateMap.get(normDate) || { sortOrder, count: 0 };
      dEntry.count += 1;
      dateMap.set(normDate, dEntry);

      const cleanNum = f.flightNumber.replace(/^0+/, "") || f.flightNumber;
      flightNumCounts[cleanNum] = (flightNumCounts[cleanNum] || 0) + 1;

      if (f.origin) {
        originCounts[f.origin] = (originCounts[f.origin] || 0) + 1;
      }

      if (f.destinationCounts && f.destinationCounts.length > 0) {
        for (const d of f.destinationCounts) {
          destCounts[d.code] = (destCounts[d.code] || 0) + 1;
        }
      } else if (f.primaryDestination) {
        destCounts[f.primaryDestination] =
          (destCounts[f.primaryDestination] || 0) + 1;
      }

      const statusRes = resolveFlightStatusDetail(
        f.flightNumber,
        f.date,
        f.origin,
        flightStatusDetails
      );
      const acType = statusRes.detail?.aircraftType || f.aircraftType;
      if (acType) {
        aircraftCounts[acType] = (aircraftCounts[acType] || 0) + 1;
      }

      const reg = (statusRes.detail?.registration || "").trim().toUpperCase();
      if (reg) {
        regCounts[reg] = (regCounts[reg] || 0) + 1;
      } else {
        unassignedRegCount += 1;
      }
    }

    return {
      dates: Array.from(dateMap.entries())
        .map(([date, info]) => ({ date, ...info }))
        .sort((a, b) => b.sortOrder - a.sortOrder),
      flightNumbers: Object.entries(flightNumCounts)
        .sort((a, b) => (parseInt(a[0], 10) || 0) - (parseInt(b[0], 10) || 0))
        .map(([num, count]) => ({ num, count })),
      origins: Object.entries(originCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      destinations: Object.entries(destCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      aircrafts: Object.entries(aircraftCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      registrations: Object.entries(regCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([reg, count]) => ({ reg, count })),
      unassignedRegCount,
    };
  }, [parsedResult, flightStatusDetails]);

  const hasOverviewFilters =
    overviewDateFilter !== "ALL" ||
    overviewFlightNumFilter !== "ALL" ||
    overviewOriginFilter !== "ALL" ||
    overviewDestFilter !== "ALL" ||
    overviewAircraftFilter !== "ALL" ||
    overviewRegistrationFilter !== "ALL" ||
    overviewAuditFilter !== "ALL" ||
    overviewSearchTerm.trim() !== "";

  const filteredOverviewFlights = useMemo(() => {
    if (!parsedResult) return [];
    const q = overviewSearchTerm.toLowerCase().trim();

    return parsedResult.flights.filter((f) => {
      const normDate = normalizeDcsFlightDate(f.date);
      if (overviewDateFilter !== "ALL" && normDate !== overviewDateFilter) {
        return false;
      }

      const cleanNum = f.flightNumber.replace(/^0+/, "") || f.flightNumber;
      if (
        overviewFlightNumFilter !== "ALL" &&
        cleanNum !== overviewFlightNumFilter
      ) {
        return false;
      }

      if (overviewOriginFilter !== "ALL" && f.origin !== overviewOriginFilter) {
        return false;
      }

      if (overviewDestFilter !== "ALL") {
        const hasDest =
          (f.destinationCounts &&
            f.destinationCounts.some((d) => d.code === overviewDestFilter)) ||
          f.primaryDestination === overviewDestFilter;
        if (!hasDest) return false;
      }

      const statusRes = resolveFlightStatusDetail(
        f.flightNumber,
        f.date,
        f.origin,
        flightStatusDetails
      );
      const acType = statusRes.detail?.aircraftType || f.aircraftType;
      const reg = (statusRes.detail?.registration || "").trim().toUpperCase();

      if (overviewAircraftFilter === "PURE_ECO" && !f.isPureEconomy) {
        return false;
      } else if (
        overviewAircraftFilter !== "ALL" &&
        overviewAircraftFilter !== "PURE_ECO" &&
        acType !== overviewAircraftFilter
      ) {
        return false;
      }

      if (overviewRegistrationFilter === "UNASSIGNED" && reg !== "") {
        return false;
      } else if (
        overviewRegistrationFilter !== "ALL" &&
        overviewRegistrationFilter !== "UNASSIGNED" &&
        reg !== overviewRegistrationFilter
      ) {
        return false;
      }

      if (
        overviewAuditFilter === "UNCOVERED" &&
        f.baggageUncoveredDeviationsCount === 0
      ) {
        return false;
      }
      if (
        overviewAuditFilter === "MISSING_WEIGHT" &&
        (f.baggageMissingWeightCount || 0) === 0
      ) {
        return false;
      }
      if (
        overviewAuditFilter === "COVERED" &&
        f.baggageCoveredDeviationsCount === 0
      ) {
        return false;
      }
      if (
        overviewAuditFilter === "CONFORME" &&
        (f.baggageUncoveredDeviationsCount > 0 ||
          f.baggageCoveredDeviationsCount > 0 ||
          (f.baggageMissingWeightCount || 0) > 0)
      ) {
        return false;
      }

      if (!q) return true;
      const haystack = [
        f.airline,
        f.flightNumber,
        `${f.airline}${f.flightNumber}`,
        `${f.airline} ${f.flightNumber}`,
        normDate,
        f.origin,
        f.primaryDestination,
        ...(f.destinationCounts || []).map((d) => d.code),
        acType,
        reg,
        f.departureTimeFormatted,
        f.gate || "",
        f.configRaw,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    parsedResult,
    flightStatusDetails,
    overviewDateFilter,
    overviewFlightNumFilter,
    overviewOriginFilter,
    overviewDestFilter,
    overviewAircraftFilter,
    overviewRegistrationFilter,
    overviewAuditFilter,
    overviewSearchTerm,
  ]);

  const totalUniqueEmdsCount = useMemo(
    () =>
      parsedResult
        ? extractUniqueEmdsFromFlights(parsedResult.flights).length
        : 0,
    [parsedResult]
  );

  const filteredUniqueEmdsCount = useMemo(
    () => extractUniqueEmdsFromFlights(filteredOverviewFlights).length,
    [filteredOverviewFlights]
  );

  // Split filtered flights by departure date, ordering most recent date first
  const overviewDateGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        date: string;
        sortOrder: number;
        flights: ManifestFlight[];
        totalPax: number;
        totalC: number;
        totalY: number;
        totalBags: number;
        totalWeight: number;
        totalUncovered: number;
        transported: TransportedPassengerReport;
      }
    >();

    for (const f of filteredOverviewFlights) {
      const normDate = normalizeDcsFlightDate(f.date);
      const sortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
      const grp = groupsMap.get(normDate) || {
        date: normDate,
        sortOrder,
        flights: [],
        totalPax: 0,
        totalC: 0,
        totalY: 0,
        totalBags: 0,
        totalWeight: 0,
        totalUncovered: 0,
        transported: {
          totalPassengers: 0,
          rawPassengersCount: 0,
          deduplicatedCount: 0,
          economy: 0,
          business: 0,
          male: 0,
          female: 0,
          child: 0,
          infant: 0,
          unknownGender: 0,
          webCheckin: 0,
        },
      };
      grp.flights.push(f);
      grp.totalPax += f.grandTotals.passengersCount;
      grp.totalC += f.businessTotals.passengersCount;
      grp.totalY += f.economyTotals.passengersCount;
      grp.totalBags += f.grandTotals.bagsCount;
      grp.totalWeight += f.grandTotals.totalWeight;
      grp.totalUncovered += f.baggageUncoveredDeviationsCount;
      groupsMap.set(normDate, grp);
    }

    const groups = Array.from(groupsMap.values()).sort(
      (a, b) => b.sortOrder - a.sortOrder
    );
    for (const grp of groups) {
      grp.transported = computeTransportedPassengerReport(grp.flights);
    }
    return groups;
  }, [filteredOverviewFlights]);

  const filteredOverviewTotals = useMemo(() => {
    return {
      pax: filteredOverviewFlights.reduce(
        (s, f) => s + f.grandTotals.passengersCount,
        0
      ),
      bags: filteredOverviewFlights.reduce(
        (s, f) => s + f.grandTotals.bagsCount,
        0
      ),
      weight: filteredOverviewFlights.reduce(
        (s, f) => s + f.grandTotals.totalWeight,
        0
      ),
      transported: computeTransportedPassengerReport(filteredOverviewFlights),
    };
  }, [filteredOverviewFlights]);

  // Automatic comparison with Programme des Vols whenever both are present
  const reconciliationSummary = useMemo(() => {
    if (!parsedResult || (!scheduleData && storedScheduleSegments.length === 0)) {
      return null;
    }
    return reconcileManifestWithSchedule(
      scheduleData,
      parsedResult,
      storedScheduleSegments
    );
  }, [parsedResult, scheduleData, storedScheduleSegments]);

  const openFlightDetail = (flightId: string) => {
    setActiveSubPage("FLIGHT_DETAIL", { flightId });
  };

  if (!parsedResult) {
    return (
      <div className="bg-white dark:bg-[#1F1209] rounded-2xl border border-[#E6D7C3] dark:border-[#4C2812] p-5 md:p-7">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#FDF4E3] dark:bg-[#2E1A0D] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#5C351B] mb-1">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-[#321B0A] dark:text-[#FAF7F2] tracking-tight">
              {pick("Manifestes de Vols (DCS)", "Flight Manifests (DCS)")}
            </h3>
            <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] max-w-lg mx-auto">
              {pick(
                "Importez un ou plusieurs fichiers manifestes.",
                "Import one or more DCS manifest files."
              )}
            </p>
          </div>

          {scheduleData && (
            <div className="px-3.5 py-2 rounded-xl bg-[#FDF4E3] dark:bg-[#2E1A0D] border border-[#E89C1D]/50 text-xs text-[#321B0A] dark:text-[#FAF7F2] flex items-center justify-center gap-2">
              <span className="font-bold text-[#4C2812] dark:text-[#F7BA42]">
                {pick("Programme actif :", "Active schedule:")}
              </span>
              <span className="font-mono font-semibold">{scheduleData.date}</span>
              <span className="text-[#6E472B] dark:text-[#DECAB1]">
                ({scheduleData.kpOperatedSegmentsCount} {pick("tronçons KP", "KP legs")})
              </span>
            </div>
          )}

          {loadError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs font-medium text-center">
              {loadError}
            </div>
          )}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[#D8C3A5] dark:border-[#5C351B] hover:border-[#4C2812] dark:hover:border-[#E89C1D] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3]/70 dark:hover:bg-[#351F11] rounded-2xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer relative text-center"
          >
            <input
              type="file"
              multiple
              accept=".txt,.pnl,.pgl,.prl,.csv,.dat,.log"
              onChange={(e) => handleFileUpload(e, false)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-9 h-9 text-[#4C2812] dark:text-[#F7BA42] mb-2.5" />
            <p className="text-[#321B0A] dark:text-[#FAF7F2] font-semibold text-sm">
              {pick(
                "Glissez-déposez vos fichiers manifestes (.txt) ou cliquez",
                "Drag and drop manifest files (.txt) or click"
              )}
            </p>
            <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-1">
              {pick(
                "Multi-fichiers pris en charge (.txt, .pnl, .pgl, .prl, .csv)",
                "Multi-file supported (.txt, .pnl, .pgl, .prl, .csv)"
              )}
            </p>
          </div>

          {quickSavedDays.length > 0 && (
            <div className="pt-4 border-t border-[#E6D7C3] dark:border-[#4C2812] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                  <Database className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />
                  <span>
                    {pick(
                      `Sauvegardes locales disponibles (${quickSavedDays.length} journée${quickSavedDays.length > 1 ? "s" : ""})`,
                      `Available local backups (${quickSavedDays.length} day${quickSavedDays.length > 1 ? "s" : ""})`
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLoadBackupDates("ALL")}
                    className="px-3 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {pick(
                      `Afficher toutes les dates (${quickSavedDays.length})`,
                      `Show all dates (${quickSavedDays.length})`
                    )}
                  </button>

                  {selectedBackupDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleLoadBackupDates(selectedBackupDates)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {pick(
                        `Afficher sélection (${selectedBackupDates.length})`,
                        `Load selected (${selectedBackupDates.length})`
                      )}
                    </button>
                  )}

                  {!confirmClearAllBackups ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAllBackups(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {pick("Tout supprimer", "Delete all")}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleClearAllSavedDays()}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-bold cursor-pointer"
                      >
                        {pick("Confirmer tout supprimer", "Confirm delete all")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAllBackups(false)}
                        className="px-2 py-1.5 rounded-lg bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold cursor-pointer"
                      >
                        {pick("Annuler", "Cancel")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {quickSavedDays.map((day) => {
                  const isChecked = selectedBackupDates.includes(day.dateKey);
                  const isConfirming = confirmDeleteDayKey === day.dateKey;
                  return (
                    <div
                      key={day.dateKey}
                      className={`p-3 rounded-xl border transition ${
                        isChecked
                          ? "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D]"
                          : "border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBackupDateSelection(day.dateKey)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2] cursor-pointer"
                          title={pick("Sélectionner pour affichage multi-dates", "Select for multi-date display")}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#E89C1D]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#8C5214] dark:text-[#DECAB1]" />
                          )}
                          <span>{day.dateKey}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleOpenSavedDay(day.dateKey)}
                            className="px-2 py-1 rounded-md bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FolderOpen className="w-3 h-3" />
                            {pick("Ouvrir", "Open")}
                          </button>
                          {!isConfirming ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDayKey(day.dateKey)}
                              className="p-1 rounded-md border border-[#E6D7C3] dark:border-[#5C351B] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#8C5214] dark:text-[#DECAB1] hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
                              title={pick(`Supprimer la sauvegarde du ${day.dateKey}`, `Delete backup for ${day.dateKey}`)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleDeleteSavedDay(day.dateKey)}
                                className="p-1 rounded bg-rose-700 text-white cursor-pointer"
                                title={pick("Confirmer", "Confirm")}
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteDayKey(null)}
                                className="p-1 rounded bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#FAF7F2] cursor-pointer"
                                title={pick("Annuler", "Cancel")}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] mt-1.5 tabular-nums">
                        {day.totalFlights} {pick("vols", "flights")} · {day.totalPassengers} pax ·{" "}
                        {day.totalWeight.toLocaleString(locale)} kg
                      </div>
                      <div className="text-[10px] text-[#8C5214]/80 dark:text-[#F7BA42]/75 truncate mt-0.5">
                        {day.sourceFileName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Collapsible Header & Global Actions */}
      <CollapsiblePanel
        title={fileMeta?.name || pick("Manifeste Actif", "Active Manifest")}
        subtitle={`${parsedResult.totalFlights} ${pick("tronçons", "legs")} · ${parsedResult.totalPassengers} pax · ${parsedResult.manifestDate || (language === "fr" ? "N/D" : "N/A")}${savedDbStatus ? ` · ${savedDbStatus}` : ""}`}
        icon={<FileText className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={false}
        rightContent={
          <button
            type="button"
            onClick={() => {
              setEmdAuditInitialFlightId(undefined);
              setEmdAuditModalFlights(parsedResult.flights);
            }}
            className="px-2.5 py-1 rounded-lg border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            title={pick(
              "Extraire les commandes WINCMD(\"PTRWEMD*...\") pour contrôler les montants des EMD émis",
              "Extract WINCMD(\"PTRWEMD*...\") commands to audit issued EMD amounts"
            )}
          >
            <CreditCard className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
            <span>Audit EMDs</span>
            <span className="font-mono tabular-nums opacity-85">
              ({totalUniqueEmdsCount})
            </span>
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {onOpenAnalytics && (
            <button
              type="button"
              onClick={() => onOpenAnalytics()}
              className="px-3.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {pick("Statistique & Analyse", "Statistics & Analytics")}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setModalConfig({
                isOpen: false,
                scope: "ALL",
                flight: activeFlight,
              })
            }
            className="px-3.5 py-2 rounded-xl bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#E89C1D]" />
            Enhanced Manifest (.txt)
          </button>

          <button
            type="button"
            onClick={() =>
              exportManifestToExcel(
                parsedResult.flights,
                `${pick("Manifeste_KP", "Manifest_KP")}_${parsedResult.manifestDate || pick("Rapport", "Report")}.xlsx`,
                language
              )
            }
            className="px-3.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            {pick("Excel Global", "Global Excel")}
          </button>

          <button
            type="button"
            onClick={() => {
              setEmdAuditInitialFlightId(undefined);
              setEmdAuditModalFlights(parsedResult.flights);
            }}
            className="px-3.5 py-2 rounded-xl border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            title={pick(
              "Extraire les commandes WINCMD(\"PTRWEMD*...\") pour contrôler les montants des EMD émis",
              "Extract WINCMD(\"PTRWEMD*...\") commands to audit issued EMD amounts"
            )}
          >
            <CreditCard className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
            <span>Audit EMDs</span>
            <span className="font-mono text-[11px] font-bold tabular-nums opacity-85">
              ({totalUniqueEmdsCount})
            </span>
          </button>

          <label className="px-3.5 py-2 rounded-xl border border-[#E89C1D]/50 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
            {pick("Ajouter fichier(s)", "Add file(s)")}
            <input
              type="file"
              multiple
              accept=".txt,.pnl,.pgl,.prl,.csv,.dat,.log"
              onChange={(e) => handleFileUpload(e, true)}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#6E472B] dark:text-[#DECAB1] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {pick("Réinitialiser", "Reset")}
          </button>
        </div>
      </CollapsiblePanel>

      {/* Collapsible Saved Backups & Multi-Date Selector (Integrated directly inside Tab 2) */}
      {quickSavedDays.length > 0 && (
        <CollapsiblePanel
          title={pick(
            `Sauvegardes par Dates (${quickSavedDays.length} j)`,
            `Saved Dates (${quickSavedDays.length} d)`
          )}
          subtitle={
            selectedBackupDates.length > 0
              ? selectedBackupDates.join(", ")
              : pick(
                  "Afficher toutes les dates, 1 date ou une sélection",
                  "Load all dates, 1 date, or a selection"
                )
          }
          icon={<Database className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
          defaultOpen={false}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E6D7C3]/70 dark:border-[#4C2812]/70">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleLoadBackupDates("ALL")}
                  className="px-3 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {pick(
                    `Toutes les dates (${quickSavedDays.length})`,
                    `All dates (${quickSavedDays.length})`
                  )}
                </button>

                {selectedBackupDates.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleLoadBackupDates(selectedBackupDates)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {pick(
                        `Afficher les ${selectedBackupDates.length} date(s) sélectionnée(s)`,
                        `Load ${selectedBackupDates.length} selected date(s)`
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBackupDates([])}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] text-xs font-semibold cursor-pointer"
                    >
                      {pick("Tout décocher", "Uncheck all")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBackupDates(quickSavedDays.map((d) => d.dateKey))
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold cursor-pointer"
                  >
                    {pick("Tout cocher", "Select all")}
                  </button>
                )}
              </div>

              {!confirmClearAllBackups ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAllBackups(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {pick("Tout nettoyer", "Clear all backups")}
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleClearAllSavedDays()}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {pick("Confirmer suppression totale", "Confirm delete all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAllBackups(false)}
                    className="px-2 py-1.5 rounded-lg bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold cursor-pointer"
                  >
                    {pick("Annuler", "Cancel")}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {quickSavedDays.map((day) => {
                const isChecked = selectedBackupDates.includes(day.dateKey);
                const isConfirming = confirmDeleteDayKey === day.dateKey;
                return (
                  <div
                    key={day.dateKey}
                    className={`p-3 rounded-xl border transition ${
                      isChecked
                        ? "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D]"
                        : "border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleBackupDateSelection(day.dateKey)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2] cursor-pointer"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#E89C1D]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#8C5214] dark:text-[#DECAB1]" />
                        )}
                        <span>{day.dateKey}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleOpenSavedDay(day.dateKey)}
                          className="px-2 py-1 rounded-md bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen className="w-3 h-3" />
                          {pick("Afficher", "Show")}
                        </button>

                        {!isConfirming ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDayKey(day.dateKey)}
                            className="p-1 rounded-md border border-[#E6D7C3] dark:border-[#5C351B] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#8C5214] dark:text-[#DECAB1] hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
                            title={pick(
                              `Supprimer la sauvegarde du ${day.dateKey}`,
                              `Delete backup for ${day.dateKey}`
                            )}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDeleteSavedDay(day.dateKey)}
                              className="p-1 rounded bg-rose-700 text-white cursor-pointer"
                              title={pick("Confirmer suppression", "Confirm delete")}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDayKey(null)}
                              className="p-1 rounded bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#FAF7F2] cursor-pointer"
                              title={pick("Annuler", "Cancel")}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] mt-1.5 tabular-nums">
                      {day.totalFlights} {pick("vols", "flights")} · {day.totalPassengers} pax ·{" "}
                      {day.totalWeight.toLocaleString(locale)} kg
                    </div>
                    <div className="text-[10px] text-[#8C5214]/80 dark:text-[#F7BA42]/75 truncate mt-0.5">
                      {day.sourceFileName}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsiblePanel>
      )}

      {/* Multi-Page Navigation Tabs (Clean Separation Instead of One Giant Page) */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-1.5 grid grid-cols-2 lg:grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSubPage("OVERVIEW")}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeSubPage === "OVERVIEW"
              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
              : "text-[#6E472B] dark:text-[#DECAB1] hover:bg-[#FAF7F2] dark:hover:bg-[#28170C] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>{pick("1. Vue d'ensemble", "1. Overview")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubPage("FLIGHT_DETAIL")}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeSubPage === "FLIGHT_DETAIL"
              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
              : "text-[#6E472B] dark:text-[#DECAB1] hover:bg-[#FAF7F2] dark:hover:bg-[#28170C] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
          }`}
        >
          <Plane className="w-4 h-4 shrink-0" />
          <span>{pick(`2. Par Vol (${parsedResult.totalFlights})`, `2. By Flight (${parsedResult.totalFlights})`)}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubPage("ALL_PASSENGERS")}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeSubPage === "ALL_PASSENGERS"
              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
              : "text-[#6E472B] dark:text-[#DECAB1] hover:bg-[#FAF7F2] dark:hover:bg-[#28170C] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>{pick(`3. Passagers (${parsedResult.totalPassengers})`, `3. Passengers (${parsedResult.totalPassengers})`)}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubPage("AUDIT")}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeSubPage === "AUDIT"
              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
              : "text-[#6E472B] dark:text-[#DECAB1] hover:bg-[#FAF7F2] dark:hover:bg-[#28170C] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
          }`}
        >
          <ShieldAlert className={`w-4 h-4 shrink-0 ${activeSubPage !== "AUDIT" && (parsedResult.totalUncoveredDeviations > 0 || (parsedResult.totalMissingBaggageWeightCount || 0) > 0) ? "text-rose-600 dark:text-rose-400" : ""}`} />
          <span>
            {pick("4. Écarts & Audit", "4. Audit")}
            {parsedResult.totalUncoveredDeviations + (parsedResult.totalMissingBaggageWeightCount || 0) > 0
              ? ` (${parsedResult.totalUncoveredDeviations + (parsedResult.totalMissingBaggageWeightCount || 0)})`
              : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubPage("RECONCILIATION")}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer col-span-2 lg:col-span-1 ${
            activeSubPage === "RECONCILIATION"
              ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
              : "text-[#6E472B] dark:text-[#DECAB1] hover:bg-[#FAF7F2] dark:hover:bg-[#28170C] hover:text-[#321B0A] dark:hover:text-[#FAF7F2]"
          }`}
        >
          <GitCompareArrows className="w-4 h-4 shrink-0" />
          <span>
            {pick("5. Rapprochement", "5. Match")}
            {reconciliationSummary
              ? ` (${reconciliationSummary.matchedCount}/${reconciliationSummary.totalKpScheduled})`
              : ""}
          </span>
        </button>
      </div>

      {/* Sub-Page 1: Vue d'ensemble */}
      {activeSubPage === "OVERVIEW" && (
        <div className="space-y-4">
          {/* Collapsible KPIs & Programme Comparison Banner */}
          <CollapsiblePanel
            title={pick("Indicateurs Globaux", "Global KPIs")}
            subtitle={`${parsedResult.totalPassengers} pax (${parsedResult.totalBusinessPassengers}C / ${parsedResult.totalEconomyPassengers}Y) · ${parsedResult.totalWebCheckin ?? parsedResult.flights.reduce((s, f) => s + getFlightWebCheckinCount(f), 0)} WB · ${parsedResult.totalBags} pcs · ${parsedResult.totalWeight.toLocaleString(locale)} kg · ${parsedResult.totalUncoveredDeviations} ${pick("écarts sans EMD", "without EMD")}${(parsedResult.totalMissingBaggageWeightCount || 0) > 0 ? ` · ${parsedResult.totalMissingBaggageWeightCount} ${pick("poids manq.", "missing wt")}` : ""} · ${parsedResult.totalEmds} EMD`}
            icon={<LayoutDashboard className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {/* Concise Programme Comparison Bar */}
              <div
                className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  !reconciliationSummary
                    ? "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] text-[#321B0A] dark:text-[#FAF7F2]"
                    : reconciliationSummary.allKpCovered
                    ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-200"
                    : "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D]/50 text-[#321B0A] dark:text-[#FAF7F2]"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs">
                  {!reconciliationSummary ? (
                    <GitCompareArrows className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42] shrink-0" />
                  ) : reconciliationSummary.allKpCovered ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42] shrink-0" />
                  )}
                  <div>
                    {!reconciliationSummary ? (
                      <span>
                        {pick(
                          "Aucun programme des vols chargé pour rapprochement.",
                          "No flight schedule loaded for reconciliation."
                        )}
                      </span>
                    ) : reconciliationSummary.allKpCovered ? (
                      <span>
                        <strong>{pick("Programme OK (100%) :", "Schedule OK (100%):")}</strong>{" "}
                        {reconciliationSummary.totalKpScheduled} {pick("tronçons KP", "KP legs")} ({reconciliationSummary.scheduleDate})
                      </span>
                    ) : (
                      <span>
                        <strong>{reconciliationSummary.scheduleDate} vs {reconciliationSummary.manifestDate} :</strong>{" "}
                        {reconciliationSummary.matchedCount}/{reconciliationSummary.totalKpScheduled} {pick("concordent", "matched")} ·{" "}
                        <strong className="text-rose-700 dark:text-rose-400">
                          {reconciliationSummary.missingCount} {pick("manquant(s)", "missing")}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubPage("RECONCILIATION")}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {reconciliationSummary
                    ? pick("Voir Rapprochement", "Open Match")
                    : pick("Comparer au Programme", "Compare Schedule")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 4 Global KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                    <span>{pick("Passagers Ayant Voyagé", "Traveled Passengers")}</span>
                    <Users className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />
                  </div>
                  <div className="text-2xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1.5 font-mono tabular-nums">
                    {parsedResult.totalPassengers}
                  </div>
                  <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums space-y-0.5">
                    <div>
                      Business (C) :{" "}
                      <span className="font-semibold text-[#4C2812] dark:text-[#F7BA42]">
                        {parsedResult.totalBusinessPassengers}
                      </span>{" "}
                      · {pick("Éco (Y) :", "Eco (Y):")} {" "}
                      <span className="font-semibold text-[#4C2812] dark:text-[#FAF7F2]">
                        {parsedResult.totalEconomyPassengers}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-semibold">
                      <WebCheckinBadge />
                      <span>
                        {pick("Check-in en ligne (WB) :", "Online Check-in (WB):")} {" "}
                        {parsedResult.totalWebCheckin ??
                          parsedResult.flights.reduce(
                            (s, f) => s + getFlightWebCheckinCount(f),
                            0
                          )}
                      </span>
                    </div>
                    {(() => {
                      let totalManifestRows = 0;
                      let totalNoShow = 0;
                      for (const f of parsedResult.flights) {
                        totalManifestRows += f.passengers.length;
                        totalNoShow += f.passengers.filter(isPassengerNoShow).length;
                      }
                      const totalUnseated = totalManifestRows - parsedResult.totalPassengers;
                      if (totalUnseated <= 0) return null;
                      return (
                        <div className="text-[11px] font-sans text-amber-700 dark:text-amber-400">
                          +{totalUnseated} {pick("sans siège conservé(s) en liste", "unseated kept in lists")}
                          {totalNoShow > 0 ? ` (${totalNoShow} No-Show)` : ""}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                    <span>{pick("Volume Bagages Total", "Total Baggage Volume")}</span>
                    <Luggage className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />
                  </div>
                  <div className="text-2xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1.5 font-mono tabular-nums">
                    {parsedResult.totalWeight.toLocaleString(locale)}{" "}
                    <span className="text-sm font-semibold text-[#6E472B] dark:text-[#DECAB1]">kg</span>
                  </div>
                  <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums">
                    {parsedResult.totalBags} {pick("pièces", "pieces")} · {pick("Moy.", "Avg.")}{" "}
                    {parsedResult.totalBags > 0
                      ? (parsedResult.totalWeight / parsedResult.totalBags).toFixed(1)
                      : "0"}{" "}
                    {pick("kg/sac", "kg/bag")}
                  </div>
                </div>

                <div
                  onClick={() => setActiveSubPage("AUDIT")}
                  className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] hover:border-rose-300 dark:hover:border-rose-600 rounded-2xl p-4 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                    <span>{pick("Écarts Franchises Bagages", "Baggage Allowance Deviations")}</span>
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1.5 font-mono tabular-nums">
                    {parsedResult.totalUncoveredDeviations}{" "}
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {pick("sans EMD", "without EMD")}
                    </span>
                  </div>
                  <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums space-y-0.5">
                    <div>
                      + {parsedResult.totalCoveredDeviations} {pick("couverts par EMD → Audit", "covered by EMD → Audit")}
                    </div>
                    {(parsedResult.totalMissingBaggageWeightCount || 0) > 0 && (
                      <div className="font-bold text-amber-700 dark:text-amber-400">
                        + {parsedResult.totalMissingBaggageWeightCount}{" "}
                        {pick("poids bagage(s) non spécifié(s)", "missing baggage weight(s)")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-medium text-[#6E472B] dark:text-[#DECAB1]">
                    <span>{pick("EMD & Fidélité", "EMD & Loyalty")}</span>
                    <Award className="w-4 h-4 text-[#E89C1D]" />
                  </div>
                  <div className="text-2xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1.5 font-mono tabular-nums">
                    {parsedResult.totalEmds}{" "}
                    <span className="text-xs font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                      {pick("EMD émis", "EMDs issued")}
                    </span>
                  </div>
                  <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums">
                    {parsedResult.totalLoyaltyCount} {pick("dossiers FF KP / FQTV", "FF KP / FQTV records")}
                  </div>
                </div>
              </div>
            </div>
          </CollapsiblePanel>

          {/* Collapsible Multi-Criteria Flight Filters Toolbar */}
          <CollapsiblePanel
            title={pick("Filtres des Vols", "Flight Filters")}
            subtitle={`${filteredOverviewFlights.length} / ${parsedResult.totalFlights} ${pick("vols", "flights")} · ${filteredOverviewTotals.pax} pax · ${filteredOverviewTotals.bags} pcs · ${filteredOverviewTotals.weight.toLocaleString(locale)} kg${hasOverviewFilters ? pick(" · Actifs", " · Active") : ""}`}
            icon={<Search className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
            defaultOpen={true}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={overviewSearchTerm}
                  onChange={(e) => setOverviewSearchTerm(e.target.value)}
                  placeholder={pick("Vol, date, origine, immat...", "Flight, date, origin, reg...")}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                />
              </div>

              <select
                value={overviewDateFilter}
                onChange={(e) => setOverviewDateFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par date de départ", "Filter by departure date")}
              >
                <option value="ALL">
                  {pick(`Date : Toutes (${overviewFilterMeta.dates.length})`, `Date: All (${overviewFilterMeta.dates.length})`)}
                </option>
                {overviewFilterMeta.dates.map((d, idx) => (
                  <option key={d.date} value={d.date}>
                    {d.date} ({d.count} {pick(`vol${d.count > 1 ? "s" : ""}`, `flight${d.count > 1 ? "s" : ""}`)})
                    {idx === 0 && overviewFilterMeta.dates.length > 1
                      ? pick(" ★ Récente", " ★ Latest")
                      : ""}
                  </option>
                ))}
              </select>

              <select
                value={overviewFlightNumFilter}
                onChange={(e) => setOverviewFlightNumFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par numéro de vol", "Filter by flight number")}
              >
                <option value="ALL">{pick("N° Vol : Tous", "Flight #: All")}</option>
                {overviewFilterMeta.flightNumbers.map((fn) => (
                  <option key={fn.num} value={fn.num}>
                    KP {fn.num} ({fn.count})
                  </option>
                ))}
              </select>

              <select
                value={overviewOriginFilter}
                onChange={(e) => setOverviewOriginFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par station de départ (origine)", "Filter by departure station (origin)")}
              >
                <option value="ALL">{pick("Origine : Toutes", "Origin: All")}</option>
                {overviewFilterMeta.origins.map((orig) => (
                  <option key={orig.code} value={orig.code}>
                    {pick("Départ", "Dep.")} {orig.code} ({orig.count})
                  </option>
                ))}
              </select>

              <select
                value={overviewDestFilter}
                onChange={(e) => setOverviewDestFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par destination", "Filter by destination")}
              >
                <option value="ALL">{pick("Destination : Toutes", "Destination: All")}</option>
                {overviewFilterMeta.destinations.map((dst) => (
                  <option key={dst.code} value={dst.code}>
                    → {dst.code} ({dst.count})
                  </option>
                ))}
              </select>

              <select
                value={overviewAircraftFilter}
                onChange={(e) => setOverviewAircraftFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par type d'appareil ou cabine", "Filter by aircraft type or cabin")}
              >
                <option value="ALL">{pick("Appareil : Tous", "Aircraft: All")}</option>
                <option value="PURE_ECO">{pick("Pure Éco uniquement (Yx)", "Pure Economy only (Yx)")}</option>
                {overviewFilterMeta.aircrafts.map((ac) => (
                  <option key={ac.code} value={ac.code}>
                    {pick("Avion", "Aircraft")} {ac.code} ({ac.count})
                  </option>
                ))}
              </select>

              <select
                value={overviewRegistrationFilter}
                onChange={(e) => setOverviewRegistrationFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par immatriculation appareil", "Filter by aircraft registration")}
              >
                <option value="ALL">
                  {pick(
                    `Immat. : Toutes (${overviewFilterMeta.registrations.length})`,
                    `Reg.: All (${overviewFilterMeta.registrations.length})`
                  )}
                </option>
                {overviewFilterMeta.registrations.map((r) => (
                  <option key={r.reg} value={r.reg}>
                    {r.reg} ({r.count})
                  </option>
                ))}
                {overviewFilterMeta.unassignedRegCount > 0 && (
                  <option value="UNASSIGNED">
                    {pick(
                      `Sans immat. (${overviewFilterMeta.unassignedRegCount})`,
                      `No reg. (${overviewFilterMeta.unassignedRegCount})`
                    )}
                  </option>
                )}
              </select>

              <select
                value={overviewAuditFilter}
                onChange={(e) => setOverviewAuditFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Filtrer par conformité bagages", "Filter by baggage compliance")}
              >
                <option value="ALL">{pick("Audit Bagages : Tous", "Baggage Audit: All")}</option>
                <option value="UNCOVERED">{pick("Avec écarts sans EMD", "With uncovered deviations")}</option>
                <option value="MISSING_WEIGHT">{pick("Avec poids bagage manquant", "With missing bag weight")}</option>
                <option value="COVERED">{pick("Avec excédents couverts EMD", "With EMD-covered excess")}</option>
                <option value="CONFORME">{pick("100% Conformes", "100% Compliant")}</option>
              </select>

              {hasOverviewFilters && (
                <button
                  type="button"
                  onClick={resetOverviewFilters}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  {pick("Réinitialiser", "Reset")}
                </button>
              )}
            </div>
          </CollapsiblePanel>

          {/* Comparative Multi-Flight Summary Table Split by Date */}
          <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2] flex flex-wrap items-center gap-2">
                  <span>
                    {pick(
                      `Tableau des Vols (${filteredOverviewFlights.length} / ${parsedResult.totalFlights})`,
                      `Flights Table (${filteredOverviewFlights.length} / ${parsedResult.totalFlights})`
                    )}
                  </span>
                  {overviewFilterMeta.dates.length > 1 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#FDF4E3] dark:bg-[#3A2212] border border-[#E89C1D]/50 text-[#4C2812] dark:text-[#F7BA42] font-mono text-[11px] font-semibold">
                      {overviewFilterMeta.dates.length} dates · {pick("Priorité", "Priority")} {overviewFilterMeta.dates[0].date}
                    </span>
                  )}
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs font-mono tabular-nums text-[#6E472B] dark:text-[#DECAB1]">
                    <strong className="text-[#321B0A] dark:text-[#FAF7F2]">
                      {filteredOverviewTotals.transported.totalPassengers}
                    </strong>{" "}
                    {pick("transportés", "transported")} ·{" "}
                    {filteredOverviewTotals.bags} pcs ·{" "}
                    <strong className="text-[#321B0A] dark:text-[#F7BA42]">
                      {filteredOverviewTotals.weight.toLocaleString(locale)} kg
                    </strong>
                  </div>

                  {filteredOverviewFlights.length > 0 && (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          exportManifestOverviewReportToPDF(
                            overviewDateGroups,
                            filteredOverviewFlights,
                            language
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                        title={pick(
                          "Exporter le rapport statistique des vols en PDF",
                          "Export flights statistical report as PDF"
                        )}
                      >
                        <FileText className="w-3 h-3 text-[#E89C1D]" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          exportManifestOverviewReportToCSV(
                            overviewDateGroups,
                            filteredOverviewFlights,
                            language
                          )
                        }
                        className="px-2.5 py-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                        title={pick(
                          "Exporter le rapport statistique des vols en CSV",
                          "Export flights statistical report as CSV"
                        )}
                      >
                        <FileDown className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmdAuditInitialFlightId(undefined);
                          setEmdAuditModalFlights(filteredOverviewFlights);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                        title={pick(
                          "Extraire les commandes WINCMD(\"PTRWEMD*...\") pour les vols affichés",
                          "Extract WINCMD(\"PTRWEMD*...\") commands for displayed flights"
                        )}
                      >
                        <CreditCard className="w-3 h-3 text-[#8C5214] dark:text-[#E89C1D]" />
                        <span>Audit EMDs</span>
                        <span className="font-mono tabular-nums opacity-85">
                          ({filteredUniqueEmdsCount})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {filteredOverviewFlights.length > 0 && (
                <div className="pt-2 border-t border-[#E6D7C3]/70 dark:border-[#4C2812]/70 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2]">
                    <span>
                      {pick("Éco (Y)", "Eco (Y)")}:{" "}
                      <strong>{filteredOverviewTotals.transported.economy}</strong>
                    </span>
                    <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                    <span>
                      {pick("Business (C)", "Business (C)")}:{" "}
                      <strong className="dark:text-[#F7BA42]">{filteredOverviewTotals.transported.business}</strong>
                    </span>
                    <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                    <span>
                      {pick("H", "M")}:{" "}
                      <strong>{filteredOverviewTotals.transported.male}</strong>
                    </span>
                    <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                    <span>
                      {pick("F", "W")}:{" "}
                      <strong>{filteredOverviewTotals.transported.female}</strong>
                    </span>
                    <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                    <span>
                      CHD:{" "}
                      <strong>{filteredOverviewTotals.transported.child}</strong>
                    </span>
                    <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                    <span>
                      INF:{" "}
                      <strong className="dark:text-[#F7BA42]">{filteredOverviewTotals.transported.infant}</strong>
                    </span>
                    <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                    <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 font-semibold">
                      <WebCheckinBadge />
                      <span>
                        WB:{" "}
                        <strong>{filteredOverviewTotals.transported.webCheckin}</strong>
                        {filteredOverviewTotals.transported.totalPassengers > 0
                          ? ` (${((filteredOverviewTotals.transported.webCheckin / filteredOverviewTotals.transported.totalPassengers) * 100).toFixed(0)}%)`
                          : ""}
                      </span>
                    </span>
                    {filteredOverviewTotals.transported.unknownGender > 0 && (
                      <>
                        <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>
                        <span className="text-[#6E472B] dark:text-[#DECAB1]">
                          {pick("N/D", "N/A")}:{" "}
                          <strong>{filteredOverviewTotals.transported.unknownGender}</strong>
                        </span>
                      </>
                    )}
                </div>
              )}
            </div>

            {overviewDateGroups.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm text-[#6E472B] dark:text-[#DECAB1]">
                  {pick(
                    "Aucun vol ne correspond aux filtres sélectionnés.",
                    "No flights match the selected filters."
                  )}
                </p>
                {hasOverviewFilters && (
                  <button
                    type="button"
                    onClick={resetOverviewFilters}
                    className="px-3 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] text-xs font-semibold cursor-pointer"
                  >
                    {pick("Afficher tous les vols", "Show all flights")}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] border-b border-[#321B0A] dark:border-[#5C351B] text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-3 pl-5 pr-3">{pick("Date", "Date")}</th>
                      <th className="py-3 px-3">{pick("Vol / Origine", "Flight / Origin")}</th>
                      <th className="py-3 px-3">{pick("Destinations", "Destinations")}</th>
                      <th className="py-3 px-3">{pick("Heure / Avion", "Time / Aircraft")}</th>
                      <th className="py-3 px-3">{pick("Config", "Config")}</th>
                      <th className="py-3 px-3">
                        <span className="inline-flex items-center gap-1">
                          <span>{pick("Passagers", "Passengers")}</span>
                          <span className="text-sky-300 font-mono text-[10px]">
                            ({filteredOverviewTotals.transported.webCheckin} WB)
                          </span>
                        </span>
                      </th>
                      <th className="py-3 px-3">{pick("Bagages", "Baggage")}</th>
                      <th className="py-3 px-3">{pick("Audit", "Audit")}</th>
                      <th className="py-3 px-3">EMD / FF</th>
                      <th className="py-3 pr-5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                    {overviewDateGroups.map((group, groupIdx) => {
                      const isCollapsed = Boolean(collapsedDateGroups[group.date]);
                      const isNewestGroup =
                        groupIdx === 0 && overviewDateGroups.length > 1;

                      return (
                        <React.Fragment key={group.date}>
                          {/* Date Split Banner Row */}
                          <tr
                            onClick={() =>
                              setCollapsedDateGroups((prev) => ({
                                ...prev,
                                [group.date]: !prev[group.date],
                              }))
                            }
                            className="bg-[#321B0A] dark:bg-[#2C180B] text-white border-y border-[#6E472B] dark:border-[#5C351B] cursor-pointer hover:bg-[#4C2812] dark:hover:bg-[#3A2010] transition-colors"
                          >
                            <td colSpan={10} className="py-3 px-5">
                              <div className="space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 font-mono text-xs">
                                    {isCollapsed ? (
                                      <ChevronDown className="w-4 h-4 text-[#F7BA42] shrink-0" />
                                    ) : (
                                      <ChevronUp className="w-4 h-4 text-[#F7BA42] shrink-0" />
                                    )}
                                    <Calendar className="w-3.5 h-3.5 text-[#E89C1D] shrink-0" />
                                    <span className="font-bold tracking-wide text-white">
                                      {group.date}
                                    </span>
                                    {isNewestGroup && (
                                      <span className="px-2 py-0.5 rounded bg-[#E89C1D] text-[#321B0A] text-[10px] font-sans font-bold uppercase tracking-wider">
                                        {pick("Récent", "Latest")}
                                      </span>
                                    )}
                                    <span className="text-[#F3E9D8] font-semibold">
                                      · {group.flights.length}{" "}
                                      {pick(
                                        `vol${group.flights.length > 1 ? "s" : ""}`,
                                        `flight${group.flights.length > 1 ? "s" : ""}`
                                      )}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums text-[#F3E9D8]">
                                    <span>
                                      <strong className="text-white">
                                        {group.transported.totalPassengers}
                                      </strong>{" "}
                                      {pick("transportés", "transported")}
                                    </span>
                                    <span className="text-[#8C5214] dark:text-[#E89C1D]">·</span>
                                    <span>
                                      {group.totalBags} pcs ·{" "}
                                      <strong className="text-[#F7BA42]">
                                        {group.totalWeight.toLocaleString(locale)} kg
                                      </strong>
                                    </span>
                                    {group.totalUncovered > 0 && (
                                      <>
                                        <span className="text-[#8C5214] dark:text-[#E89C1D]">·</span>
                                        <span className="text-rose-300 font-bold">
                                          {group.totalUncovered} {pick("écart(s) sans EMD", "deviation(s) without EMD")}
                                        </span>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreselectedPaxDates([group.date]);
                                        setPreselectedPaxFlightNumbers([]);
                                        setActiveSubPage("ALL_PASSENGERS");
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-[#E89C1D] hover:bg-[#F7BA42] text-[#1F1209] font-sans text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                                      title={pick(
                                        `Voir et filtrer tous les passagers du ${group.date}`,
                                        `View and filter all passengers on ${group.date}`
                                      )}
                                    >
                                      <Users className="w-3 h-3" />
                                      <span>{pick("Voir passagers", "View passengers")}</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Complete Transported Passenger Report for this Departure Date */}
                                <div className="pt-2 border-t border-[#6E472B]/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#F3E9D8]">
                                    <span className="font-semibold text-[#F7BA42] uppercase tracking-wider text-[10px]">
                                      {pick("Transportés :", "Traveled:")}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-3 sm:grid-cols-6 lg:flex lg:flex-wrap items-center gap-2 sm:gap-3 font-mono tabular-nums">
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#6E472B]/80 flex items-center gap-1.5">
                                      <span className="text-[#E6D7C3] text-[10px] font-sans uppercase">
                                        {pick("Éco (Y)", "Eco (Y)")}
                                      </span>
                                      <strong className="text-white">
                                        {group.transported.economy}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#6E472B]/80 flex items-center gap-1.5">
                                      <span className="text-[#F7BA42] text-[10px] font-sans uppercase">
                                        {pick("Business (C)", "Business (C)")}
                                      </span>
                                      <strong className="text-[#F7BA42]">
                                        {group.transported.business}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#6E472B]/80 flex items-center gap-1.5">
                                      <span className="text-[#E6D7C3] text-[10px] font-sans uppercase">
                                        {pick("Hommes", "Men")}
                                      </span>
                                      <strong className="text-white">
                                        {group.transported.male}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#6E472B]/80 flex items-center gap-1.5">
                                      <span className="text-[#E6D7C3] text-[10px] font-sans uppercase">
                                        {pick("Femmes", "Women")}
                                      </span>
                                      <strong className="text-white">
                                        {group.transported.female}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#6E472B]/80 flex items-center gap-1.5">
                                      <span className="text-[#E6D7C3] text-[10px] font-sans uppercase">
                                        {pick("Enfants (CHD)", "Children (CHD)")}
                                      </span>
                                      <strong className="text-white">
                                        {group.transported.child}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#E89C1D]/60 flex items-center gap-1.5">
                                      <span className="text-[#F7BA42] text-[10px] font-sans uppercase">
                                        {pick("Bébés (INF)", "Infants (INF)")}
                                      </span>
                                      <strong className="text-[#F7BA42]">
                                        {group.transported.infant}
                                      </strong>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-sky-400/50 flex items-center gap-1.5">
                                      <WebCheckinBadge />
                                      <span className="text-sky-200 text-[10px] font-sans uppercase">
                                        WB
                                      </span>
                                      <strong className="text-sky-300">
                                        {group.transported.webCheckin}
                                      </strong>
                                    </div>
                                    {group.transported.unknownGender > 0 && (
                                      <div className="px-2 py-1 rounded bg-[#4C2812] dark:bg-[#1F1209] border border-[#6E472B]/80 flex items-center gap-1.5">
                                        <span className="text-[#E6D7C3] text-[10px] font-sans uppercase">
                                          {pick("N/D", "N/A")}
                                        </span>
                                        <strong className="text-[#F3E9D8]">
                                          {group.transported.unknownGender}
                                        </strong>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {!isCollapsed &&
                            group.flights.map((f, fIdx) => {
                              const destSummary =
                                f.destinationCounts && f.destinationCounts.length > 0
                                  ? f.destinationCounts
                                      .slice(0, 3)
                                      .map((d) => `${d.code} (${d.count})`)
                                      .join(", ") +
                                    (f.destinationCounts.length > 3
                                      ? ` +${f.destinationCounts.length - 3}`
                                      : "")
                                  : f.primaryDestination || "—";

                              const zebraClass =
                                fIdx % 2 === 0
                                  ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                                  : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]";
                              const accentClass =
                                f.baggageUncoveredDeviationsCount > 0
                                  ? "shadow-[inset_3px_0_0_#f43f5e]"
                                  : (f.baggageMissingWeightCount || 0) > 0
                                  ? "shadow-[inset_3px_0_0_#f59e0b]"
                                  : "";

                              const statusRes = resolveFlightStatusDetail(
                                f.flightNumber,
                                f.date,
                                f.origin,
                                flightStatusDetails
                              );
                              const detail = statusRes.detail;
                              const acTypeDisplay =
                                detail?.aircraftType || f.aircraftType || "—";
                              const regDisplay = detail?.registration || "";
                              const capTotal =
                                detail && detail.totalCapacity > 0
                                  ? detail.totalCapacity
                                  : null;
                              const traveledCount = f.grandTotals.passengersCount;
                              const lfPct =
                                capTotal !== null && capTotal > 0
                                  ? Number(((traveledCount / capTotal) * 100).toFixed(1))
                                  : null;
                              const lfBarColor =
                                lfPct === null
                                  ? "bg-[#D8C3A5] dark:bg-[#4C2812]"
                                  : lfPct >= 85
                                  ? "bg-emerald-500"
                                  : lfPct >= 65
                                  ? "bg-sky-500"
                                  : lfPct >= 45
                                  ? "bg-amber-500"
                                  : "bg-rose-500";
                              const gateDisplay = detail?.gate || f.gate;

                              return (
                                <tr
                                  key={f.id}
                                  onClick={() => openFlightDetail(f.id)}
                                  className={`cursor-pointer transition-colors ${zebraClass} ${accentClass}`}
                                >
                                  <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] font-mono text-[11px] font-bold">
                                      {normalizeDcsFlightDate(f.date)}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                                    {f.airline} {f.flightNumber} · {pick("Départ", "Dep.")}{" "}
                                    <span className="text-[#8C5214] dark:text-[#F7BA42]">{f.origin}</span>
                                  </td>
                                  <td className="py-3.5 px-3 font-mono text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                                    {destSummary}
                                  </td>
                                  <td className="py-3.5 px-3 font-mono text-[#6E472B] dark:text-[#DECAB1] tabular-nums whitespace-nowrap">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
                                          {f.departureTimeFormatted} · {acTypeDisplay}
                                          {regDisplay ? (
                                            <span className="text-[#8C5214] dark:text-[#F7BA42] font-bold">
                                              /{regDisplay}
                                            </span>
                                          ) : null}
                                          {detail?.isManualOverride && (
                                            <span className="ml-1 text-[10px] font-sans font-semibold text-indigo-600 dark:text-amber-400">
                                              ({pick("Modifié", "Edited")})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">
                                          {capTotal !== null ? (
                                            <>
                                              {`${detail?.businessCapacity ?? 0}C/${detail?.economyCapacity ?? 0}Y (${capTotal})`}
                                              {gateDisplay ? ` · ${pick("Porte", "Gate")} ${gateDisplay}` : ""}
                                            </>
                                          ) : (
                                            <>
                                              <span className="italic opacity-75">
                                                {pick("Détails PTRG* non importés", "PTRG* details missing")}
                                              </span>
                                              {gateDisplay ? ` · ${pick("Porte", "Gate")} ${gateDisplay}` : ""}
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEquipmentFlight(f);
                                        }}
                                        className="p-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:border-[#E89C1D] text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42] transition cursor-pointer shrink-0"
                                        title={pick(
                                          "Modifier l'équipement (type, immatriculation, capacité)",
                                          "Edit equipment (type, registration, capacity)"
                                        )}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 font-mono text-[#4C2812] dark:text-[#FAF7F2] whitespace-nowrap">
                                    {f.isPureEconomy
                                      ? `${pick("Pure Éco", "Pure Eco")} · ${f.configRaw}`
                                      : f.configRaw || "—"}
                                  </td>
                                  <td className="py-3.5 px-3 font-mono tabular-nums whitespace-nowrap">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                        {traveledCount}
                                      </span>
                                      {capTotal !== null && lfPct !== null && (
                                        <span className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                                          / {capTotal}{" "}
                                          <span
                                            className={`font-bold ${
                                              lfPct >= 85
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : lfPct >= 65
                                                ? "text-sky-700 dark:text-sky-400"
                                                : lfPct >= 45
                                                ? "text-amber-700 dark:text-amber-400"
                                                : "text-rose-700 dark:text-rose-400"
                                            }`}
                                          >
                                            ({lfPct}%)
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                    {/* Mini load factor progress bar */}
                                    <div
                                      className="mt-1 w-24 h-1.5 rounded-full bg-[#E6D7C3]/80 dark:bg-[#3A2212] overflow-hidden"
                                      title={
                                        lfPct !== null
                                          ? `${pick("Remplissage", "Load factor")}: ${lfPct}% (${traveledCount}/${capTotal})`
                                          : pick("Capacité non importée (Programme des Vols)", "Capacity not imported (Flight Schedule)")
                                      }
                                    >
                                      <div
                                        className={`h-full rounded-full transition-all ${lfBarColor}`}
                                        style={{
                                          width: `${lfPct !== null ? Math.min(100, Math.max(4, lfPct)) : 0}%`,
                                        }}
                                      />
                                    </div>
                                    {(() => {
                                      const wbCount = getFlightWebCheckinCount(f);
                                      const unseated = f.passengers.length - f.grandTotals.passengersCount;
                                      const noShow = f.passengers.filter(isPassengerNoShow).length;
                                      return (
                                        <div className="mt-1 space-y-0.5">
                                          {wbCount > 0 && (
                                            <div className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-300">
                                              <WebCheckinBadge />
                                              <span>
                                                {wbCount} WB
                                                {traveledCount > 0
                                                  ? ` (${((wbCount / traveledCount) * 100).toFixed(0)}%)`
                                                  : ""}
                                              </span>
                                            </div>
                                          )}
                                          {unseated > 0 && (
                                            <div className="text-[10px] font-sans text-[#8C5214] dark:text-[#F7BA42]">
                                              +{unseated} {pick("sans siège", "unseated")}
                                              {noShow > 0 && (
                                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                                  {" "}({noShow} NS)
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-3.5 px-3 font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                                    <span className="font-bold">
                                      {f.grandTotals.bagsCount}/
                                      {f.grandTotals.totalWeight.toLocaleString(locale)} kg
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3 whitespace-nowrap">
                                    <div className="flex flex-col gap-0.5">
                                      {(f.baggageMissingWeightCount || 0) > 0 && (
                                        <span className="text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                                          {f.baggageMissingWeightCount} {pick("poids manq.", "missing wt")}
                                        </span>
                                      )}
                                      {f.baggageUncoveredDeviationsCount > 0 ? (
                                        <span className="text-rose-700 dark:text-rose-400 font-bold">
                                          {f.baggageUncoveredDeviationsCount} {pick("sans EMD", "no EMD")}
                                          {f.baggageCoveredDeviationsCount > 0
                                            ? ` · ${f.baggageCoveredDeviationsCount} ${pick("couverts", "covered")}`
                                            : ""}
                                        </span>
                                      ) : f.baggageCoveredDeviationsCount > 0 ? (
                                        <span className="text-[#8C5214] dark:text-[#F7BA42] font-semibold">
                                          {f.baggageCoveredDeviationsCount} {pick("couverts EMD", "EMD covered")}
                                        </span>
                                      ) : (f.baggageMissingWeightCount || 0) === 0 ? (
                                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                          {pick("Conforme", "Compliant")}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 font-mono font-semibold text-[#6E472B] dark:text-[#DECAB1] tabular-nums whitespace-nowrap">
                                    {f.emdCount}/{f.ffCount + f.fqtvCount}
                                  </td>
                                  <td className="py-3.5 pr-5 pl-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadTextFile(
                                            `ENHANCED_MANIFEST_${f.airline}${f.flightNumber}_${f.origin}_${f.date}.txt`,
                                            generateEnhancedManifestText(f, {
                                              excludeUnboarded: true,
                                            })
                                          );
                                        }}
                                        className="text-xs font-semibold text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42] inline-flex items-center gap-1 cursor-pointer"
                                        title={pick("Télécharger Enhanced Manifest (.txt)", "Download Enhanced Manifest (.txt)")}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        .TXT
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openFlightDetail(f.id);
                                        }}
                                        className="text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        {pick("Explorer", "Explore")}
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Page 2: Manifeste par Vol */}
      {activeSubPage === "FLIGHT_DETAIL" && (
        <ManifestFlightDetailView
          parsedResult={parsedResult}
          selectedFlightId={selectedFlightId}
          onSelectFlight={setSelectedFlightId}
          flightStatusDetails={flightStatusDetails}
          emdDetailsMap={emdDetailsMap}
          onOpenEmdAudit={(flight) => {
            setEmdAuditInitialFlightId(flight.id);
            setEmdAuditModalFlights(parsedResult.flights);
          }}
          onEditEquipment={(flight) => setEditingEquipmentFlight(flight)}
          onOpenEnhancedManifest={(flight) =>
            setModalConfig({ isOpen: true, scope: "SINGLE", flight })
          }
          onViewFlightEvolution={
            onOpenAnalytics
              ? (flightNumber, origin) => onOpenAnalytics(flightNumber, origin)
              : undefined
          }
        />
      )}

      {/* Sub-Page 3: Tous Passagers (Multi-Dates & Multi-Vols) */}
      {activeSubPage === "ALL_PASSENGERS" && (
        <MultiFlightPassengersView
          parsedResult={parsedResult}
          emdDetailsMap={emdDetailsMap}
          preselectedDates={preselectedPaxDates}
          preselectedFlightNumbers={preselectedPaxFlightNumbers}
          onPreselectionConsumed={() => {
            setPreselectedPaxDates(null);
            setPreselectedPaxFlightNumbers(null);
          }}
          onInspectFlight={openFlightDetail}
        />
      )}

      {/* Sub-Page 4: Écarts & Contrôles */}
      {activeSubPage === "AUDIT" && (
        <ManifestAuditView
          parsedResult={parsedResult}
          emdDetailsMap={emdDetailsMap}
          onImportEmdDetails={handleImportEmdDetails}
          onClearEmdDetails={handleClearEmdDetails}
        />
      )}

      {/* Sub-Page 5: Rapprochement Programme des Vols */}
      {activeSubPage === "RECONCILIATION" && (
        <ManifestReconciliationView
          manifestData={parsedResult}
          scheduleData={scheduleData}
          storedScheduleSegments={storedScheduleSegments}
          onScheduleLoaded={setScheduleState}
          onInspectFlight={openFlightDetail}
        />
      )}

      {/* Enhanced Passenger Manifest Export Modal */}
      <EnhancedManifestModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        flights={parsedResult.flights}
        selectedFlight={modalConfig.flight || activeFlight}
        initialScope={modalConfig.scope}
      />

      {/* Flight Equipment Edit Modal */}
      <FlightEquipmentEditModal
        isOpen={Boolean(editingEquipmentFlight)}
        onClose={() => setEditingEquipmentFlight(null)}
        flightContext={
          editingEquipmentFlight
            ? {
                airline: editingEquipmentFlight.airline,
                flightNumber: editingEquipmentFlight.flightNumber,
                date: editingEquipmentFlight.date,
                origin: editingEquipmentFlight.origin,
                destination: editingEquipmentFlight.primaryDestination,
                defaultAircraftType: editingEquipmentFlight.aircraftType,
                etdHeader: editingEquipmentFlight.departureTime,
                gate: editingEquipmentFlight.gate,
                boardedPaxCount: editingEquipmentFlight.grandTotals.passengersCount,
              }
            : null
        }
        existingDetail={
          editingEquipmentFlight
            ? resolveFlightStatusDetail(
                editingEquipmentFlight.flightNumber,
                editingEquipmentFlight.date,
                editingEquipmentFlight.origin,
                flightStatusDetails
              ).detail
            : null
        }
        allStatusDetails={flightStatusDetails}
        onSave={handleSaveFlightEquipment}
        onRemoveManual={handleRemoveFlightEquipment}
      />

      {/* Audit EMDs WINCMD Extraction Modal */}
      <EmdAuditWincmdModal
        isOpen={Boolean(emdAuditModalFlights)}
        onClose={() => {
          setEmdAuditModalFlights(null);
          setEmdAuditInitialFlightId(undefined);
        }}
        flights={emdAuditModalFlights || parsedResult.flights}
        initialFlightId={emdAuditInitialFlightId}
        dateLabel={
          overviewDateFilter !== "ALL"
            ? overviewDateFilter
            : parsedResult.manifestDate
        }
        emdDetailsMap={emdDetailsMap}
        onImportEmdDetails={handleImportEmdDetails}
        onClearEmdDetails={handleClearEmdDetails}
      />
    </div>
  );
};
