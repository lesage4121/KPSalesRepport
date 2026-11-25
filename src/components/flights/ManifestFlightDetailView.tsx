

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
  Calendar,
  Pencil,
  Users,
  Luggage,
  ShieldAlert,
  Award,
  UserX,
  TicketX,
  Smartphone,
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
  buildPriorFlightPaxKeys,
  extractInfantFromRawLines,
  getDcsFlightDateSortOrder,
  getEditCodeLabel,
  getFlightWebCheckinCount,
  getPassengerDepartureType,
  isPassengerNoShow,
  isPassengerNoTicket,
  isPassengerWebCheckin,
  isPassengerWithSeat,
  normalizeDcsFlightDate,
  PassengerDepartureType,
} from "../../utils/manifestParser";
import {
  exportFlightDetailReportToExcel,
  exportFlightDetailReportToPDF,
} from "../../utils/flightStatsExport";
import {
  computeStationFlightEmdSummary,
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
import { FilterOptionField } from "./FilterOptionField";
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
type DepartureTypeFilter = "ALL" | PassengerDepartureType;
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
}) => {
  const { language, locale, pick } = useLanguage();
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>("BOTH");
  const [seatStatusFilter, setSeatStatusFilter] =
    useState<SeatStatusFilter>("ALL");
  const [departureTypeFilter, setDepartureTypeFilter] =
    useState<DepartureTypeFilter>("ALL");
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

  const priorLegPaxKeys = useMemo(() => {
    if (!activeFlight) return undefined;
    return buildPriorFlightPaxKeys(activeFlight, parsedResult.flights);
  }, [activeFlight, parsedResult.flights]);

  const activeFlightStatus = useMemo(() => {
    if (!activeFlight) return null;
    return resolveFlightStatusDetail(
      activeFlight.flightNumber,
      activeFlight.date,
      activeFlight.origin,
      flightStatusDetails
    );
  }, [activeFlight, flightStatusDetails]);

  const activeFlightKpis = useMemo(() => {
    if (!activeFlight) {
      return {
        traveled: 0,
        business: 0,
        economy: 0,
        bags: 0,
        weight: 0,
        uncoveredDeviations: 0,
        missingBagWeight: 0,
        emd: 0,
        ff: 0,
        fqtv: 0,
        loyaltyTotal: 0,
        noShow: 0,
        noTicket: 0,
        wbCount: 0,
        wbPct: "0",
      };
    }
    const traveled = activeFlight.grandTotals.passengersCount;
    const wbCount = getFlightWebCheckinCount(activeFlight);
    let noShow = 0;
    let noTicket = 0;
    for (const pax of activeFlight.passengers) {
      if (isPassengerNoShow(pax)) noShow += 1;
      if (isPassengerNoTicket(pax)) noTicket += 1;
    }
    return {
      traveled,
      business: activeFlight.businessTotals.passengersCount,
      economy: activeFlight.economyTotals.passengersCount,
      bags: activeFlight.grandTotals.bagsCount,
      weight: activeFlight.grandTotals.totalWeight,
      uncoveredDeviations: activeFlight.baggageUncoveredDeviationsCount,
      missingBagWeight: activeFlight.baggageMissingWeightCount || 0,
      emd: activeFlight.emdCount,
      ff: activeFlight.ffCount,
      fqtv: activeFlight.fqtvCount,
      loyaltyTotal: activeFlight.ffCount + activeFlight.fqtvCount,
      noShow,
      noTicket,
      wbCount,
      wbPct: traveled > 0 ? ((wbCount / traveled) * 100).toFixed(1) : "0",
    };
  }, [activeFlight]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (cabinFilter !== "BOTH") parts.push(`${pick("Cabine", "Cabin")}: ${cabinFilter}`);
    if (seatStatusFilter !== "ALL") parts.push(seatStatusFilter);
    if (departureTypeFilter !== "ALL") parts.push(departureTypeFilter);
    if (genderTypeFilter !== "ALL") parts.push(genderTypeFilter);
    if (bookingClassFilter !== "ALL") parts.push(`${pick("Classe", "Cls")}: ${bookingClassFilter}`);
    if (editCodeFilter !== "ALL") parts.push(`Code: ${editCodeFilter}`);
    if (baggageFilter !== "ALL") parts.push(baggageFilter);
    if (destFilter !== "ALL") parts.push(`Dest: ${destFilter}`);
    if (searchTerm.trim()) parts.push(`"${searchTerm.trim()}"`);
    return parts.join(" · ");
  }, [
    cabinFilter,
    seatStatusFilter,
    departureTypeFilter,
    genderTypeFilter,
    bookingClassFilter,
    editCodeFilter,
    baggageFilter,
    destFilter,
    searchTerm,
    pick,
  ]);

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
    departureTypeFilter,
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
          DEP_LOCAL: 0,
          DEP_TRANSIT: 0,
          DEP_CONNECTION: 0,
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
      DEP_LOCAL: 0,
      DEP_TRANSIT: 0,
      DEP_CONNECTION: 0,
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
      const depType = getPassengerDepartureType(p, activeFlight, priorLegPaxKeys);
      if (depType === "LOCAL") counts.DEP_LOCAL++;
      else if (depType === "TRANSIT") counts.DEP_TRANSIT++;
      else counts.DEP_CONNECTION++;
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
  }, [activeFlight, priorLegPaxKeys]);

  const hasActiveFilters =
    cabinFilter !== "BOTH" ||
    seatStatusFilter !== "ALL" ||
    departureTypeFilter !== "ALL" ||
    genderTypeFilter !== "ALL" ||
    bookingClassFilter !== "ALL" ||
    editCodeFilter !== "ALL" ||
    baggageFilter !== "ALL" ||
    destFilter !== "ALL" ||
    searchTerm.trim() !== "";

  const resetAllFilters = () => {
    setCabinFilter("BOTH");
    setSeatStatusFilter("ALL");
    setDepartureTypeFilter("ALL");
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

      // 0b. Provenance au départ (Local vs Transit même avion vs Correspondance/Transfert autre vol)
      if (
        departureTypeFilter !== "ALL" &&
        getPassengerDepartureType(pax, activeFlight, priorLegPaxKeys) !==
          departureTypeFilter
      ) {
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
    priorLegPaxKeys,
    cabinFilter,
    seatStatusFilter,
    departureTypeFilter,
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
      const depType = getPassengerDepartureType(pax, activeFlight, priorLegPaxKeys);
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
            <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] flex items-center gap-1.5 flex-wrap">
              <span>→ {pax.destination}</span>
              <span
                className={`px-1.5 py-0.5 rounded font-sans text-[10px] font-bold ${
                  depType === "TRANSIT"
                    ? "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                    : depType === "CONNECTION"
                    ? "bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300"
                    : "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {depType === "TRANSIT"
                  ? pick("Transit", "Transit")
                  : depType === "CONNECTION"
                  ? pick("Corresp.", "Transfer")
                  : pick("Local", "Local")}
              </span>
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

      {/* 1. Passenger Filters (First, with PDF & Excel report + filtered passenger exports) */}
      <CollapsiblePanel
        title={pick("Filtres Passagers", "Passenger Filters")}
        subtitle={pick(
          `${orderedPassengers.length} / ${activeFlight.passengers.length} affichés (${activeFlight.grandTotals.passengersCount} voyagés)${hasActiveFilters ? " · Filtres actifs" : ""}`,
          `${orderedPassengers.length} / ${activeFlight.passengers.length} shown (${activeFlight.grandTotals.passengersCount} traveled)${hasActiveFilters ? " · Active filters" : ""}`
        )}
        icon={<Search className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={true}
        rightContent={
          <div className="flex flex-wrap items-center gap-1.5">
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
            <button
              type="button"
              disabled={orderedPassengers.length === 0}
              onClick={() =>
                exportFlightDetailReportToPDF({
                  flight: activeFlight,
                  passengers: orderedPassengers,
                  flightStatusDetail: activeFlightStatus?.detail,
                  priorLegPaxKeys,
                  activeFilterSummary,
                  language,
                })
              }
              className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] disabled:opacity-40 text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-default whitespace-nowrap"
              title={pick(
                "Exporter le rapport du vol et la liste des passagers filtrés en PDF",
                "Export flight report and filtered passenger list as PDF"
              )}
            >
              <FileText className="w-3 h-3 text-[#E89C1D]" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              disabled={orderedPassengers.length === 0}
              onClick={() =>
                exportFlightDetailReportToExcel({
                  flight: activeFlight,
                  passengers: orderedPassengers,
                  flightStatusDetail: activeFlightStatus?.detail,
                  priorLegPaxKeys,
                  activeFilterSummary,
                  language,
                })
              }
              className="px-2.5 py-1 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] disabled:opacity-40 text-[#4C2812] dark:text-[#FAF7F2] text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-default whitespace-nowrap"
              title={pick(
                "Exporter le rapport du vol et la liste des passagers filtrés en Excel",
                "Export flight report and filtered passenger list as Excel"
              )}
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>
        }
      >
        <div className="space-y-2.5">
          {/* Row 1: Free-text Search + PageSize + Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative w-full sm:max-w-xs">
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

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <span className="text-[#6E472B] dark:text-[#DECAB1]">
                <strong className="text-[#321B0A] dark:text-[#FAF7F2]">{orderedPassengers.length}</strong>{" "}
                / {activeFlight.passengers.length} {pick("passagers", "passengers")}
              </span>
            </div>
          </div>

          {/* Row 2: Unified Searchable Option Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            <FilterOptionField
              value={cabinFilter}
              onChange={(v) => setCabinFilter(v as CabinFilter)}
              allValue="BOTH"
              prefixLabel={pick("Cabine", "Cabin")}
              allLabel={pick(
                `Toutes (${activeFlight.passengers.length})`,
                `All (${activeFlight.passengers.length})`
              )}
              placeholder={pick("Cabine...", "Cabin...")}
              options={[
                {
                  value: "C",
                  label: "Business (C)",
                  count: activeFlight.businessPassengers.length,
                  keywords: "business c",
                },
                {
                  value: "Y",
                  label: pick("Économie (Y)", "Economy (Y)"),
                  count: activeFlight.economyPassengers.length,
                  keywords: "economie economy y",
                },
              ]}
            />

            <FilterOptionField
              value={seatStatusFilter}
              onChange={(v) => setSeatStatusFilter(v as SeatStatusFilter)}
              prefixLabel={pick("Statut", "Status")}
              allLabel={pick(
                `Tous (${activeFlight.passengers.length})`,
                `All (${activeFlight.passengers.length})`
              )}
              placeholder={pick("Statut siège...", "Seat status...")}
              options={[
                {
                  value: "WITH_SEAT",
                  label: pick("Avec siège", "Seated"),
                  count: filterMeta.counts.WITH_SEAT,
                  keywords: "avec siege seated",
                },
                {
                  value: "NO_SHOW",
                  label: pick("No-Show / Sans siège", "No-Show / Unseated"),
                  count: filterMeta.counts.NO_SHOW,
                  keywords: "no-show noshow sans siege unseated",
                },
              ]}
            />

            <FilterOptionField
              value={departureTypeFilter}
              onChange={(v) => setDepartureTypeFilter(v as DepartureTypeFilter)}
              prefixLabel={pick(`Départ ${activeFlight.origin}`, `Dep. ${activeFlight.origin}`)}
              allLabel={pick(
                `Tous (${activeFlight.passengers.length})`,
                `All (${activeFlight.passengers.length})`
              )}
              placeholder={pick("Local / Transit / Corresp...", "Local / Transit / Transfer...")}
              options={[
                {
                  value: "LOCAL",
                  label: pick(`Locaux · ${activeFlight.origin}`, `Local · ${activeFlight.origin}`),
                  count: filterMeta.counts.DEP_LOCAL,
                  keywords: "local locaux",
                },
                {
                  value: "TRANSIT",
                  label: pick("Transit (même avion)", "Transit (same aircraft)"),
                  count: filterMeta.counts.DEP_TRANSIT,
                  keywords: "transit escale meme avion through #",
                },
                {
                  value: "CONNECTION",
                  label: pick("Correspondance (transfert)", "Connection (transfer)"),
                  count: filterMeta.counts.DEP_CONNECTION,
                  keywords: "correspondance transfert autre vol connection ib",
                },
              ]}
              title={pick(
                "Filtrer par provenance : locaux, transit (même avion) ou correspondance/transfert (autre vol)",
                "Filter by departure origin: local, through-transit, or transfer connection"
              )}
            />

            <FilterOptionField
              value={genderTypeFilter}
              onChange={(v) => setGenderTypeFilter(v as GenderTypeFilter)}
              prefixLabel={pick("Catégorie", "Category")}
              allLabel={pick("Tous", "All")}
              placeholder={pick("Sexe / Type...", "Gender / Type...")}
              options={[
                {
                  value: "M",
                  label: pick("Hommes (M)", "Male (M)"),
                  count: filterMeta.counts.M,
                  keywords: "homme male m",
                },
                {
                  value: "F",
                  label: pick("Femmes (F)", "Female (F)"),
                  count: filterMeta.counts.F,
                  keywords: "femme female f",
                },
                {
                  value: "CHD",
                  label: pick("Enfants (CHD)", "Children (CHD)"),
                  count: filterMeta.counts.CHD,
                  keywords: "enfant child chd",
                },
                {
                  value: "INF",
                  label: pick("Avec Bébé (INF)", "With Infant (INF)"),
                  count: filterMeta.counts.INF,
                  keywords: "bebe infant inf",
                },
                {
                  value: "WEB_CHECKIN",
                  label: pick("Check-in en ligne (WB)", "Online Check-in (WB)"),
                  count: filterMeta.counts.WEB_CHECKIN,
                  keywords: "web check-in wb",
                },
                {
                  value: "NO_SEAT",
                  label: pick("Sans siège / OFL", "No seat / OFL"),
                  count: filterMeta.counts.NO_SEAT,
                  keywords: "ofl sans siege offloaded",
                },
              ]}
            />

            <FilterOptionField
              value={bookingClassFilter}
              onChange={setBookingClassFilter}
              prefixLabel={pick("Classe", "Class")}
              allLabel={pick("Toutes", "All")}
              placeholder={pick("Classe résa...", "Booking class...")}
              options={filterMeta.bookingClasses.map((c) => ({
                value: c.code,
                label: `${pick("Classe", "Class")} ${c.code}`,
                count: c.count,
                keywords: c.code,
              }))}
            />

            <FilterOptionField
              value={editCodeFilter}
              onChange={setEditCodeFilter}
              prefixLabel="Edit Code"
              allLabel={pick("Tous", "All")}
              placeholder={pick("Saisir ou choisir code...", "Type or select code...")}
              options={filterMeta.editCodes.map((ec) => {
                const label = getEditCodeLabel(ec.code, language);
                return {
                  value: ec.code,
                  label: label ? `${ec.code} — ${label}` : ec.code,
                  count: ec.count,
                  keywords: `${ec.code} ${label || ""}`,
                };
              })}
            />

            <FilterOptionField
              value={baggageFilter}
              onChange={(v) => setBaggageFilter(v as BaggageFilter)}
              prefixLabel={pick("Bagages", "Baggage")}
              allLabel={pick("Tous", "All")}
              placeholder={pick("Bagages / Franchise...", "Baggage / Allowance...")}
              options={[
                {
                  value: "WITH_BAGS",
                  label: pick("Avec bagages en soute", "With checked baggage"),
                  keywords: "avec bagages checked",
                },
                {
                  value: "NO_BAGS",
                  label: pick("Sans bagage (NB / 0)", "No baggage (NB / 0)"),
                  keywords: "sans bagage nb",
                },
                {
                  value: "MISSING_WEIGHT",
                  label: pick("Poids non spécifié", "Missing weight"),
                  keywords: "poids manquant missing weight",
                },
                {
                  value: "CONFORME",
                  label: pick("Franchise conforme", "Allowance compliant"),
                  keywords: "conforme compliant",
                },
                {
                  value: "ECART_NON_COUVERT",
                  label: pick("Écart sans EMD", "Excess without EMD"),
                  keywords: "ecart exces excess emd",
                },
                {
                  value: "COUVERT_EMD",
                  label: pick("Couvert par EMD / AE", "Covered by EMD / AE"),
                  keywords: "couvert emd ae",
                },
              ]}
            />

            {filterMeta.destinations.length > 1 && (
              <FilterOptionField
                value={destFilter}
                onChange={setDestFilter}
                prefixLabel={pick("Dest.", "Dest.")}
                allLabel={pick("Toutes", "All")}
                placeholder={pick("Destination...", "Destination...")}
                options={filterMeta.destinations.map((d) => ({
                  value: d.code,
                  label: `→ ${d.code}`,
                  count: d.count,
                  keywords: d.code,
                }))}
              />
            )}
          </div>
        </div>
      </CollapsiblePanel>

      {/* 2. Flight KPIs Collapse (Same 8 compact KPIs as Overview, scoped to selected flight + Enhanced Manifest button on collapse header) */}
      <CollapsiblePanel
        title={`${activeFlight.airline} ${activeFlight.flightNumber} · ${normalizeDcsFlightDate(activeFlight.date)} · ${activeFlight.origin}`}
        subtitle={`${activeFlightKpis.traveled} pax (C${activeFlightKpis.business}Y${activeFlightKpis.economy}) · ${activeFlightKpis.bags}/${activeFlightKpis.weight.toLocaleString(locale)} kg · ${activeFlightKpis.wbCount} WB · ${activeFlightKpis.emd} EMD · ${activeFlightKpis.noShow} NOSHOW`}
        icon={<Plane className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={true}
        rightContent={
          <button
            type="button"
            onClick={() => onOpenEnhancedManifest(activeFlight)}
            className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Enhanced Manifest</span>
          </button>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Traveled Passengers */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] truncate">
                {pick("Passagers Voyagés", "Traveled Passengers")}
              </div>
              <div className="text-xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.traveled}
              </div>
              <div className="text-[11px] font-bold text-[#4C2812] dark:text-[#F7BA42] mt-1 font-mono tabular-nums">
                C{activeFlightKpis.business}Y{activeFlightKpis.economy}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#EFE4D4] dark:bg-[#3A2212] shrink-0">
              <Users className="w-5 h-5 text-[#4C2812] dark:text-[#F7BA42]" />
            </div>
          </div>

          {/* 2. Baggage */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] truncate">
                {pick("Bagages", "Baggage")}
              </div>
              <div className="text-xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.bags}/{activeFlightKpis.weight.toLocaleString(locale)}{" "}
                <span className="text-xs font-semibold text-[#6E472B] dark:text-[#DECAB1]">kg</span>
              </div>
              <div className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums">
                {pick("moy.", "avg.")}{" "}
                {activeFlightKpis.bags > 0
                  ? (activeFlightKpis.weight / activeFlightKpis.bags).toFixed(1)
                  : "0"}{" "}
                {pick("kg/sac", "kg/bag")}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#EFE4D4] dark:bg-[#3A2212] shrink-0">
              <Luggage className="w-5 h-5 text-[#4C2812] dark:text-[#F7BA42]" />
            </div>
          </div>

          {/* 3. Baggage Allowance Deviations */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] truncate">
                {pick("Écarts Franchises Bagages", "Baggage Allowance Deviations")}
              </div>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.uncoveredDeviations}{" "}
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  {pick("sans EMD", "without EMD")}
                </span>
              </div>
              {activeFlightKpis.missingBagWeight > 0 && (
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-1 font-mono tabular-nums">
                  +{activeFlightKpis.missingBagWeight}{" "}
                  {pick("poids manq.", "missing wt")}
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-rose-100/80 dark:bg-rose-950/60 shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>

          {/* 4. EMD */}
          <div
            onClick={() => onOpenEmdAudit?.(activeFlight)}
            className={`bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2 ${
              onOpenEmdAudit ? "hover:border-[#E89C1D] cursor-pointer transition-colors" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                EMD
              </div>
              <div className="text-xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.emd}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#FDF4E3] dark:bg-[#3A2212] shrink-0">
              <CreditCard className="w-5 h-5 text-[#8C5214] dark:text-[#E89C1D]" />
            </div>
          </div>

          {/* 5. Loyalty */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                {pick("Fidélité", "Loyalty")}
              </div>
              <div className="text-xl font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.loyaltyTotal}
              </div>
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] mt-1 font-mono tabular-nums">
                {activeFlightKpis.ff}/{activeFlightKpis.fqtv} FF/FQTV
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#FDF4E3] dark:bg-[#3A2212] shrink-0">
              <Award className="w-5 h-5 text-[#E89C1D]" />
            </div>
          </div>

          {/* 6. NOSHOW */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                NOSHOW
              </div>
              <div className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.noShow}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 shrink-0">
              <UserX className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
          </div>

          {/* 7. NO TICKET */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                NO TICKET
              </div>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1 font-mono tabular-nums leading-none">
                {activeFlightKpis.noTicket}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-rose-100/80 dark:bg-rose-950/60 shrink-0">
              <TicketX className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>

          {/* 8. WEB CHECK IN */}
          <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                WEB CHECK IN
              </div>
              <div className="text-xl font-bold text-sky-700 dark:text-sky-300 mt-1 font-mono tabular-nums leading-none flex items-baseline gap-1.5">
                <span>{activeFlightKpis.wbCount}</span>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                  ({activeFlightKpis.wbPct}%)
                </span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-sky-100/80 dark:bg-sky-950/60 shrink-0">
              <Smartphone className="w-5 h-5 text-sky-600 dark:text-sky-400" />
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
