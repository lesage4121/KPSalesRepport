import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  FileCode,
  FileDown,
  FileText,
  List,
  MessageSquareText,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { EmdDocumentDetail, ManifestFlight } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import {
  classifyEmdBaggagePieces,
  computeEmdTotalInCurrency,
  computeStationFlightEmdSummary,
  convertEmdDetailToCurrency,
  downloadEmdWincmdAnsi,
  extractUniqueEmdsFromFlights,
  formatCurrencyAmount,
  formatCurrencyTotals,
  formatEmdMonetaryValue,
  formatEmdMonetaryWithTarget,
  formatEmdRoute,
  formatFopMethodLabel,
  formatIssuingPointLabel,
  formatTotalsWithTarget,
  generateEmdWincmdText,
  getEmdIssuanceInfo,
  loadDisplayCurrency,
  loadXofRates,
  normalizeEmdNumber,
  parseWemdOutputFile,
} from "../../utils/emdAudit";
import {
  exportEmdAuditListToCSV,
  exportEmdAuditListToPDF,
} from "../../utils/emdPdfExport";
import { getDcsFlightDateSortOrder } from "../../utils/manifestParser";
import { FilterCombobox } from "../ui/FilterCombobox";
import { XofRatesPopover } from "./XofRatesPopover";

interface EmdAuditWincmdModalProps {
  isOpen: boolean;
  onClose: () => void;
  flights: ManifestFlight[];
  initialFlightId?: string;
  dateLabel?: string;
  emdDetailsMap?: Record<string, EmdDocumentDetail>;
  onImportEmdDetails?: (emds: EmdDocumentDetail[]) => void;
  onClearEmdDetails?: () => void;
}

function matchesFilterText(
  candidate: string | undefined,
  filterVal: string
): boolean {
  const f = (filterVal || "").trim().toLowerCase();
  if (!f || f === "all") return true;
  return (candidate || "").toLowerCase().includes(f);
}

