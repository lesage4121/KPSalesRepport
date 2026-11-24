/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Plane,
  FileText,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  ListFilter,
  RotateCcw,
  TrendingUp,
  Calendar,
  Pencil,
} from "lucide-react";
import {
  EmdDocumentDetail,
  FlightStatusDetail,
  ManifestFlight,
  ManifestParseResult,
  ManifestPassenger,
} from "../../types";
import { resolveFlightStatusDetail } from "../../utils/flightStatusParser";
import {
  exportManifestToExcel,
  extractInfantFromRawLines,
  getDcsFlightDateSortOrder,
  getEditCodeLabel,
  getFlightWebCheckinCount,
  isPassengerNoShow,
  isPassengerWebCheckin,
  isPassengerWithSeat,
  normalizeDcsFlightDate,
} from "../../utils/manifestParser";
import {
  computeStationFlightEmdSummary,
  extractUniqueEmdsFromFlights,
  formatCurrencyAmount,
  formatCurrencyTotals,
  formatEmdMonetaryWithTarget,
  getEmdIssuanceInfo,
  loadDisplayCurrency,
  loadXofRates,
  normalizeEmdNumber,
} from "../../utils/emdAudit";
import { PassengerDossierDrawer } from "./PassengerDossierDrawer";
import { BabyBottleIcon } from "./BabyBottleIcon";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { useLanguage } from "../../context/LanguageContext";

interface ManifestFlightDetailViewProps {
  parsedResult: ManifestParseResult;
  selectedFlightId: string;
  onSelectFlight: (flightId: string) => void;
  flightStatusDetails?: FlightStatusDetail[];
  emdDetailsMap?: Record<string, EmdDocumentDetail>;
  onOpenEmdAudit?: (flight: ManifestFlight) => void;
  onEditEquipment?: (flight: ManifestFlight) => void;
  onOpenEnhancedManifest: (flight: ManifestFlight) => void;
  onViewFlightEvolution?: (flightNumber: string, origin: string) => void;
}

type CabinFilter = "BOTH" | "C" | "Y";
type SeatStatusFilter = "ALL" | "WITH_SEAT" | "NO_SHOW" | "NO_SEAT";
type GenderTypeFilter = "ALL" | "M" | "F" | "CHD" | "INF" | "WEB_CHECKIN" | "NO_SEAT";
type BaggageFilter =
  | "ALL"
  | "WITH_BAGS"
  | "NO_BAGS"
  | "MISSING_WEIGHT"
  | "CONFORME"
  | "ECART_NON_COUVERT"
  | "COUVERT_EMD";