export const EmdAuditWincmdModal: React.FC<EmdAuditWincmdModalProps> = ({
  isOpen,
  onClose,
  flights,
  initialFlightId,
  dateLabel,
  emdDetailsMap = {},
  onImportEmdDetails,
  onClearEmdDetails,
}) => {
  const { language, pick } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const [activeTab, setActiveTab] = useState<"commands" | "list" | "audit">(
    "commands"
  );
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [flightFilter, setFlightFilter] = useState<string>(
    initialFlightId || "ALL"
  );
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [stationNumberFilter, setStationNumberFilter] = useState<string>("ALL");
  const [reasonFilter, setReasonFilter] = useState<string>("ALL");
  const [stationOriginOnly, setStationOriginOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [auditScopeAll, setAuditScopeAll] = useState(false);
  const [xofRates, setXofRates] = useState<Record<string, number>>(() =>
    loadXofRates()
  );
  const [displayCurrency, setDisplayCurrency] = useState<string>(() =>
    loadDisplayCurrency()
  );
  const [importFeedback, setImportFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncRates = () => setXofRates(loadXofRates());
    const syncCurrency = () => setDisplayCurrency(loadDisplayCurrency());
    window.addEventListener("kp-xof-rates-updated", syncRates);
    window.addEventListener("kp-display-currency-updated", syncCurrency);
    return () => {
      window.removeEventListener("kp-xof-rates-updated", syncRates);
      window.removeEventListener("kp-display-currency-updated", syncCurrency);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFlightFilter(initialFlightId || "ALL");
    setDateFilter("ALL");
    setStationFilter("ALL");
    setAgentFilter("ALL");
    setStationNumberFilter("ALL");
    setReasonFilter("ALL");
    setStationOriginOnly(false);
    setSearchTerm("");
    setCopied(false);
    setImportFeedback(null);
    setAuditScopeAll(false);
  }, [isOpen, initialFlightId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const availableDates = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of flights) {
      if (!f.date) continue;
      const order = getDcsFlightDateSortOrder(f.date, f.extractedYear);
      const prev = map.get(f.date);
      if (prev === undefined || order < prev) {
        map.set(f.date, order);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([date]) => date);
  }, [flights]);

  const dateScopedFlights = useMemo(() => {
    if (!dateFilter || dateFilter === "ALL") return flights;
    const f = dateFilter.trim().toLowerCase();
    return flights.filter((fl) => (fl.date || "").toLowerCase().includes(f));
  }, [flights, dateFilter]);

  const selectedFlightObj = useMemo(() => {
    if (!flightFilter || flightFilter === "ALL") return null;
    return dateScopedFlights.find((f) => f.id === flightFilter) || null;
  }, [dateScopedFlights, flightFilter]);

  const selectedFlightStationSummary = useMemo(() => {
    if (!selectedFlightObj) return null;
    return computeStationFlightEmdSummary(
      selectedFlightObj,
      emdDetailsMap,
      xofRates,
      displayCurrency
    );
  }, [selectedFlightObj, emdDetailsMap, xofRates, displayCurrency]);

  const selectedFlights = useMemo(() => {
    if (!flightFilter || flightFilter === "ALL") return dateScopedFlights;
    const exact = dateScopedFlights.filter((f) => f.id === flightFilter);
    if (exact.length > 0) return exact;
    const q = flightFilter.trim().toLowerCase();
    return dateScopedFlights.filter((f) =>
      `${f.date} ${f.airline} ${f.flightNumber} ${f.airline}${f.flightNumber} ${f.origin} ${f.primaryDestination}`
        .toLowerCase()
        .includes(q)
    );
  }, [dateScopedFlights, flightFilter]);

  const allUniqueRecords = useMemo(
    () => extractUniqueEmdsFromFlights(selectedFlights),
    [selectedFlights]
  );

  const globalEmdIndex = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof extractUniqueEmdsFromFlights>[number]
    >();
    for (const rec of extractUniqueEmdsFromFlights(flights)) {
      map.set(normalizeEmdNumber(rec.emdNumber), rec);
    }
    return map;
  }, [flights]);

  const issuanceFilterOptions = useMemo(() => {
    const stations = new Set<string>();
    const agents = new Set<string>();
    const stationNumbers = new Set<string>();
    const reasons = new Set<string>();
    const currencies = new Set<string>();
    for (const d of Object.values(emdDetailsMap) as EmdDocumentDetail[]) {
      const iss = getEmdIssuanceInfo(d);
      if (iss.issuingStation) stations.add(iss.issuingStation);
      if (iss.issuingAgent) agents.add(iss.issuingAgent);
      if (iss.issuingStationNumber) stationNumbers.add(iss.issuingStationNumber);
      if (d.reasonForIssuance) reasons.add(d.reasonForIssuance);
      if (d.totalValue?.currency) currencies.add(d.totalValue.currency);
    }
    return {
      stations: Array.from(stations).sort(),
      agents: Array.from(agents).sort(),
      stationNumbers: Array.from(stationNumbers).sort(),
      reasons: Array.from(reasons).sort(),
      currencies: Array.from(currencies).sort(),
    };
  }, [emdDetailsMap]);

  const hasIssuanceFilters =
    stationFilter !== "ALL" ||
    agentFilter !== "ALL" ||
    stationNumberFilter !== "ALL" ||
    reasonFilter !== "ALL" ||
    (stationOriginOnly && Boolean(selectedFlightObj));

  const matchesIssuanceAndSearch = (
    detail: EmdDocumentDetail | undefined,
    extraStrings: string[]
  ): boolean => {
    const iss = getEmdIssuanceInfo(detail);
    if (!matchesFilterText(iss.issuingStation, stationFilter)) {
      return false;
    }
    if (!matchesFilterText(iss.issuingAgent, agentFilter)) {
      return false;
    }
    if (
      !matchesFilterText(
        iss.issuingStationNumber ? `STA-${iss.issuingStationNumber}` : "",
        stationNumberFilter
      )
    ) {
      return false;
    }
    if (!matchesFilterText(detail?.reasonForIssuance, reasonFilter)) {
      return false;
    }
    if (stationOriginOnly && selectedFlightObj) {
      if (!iss.issuingStation || iss.issuingStation !== selectedFlightObj.origin) {
        return false;
      }
    }

    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [
      ...extraStrings,
      detail?.reasonForIssuance || "",
      detail?.pnr || "",
      detail?.fopSummary || "",
      detail?.endorsementsRestrictions || "",
      detail?.totalValue?.rawAmount || "",
      detail?.totalValue?.currency || "",
      iss.issuingStation || "",
      iss.issuingPointCode || "",
      iss.issuingAgent || "",
      iss.issuingStationNumber || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  };

  const filteredRecords = useMemo(() => {
    return allUniqueRecords.filter((rec) => {
      const detail = emdDetailsMap[normalizeEmdNumber(rec.emdNumber)];
      return matchesIssuanceAndSearch(detail, [
        rec.emdNumber,
        rec.wincmd,
        ...rec.coupons,
        ...rec.passengerNames,
        ...rec.routes,
        ...rec.flights.map(
          (f) => `${f.airline}${f.flightNumber} ${f.flightNumber}`
        ),
        ...rec.ancillaryDescriptions,
      ]);
    });
  }, [
    allUniqueRecords,
    searchTerm,
    emdDetailsMap,
    stationFilter,
    agentFilter,
    stationNumberFilter,
    reasonFilter,
    stationOriginOnly,
    selectedFlightObj,
  ]);

  const totalImportedCount = useMemo(
    () => Object.keys(emdDetailsMap).length,
    [emdDetailsMap]
  );

  const scopedEmdSet = useMemo(
    () => new Set(allUniqueRecords.map((r) => normalizeEmdNumber(r.emdNumber))),
    [allUniqueRecords]
  );

  const scopedAuditedCount = useMemo(() => {
    let count = 0;
    for (const key of scopedEmdSet) {
      if (emdDetailsMap[key]) count++;
    }
    return count;
  }, [scopedEmdSet, emdDetailsMap]);

  const isUnfilteredManifestScope =
    flightFilter === "ALL" && dateFilter === "ALL";

  const auditedDetailsList = useMemo(() => {
    const allImported = (
      Object.values(emdDetailsMap) as EmdDocumentDetail[]
    ).sort((a, b) => a.emdNumber.localeCompare(b.emdNumber));
    const useAll =
      (isUnfilteredManifestScope && auditScopeAll) || flights.length === 0;
    const baseList = useAll
      ? allImported
      : allImported.filter((d) =>
          scopedEmdSet.has(normalizeEmdNumber(d.emdNumber))
        );

    return baseList.filter((d) => {
      const manifestRef = globalEmdIndex.get(normalizeEmdNumber(d.emdNumber));
      return matchesIssuanceAndSearch(d, [
        d.emdNumber,
        d.passengerName,
        d.issuedInConnectionWith || "",
        ...d.coupons.map(
          (c) => `${c.route} ${c.rfisc} ${c.reasonForIssuanceSubCode}`
        ),
        ...(manifestRef?.passengerNames || []),
        ...(manifestRef?.flights.map((f) => `${f.airline}${f.flightNumber}`) ||
          []),
      ]);
    });
  }, [
    emdDetailsMap,
    isUnfilteredManifestScope,
    auditScopeAll,
    flights.length,
    scopedEmdSet,
    searchTerm,
    globalEmdIndex,
    stationFilter,
    agentFilter,
    stationNumberFilter,
    reasonFilter,
    stationOriginOnly,
    selectedFlightObj,
  ]);

  const auditedSummary = useMemo(() => {
    const { total: totalTarget } = computeEmdTotalInCurrency(
      auditedDetailsList,
      displayCurrency,
      xofRates,
      "totalValue"
    );
    let p32 = 0;
    let p23 = 0;
    let upg = 0;
    for (const d of auditedDetailsList) {
      const c = classifyEmdBaggagePieces(d);
      p32 += c.pieces32kg;
      p23 += c.pieces23kg;
      upg += c.inFlightUpgradeCount;
    }
    return { totalTarget, p32, p23, upg };
  }, [auditedDetailsList, displayCurrency, xofRates]);

  const wincmdContent = useMemo(
    () => generateEmdWincmdText(filteredRecords),
    [filteredRecords]
  );

  const effectiveDateLabel = useMemo(() => {
    if (selectedFlightObj) {
      return `${selectedFlightObj.airline}${selectedFlightObj.flightNumber}_${selectedFlightObj.date}`;
    }
    if (dateFilter !== "ALL") return dateFilter;
    if (dateLabel) return dateLabel;
    if (availableDates.length === 1) return availableDates[0];
    return "GLOBAL";
  }, [selectedFlightObj, dateFilter, dateLabel, availableDates]);

  const handleCopy = () => {
    if (!wincmdContent) return;
    navigator.clipboard.writeText(wincmdContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (filteredRecords.length === 0) return;
    downloadEmdWincmdAnsi(filteredRecords, effectiveDateLabel);
  };

  const handleWemdFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allParsed: EmdDocumentDetail[] = [];
    let totalBlocks = 0;
    let totalDuplicates = 0;
    const names: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        names.push(file.name);
        const text = await file.text();
        const res = parseWemdOutputFile(text);
        totalBlocks += res.blocksCount;
        totalDuplicates += res.duplicatesMerged;
        allParsed.push(...res.emds);
      }

      if (allParsed.length === 0) {
        setImportFeedback({
          type: "error",
          message: pick(
            `Aucun bloc WEMD* valide détecté dans ${names.join(", ")}.`,
            `No valid WEMD* blocks detected in ${names.join(", ")}.`
          ),
        });
      } else {
        onImportEmdDetails?.(allParsed);
        setActiveTab("audit");
        setImportFeedback({
          type: "success",
          message: pick(
            `${allParsed.length} EMD(s) analysé(s) depuis ${names.join(", ")}${
              totalDuplicates > 0
                ? ` (${totalDuplicates} doublon(s) fusionné(s) / ${totalBlocks} blocs)`
                : ""
            }.`,
            `${allParsed.length} EMD(s) parsed from ${names.join(", ")}${
              totalDuplicates > 0
                ? ` (${totalDuplicates} duplicate(s) merged / ${totalBlocks} blocks)`
                : ""
            }.`
          ),
        });
      }
    } catch {
      setImportFeedback({
        type: "error",
        message: pick(
          "Impossible de lire le fichier WEMD* sélectionné.",
          "Failed to read the selected WEMD* file."
        ),
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="emd-audit-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#1F1209]/65 dark:bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            key="emd-audit-modal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 30,
              mass: 0.85,
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#1F1209] w-[92vw] max-w-[1160px] h-[84vh] rounded-3xl shadow-2xl shadow-black/40 border border-[#E6D7C3] dark:border-[#5C351B] ring-1 ring-[#E89C1D]/25 overflow-hidden flex flex-col"
          >
            {/* Gold Accent Top Bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#4C2812] via-[#E89C1D] to-[#4C2812] shrink-0" />

            {/* Header */}
            <div className="px-5 py-2.5 border-b border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between gap-4 bg-[#FAF7F2] dark:bg-[#28170C] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] p-1.5 rounded-xl shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#321B0A] dark:text-[#FAF7F2] truncate">
                  {pick("Audit EMDs", "EMD Audit")}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] p-1.5 rounded-xl hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition-colors cursor-pointer shrink-0"
                aria-label={pick("Fermer", "Close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters, Import & View Switcher */}
            <div className="px-6 py-3 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#1F1209] space-y-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {availableDates.length > 1 && (
                    <FilterCombobox
                      value={dateFilter}
                      onChange={(v) => {
                        setDateFilter(v);
                        setFlightFilter("ALL");
                      }}
                      options={availableDates.map((d) => ({ value: d, label: d }))}
                      placeholder={pick(`Dates (${availableDates.length})`, `Dates (${availableDates.length})`)}
                      allLabel={pick("Toutes dates", "All dates")}
                      theme="warm"
                      widthClass="w-36"
                    />
                  )}

                  <FilterCombobox
                    value={flightFilter}
                    onChange={setFlightFilter}
                    options={dateScopedFlights.map((f) => ({
                      value: f.id,
                      label: `${f.date} · ${f.airline}${f.flightNumber} · ${f.origin}→${f.primaryDestination} (${f.emdCount})`,
                      searchText: `${f.airline} ${f.flightNumber} ${f.origin} ${f.primaryDestination} ${f.date}`,
                    }))}
                    placeholder={pick(`Vols (${dateScopedFlights.length})`, `Flights (${dateScopedFlights.length})`)}
                    allLabel={pick("Tous les vols", "All flights")}
                    theme="warm"
                    widthClass="w-56"
                  />

                  {totalImportedCount > 0 && (
                    <>
                      <FilterCombobox
                        value={stationFilter}
                        onChange={setStationFilter}
                        options={issuanceFilterOptions.stations.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        placeholder={`Station (${issuanceFilterOptions.stations.length})`}
                        allLabel={pick("Toutes stations", "All stations")}
                        theme="warm"
                        widthClass="w-32"
                      />

                      <FilterCombobox
                        value={agentFilter}
                        onChange={setAgentFilter}
                        options={issuanceFilterOptions.agents.map((a) => ({
                          value: a,
                          label: a,
                        }))}
                        placeholder={`Agent (${issuanceFilterOptions.agents.length})`}
                        allLabel={pick("Tous agents", "All agents")}
                        theme="warm"
                        widthClass="w-36"
                      />

                      <FilterCombobox
                        value={stationNumberFilter}
                        onChange={setStationNumberFilter}
                        options={issuanceFilterOptions.stationNumbers.map((sn) => ({
                          value: sn,
                          label: `STA-${sn}`,
                          searchText: sn,
                        }))}
                        placeholder={`N° STA (${issuanceFilterOptions.stationNumbers.length})`}
                        allLabel={pick("Tous N° STA", "All STA")}
                        theme="warm"
                        widthClass="w-36"
                      />

                      <FilterCombobox
                        value={reasonFilter}
                        onChange={setReasonFilter}
                        options={issuanceFilterOptions.reasons.map((r) => ({
                          value: r,
                          label: r,
                        }))}
                        placeholder={pick("Raison", "Reason")}
                        allLabel={pick("Toutes raisons", "All reasons")}
                        theme="warm"
                        widthClass="w-44"
                      />
                    </>
                  )}

                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={pick("EMD, nom, PNR, STA...", "EMD, name, PNR, STA...")}
                      className="w-full min-h-[34px] pl-8 pr-2.5 py-1 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-xl text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                    />
                  </div>
                </div>

                {/* Currency + Rates + Export PDF/CSV + Upload WEMD + Clear */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <XofRatesPopover
                    currenciesInUse={issuanceFilterOptions.currencies}
                    theme="warm"
                  />

                  {auditedDetailsList.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          exportEmdAuditListToPDF({
                            details: auditedDetailsList,
                            scopeLabel: effectiveDateLabel,
                            xofRates,
                            targetCurrency: displayCurrency,
                            language,
                          })
                        }
                        className="min-h-[34px] px-2.5 py-1 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        title={pick("Exporter en PDF", "Export to PDF")}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          exportEmdAuditListToCSV({
                            details: auditedDetailsList,
                            xofRates,
                            targetCurrency: displayCurrency,
                            language,
                          })
                        }
                        className="min-h-[34px] px-2.5 py-1 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        title={pick("Exporter en CSV", "Export to CSV")}
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>CSV</span>
                      </button>
                    </>
                  )}

                  {onImportEmdDetails && (
                    <label className="min-h-[34px] px-3 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{pick("Importer WEMD*", "Import WEMD*")}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.log,.dat,.out"
                        onChange={handleWemdFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {onClearEmdDetails && totalImportedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearEmdDetails();
                        setImportFeedback(null);
                      }}
                      className="min-h-[34px] px-2.5 py-1 rounded-xl border border-rose-300 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-800 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      title={pick("Effacer audit WEMD*", "Clear WEMD* audit")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs Row + Station / Global Totals in Local + XOF */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="inline-flex flex-wrap bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("commands")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      activeTab === "commands"
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                        : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>WINCMD ({filteredRecords.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("list")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      activeTab === "list"
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                        : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>{pick(`Liste (${filteredRecords.length})`, `List (${filteredRecords.length})`)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("audit")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      activeTab === "audit"
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                        : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{pick(`Détails (${auditedDetailsList.length})`, `Details (${auditedDetailsList.length})`)}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] tabular-nums">
                  {selectedFlightObj && totalImportedCount > 0 && (
                    <label className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stationOriginOnly}
                        onChange={(e) => setStationOriginOnly(e.target.checked)}
                        className="rounded border-[#D8C3A5] text-[#4C2812] focus:ring-[#E89C1D]"
                      />
                      <span>
                        {pick(
                          `Station ${selectedFlightObj.origin}`,
                          `${selectedFlightObj.origin} only`
                        )}
                      </span>
                    </label>
                  )}

                  {selectedFlightStationSummary &&
                    selectedFlightStationSummary.stationIssuedEmds.length +
                      selectedFlightStationSummary.transitOrForeignEmds.length >
                      0 && (
                      <span>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {selectedFlightStationSummary.flightOrigin} :{" "}
                          {formatCurrencyTotals(
                            selectedFlightStationSummary.stationTotalsByCurrency,
                            locale
                          )}{" "}
                          {!(
                            selectedFlightStationSummary.stationTotalsByCurrency.length === 1 &&
                            selectedFlightStationSummary.stationTotalsByCurrency[0].currency ===
                              displayCurrency
                          ) && (
                            <>
                              (≈{" "}
                              {formatCurrencyAmount(
                                selectedFlightStationSummary.stationTotalTarget,
                                displayCurrency,
                                locale
                              )}
                              )
                            </>
                          )}
                        </strong>
                        {selectedFlightStationSummary.transitOrForeignEmds.length > 0 && (
                          <span className="ml-1.5 text-amber-700 dark:text-amber-400">
                            · {selectedFlightStationSummary.transitOrForeignEmds.length}{" "}
                            {pick("hors station", "foreign")}
                          </span>
                        )}
                      </span>
                    )}

                  {auditedDetailsList.length > 0 && (
                    <span>
                      <strong className="text-[#321B0A] dark:text-[#F7BA42]">
                        {formatTotalsWithTarget(
                          auditedDetailsList,
                          displayCurrency,
                          xofRates,
                          locale
                        )}
                      </strong>
                      {auditedSummary.p32 > 0 ? ` · 32kg:${auditedSummary.p32}` : ""}
                      {auditedSummary.p23 > 0 ? ` · 23kg:${auditedSummary.p23}` : ""}
                      {auditedSummary.upg > 0 ? ` · Upg:${auditedSummary.upg}` : ""}
                    </span>
                  )}

                  {hasIssuanceFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setStationFilter("ALL");
                        setAgentFilter("ALL");
                        setStationNumberFilter("ALL");
                        setReasonFilter("ALL");
                        setStationOriginOnly(false);
                      }}
                      className="text-rose-700 dark:text-rose-400 font-sans font-semibold hover:underline cursor-pointer"
                    >
                      {pick("Effacer filtres", "Clear filters")}
                    </button>
                  )}
                </div>
              </div>

              {importFeedback && (
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                    importFeedback.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Body (strictly flex-1 min-h-0 so modal height stays locked at 90vh) */}
            {activeTab === "audit" ? (
              totalImportedCount === 0 ? (
                <div className="p-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center bg-[#FAF7F2]/60 dark:bg-[#190E07] space-y-3">
                  <FileText className="w-9 h-9 text-[#8C5214]/60 dark:text-[#F7BA42]/60" />
                  <div className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                    {pick(
                      "Aucun résultat WEMD* importé",
                      "No WEMD* output imported"
                    )}
                  </div>
                  {onImportEmdDetails && (
                    <label className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer shadow-sm">
                      <Upload className="w-4 h-4" />
                      <span>
                        {pick("Importer WEMD* (.txt)", "Import WEMD* (.txt)")}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".txt,.log,.dat,.out"
                        onChange={handleWemdFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-auto bg-[#FAF7F2]/50 dark:bg-[#190E07] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-[#6E472B] dark:text-[#DECAB1] font-medium">
                      {auditedDetailsList.length}{" "}
                      {pick("EMD affiché(s)", "EMD(s) displayed")}
                      {scopedAuditedCount === 0 && !auditScopeAll && (
                        <span className="ml-2 text-amber-700 dark:text-amber-300 font-semibold">
                          ·{" "}
                          {pick(
                            "Aucun EMD audité pour cette sélection",
                            "No audited EMD for this selection"
                          )}
                        </span>
                      )}
                    </div>
                    {isUnfilteredManifestScope &&
                      totalImportedCount > scopedAuditedCount && (
                        <button
                          type="button"
                          onClick={() => setAuditScopeAll((v) => !v)}
                          className="px-3 py-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] cursor-pointer"
                        >
                          {auditScopeAll
                            ? pick(
                                `Sélection (${scopedAuditedCount})`,
                                `Selection (${scopedAuditedCount})`
                              )
                            : pick(
                                `Tous importés (${totalImportedCount})`,
                                `All imported (${totalImportedCount})`
                              )}
                        </button>
                      )}
                  </div>

                  {auditedDetailsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#6E472B] dark:text-[#DECAB1]">
                      {pick(
                        "Aucun EMD audité ne correspond au vol ou aux filtres sélectionnés.",
                        "No audited EMD matches the selected flight or filters."
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditedDetailsList.map((detail) => {
                        const manifestRef = globalEmdIndex.get(
                          normalizeEmdNumber(detail.emdNumber)
                        );
                        const iss = getEmdIssuanceInfo(detail);
                        const ptLabel = formatIssuingPointLabel(
                          iss.issuingPointCode,
                          language
                        );
                        const cls = classifyEmdBaggagePieces(detail);
                        const pieceTag = [
                          cls.pieces32kg > 0 ? `${cls.pieces32kg}×32kg` : "",
                          cls.pieces23kg > 0 ? `${cls.pieces23kg}×23kg` : "",
                          cls.specialBagPieces > 0
                            ? `${cls.specialBagPieces}×Spéc.`
                            : "",
                          cls.inFlightUpgradeCount > 0
                            ? `${cls.inFlightUpgradeCount}×Upgrade`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        const convertedVal = convertEmdDetailToCurrency(
                          detail,
                          displayCurrency,
                          xofRates,
                          "totalValue"
                        );
                        const isDifferentCur =
                          detail.totalValue &&
                          detail.totalValue.currency.trim().toUpperCase() !==
                            displayCurrency;

                        return (
                          <div
                            key={detail.emdNumber}
                            className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl divide-y divide-[#F0E6D6] dark:divide-[#3A2212]"
                          >
                            <div className="px-4 py-2.5 flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                                  <span className="font-bold text-sm text-[#4C2812] dark:text-[#F7BA42]">
                                    EMD {detail.emdNumber}
                                  </span>
                                  {detail.reasonForIssuance && (
                                    <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                      · {detail.reasonForIssuance}
                                    </span>
                                  )}
                                  {pieceTag && (
                                    <span className="font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                                      · {pieceTag}
                                    </span>
                                  )}
                                  {detail.pnr && (
                                    <span className="text-[#6E472B] dark:text-[#DECAB1]">
                                      · PNR {detail.pnr}
                                    </span>
                                  )}
                                  {detail.dateOfIssue && (
                                    <span className="text-[#6E472B] dark:text-[#DECAB1]">
                                      · {detail.dateOfIssue}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] flex flex-wrap items-center gap-2">
                                  <span>
                                    {detail.passengerName ||
                                      manifestRef?.passengerNames.join(" · ") ||
                                      "—"}
                                  </span>
                                  {manifestRef && manifestRef.flights.length > 0 && (
                                    <span className="font-mono text-[11px] font-normal text-[#6E472B] dark:text-[#DECAB1]">
                                      (
                                      {manifestRef.flights
                                        .map(
                                          (f) =>
                                            `${f.airline}${f.flightNumber} ${f.origin}·${f.date}`
                                        )
                                        .join(", ")}
                                      )
                                    </span>
                                  )}
                                  {(iss.issuingStation ||
                                    iss.issuingAgent ||
                                    iss.issuingStationNumber) && (
                                    <span className="font-mono text-[11px] font-normal text-[#6E472B] dark:text-[#DECAB1]">
                                      · {iss.issuingStation || "—"}
                                      {iss.issuingPointCode
                                        ? ` (${iss.issuingPointCode}${
                                            ptLabel ? ` - ${ptLabel}` : ""
                                          })`
                                        : ""}
                                      {iss.issuingAgent ? ` · ${iss.issuingAgent}` : ""}
                                      {iss.issuingStationNumber
                                        ? ` · STA-${iss.issuingStationNumber}`
                                        : ""}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right font-mono tabular-nums shrink-0">
                                <div className="text-[10px] font-sans uppercase font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                                  TOTAL
                                </div>
                                <div className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                  {formatEmdMonetaryValue(detail.totalValue, locale)}
                                </div>
                                {isDifferentCur && convertedVal !== null && (
                                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                    ≈ {formatCurrencyAmount(convertedVal, displayCurrency, locale)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {detail.coupons.length > 0 && (
                              <div className="divide-y divide-[#F0E6D6]/70 dark:divide-[#3A2212] bg-[#FAF7F2]/50 dark:bg-[#28170C]/60">
                                {detail.coupons.map((cpn) => (
                                  <div
                                    key={cpn.couponNumber}
                                    className="px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-[#8C5214] dark:text-[#F7BA42]">
                                        CPN {cpn.couponNumber}
                                      </span>
                                      <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                        {formatEmdRoute(cpn.route)}
                                      </span>
                                      <span className="text-[#6E472B] dark:text-[#DECAB1]">
                                        {cpn.airline} · RFISC {cpn.rfisc}
                                        {cpn.quantity !== undefined
                                          ? ` · Qté ${cpn.quantity}`
                                          : ""}
                                      </span>
                                      {cpn.reasonForIssuanceSubCode && (
                                        <span className="text-[#4C2812] dark:text-[#FAF7F2]">
                                          · {cpn.reasonForIssuanceSubCode}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`font-bold text-[11px] ${
                                        cpn.status === "USED"
                                          ? "text-emerald-700 dark:text-emerald-400"
                                          : "text-[#6E472B] dark:text-[#DECAB1]"
                                      }`}
                                    >
                                      {cpn.status || "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                              <div className="flex flex-wrap items-center gap-4">
                                <span>
                                  <span className="text-[10px] font-sans uppercase font-semibold text-[#8C5214] dark:text-[#F7BA42] mr-1">
                                    BASE
                                  </span>
                                  <strong className="text-[#321B0A] dark:text-[#FAF7F2]">
                                    {formatEmdMonetaryValue(detail.baseValue, locale)}
                                  </strong>
                                </span>
                                {detail.equivValue && (
                                  <span>
                                    <span className="text-[10px] font-sans uppercase font-semibold text-[#8C5214] dark:text-[#F7BA42] mr-1">
                                      EQUIV
                                    </span>
                                    <strong className="text-[#321B0A] dark:text-[#FAF7F2]">
                                      {formatEmdMonetaryValue(detail.equivValue, locale)}
                                    </strong>
                                  </span>
                                )}
                                <span>
                                  <span className="text-[10px] font-sans uppercase font-semibold text-[#8C5214] dark:text-[#F7BA42] mr-1">
                                    FOP
                                  </span>
                                  <strong className="text-[#321B0A] dark:text-[#FAF7F2]">
                                    {detail.fopEntries.length > 0
                                      ? detail.fopEntries
                                          .map(
                                            (f) =>
                                              `${formatFopMethodLabel(
                                                f.methodCode,
                                                language
                                              )}${
                                                f.methodDetails !== f.methodCode
                                                  ? ` (${f.methodDetails})`
                                                  : ""
                                              }${f.amount ? ` · ${f.amount}` : ""}${
                                                f.approvalCode
                                                  ? ` · APP ${f.approvalCode}`
                                                  : ""
                                              }`
                                          )
                                          .join(" / ")
                                      : detail.fopSummary || "—"}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            {detail.endorsementsRestrictions && (
                              <div className="px-4 py-1.5 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-2 text-xs">
                                <MessageSquareText className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] shrink-0 mt-0.5" />
                                <span className="font-mono text-[#321B0A] dark:text-[#FAF7F2]">
                                  {detail.endorsementsRestrictions}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center bg-[#FAF7F2]/60 dark:bg-[#190E07] space-y-2">
                <CreditCard className="w-8 h-8 text-[#8C5214]/60 dark:text-[#F7BA42]/60" />
                <div className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                  {pick(
                    "Aucun EMD sur cette sélection",
                    "No EMD for this selection"
                  )}
                </div>
              </div>
            ) : activeTab === "commands" ? (
              <div className="p-5 flex-1 min-h-0 overflow-auto bg-[#231206] font-mono text-xs text-[#FAF7F2]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#4C2812] text-[#F3E9D8]">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">
                      {pick("Commandes WINCMD", "WINCMD Commands")}
                    </span>
                    <span className="bg-[#4C2812] text-[#F7BA42] px-2 py-0.5 rounded text-[11px] font-mono tabular-nums">
                      {filteredRecords.length} EMD
                    </span>
                  </div>
                  <span className="text-[11px] text-[#DECAB1] tabular-nums">
                    {effectiveDateLabel}
                  </span>
                </div>
                <pre className="whitespace-pre overflow-x-auto leading-relaxed select-all tabular-nums">
                  {wincmdContent}
                </pre>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-[#1F1209]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] border-b border-[#321B0A] dark:border-[#5C351B] text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 pl-5 pr-3">
                        {pick("N° EMD", "EMD #")}
                      </th>
                      <th className="py-3 px-3">
                        {pick("Station / Agent / STA", "Station / Agent / STA")}
                      </th>
                      <th className="py-3 px-3">
                        {pick("Passager(s)", "Passenger(s)")}
                      </th>
                      <th className="py-3 px-3">
                        {pick("Vol(s) / Route", "Flight(s) / Route")}
                      </th>
                      <th className="py-3 px-3">
                        {pick(
                          `Montant (Local / ${displayCurrency}) / FOP`,
                          `Amount (Local / ${displayCurrency}) / FOP`
                        )}
                      </th>
                      <th className="py-3 pl-3 pr-5">
                        {pick("Commande WINCMD", "WINCMD Command")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E6D6] dark:divide-[#3A2212]">
                    {filteredRecords.map((rec) => {
                      const detail =
                        emdDetailsMap[normalizeEmdNumber(rec.emdNumber)];
                      const iss = getEmdIssuanceInfo(detail);
                      return (
                        <tr
                          key={rec.emdNumber}
                          className="hover:bg-[#FAF7F2] dark:hover:bg-[#28170C]/80 transition-colors"
                        >
                          <td className="py-2.5 pl-5 pr-3 font-mono font-bold text-[#321B0A] dark:text-[#F7BA42] tabular-nums whitespace-nowrap">
                            <div>
                              {rec.emdNumber}
                              {rec.coupons.length > 0
                                ? ` (${rec.coupons.join(",")})`
                                : ""}
                            </div>
                            {detail?.reasonForIssuance && (
                              <div className="text-[10px] font-normal text-[#6E472B] dark:text-[#DECAB1]">
                                {detail.reasonForIssuance}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#6E472B] dark:text-[#DECAB1] tabular-nums whitespace-nowrap">
                            {iss.issuingStation ? (
                              <div>
                                <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                  {iss.issuingStation}
                                  {iss.issuingPointCode
                                    ? ` (${iss.issuingPointCode})`
                                    : ""}
                                </span>
                                {iss.issuingAgent ? ` · ${iss.issuingAgent}` : ""}
                                {iss.issuingStationNumber ? (
                                  <div className="text-[10px]">
                                    STA-{iss.issuingStationNumber}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#321B0A] dark:text-[#FAF7F2]">
                            <div>{rec.passengerNames.join(" · ") || "—"}</div>
                            {rec.ancillaryDescriptions.length > 0 && (
                              <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">
                                {rec.ancillaryDescriptions.join(" · ")}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#6E472B] dark:text-[#DECAB1] tabular-nums">
                            {rec.flights
                              .map(
                                (f) =>
                                  `${f.airline}${f.flightNumber} (${f.route} · ${f.date})`
                              )
                              .join(" · ")}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">
                            {detail ? (
                              <div>
                                <div className="font-bold text-emerald-800 dark:text-emerald-300">
                                  {formatEmdMonetaryWithTarget(
                                    detail,
                                    displayCurrency,
                                    xofRates,
                                    locale
                                  )}
                                </div>
                                <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">
                                  {detail.fopSummary || "—"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] font-sans text-[#8C5214]/70 dark:text-[#DECAB1]/60 italic">
                                {pick("Non audité", "Not audited")}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pl-3 pr-5 font-mono text-[11px] text-[#4C2812] dark:text-[#F7BA42] whitespace-nowrap">
                            {rec.wincmd}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-medium tabular-nums">
                <strong className="text-[#321B0A] dark:text-[#FAF7F2] font-mono">
                  {filteredRecords.length}
                </strong>{" "}
                {pick("commande(s)", "command(s)")}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={filteredRecords.length === 0}
                  className="px-3.5 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 text-[#4C2812] dark:text-[#FAF7F2] text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>
                    {copied ? pick("Copié !", "Copied!") : pick("Copier", "Copy")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={filteredRecords.length === 0}
                  className="px-4 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] disabled:opacity-40 text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {pick(
                      `Télécharger (.txt) (${filteredRecords.length})`,
                      `Download (.txt) (${filteredRecords.length})`
                    )}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