export const ManifestFlightDetailView: React.FC<ManifestFlightDetailViewProps> = ({
  parsedResult,
  selectedFlightId,
  onSelectFlight,
  flightStatusDetails = [],
  emdDetailsMap = {},
  onOpenEmdAudit,
  onEditEquipment,
  onOpenEnhancedManifest,
  onViewFlightEvolution,
}) => {
  const { language, pick } = useLanguage();
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>("BOTH");
  const [seatStatusFilter, setSeatStatusFilter] =
    useState<SeatStatusFilter>("ALL");
  const [genderTypeFilter, setGenderTypeFilter] =
    useState<GenderTypeFilter>("ALL");
  const [bookingClassFilter, setBookingClassFilter] = useState<string>("ALL");
  const [editCodeFilter, setEditCodeFilter] = useState<string>("ALL");
  const [baggageFilter, setBaggageFilter] = useState<BaggageFilter>("ALL");
  const [destFilter, setDestFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [drawerPaxId, setDrawerPaxId] = useState<string | null>(null);
  const [isFlightListOpen, setIsFlightListOpen] = useState<boolean>(false);
  const [flightSelectorSearch, setFlightSelectorSearch] = useState<string>("");
  const [flightSelectorDate, setFlightSelectorDate] = useState<string>("ALL");
  const [flightSelectorOrigin, setFlightSelectorOrigin] =
    useState<string>("ALL");
  const [flightSelectorRegistration, setFlightSelectorRegistration] =
    useState<string>("ALL");
  const [xofRates, setXofRates] = useState<Record<string, number>>(() =>
    loadXofRates()
  );
  const [displayCurrency, setDisplayCurrency] = useState<string>(() =>
    loadDisplayCurrency()
  );

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

  const activeFlightIndex = useMemo(() => {
    const idx = parsedResult.flights.findIndex((f) => f.id === selectedFlightId);
    return idx >= 0 ? idx : 0;
  }, [parsedResult.flights, selectedFlightId]);

  const activeFlight = useMemo(() => {
    return parsedResult.flights[activeFlightIndex] || null;
  }, [parsedResult.flights, activeFlightIndex]);

  const activeFlightStatus = useMemo(() => {
    if (!activeFlight) return null;
    return resolveFlightStatusDetail(
      activeFlight.flightNumber,
      activeFlight.date,
      activeFlight.origin,
      flightStatusDetails
    );
  }, [activeFlight, flightStatusDetails]);

  const activeFlightEmdStats = useMemo(() => {
    if (!activeFlight) return { total: 0, audited: 0 };
    const unique = extractUniqueEmdsFromFlights([activeFlight]);
    let audited = 0;
    for (const rec of unique) {
      if (emdDetailsMap[normalizeEmdNumber(rec.emdNumber)]) audited++;
    }
    return { total: unique.length, audited };
  }, [activeFlight, emdDetailsMap]);

  const stationEmdSummary = useMemo(() => {
    if (!activeFlight) return null;
    return computeStationFlightEmdSummary(
      activeFlight,
      emdDetailsMap,
      xofRates,
      displayCurrency
    );
  }, [activeFlight, emdDetailsMap, xofRates, displayCurrency]);

  const selectorMeta = useMemo(() => {
    const dateMap = new Map<string, { sortOrder: number; count: number }>();
    const originCounts: Record<string, number> = {};
    const regCounts: Record<string, number> = {};
    let unassignedRegCount = 0;

    for (const f of parsedResult.flights) {
      const normDate = normalizeDcsFlightDate(f.date);
      const sortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
      const entry = dateMap.get(normDate) || { sortOrder, count: 0 };
      entry.count += 1;
      dateMap.set(normDate, entry);

      if (f.origin) {
        originCounts[f.origin] = (originCounts[f.origin] || 0) + 1;
      }

      const statusRes = resolveFlightStatusDetail(
        f.flightNumber,
        f.date,
        f.origin,
        flightStatusDetails
      );
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
      origins: Object.entries(originCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      registrations: Object.entries(regCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([reg, count]) => ({ reg, count })),
      unassignedRegCount,
    };
  }, [parsedResult.flights, flightStatusDetails]);

  const filteredSelectorFlights = useMemo(() => {
    const q = flightSelectorSearch.toLowerCase().trim();
    return parsedResult.flights.filter((f) => {
      const normDate = normalizeDcsFlightDate(f.date);
      if (flightSelectorDate !== "ALL" && normDate !== flightSelectorDate) {
        return false;
      }
      if (flightSelectorOrigin !== "ALL" && f.origin !== flightSelectorOrigin) {
        return false;
      }

      const statusRes = resolveFlightStatusDetail(
        f.flightNumber,
        f.date,
        f.origin,
        flightStatusDetails
      );
      const reg = (statusRes.detail?.registration || "").trim().toUpperCase();
      const acType = statusRes.detail?.aircraftType || f.aircraftType;

      if (flightSelectorRegistration === "UNASSIGNED" && reg !== "") {
        return false;
      } else if (
        flightSelectorRegistration !== "ALL" &&
        flightSelectorRegistration !== "UNASSIGNED" &&
        reg !== flightSelectorRegistration
      ) {
        return false;
      }

      if (!q) return true;
      return [
        f.airline,
        f.flightNumber,
        `${f.airline}${f.flightNumber}`,
        normDate,
        f.origin,
        acType,
        reg,
        f.primaryDestination,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    parsedResult.flights,
    flightStatusDetails,
    flightSelectorSearch,
    flightSelectorDate,
    flightSelectorOrigin,
    flightSelectorRegistration,
  ]);

  const groupedSelectorFlights = useMemo(() => {
    const groupsMap = new Map<
      string,
      { date: string; sortOrder: number; flights: ManifestFlight[] }
    >();
    for (const f of filteredSelectorFlights) {
      const normDate = normalizeDcsFlightDate(f.date);
      const sortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
      const g = groupsMap.get(normDate) || {
        date: normDate,
        sortOrder,
        flights: [],
      };
      g.flights.push(f);
      groupsMap.set(normDate, g);
    }
    return Array.from(groupsMap.values()).sort(
      (a, b) => b.sortOrder - a.sortOrder
    );
  }, [filteredSelectorFlights]);

  // Reset flight-specific filters when switching flights
  useEffect(() => {
    setBookingClassFilter("ALL");
    setEditCodeFilter("ALL");
    setDestFilter("ALL");
  }, [selectedFlightId]);

  useEffect(() => {
    setCurrentPage(1);
    setDrawerPaxId(null);
  }, [
    selectedFlightId,
    cabinFilter,
    seatStatusFilter,
    genderTypeFilter,
    bookingClassFilter,
    editCodeFilter,
    baggageFilter,
    destFilter,
    searchTerm,
    pageSize,
  ]);

  // Dynamic filter options computed from activeFlight passengers
  const filterMeta = useMemo(() => {
    if (!activeFlight) {
      return {
        bookingClasses: [] as { code: string; count: number }[],
        editCodes: [] as { code: string; count: number }[],
        destinations: [] as { code: string; count: number }[],
        counts: {
          M: 0,
          F: 0,
          CHD: 0,
          INF: 0,
          WEB_CHECKIN: 0,
          NO_SEAT: 0,
          WITH_SEAT: 0,
          NO_SHOW: 0,
          UNSEATED: 0,
        },
      };
    }

    const classCounts: Record<string, number> = {};
    const codeCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const counts = {
      M: 0,
      F: 0,
      CHD: 0,
      INF: 0,
      WEB_CHECKIN: 0,
      NO_SEAT: 0,
      WITH_SEAT: 0,
      NO_SHOW: 0,
      UNSEATED: 0,
    };

    for (const p of activeFlight.passengers) {
      if (p.bookingClass) {
        classCounts[p.bookingClass] = (classCounts[p.bookingClass] || 0) + 1;
      }
      if (p.destination) {
        destCounts[p.destination] = (destCounts[p.destination] || 0) + 1;
      }
      for (const code of p.editCodes) {
        codeCounts[code] = (codeCounts[code] || 0) + 1;
      }
      if (isPassengerWithSeat(p)) counts.WITH_SEAT++;
      else counts.UNSEATED++;
      if (isPassengerNoShow(p)) counts.NO_SHOW++;
      if (p.isChild) counts.CHD++;
      else if (p.gender === "M") counts.M++;
      else if (p.gender === "F") counts.F++;
      if (p.hasInfant) counts.INF++;
      if (isPassengerWebCheckin(p)) counts.WEB_CHECKIN++;
      if (p.isOffloadedOrNoSeat) counts.NO_SEAT++;
    }

    return {
      bookingClasses: Object.entries(classCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      editCodes: Object.entries(codeCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      destinations: Object.entries(destCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      counts,
    };
  }, [activeFlight]);

  const hasActiveFilters =
    cabinFilter !== "BOTH" ||
    seatStatusFilter !== "ALL" ||
    genderTypeFilter !== "ALL" ||
    bookingClassFilter !== "ALL" ||
    editCodeFilter !== "ALL" ||
    baggageFilter !== "ALL" ||
    destFilter !== "ALL" ||
    searchTerm.trim() !== "";

  const resetAllFilters = () => {
    setCabinFilter("BOTH");
    setSeatStatusFilter("ALL");
    setGenderTypeFilter("ALL");
    setBookingClassFilter("ALL");
    setEditCodeFilter("ALL");
    setBaggageFilter("ALL");
    setDestFilter("ALL");
    setSearchTerm("");
  };

  const orderedPassengers = useMemo(() => {
    if (!activeFlight) return [];
    const list: ManifestPassenger[] = [];
    // businessPassengers & economyPassengers are already sorted alphabetically by lastName/firstName with classSeq 1..N
    if (cabinFilter === "BOTH" || cabinFilter === "C") {
      list.push(...activeFlight.businessPassengers);
    }
    if (cabinFilter === "BOTH" || cabinFilter === "Y") {
      list.push(...activeFlight.economyPassengers);
    }

    const q = searchTerm.toLowerCase().trim();

    return list.filter((pax) => {
      // 0. Seat / Boarding Status (With Seat = Actually Traveled, No-Show = Ticketed without Seat)
      if (seatStatusFilter === "WITH_SEAT" && !isPassengerWithSeat(pax)) {
        return false;
      }
      if (seatStatusFilter === "NO_SHOW" && !isPassengerNoShow(pax)) {
        return false;
      }
      if (seatStatusFilter === "NO_SEAT" && isPassengerWithSeat(pax)) {
        return false;
      }

      // 1. Sexe / Type / INF
      if (genderTypeFilter === "M" && (pax.isChild || pax.gender !== "M")) {
        return false;
      }
      if (genderTypeFilter === "F" && (pax.isChild || pax.gender !== "F")) {
        return false;
      }
      if (genderTypeFilter === "CHD" && !pax.isChild) {
        return false;
      }
      if (genderTypeFilter === "INF" && !pax.hasInfant) {
        return false;
      }
      if (genderTypeFilter === "WEB_CHECKIN" && !isPassengerWebCheckin(pax)) {
        return false;
      }
      if (genderTypeFilter === "NO_SEAT" && !pax.isOffloadedOrNoSeat) {
        return false;
      }

      // 2. Classe de réservation
      if (
        bookingClassFilter !== "ALL" &&
        pax.bookingClass !== bookingClassFilter
      ) {
        return false;
      }

      // 3. Edit code
      if (editCodeFilter !== "ALL" && !pax.editCodes.includes(editCodeFilter)) {
        return false;
      }

      // 4. Destination
      if (destFilter !== "ALL" && pax.destination !== destFilter) {
        return false;
      }

      // 5. Bagages / Conformité
      const actualBags = Math.max(
        pax.bags.length,
        pax.bagsDeclaredCount || 0,
        pax.bagsTotalDeclaredLine?.count || 0
      );
      if (baggageFilter === "WITH_BAGS" && actualBags === 0) return false;
      if (baggageFilter === "NO_BAGS" && actualBags > 0) return false;
      if (
        baggageFilter === "MISSING_WEIGHT" &&
        !pax.hasMissingBaggageWeight
      ) {
        return false;
      }
      if (
        baggageFilter === "CONFORME" &&
        pax.baggageCompliance !== "CONFORME"
      ) {
        return false;
      }
      if (
        baggageFilter === "ECART_NON_COUVERT" &&
        pax.baggageCompliance !== "ECART_NON_COUVERT"
      ) {
        return false;
      }
      if (
        baggageFilter === "COUVERT_EMD" &&
        pax.baggageCompliance !== "COUVERT_EMD"
      ) {
        return false;
      }

      // 6. Recherche texte libre
      if (!q) return true;
      const infantFallback =
        pax.infant ||
        extractInfantFromRawLines(pax.rawLines, {
          date: activeFlight.date,
          bookingClass: pax.bookingClass,
          route: `${activeFlight.origin}${pax.destination}`,
        });
      const haystack = [
        pax.fullNameDisplay,
        pax.seat,
        pax.destination,
        pax.baggageDestination,
        pax.bookingClass,
        pax.ticket?.ticketNumber || "",
        infantFallback?.fullNameDisplay || "",
        infantFallback?.birthDate || "",
        infantFallback?.ticket?.ticketNumber || "",
        pax.kpFrequentFlyer?.number || "",
        pax.partnerFrequentFlyer?.number || "",
        ...pax.bags.map((b) => b.tag),
        ...pax.emdNumbers,
        ...pax.editCodes,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    activeFlight,
    cabinFilter,
    seatStatusFilter,
    genderTypeFilter,
    bookingClassFilter,
    editCodeFilter,
    destFilter,
    baggageFilter,
    searchTerm,
  ]);

  const totalPages = Math.max(1, Math.ceil(orderedPassengers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPassengers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return orderedPassengers.slice(start, start + pageSize);
  }, [orderedPassengers, safePage, pageSize]);

  const drawerIndex = useMemo(() => {
    if (!drawerPaxId) return -1;
    return orderedPassengers.findIndex((p) => p.id === drawerPaxId);
  }, [orderedPassengers, drawerPaxId]);

  const activeDrawerPax =
    drawerIndex >= 0 ? orderedPassengers[drawerIndex] : null;

  if (!activeFlight) return null;

  // Group current page rows by cabin so Business (C) and Éco (Y) stay visually grouped
  const pageBusiness = paginatedPassengers.filter((p) => p.cabinClass === "C");
  const pageEconomy = paginatedPassengers.filter((p) => p.cabinClass === "Y");

  const activeFlightWebCheckinCount = getFlightWebCheckinCount(activeFlight);
  const activeFlightBizWbCount = activeFlight.businessPassengers.filter(
    (p) => isPassengerWithSeat(p) && isPassengerWebCheckin(p)
  ).length;
  const activeFlightEcoWbCount = activeFlight.economyPassengers.filter(
    (p) => isPassengerWithSeat(p) && isPassengerWebCheckin(p)
  ).length;
  const filteredWbCount = orderedPassengers.filter(isPassengerWebCheckin).length;

  const renderRows = (rows: ManifestPassenger[]) =>
    rows.map((pax, rowIndex) => {
      const infantInfo =
        pax.infant ||
        extractInfantFromRawLines(pax.rawLines, {
          date: activeFlight.date,
          bookingClass: pax.bookingClass,
          route: `${activeFlight.origin}${pax.destination}`,
        });
      const hasInfant = pax.hasInfant || Boolean(infantInfo);
      const actualBags = Math.max(
        pax.bags.length,
        pax.bagsDeclaredCount || 0,
        pax.bagsTotalDeclaredLine?.count || 0
      );
      const orderNum = String(pax.classSeq || rowIndex + 1).padStart(3, "0");

      const rowThemeClass =
        pax.baggageCompliance === "ECART_NON_COUVERT"
          ? rowIndex % 2 === 0
            ? "bg-rose-50/75 dark:bg-rose-950/35 hover:bg-rose-100/75 dark:hover:bg-rose-950/55 shadow-[inset_3px_0_0_#f43f5e]"
            : "bg-rose-100/45 dark:bg-rose-950/50 hover:bg-rose-100/80 dark:hover:bg-rose-950/65 shadow-[inset_3px_0_0_#f43f5e]"
          : pax.hasMissingBaggageWeight
          ? rowIndex % 2 === 0
            ? "bg-amber-50/65 dark:bg-amber-950/30 hover:bg-amber-100/60 dark:hover:bg-amber-950/50 shadow-[inset_3px_0_0_#f59e0b]"
            : "bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/55 shadow-[inset_3px_0_0_#f59e0b]"
          : pax.baggageCompliance === "COUVERT_EMD"
          ? rowIndex % 2 === 0
            ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] shadow-[inset_3px_0_0_#E89C1D]"
            : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] shadow-[inset_3px_0_0_#E89C1D]"
          : rowIndex % 2 === 0
          ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
          : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]";

      return (
        <tr
          key={pax.id}
          onClick={() => setDrawerPaxId(pax.id)}
          className={`transition-colors cursor-pointer ${rowThemeClass}`}
        >
          <td className="py-3 pl-5 pr-2 font-mono font-bold text-[#4C2812] dark:text-[#F7BA42] tabular-nums whitespace-nowrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px]">
              {orderNum}
            </span>
            {pax.isTransitMarker && (
              <span className="ml-1 text-[#8C5214] dark:text-[#E89C1D] font-bold" title="Transit (#)">
                #
              </span>
            )}
          </td>

          <td className="py-3 px-3">
            <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] flex items-center gap-1.5">
              {hasInfant && (
                <BabyBottleIcon
                  className="w-4 h-4"
                  title={pick(
                    "Passager accompagné d'un bébé (INF)",
                    "Passenger traveling with an infant (INF)"
                  )}
                />
              )}
              <span>
                {pax.lastName}{" "}
                <span className="font-semibold text-[#6E472B] dark:text-[#DECAB1]">{pax.firstName}</span>
              </span>
            </div>
            <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
              {pax.isChild
                ? pick("Enfant (CHD)", "Child (CHD)")
                : pax.gender === "M"
                ? pick("Homme", "Male")
                : pax.gender === "F"
                ? pick("Femme", "Female")
                : pick("N/D", "N/A")}
              {hasInfant && (
                <span className="text-[#8C5214] dark:text-[#F7BA42] font-semibold">
                  {" "}· + {pick("Bébé", "Infant")}
                  {infantInfo?.fullNameDisplay
                    ? ` : ${infantInfo.fullNameDisplay}${
                        infantInfo.birthDate ? ` (${infantInfo.birthDate})` : ""
                      }`
                    : ""}
                </span>
              )}
              {pax.isCodeshare && (
                <span className="text-[#6E472B] dark:text-[#DECAB1] font-semibold"> · Codeshare</span>
              )}
            </div>
          </td>

          <td className="py-3 px-3 font-mono whitespace-nowrap">
            <div className="font-semibold text-[#321B0A] dark:text-[#FAF7F2] tabular-nums flex items-center gap-1.5">
              <span>{pax.bookingClass} ·</span>
              {isPassengerWebCheckin(pax) && <WebCheckinBadge />}
              <span>{pax.seat || pick("Sans siège", "No seat")}</span>
              {isPassengerNoShow(pax) && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-sans text-[10px] font-bold uppercase">
                  No-Show
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
              → {pax.destination}
              {pax.baggageDestination &&
                pax.baggageDestination !== pax.destination && (
                  <span className="text-[#8C5214]/80 dark:text-[#F7BA42]/80"> (Bag {pax.baggageDestination})</span>
                )}
            </div>
          </td>

          <td className="py-3 px-3">
            <div className="font-mono tabular-nums font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
              {actualBags} pcs ·{" "}
              {pax.hasMissingBaggageWeight && pax.totalBagWeight === 0 ? (
                <span className="text-amber-700 dark:text-amber-400 font-bold">
                  {pick("Poids N/D", "Wt N/A")}
                </span>
              ) : (
                `${pax.totalBagWeight} kg`
              )}
            </div>
            <div className="mt-0.5 flex flex-col gap-0.5">
              {pax.hasMissingBaggageWeight && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {pick("Poids non spécifié", "Missing weight")}
                </span>
              )}
              {pax.baggageCompliance === "CONFORME" ? (
                !pax.hasMissingBaggageWeight && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    {pick("Conforme", "Compliant")}
                  </span>
                )
              ) : pax.baggageCompliance === "COUVERT_EMD" ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#8C5214] dark:text-[#F7BA42] font-semibold">
                  <CreditCard className="w-3 h-3 shrink-0" />
                  {pick("Couvert EMD", "EMD Covered")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-400 font-bold">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {pick("Écart sans EMD", "Excess (No EMD)")}
                </span>
              )}
            </div>
          </td>

          <td className="py-3 px-3 font-mono text-[11px]">
            {pax.emdNumbers.length > 0 && (
              <div className="space-y-0.5">
                {pax.emdNumbers.map((rawNum) => {
                  const detail = emdDetailsMap[normalizeEmdNumber(rawNum)];
                  const iss = getEmdIssuanceInfo(detail);
                  const isOtherStation =
                    iss.issuingStation && iss.issuingStation !== activeFlight.origin;
                  return (
                    <div key={rawNum}>
                      <div className="font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                        EMD {rawNum}
                      </div>
                      {detail && (
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {formatEmdMonetaryWithTarget(
                            detail,
                            displayCurrency,
                            xofRates,
                            language === "fr" ? "fr-FR" : "en-US"
                          )}
                          {detail.fopEntries[0]?.methodCode
                            ? ` · ${detail.fopEntries[0].methodCode}`
                            : detail.fopSummary
                            ? ` · ${detail.fopSummary}`
                            : ""}
                          {iss.issuingAgent
                            ? ` · ${iss.issuingAgent}`
                            : iss.issuingStation
                            ? ` · ${iss.issuingStation}`
                            : ""}
                          {isOtherStation && (
                            <span className="ml-1 font-sans text-amber-700 dark:text-amber-400">
                              ({pick(`hors ${activeFlight.origin}`, `non-${activeFlight.origin}`)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {pax.kpFrequentFlyer && (
              <div className="text-[#4C2812] dark:text-[#FAF7F2] font-semibold">
                FF {pax.kpFrequentFlyer.number}
              </div>
            )}
            {pax.partnerFrequentFlyer && (
              <div className="text-[#6E472B] dark:text-[#DECAB1] font-semibold">
                FQTV {pax.partnerFrequentFlyer.number}
              </div>
            )}
            {pax.emdNumbers.length === 0 &&
              !pax.kpFrequentFlyer &&
              !pax.partnerFrequentFlyer && <span className="text-[#8C5214]/60 dark:text-[#DECAB1]/40">—</span>}
          </td>

          <td className="py-3 px-3 font-mono text-[11px]">
            {pax.ticket ? (
              <div className="text-[#321B0A] dark:text-[#FAF7F2] tabular-nums">
                {pax.ticket.ticketNumber} · {pax.ticket.couponNumber}
              </div>
            ) : (
              <span className="text-[#8C5214]/70 dark:text-[#DECAB1]/60 font-sans">
                {pick("Sans billet", "No ticket")}
              </span>
            )}
            {infantInfo?.ticket && (
              <div className="text-[#8C5214] dark:text-[#F7BA42] font-semibold tabular-nums">
                IFET {infantInfo.ticket.ticketNumber}
                {infantInfo.ticket.couponNumber
                  ? ` · ${infantInfo.ticket.couponNumber}`
                  : ""}
              </div>
            )}
            {pax.outboundFlight && (
              <div className="text-[#6E472B] dark:text-[#DECAB1]">
                {pick("Suite :", "Onward:")} {pax.outboundFlight.carrier}
                {pax.outboundFlight.flightNumber} → {pax.outboundFlight.destination}
              </div>
            )}
            {pax.inboundFlight && (
              <div className="text-[#6E472B] dark:text-[#DECAB1]">
                {pick("Arrivée :", "Inbound:")} {pax.inboundFlight.carrier}
                {pax.inboundFlight.flightNumber} ({pax.inboundFlight.origin})
              </div>
            )}
          </td>

          <td className="py-3 pr-5 pl-2 text-right">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDrawerPaxId(pax.id);
              }}
              className="text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {pick("Dossier", "Record")}
            </button>
          </td>
        </tr>
      );
    });

  return (
    <div className="space-y-5">
      {/* Collapsible / Expandable Flight Selector Container */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsFlightListOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              <ListFilter className="w-3.5 h-3.5 text-[#E89C1D]" />
              <span>
                {isFlightListOpen
                  ? pick("Replier la liste des vols", "Collapse flight list")
                  : pick(
                      `Sélectionner un vol (${parsedResult.flights.length})`,
                      `Select a flight (${parsedResult.flights.length})`
                    )}
              </span>
              {isFlightListOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#F7BA42]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#F7BA42]" />
              )}
            </button>

            <div className="text-xs font-mono text-[#6E472B] dark:text-[#DECAB1] truncate flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {activeFlight.airline} {activeFlight.flightNumber} · {normalizeDcsFlightDate(activeFlight.date)} · {pick("Départ", "Dep.")} {activeFlight.origin}
              </span>
              <span className="text-[#D8C3A5] dark:text-[#5C351B]">|</span>
              <span>
                {activeFlightStatus?.detail?.aircraftType || activeFlight.aircraftType}
                {activeFlightStatus?.detail?.registration ? `/${activeFlightStatus.detail.registration}` : ""}
                {activeFlightStatus?.detail && activeFlightStatus.detail.totalCapacity > 0
                  ? ` (${activeFlightStatus.detail.totalCapacity})`
                  : ""}
              </span>
              {onEditEquipment && (
                <button
                  type="button"
                  onClick={() => onEditEquipment(activeFlight)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:border-[#E89C1D] text-[11px] font-sans font-semibold text-[#4C2812] dark:text-[#F7BA42] cursor-pointer transition whitespace-nowrap"
                  title={pick(
                    "Modifier l'équipement (type, immatriculation, capacité)",
                    "Edit equipment (type, registration, capacity)"
                  )}
                >
                  <Pencil className="w-3 h-3" />
                  <span>{pick("Équip.", "Equip.")}</span>
                </button>
              )}
              <span className="text-[#D8C3A5] dark:text-[#5C351B]">|</span>
              <span className="text-[#6E472B] dark:text-[#DECAB1]">
                {activeFlight.grandTotals.passengersCount} pax (
                {activeFlight.isPureEconomy
                  ? pick(`Pure Éco ${activeFlight.configRaw}`, `All-Economy ${activeFlight.configRaw}`)
                  : activeFlight.configRaw || `${activeFlight.businessTotals.passengersCount}C/${activeFlight.economyTotals.passengersCount}Y`}
                )
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={activeFlightIndex <= 0}
              onClick={() => {
                if (activeFlightIndex > 0) {
                  onSelectFlight(parsedResult.flights[activeFlightIndex - 1].id);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 text-xs font-semibold text-[#4C2812] dark:text-[#FAF7F2] inline-flex items-center gap-1 cursor-pointer disabled:cursor-default"
              title={pick("Vol précédent", "Previous flight")}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {pick("Préc.", "Prev.")}
            </button>
            <span className="font-mono text-[11px] font-bold text-[#6E472B] dark:text-[#DECAB1] px-1.5 tabular-nums">
              {activeFlightIndex + 1} / {parsedResult.flights.length}
            </span>
            <button
              type="button"
              disabled={activeFlightIndex >= parsedResult.flights.length - 1}
              onClick={() => {
                if (activeFlightIndex < parsedResult.flights.length - 1) {
                  onSelectFlight(parsedResult.flights[activeFlightIndex + 1].id);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 text-xs font-semibold text-[#4C2812] dark:text-[#FAF7F2] inline-flex items-center gap-1 cursor-pointer disabled:cursor-default"
              title={pick("Vol suivant", "Next flight")}
            >
              {pick("Suiv.", "Next")}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isFlightListOpen && (
          <div className="p-4 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#1F1209] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={flightSelectorSearch}
                    onChange={(e) => setFlightSelectorSearch(e.target.value)}
                    placeholder={pick("Vol, date, station, immat...", "Flight #, date, station, reg...")}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                  />
                </div>

                <select
                  value={flightSelectorDate}
                  onChange={(e) => setFlightSelectorDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                >
                  <option value="ALL">
                    {pick(`Toutes les dates (${selectorMeta.dates.length})`, `All dates (${selectorMeta.dates.length})`)}
                  </option>
                  {selectorMeta.dates.map((d) => (
                    <option key={d.date} value={d.date}>
                      {d.date} ({d.count} {pick("vols", "flights")})
                    </option>
                  ))}
                </select>

                <select
                  value={flightSelectorOrigin}
                  onChange={(e) => setFlightSelectorOrigin(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                >
                  <option value="ALL">{pick("Toutes origines", "All origins")}</option>
                  {selectorMeta.origins.map((o) => (
                    <option key={o.code} value={o.code}>
                      {pick("Départ", "Dep.")} {o.code} ({o.count})
                    </option>
                  ))}
                </select>

                <select
                  value={flightSelectorRegistration}
                  onChange={(e) => setFlightSelectorRegistration(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                  title={pick("Filtrer par immatriculation appareil", "Filter by aircraft registration")}
                >
                  <option value="ALL">
                    {pick(
                      `Immat. : Toutes (${selectorMeta.registrations.length})`,
                      `Reg.: All (${selectorMeta.registrations.length})`
                    )}
                  </option>
                  {selectorMeta.registrations.map((r) => (
                    <option key={r.reg} value={r.reg}>
                      {r.reg} ({r.count})
                    </option>
                  ))}
                  {selectorMeta.unassignedRegCount > 0 && (
                    <option value="UNASSIGNED">
                      {pick(
                        `Sans immat. (${selectorMeta.unassignedRegCount})`,
                        `No reg. (${selectorMeta.unassignedRegCount})`
                      )}
                    </option>
                  )}
                </select>
              </div>

              <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                {pick(
                  `${filteredSelectorFlights.length} vol(s) · Triés par date la plus récente`,
                  `${filteredSelectorFlights.length} flight(s) · Sorted by newest date`
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto pr-1 space-y-4">
              {groupedSelectorFlights.map((group, gIdx) => (
                <div key={group.date} className="space-y-2">
                  <div className="px-3 py-1.5 rounded-lg bg-[#321B0A] dark:bg-[#2C180B] text-white font-mono text-[11px] font-bold flex items-center justify-between border border-transparent dark:border-[#5C351B]">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#E89C1D]" />
                      {group.date}
                      {gIdx === 0 && groupedSelectorFlights.length > 1 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-[#E89C1D] text-[#321B0A] text-[10px] font-sans font-bold uppercase">
                          {pick("Plus récente", "Latest")}
                        </span>
                      )}
                    </span>
                    <span className="text-[#F3E9D8]">
                      {group.flights.length} {pick(`vol${group.flights.length > 1 ? "s" : ""}`, `flight${group.flights.length > 1 ? "s" : ""}`)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                    {group.flights.map((flight) => {
                      const isSelected = activeFlight.id === flight.id;
                      const flightReg = resolveFlightStatusDetail(
                        flight.flightNumber,
                        flight.date,
                        flight.origin,
                        flightStatusDetails
                      ).detail?.registration;
                      return (
                        <button
                          key={flight.id}
                          type="button"
                          onClick={() => {
                            onSelectFlight(flight.id);
                            setIsFlightListOpen(false);
                          }}
                          className={`px-3.5 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? "bg-[#4C2812] dark:bg-[#5C3016] border-[#321B0A] dark:border-[#E89C1D] text-white shadow-xs"
                              : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] text-[#321B0A] dark:text-[#FAF7F2] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] hover:border-[#E89C1D]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 font-mono text-xs font-bold">
                            <span className="truncate">
                              {flight.airline} {flight.flightNumber} · {pick("Départ", "Dep.")} {flight.origin}
                              {flightReg ? (
                                <span className={isSelected ? "text-[#F7BA42]" : "text-[#8C5214] dark:text-[#F7BA42]"}>
                                  {" "}· {flightReg}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                                isSelected
                                  ? "bg-[#321B0A] dark:bg-[#1F1209] text-[#F7BA42]"
                                  : "bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42]"
                              }`}
                            >
                              {normalizeDcsFlightDate(flight.date)}
                            </span>
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 font-mono tabular-nums ${
                              isSelected ? "text-[#F3E9D8]" : "text-[#6E472B] dark:text-[#DECAB1]"
                            }`}
                          >
                            {flight.grandTotals.passengersCount} pax (
                            {flight.isPureEconomy
                              ? pick(`Pure Éco ${flight.configRaw}`, `All-Economy ${flight.configRaw}`)
                              : flight.configRaw ||
                                `${flight.businessTotals.passengersCount}C/${flight.economyTotals.passengersCount}Y`}
                            ) · {flight.grandTotals.totalWeight} kg
                            {flight.baggageUncoveredDeviationsCount > 0 && (
                              <span
                                className={`ml-1.5 font-bold ${
                                  isSelected ? "text-[#F7BA42]" : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                · {flight.baggageUncoveredDeviationsCount}{" "}
                                {pick(
                                  `écart${flight.baggageUncoveredDeviationsCount > 1 ? "s" : ""}`,
                                  `excess${flight.baggageUncoveredDeviationsCount > 1 ? "es" : ""}`
                                )}
                              </span>
                            )}
                            {(flight.baggageMissingWeightCount || 0) > 0 && (
                              <span
                                className={`ml-1.5 font-bold ${
                                  isSelected ? "text-amber-200" : "text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                · {flight.baggageMissingWeightCount}{" "}
                                {pick("poids manq.", "missing wt")}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Flight Identity + Cabin Totals + Exports */}
      <CollapsiblePanel
        title={`${activeFlight.airline} ${activeFlight.flightNumber} · ${normalizeDcsFlightDate(activeFlight.date)} · ${activeFlight.origin}`}
        subtitle={`${activeFlight.departureTimeFormatted} · ${activeFlight.aircraftType} (${activeFlight.isPureEconomy ? pick(`Pure Éco ${activeFlight.configRaw}`, `All-Economy ${activeFlight.configRaw}`) : activeFlight.configRaw || "—"}) · ${activeFlight.grandTotals.passengersCount} pax (${activeFlight.businessTotals.passengersCount}C/${activeFlight.economyTotals.passengersCount}Y) · ${activeFlight.grandTotals.bagsCount}/${activeFlight.grandTotals.totalWeight} kg`}
        icon={<Plane className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={false}
        rightContent={
          onOpenEmdAudit ? (
            <button
              type="button"
              onClick={() => onOpenEmdAudit(activeFlight)}
              className="px-2.5 py-1 rounded-lg border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              title={pick(
                "Extraire les commandes WINCMD(\"PTRWEMD*...\") et importer les montants WEMD* pour ce vol",
                "Extract WINCMD(\"PTRWEMD*...\") commands and import WEMD* amounts for this flight"
              )}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
              <span>EMDs Audit</span>
              <span className="font-mono tabular-nums opacity-85">
                ({activeFlightEmdStats.audited > 0
                  ? `${activeFlightEmdStats.audited}/${activeFlightEmdStats.total}`
                  : activeFlightEmdStats.total})
              </span>
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6D7C3]/70 dark:border-[#4C2812]/70">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4C2812] dark:bg-[#2E1A0D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/40 flex items-center justify-center shrink-0">
                <Plane className="w-5 h-5" />
              </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-[#321B0A] dark:text-[#FAF7F2] font-mono">
                  {activeFlight.airline} {activeFlight.flightNumber}
                </h4>
                <span className="text-[#D8C3A5] dark:text-[#5C351B]">|</span>
                <span className="text-sm font-bold text-[#8C5214] dark:text-[#F7BA42] font-mono">
                  {pick("Départ", "Dep.")} {activeFlight.origin}
                </span>
                <span className="text-xs font-mono text-[#6E472B] dark:text-[#DECAB1]">
                  · {activeFlight.date} · {activeFlight.departureTimeFormatted}
                  {activeFlight.gate ? ` · ${pick("Porte", "Gate")} ${activeFlight.gate}` : ""}
                </span>
              </div>
              <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono mt-0.5 space-y-0.5">
                <div>
                  {activeFlightStatus?.detail?.aircraftType || activeFlight.aircraftType}
                  {activeFlightStatus?.detail?.registration ? (
                    <span className="font-bold text-[#4C2812] dark:text-[#F7BA42]">
                      /{activeFlightStatus.detail.registration}
                    </span>
                  ) : null}
                  {activeFlightStatus?.detail && activeFlightStatus.detail.totalCapacity > 0 && (
                    <span>
                      {" "}· {pick("Cap.", "Cap.")}{" "}
                      <strong>{activeFlightStatus.detail.totalCapacity}</strong> (
                      {activeFlightStatus.detail.businessCapacity}C/
                      {activeFlightStatus.detail.economyCapacity}Y)
                      {activeFlightStatus.resolvedStatus
                        ? ` · ${activeFlightStatus.resolvedStatus}`
                        : ""}
                      {activeFlightStatus.detail.boardingTimeFormatted
                        ? ` · ${pick("Emb.", "Brd")} ${activeFlightStatus.detail.boardingTimeFormatted}`
                        : ""}
                    </span>
                  )}
                  {" "}· Config{" "}
                  {activeFlight.isPureEconomy
                    ? `${activeFlight.configRaw} (${pick("Pure Éco", "All-Economy")} · 0C/${activeFlight.configEconomy}Y)`
                    : `${activeFlight.configRaw} (${activeFlight.configBusiness}C/${activeFlight.configEconomy}Y)`}{" "}
                  · {activeFlight.headerEditCodes.join(" ")}
                </div>
                {activeFlight.destinationCounts && activeFlight.destinationCounts.length > 0 && (
                  <div className="text-[#4C2812] dark:text-[#FAF7F2]">
                    {pick("Destinations passagers :", "Passenger destinations:")}{" "}
                    {activeFlight.destinationCounts
                      .map((d) => `${d.code} (${d.count})`)
                      .join(", ")}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onEditEquipment && (
              <button
                type="button"
                onClick={() => onEditEquipment(activeFlight)}
                className="px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5 text-[#E89C1D]" />
                {pick("Modifier équipement", "Edit Equipment")}
              </button>
            )}

            {onViewFlightEvolution && (
              <button
                type="button"
                onClick={() =>
                  onViewFlightEvolution(
                    activeFlight.flightNumber,
                    activeFlight.origin
                  )
                }
                className="px-3 py-2 rounded-xl border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title={pick("Voir la courbe d'évolution multi-jours de ce vol", "View multi-day trend chart for this flight")}
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
                {pick("Courbe d'évolution", "Trend Chart")}
              </button>
            )}

            {onOpenEmdAudit && (
              <button
                type="button"
                onClick={() => onOpenEmdAudit(activeFlight)}
                className="px-3.5 py-2 rounded-xl border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                title={pick(
                  "Extraire les commandes WINCMD(\"PTRWEMD*...\") et importer le fichier WEMD* pour ce vol",
                  "Extract WINCMD(\"PTRWEMD*...\") commands and import WEMD* output for this flight"
                )}
              >
                <CreditCard className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
                <span>EMDs Audit</span>
                <span className="font-mono text-[11px] font-bold tabular-nums opacity-85">
                  ({activeFlightEmdStats.audited > 0
                    ? `${activeFlightEmdStats.audited}/${activeFlightEmdStats.total}`
                    : activeFlightEmdStats.total})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenEnhancedManifest(activeFlight)}
              className="px-3.5 py-2 rounded-xl bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Enhanced Manifest (.txt)
            </button>

            <button
              type="button"
              onClick={() =>
                exportManifestToExcel(
                  [activeFlight],
                  pick(
                    `Manifeste_${activeFlight.airline}${activeFlight.flightNumber}_${activeFlight.origin}_${activeFlight.date}.xlsx`,
                    `Manifest_${activeFlight.airline}${activeFlight.flightNumber}_${activeFlight.origin}_${activeFlight.date}.xlsx`
                  ),
                  language
                )
              }
              className="px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              {pick("Excel Vol", "Flight Excel")}
            </button>
          </div>
        </div>

        {/* C / Y / Total */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between font-mono tabular-nums">
            <div>
              <div className="font-sans font-bold text-[#321B0A] dark:text-[#F7BA42]">Business (C)</div>
              <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                {activeFlight.businessTotals.male}{pick("H", "M")} / {activeFlight.businessTotals.female}F /{" "}
                {activeFlight.businessTotals.infant} INF
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {activeFlight.businessTotals.passengersCount} pax
              </div>
              <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                {activeFlight.businessTotals.bagsCount} pcs ·{" "}
                {activeFlight.businessTotals.totalWeight} kg
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between font-mono tabular-nums">
            <div>
              <div className="font-sans font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {pick("Économie (Y)", "Economy (Y)")}
              </div>
              <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                {activeFlight.economyTotals.male}{pick("H", "M")} / {activeFlight.economyTotals.female}F /{" "}
                {activeFlight.economyTotals.child} CHD / {activeFlight.economyTotals.infant} INF
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {activeFlight.economyTotals.passengersCount} pax
              </div>
              <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                {activeFlight.economyTotals.bagsCount} pcs ·{" "}
                {activeFlight.economyTotals.totalWeight} kg
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#4C2812] dark:bg-[#2E180A] border border-transparent dark:border-[#E89C1D]/45 text-white flex items-center justify-between font-mono tabular-nums">
            <div>
              <div className="font-sans font-bold">
                {pick("Total Voyagé", "Traveled Total")}
                {activeFlightStatus?.detail && activeFlightStatus.detail.totalCapacity > 0 && (
                  <span className="ml-2 text-[#F7BA42] font-mono text-[11px]">
                    LF {((activeFlight.grandTotals.passengersCount / activeFlightStatus.detail.totalCapacity) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#F3E9D8] mt-0.5">
                {activeFlight.emdCount}/{activeFlight.ffCount + activeFlight.fqtvCount} EMD/FF ·{" "}
                <span className="text-sky-300 font-semibold">
                  {activeFlightWebCheckinCount} WB
                  {activeFlight.grandTotals.passengersCount > 0
                    ? ` (${((activeFlightWebCheckinCount / activeFlight.grandTotals.passengersCount) * 100).toFixed(0)}%)`
                    : ""}
                </span>
                {activeFlight.passengers.length > activeFlight.grandTotals.passengersCount && (
                  <span className="text-[#F7BA42] font-sans ml-1">
                    · +{activeFlight.passengers.length - activeFlight.grandTotals.passengersCount}{" "}
                    {pick("sans siège", "unseated")}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#F7BA42]">
                {activeFlight.grandTotals.passengersCount}
                {activeFlightStatus?.detail && activeFlightStatus.detail.totalCapacity > 0
                  ? `/${activeFlightStatus.detail.totalCapacity}`
                  : ""}{" "}
                pax
              </div>
              <div className="text-[11px] text-[#FAF7F2]">
                {activeFlight.grandTotals.bagsCount}/
                {activeFlight.grandTotals.totalWeight} kg
              </div>
            </div>
          </div>
        </div>
        </div>
      </CollapsiblePanel>

      {/* Collapsible Cabin Switcher, Multi-Criteria Filters, Search & Pagination Bar */}
      <CollapsiblePanel
        title={pick("Filtres Passagers", "Passenger Filters")}
        subtitle={pick(
          `${orderedPassengers.length} / ${activeFlight.passengers.length} affichés (${activeFlight.grandTotals.passengersCount} voyagés)${hasActiveFilters ? " · Filtres actifs" : ""}`,
          `${orderedPassengers.length} / ${activeFlight.passengers.length} shown (${activeFlight.grandTotals.passengersCount} traveled)${hasActiveFilters ? " · Active filters" : ""}`
        )}
        icon={<Search className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              {
                id: "BOTH" as const,
                label: pick(
                  `Toutes les cabines (${activeFlight.passengers.length})`,
                  `All cabins (${activeFlight.passengers.length})`
                ),
              },
              {
                id: "C" as const,
                label: `Business C (${activeFlight.businessPassengers.length})`,
              },
              {
                id: "Y" as const,
                label: pick(
                  `Économie Y (${activeFlight.economyPassengers.length})`,
                  `Economy Y (${activeFlight.economyPassengers.length})`
                ),
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCabinFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  cabinFilter === tab.id
                    ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                    : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={pick("Nom, billet, tag, EMD, FF...", "Name, ticket, tag, EMD, FF...")}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
              />
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
            >
              <option value={20}>20 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={200}>{pick("Tout afficher", "Show all")}</option>
            </select>
          </div>
        </div>

        {/* Seat / Boarding Status Quick Filter (Seated = Traveled vs No-Show = Ticket without Seat) */}
        <div className="pt-3 border-t border-[#E6D7C3]/70 dark:border-[#4C2812]/70 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E472B] dark:text-[#F7BA42] mr-1">
            {pick("Statut :", "Status:")}
          </span>
          {[
            {
              id: "ALL" as const,
              label: pick(
                `Tous (${activeFlight.passengers.length})`,
                `All (${activeFlight.passengers.length})`
              ),
            },
            {
              id: "WITH_SEAT" as const,
              label: pick(
                `Avec siège (${filterMeta.counts.WITH_SEAT})`,
                `Seated (${filterMeta.counts.WITH_SEAT})`
              ),
            },
            {
              id: "NO_SHOW" as const,
              label: pick(
                `No-Show / Sans siège (${filterMeta.counts.NO_SHOW})`,
                `No-Show / Unseated (${filterMeta.counts.NO_SHOW})`
              ),
            },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSeatStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                seatStatusFilter === st.id
                  ? st.id === "NO_SHOW"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                  : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Multi-Criteria Passenger Filters */}
        <div className="pt-3 border-t border-[#E6D7C3]/70 dark:border-[#4C2812]/70 flex flex-wrap items-center gap-2">
          <select
            value={genderTypeFilter}
            onChange={(e) =>
              setGenderTypeFilter(e.target.value as GenderTypeFilter)
            }
            className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
            title={pick("Filtrer par sexe ou catégorie passager", "Filter by gender or passenger type")}
          >
            <option value="ALL">{pick("Sexe / Type : Tous", "Gender / Type: All")}</option>
            <option value="M">{pick("Hommes (M)", "Male (M)")} · {filterMeta.counts.M}</option>
            <option value="F">{pick("Femmes (F)", "Female (F)")} · {filterMeta.counts.F}</option>
            <option value="CHD">{pick("Enfants (CHD)", "Children (CHD)")} · {filterMeta.counts.CHD}</option>
            <option value="INF">{pick("Avec Bébé (INF)", "With Infant (INF)")} · {filterMeta.counts.INF}</option>
            <option value="WEB_CHECKIN">{pick("Check-in en ligne (WB)", "Online Check-in (WB)")} · {filterMeta.counts.WEB_CHECKIN}</option>
            <option value="NO_SEAT">
              {pick("Sans siège / OFL", "No seat / OFL")} · {filterMeta.counts.NO_SEAT}
            </option>
          </select>

          <select
            value={bookingClassFilter}
            onChange={(e) => setBookingClassFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
            title={pick("Filtrer par classe de réservation", "Filter by booking class")}
          >
            <option value="ALL">{pick("Classe Résa : Toutes", "Booking Class: All")}</option>
            {filterMeta.bookingClasses.map((c) => (
              <option key={c.code} value={c.code}>
                {pick("Classe", "Class")} {c.code} ({c.count})
              </option>
            ))}
          </select>

          <select
            value={editCodeFilter}
            onChange={(e) => setEditCodeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer max-w-[230px]"
            title={pick("Filtrer par Edit Code DCS", "Filter by DCS Edit Code")}
          >
            <option value="ALL">{pick("Edit Code : Tous", "Edit Code: All")}</option>
            {filterMeta.editCodes.map((ec) => {
              const label = getEditCodeLabel(ec.code, language);
              return (
                <option key={ec.code} value={ec.code}>
                  {ec.code} ({ec.count}){label ? ` — ${label}` : ""}
                </option>
              );
            })}
          </select>

          <select
            value={baggageFilter}
            onChange={(e) => setBaggageFilter(e.target.value as BaggageFilter)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
            title={pick("Filtrer par bagages ou conformité franchise", "Filter by baggage or allowance compliance")}
          >
            <option value="ALL">{pick("Bagages & Franchise : Tous", "Baggage & Allowance: All")}</option>
            <option value="WITH_BAGS">{pick("Avec bagages en soute", "With checked baggage")}</option>
            <option value="NO_BAGS">{pick("Sans bagage (NB / 0)", "No baggage (NB / 0)")}</option>
            <option value="MISSING_WEIGHT">{pick("Poids bagage non spécifié", "Missing baggage weight")}</option>
            <option value="CONFORME">{pick("Franchise conforme", "Allowance compliant")}</option>
            <option value="ECART_NON_COUVERT">{pick("Écart sans EMD", "Excess without EMD")}</option>
            <option value="COUVERT_EMD">{pick("Couvert par EMD / AE", "Covered by EMD / AE")}</option>
          </select>

          {filterMeta.destinations.length > 1 && (
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              title={pick("Filtrer par destination passager", "Filter by passenger destination")}
            >
              <option value="ALL">{pick("Destination : Toutes", "Destination: All")}</option>
              {filterMeta.destinations.map((d) => (
                <option key={d.code} value={d.code}>
                  → {d.code} ({d.count})
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-[#6E472B] dark:text-[#DECAB1]">
              <strong className="text-[#321B0A] dark:text-[#FAF7F2]">{orderedPassengers.length}</strong>{" "}
              / {activeFlight.passengers.length} {pick("passagers", "passengers")}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 font-sans text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3" />
                {pick("Réinitialiser", "Reset")}
              </button>
            )}
          </div>
        </div>
        </div>
      </CollapsiblePanel>

      {/* Grouped Passenger Table (Alphabetical per class + Zebra Striping) */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden shadow-xs">
        {paginatedPassengers.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6E472B] dark:text-[#DECAB1]">
            {pick(
              "Aucun passager trouvé avec ces critères.",
              "No passengers found matching these criteria."
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {stationEmdSummary &&
                  stationEmdSummary.totalFlightEmdsCount > 0 &&
                  (stationEmdSummary.stationIssuedEmds.length > 0 ||
                    stationEmdSummary.transitOrForeignEmds.length > 0) && (
                    <tr className="bg-[#FDF4E3] dark:bg-[#28170C] border-b border-[#E6D7C3] dark:border-[#4C2812] text-xs">
                      <th colSpan={7} className="py-2.5 px-5 font-normal">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                            <CreditCard className="w-3.5 h-3.5 text-[#E89C1D] shrink-0" />
                            <span className="font-sans font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                              {pick(
                                `Recette EMD station ${stationEmdSummary.flightOrigin} :`,
                                `Station ${stationEmdSummary.flightOrigin} EMD revenue:`
                              )}
                            </span>
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">
                              {formatCurrencyTotals(
                                stationEmdSummary.stationTotalsByCurrency,
                                language === "fr" ? "fr-FR" : "en-US"
                              )}
                            </span>
                            {!(
                              stationEmdSummary.stationTotalsByCurrency.length === 1 &&
                              stationEmdSummary.stationTotalsByCurrency[0].currency ===
                                displayCurrency
                            ) && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-800/70">
                                ≈{" "}
                                {formatCurrencyAmount(
                                  stationEmdSummary.stationTotalTarget,
                                  displayCurrency,
                                  language === "fr" ? "fr-FR" : "en-US"
                                )}
                              </span>
                            )}
                            <span className="text-[#6E472B] dark:text-[#DECAB1]">
                              · {stationEmdSummary.stationIssuedEmds.length}{" "}
                              {pick(
                                `émis à ${stationEmdSummary.flightOrigin}`,
                                `issued at ${stationEmdSummary.flightOrigin}`
                              )}
                            </span>
                            {stationEmdSummary.transitOrForeignEmds.length > 0 && (
                              <span className="text-amber-700 dark:text-amber-400 font-sans font-semibold">
                                · {stationEmdSummary.transitOrForeignEmds.length}{" "}
                                {pick(
                                  `hors ${stationEmdSummary.flightOrigin}`,
                                  `foreign`
                                )}
                              </span>
                            )}
                          </div>

                          {(stationEmdSummary.stationExcessPieces32kg > 0 ||
                            stationEmdSummary.stationExcessPieces23kg > 0 ||
                            stationEmdSummary.stationInFlightUpgrades > 0) && (
                            <div className="font-mono text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] tabular-nums">
                              {[
                                stationEmdSummary.stationExcessPieces32kg > 0
                                  ? `32kg: ${stationEmdSummary.stationExcessPieces32kg}`
                                  : "",
                                stationEmdSummary.stationExcessPieces23kg > 0
                                  ? `23kg: ${stationEmdSummary.stationExcessPieces23kg}`
                                  : "",
                                stationEmdSummary.stationInFlightUpgrades > 0
                                  ? `Upgrade: ${stationEmdSummary.stationInFlightUpgrades}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      </th>
                    </tr>
                  )}

                <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] text-[11px] font-semibold uppercase tracking-wider border-b border-[#321B0A] dark:border-[#5C351B]">
                  <th className="py-3 pl-5 pr-2 w-20">{pick("N° Ordre", "Seq #")}</th>
                  <th className="py-3 px-3">{pick("Passager (A → Z)", "Passenger (A → Z)")}</th>
                  <th className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{pick("Résa / Siège", "Booking / Seat")}</span>
                      <span className="inline-flex items-center gap-1 text-sky-300 font-mono text-[10px]">
                        · <WebCheckinBadge /> {filteredWbCount} WB
                      </span>
                    </span>
                  </th>
                  <th className="py-3 px-3">{pick("Bagages & Franchise", "Baggage & Allowance")}</th>
                  <th className="py-3 px-3">{pick("EMD / Fidélité", "EMD / Loyalty")}</th>
                  <th className="py-3 px-3">{pick("Billet & Suite", "Ticket & Onward")}</th>
                  <th className="py-3 pr-5 pl-2 text-right">{pick("Dossier", "Record")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70 text-xs">
                {pageBusiness.length > 0 && (
                  <>
                    <tr className="bg-[#321B0A] dark:bg-[#2C180B] text-[#F7BA42] border-y border-[#6E472B] dark:border-[#5C351B]">
                      <td colSpan={7} className="py-2 px-5 font-mono text-[11px] font-bold tracking-wide">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {pick(
                              `C CLASS — BUSINESS · ${activeFlight.businessTotals.passengersCount} voyagé(s)${activeFlight.businessPassengers.length > activeFlight.businessTotals.passengersCount ? ` / ${activeFlight.businessPassengers.length} liste` : ""}`,
                              `C CLASS — BUSINESS · ${activeFlight.businessTotals.passengersCount} traveled${activeFlight.businessPassengers.length > activeFlight.businessTotals.passengersCount ? ` / ${activeFlight.businessPassengers.length} listed` : ""}`
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sky-300">
                            <WebCheckinBadge />
                            {pick("Check-in en ligne (WB) :", "Online Check-in (WB):")} {activeFlightBizWbCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {renderRows(pageBusiness)}
                  </>
                )}

                {pageEconomy.length > 0 && (
                  <>
                    <tr className="bg-[#6E472B] dark:bg-[#3A2212] text-[#FAF7F2] border-y border-[#4C2812] dark:border-[#5C351B]">
                      <td colSpan={7} className="py-2 px-5 font-mono text-[11px] font-bold tracking-wide">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {pick(
                              `Y CLASS — ÉCONOMIE · ${activeFlight.economyTotals.passengersCount} voyagé(s)${activeFlight.economyPassengers.length > activeFlight.economyTotals.passengersCount ? ` / ${activeFlight.economyPassengers.length} liste` : ""}`,
                              `Y CLASS — ECONOMY · ${activeFlight.economyTotals.passengersCount} traveled${activeFlight.economyPassengers.length > activeFlight.economyTotals.passengersCount ? ` / ${activeFlight.economyPassengers.length} listed` : ""}`
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sky-200">
                            <WebCheckinBadge />
                            {pick("Check-in en ligne (WB) :", "Online Check-in (WB):")} {activeFlightEcoWbCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {renderRows(pageEconomy)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {orderedPassengers.length > 0 && (
          <div className="px-5 py-3 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums">
              {pick("Affichage", "Showing")} {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, orderedPassengers.length)}{" "}
              {pick("sur", "of")}{" "}
              <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {orderedPassengers.length}
              </span>{" "}
              {pick("passagers", "passengers")}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 font-semibold text-[#4C2812] dark:text-[#FAF7F2] inline-flex items-center gap-1 cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {pick("Précédent", "Previous")}
              </button>
              <span className="font-mono text-[#4C2812] dark:text-[#F7BA42] font-semibold px-2 tabular-nums">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 font-semibold text-[#4C2812] dark:text-[#FAF7F2] inline-flex items-center gap-1 cursor-pointer disabled:cursor-default"
              >
                {pick("Suivant", "Next")}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Passenger Slide-Over Dossier */}
      <PassengerDossierDrawer
        passenger={activeDrawerPax}
        flight={activeFlight}
        emdDetailsMap={emdDetailsMap}
        onClose={() => setDrawerPaxId(null)}
        hasPrev={drawerIndex > 0}
        hasNext={drawerIndex >= 0 && drawerIndex < orderedPassengers.length - 1}
        onPrev={() => {
          if (drawerIndex > 0) setDrawerPaxId(orderedPassengers[drawerIndex - 1].id);
        }}
        onNext={() => {
          if (drawerIndex >= 0 && drawerIndex < orderedPassengers.length - 1) {
            setDrawerPaxId(orderedPassengers[drawerIndex + 1].id);
          }
        }}
      />
    </div>
  );
};
