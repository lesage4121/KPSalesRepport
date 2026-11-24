/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  FileDown,
  FileSpreadsheet,
  Filter,
  Luggage,
  Plane,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  EmdDocumentDetail,
  ManifestFlight,
  ManifestParseResult,
  ManifestPassenger,
} from "../../types";
import {
  extractInfantFromRawLines,
  getDcsFlightDateSortOrder,
  getEditCodeLabel,
  isPassengerNoShow,
  isPassengerWebCheckin,
  isPassengerWithSeat,
  normalizeDcsFlightDate,
} from "../../utils/manifestParser";
import {
  formatEmdMonetaryValue,
  normalizeEmdNumber,
} from "../../utils/emdAudit";
import { PassengerDossierDrawer } from "./PassengerDossierDrawer";
import { BabyBottleIcon } from "./BabyBottleIcon";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { useLanguage } from "../../context/LanguageContext";

interface MultiFlightPassengersViewProps {
  parsedResult: ManifestParseResult;
  emdDetailsMap?: Record<string, EmdDocumentDetail>;
  preselectedDates?: string[] | null;
  preselectedFlightNumbers?: string[] | null;
  onPreselectionConsumed?: () => void;
  onInspectFlight?: (flightId: string) => void;
}

type CabinFilter = "BOTH" | "C" | "Y";
type SeatStatusFilter = "ALL" | "WITH_SEAT" | "NO_SHOW" | "NO_SEAT";
type GenderTypeFilter =
  | "ALL"
  | "M"
  | "F"
  | "CHD"
  | "INF"
  | "NO_SEAT"
  | "TRANSIT"
  | "CODESHARE"
  | "WEB_CHECKIN";
type BaggageFilter =
  | "ALL"
  | "WITH_BAGS"
  | "NO_BAGS"
  | "MISSING_WEIGHT"
  | "CONFORME"
  | "ECART_NON_COUVERT"
  | "COUVERT_EMD";
type SpecialFilter =
  | "ALL"
  | "HAS_EMD"
  | "HAS_FF"
  | "NO_TICKET"
  | "HAS_CONNECTION";
type SortMode = "FLIGHT_ALPHA" | "ALPHA" | "WEIGHT_DESC";
type EditCodeMatchMode = "ANY" | "ALL";

interface CrossFlightEntry {
  flight: ManifestFlight;
  passenger: ManifestPassenger;
  normDate: string;
  dateSortOrder: number;
}

export const MultiFlightPassengersView: React.FC<
  MultiFlightPassengersViewProps
> = ({
  parsedResult,
  emdDetailsMap = {},
  preselectedDates,
  preselectedFlightNumbers,
  onPreselectionConsumed,
  onInspectFlight,
}) => {
  const { language, locale, pick } = useLanguage();

  // Scope selectors: empty array = ALL
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedFlightNumbers, setSelectedFlightNumbers] = useState<string[]>(
    []
  );
  const [originFilter, setOriginFilter] = useState<string>("ALL");

  // Passenger criteria filters
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>("BOTH");
  const [seatStatusFilter, setSeatStatusFilter] =
    useState<SeatStatusFilter>("ALL");
  const [genderTypeFilter, setGenderTypeFilter] =
    useState<GenderTypeFilter>("ALL");
  const [bookingClassFilter, setBookingClassFilter] = useState<string>("ALL");
  const [selectedEditCodes, setSelectedEditCodes] = useState<string[]>([]);
  const [editCodeMatchMode, setEditCodeMatchMode] =
    useState<EditCodeMatchMode>("ANY");
  const [baggageFilter, setBaggageFilter] = useState<BaggageFilter>("ALL");
  const [destFilter, setDestFilter] = useState<string>("ALL");
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("FLIGHT_ALPHA");

  // Pagination & Dossier Drawer
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  // Sync external preselection (e.g. clicking "Passagers" on a date group in Overview)
  useEffect(() => {
    if (
      (preselectedDates && preselectedDates.length > 0) ||
      (preselectedFlightNumbers && preselectedFlightNumbers.length > 0)
    ) {
      if (preselectedDates) {
        setSelectedDates(preselectedDates.map((d) => normalizeDcsFlightDate(d)));
      }
      if (preselectedFlightNumbers) {
        setSelectedFlightNumbers(preselectedFlightNumbers);
      }
      setCurrentPage(1);
      onPreselectionConsumed?.();
    }
  }, [preselectedDates, preselectedFlightNumbers, onPreselectionConsumed]);

  // Available dates sorted most recent first
  const availableDates = useMemo(() => {
    const map = new Map<
      string,
      { date: string; sortOrder: number; flightsCount: number; paxCount: number }
    >();
    for (const f of parsedResult.flights) {
      const norm = normalizeDcsFlightDate(f.date);
      const sortOrder = getDcsFlightDateSortOrder(norm, f.extractedYear);
      const existing = map.get(norm) || {
        date: norm,
        sortOrder,
        flightsCount: 0,
        paxCount: 0,
      };
      existing.flightsCount += 1;
      existing.paxCount += f.grandTotals.passengersCount;
      map.set(norm, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.sortOrder - a.sortOrder);
  }, [parsedResult.flights]);

  // Flights matching selectedDates (and originFilter) to populate available flight numbers
  const flightsMatchingDate = useMemo(() => {
    return parsedResult.flights.filter((f) => {
      if (selectedDates.length > 0) {
        const norm = normalizeDcsFlightDate(f.date);
        if (!selectedDates.includes(norm)) return false;
      }
      return true;
    });
  }, [parsedResult.flights, selectedDates]);

  const availableOrigins = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of flightsMatchingDate) {
      if (f.origin) counts[f.origin] = (counts[f.origin] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, count]) => ({ code, count }));
  }, [flightsMatchingDate]);

  const availableFlightNumbers = useMemo(() => {
    const map = new Map<
      string,
      {
        flightNumber: string;
        airline: string;
        legsCount: number;
        paxCount: number;
        origins: Set<string>;
      }
    >();
    for (const f of flightsMatchingDate) {
      if (originFilter !== "ALL" && f.origin !== originFilter) continue;
      const num = f.flightNumber;
      const entry = map.get(num) || {
        flightNumber: num,
        airline: f.airline || "KP",
        legsCount: 0,
        paxCount: 0,
        origins: new Set<string>(),
      };
      entry.legsCount += 1;
      entry.paxCount += f.grandTotals.passengersCount;
      if (f.origin) entry.origins.add(f.origin);
      map.set(num, entry);
    }
    return Array.from(map.values()).sort((a, b) => {
      const na = parseInt(a.flightNumber, 10);
      const nb = parseInt(b.flightNumber, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return a.flightNumber.localeCompare(b.flightNumber);
    });
  }, [flightsMatchingDate, originFilter]);

  // Prune invalid selected flight numbers if date/origin filter narrows them out
  const validFlightNumbersSet = useMemo(
    () => new Set(availableFlightNumbers.map((fn) => fn.flightNumber)),
    [availableFlightNumbers]
  );

  const effectiveSelectedFlightNumbers = useMemo(
    () => selectedFlightNumbers.filter((num) => validFlightNumbersSet.has(num)),
    [selectedFlightNumbers, validFlightNumbersSet]
  );

  // Scoped flights
  const scopedFlights = useMemo(() => {
    return flightsMatchingDate.filter((f) => {
      if (originFilter !== "ALL" && f.origin !== originFilter) return false;
      if (
        effectiveSelectedFlightNumbers.length > 0 &&
        !effectiveSelectedFlightNumbers.includes(f.flightNumber)
      ) {
        return false;
      }
      return true;
    });
  }, [flightsMatchingDate, originFilter, effectiveSelectedFlightNumbers]);

  // All passenger entries inside the selected scope (sorted deterministically)
  const scopedEntries = useMemo<CrossFlightEntry[]>(() => {
    const out: CrossFlightEntry[] = [];
    for (const f of scopedFlights) {
      const normDate = normalizeDcsFlightDate(f.date);
      const dateSortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
      // Business first, then Economy (already sorted alphabetically with classSeq)
      for (const p of f.businessPassengers) {
        out.push({ flight: f, passenger: p, normDate, dateSortOrder });
      }
      for (const p of f.economyPassengers) {
        out.push({ flight: f, passenger: p, normDate, dateSortOrder });
      }
    }
    // Default deterministic order: most recent date -> flight number -> origin -> cabin C/Y -> classSeq
    out.sort((a, b) => {
      if (b.dateSortOrder !== a.dateSortOrder) {
        return b.dateSortOrder - a.dateSortOrder;
      }
      const fa = parseInt(a.flight.flightNumber, 10);
      const fb = parseInt(b.flight.flightNumber, 10);
      if (!Number.isNaN(fa) && !Number.isNaN(fb) && fa !== fb) return fa - fb;
      if (a.flight.flightNumber !== b.flight.flightNumber) {
        return a.flight.flightNumber.localeCompare(b.flight.flightNumber);
      }
      if (a.flight.origin !== b.flight.origin) {
        return a.flight.origin.localeCompare(b.flight.origin);
      }
      if (a.passenger.cabinClass !== b.passenger.cabinClass) {
        return a.passenger.cabinClass === "C" ? -1 : 1;
      }
      return (a.passenger.classSeq || 0) - (b.passenger.classSeq || 0);
    });
    return out;
  }, [scopedFlights]);

  // Dynamic criteria metadata computed from scoped entries
  const filterMeta = useMemo(() => {
    const classCounts: Record<string, number> = {};
    const editCodeCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const counts = {
      C: 0,
      Y: 0,
      WITH_SEAT: 0,
      NO_SHOW: 0,
      UNSEATED: 0,
      M: 0,
      F: 0,
      CHD: 0,
      INF: 0,
      NO_SEAT: 0,
      TRANSIT: 0,
      CODESHARE: 0,
      WEB_CHECKIN: 0,
      MISSING_WEIGHT: 0,
      ECART_NON_COUVERT: 0,
      COUVERT_EMD: 0,
    };

    for (const { passenger: p } of scopedEntries) {
      if (p.cabinClass === "C") counts.C++;
      else counts.Y++;

      if (isPassengerWithSeat(p)) counts.WITH_SEAT++;
      else counts.UNSEATED++;
      if (isPassengerNoShow(p)) counts.NO_SHOW++;

      if (!p.isChild && p.gender === "M") counts.M++;
      if (!p.isChild && p.gender === "F") counts.F++;
      if (p.isChild) counts.CHD++;
      if (p.hasInfant) counts.INF++;
      if (p.isOffloadedOrNoSeat) counts.NO_SEAT++;
      if (p.isTransitMarker) counts.TRANSIT++;
      if (p.isCodeshare) counts.CODESHARE++;
      if (isPassengerWebCheckin(p)) counts.WEB_CHECKIN++;
      if (p.hasMissingBaggageWeight) counts.MISSING_WEIGHT++;
      if (p.baggageCompliance === "ECART_NON_COUVERT") counts.ECART_NON_COUVERT++;
      if (p.baggageCompliance === "COUVERT_EMD") counts.COUVERT_EMD++;

      if (p.bookingClass) {
        classCounts[p.bookingClass] = (classCounts[p.bookingClass] || 0) + 1;
      }
      if (p.destination) {
        destCounts[p.destination] = (destCounts[p.destination] || 0) + 1;
      }
      for (const ec of p.editCodes) {
        editCodeCounts[ec] = (editCodeCounts[ec] || 0) + 1;
      }
    }

    return {
      counts,
      bookingClasses: Object.entries(classCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      editCodes: Object.entries(editCodeCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
      destinations: Object.entries(destCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => ({ code, count })),
    };
  }, [scopedEntries]);

  // Filtered + Sorted passenger list
  const filteredEntries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    const matched = scopedEntries.filter(({ flight, passenger: pax, normDate }) => {
      // 1. Cabin
      if (cabinFilter !== "BOTH" && pax.cabinClass !== cabinFilter) {
        return false;
      }

      // 1b. Seat / Boarding Status (With Seat = Actually Traveled, No-Show = Ticketed without Seat)
      if (seatStatusFilter === "WITH_SEAT" && !isPassengerWithSeat(pax)) {
        return false;
      }
      if (seatStatusFilter === "NO_SHOW" && !isPassengerNoShow(pax)) {
        return false;
      }
      if (seatStatusFilter === "NO_SEAT" && isPassengerWithSeat(pax)) {
        return false;
      }

      // 2. Gender / Pax Type / Operational status
      if (genderTypeFilter === "M" && (pax.isChild || pax.gender !== "M")) {
        return false;
      }
      if (genderTypeFilter === "F" && (pax.isChild || pax.gender !== "F")) {
        return false;
      }
      if (genderTypeFilter === "CHD" && !pax.isChild) return false;
      if (genderTypeFilter === "INF" && !pax.hasInfant) return false;
      if (genderTypeFilter === "NO_SEAT" && !pax.isOffloadedOrNoSeat) {
        return false;
      }
      if (genderTypeFilter === "TRANSIT" && !pax.isTransitMarker) return false;
      if (genderTypeFilter === "CODESHARE" && !pax.isCodeshare) return false;
      if (genderTypeFilter === "WEB_CHECKIN" && !isPassengerWebCheckin(pax)) return false;

      // 3. Booking class
      if (
        bookingClassFilter !== "ALL" &&
        pax.bookingClass !== bookingClassFilter
      ) {
        return false;
      }

      // 4. Edit Codes (single or multiple, ANY or ALL)
      if (selectedEditCodes.length > 0) {
        if (editCodeMatchMode === "ALL") {
          const hasAll = selectedEditCodes.every((code) =>
            pax.editCodes.includes(code)
          );
          if (!hasAll) return false;
        } else {
          const hasAny = selectedEditCodes.some((code) =>
            pax.editCodes.includes(code)
          );
          if (!hasAny) return false;
        }
      }

      // 5. Destination
      if (destFilter !== "ALL" && pax.destination !== destFilter) {
        return false;
      }

      // 6. Baggage & compliance
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

      // 7. Special criteria (EMD, Loyalty, Ticket, Connections)
      if (
        specialFilter === "HAS_EMD" &&
        pax.emdNumbers.length === 0 &&
        pax.ancillaries.length === 0
      ) {
        return false;
      }
      if (
        specialFilter === "HAS_FF" &&
        !pax.kpFrequentFlyer &&
        !pax.partnerFrequentFlyer
      ) {
        return false;
      }
      if (specialFilter === "NO_TICKET" && Boolean(pax.ticket)) {
        return false;
      }
      if (
        specialFilter === "HAS_CONNECTION" &&
        !pax.inboundFlight &&
        !pax.outboundFlight
      ) {
        return false;
      }

      // 8. Free-text search
      if (!q) return true;
      const infantFallback =
        pax.infant ||
        extractInfantFromRawLines(pax.rawLines, {
          date: flight.date,
          bookingClass: pax.bookingClass,
          route: `${flight.origin}${pax.destination}`,
        });
      const haystack = [
        normDate,
        flight.airline,
        flight.flightNumber,
        `${flight.airline}${flight.flightNumber}`,
        `${flight.airline} ${flight.flightNumber}`,
        flight.origin,
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

    if (sortMode === "ALPHA") {
      return [...matched].sort((a, b) => {
        const nameCmp = a.passenger.lastName.localeCompare(
          b.passenger.lastName
        );
        if (nameCmp !== 0) return nameCmp;
        const firstCmp = a.passenger.firstName.localeCompare(
          b.passenger.firstName
        );
        if (firstCmp !== 0) return firstCmp;
        return b.dateSortOrder - a.dateSortOrder;
      });
    }

    if (sortMode === "WEIGHT_DESC") {
      return [...matched].sort((a, b) => {
        if (b.passenger.totalBagWeight !== a.passenger.totalBagWeight) {
          return b.passenger.totalBagWeight - a.passenger.totalBagWeight;
        }
        return b.dateSortOrder - a.dateSortOrder;
      });
    }

    return matched;
  }, [
    scopedEntries,
    cabinFilter,
    seatStatusFilter,
    genderTypeFilter,
    bookingClassFilter,
    selectedEditCodes,
    editCodeMatchMode,
    destFilter,
    baggageFilter,
    specialFilter,
    searchTerm,
    sortMode,
  ]);

  // Filtered KPIs
  const filteredSummary = useMemo(() => {
    let business = 0;
    let economy = 0;
    let male = 0;
    let female = 0;
    let child = 0;
    let infant = 0;
    let bags = 0;
    let weight = 0;
    let webCheckin = 0;
    const flightIds = new Set<string>();

    for (const { flight, passenger: p } of filteredEntries) {
      flightIds.add(flight.id);
      if (p.cabinClass === "C") business++;
      else economy++;

      if (!p.isChild && p.gender === "M") male++;
      else if (!p.isChild && p.gender === "F") female++;
      else if (p.isChild) child++;

      if (p.hasInfant) infant++;
      if (isPassengerWebCheckin(p)) webCheckin++;

      const actualBags = Math.max(
        p.bags.length,
        p.bagsDeclaredCount || 0,
        p.bagsTotalDeclaredLine?.count || 0
      );
      bags += actualBags;
      weight += p.totalBagWeight || 0;
    }

    return {
      total: filteredEntries.length,
      business,
      economy,
      male,
      female,
      child,
      infant,
      webCheckin,
      bags,
      weight,
      flightsCount: flightIds.size,
    };
  }, [filteredEntries]);

  // Reset page when filters or scope change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedDates,
    selectedFlightNumbers,
    originFilter,
    cabinFilter,
    seatStatusFilter,
    genderTypeFilter,
    bookingClassFilter,
    selectedEditCodes,
    editCodeMatchMode,
    baggageFilter,
    destFilter,
    specialFilter,
    searchTerm,
    sortMode,
    pageSize,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, safePage, pageSize]);

  const drawerIndex = useMemo(() => {
    if (!drawerKey) return -1;
    return filteredEntries.findIndex(
      (item) => `${item.flight.id}__${item.passenger.id}` === drawerKey
    );
  }, [filteredEntries, drawerKey]);

  const activeDrawerItem =
    drawerIndex >= 0 ? filteredEntries[drawerIndex] : null;

  const hasScopeFilters =
    selectedDates.length > 0 ||
    effectiveSelectedFlightNumbers.length > 0 ||
    originFilter !== "ALL";

  const hasPassengerFilters =
    cabinFilter !== "BOTH" ||
    seatStatusFilter !== "ALL" ||
    genderTypeFilter !== "ALL" ||
    bookingClassFilter !== "ALL" ||
    selectedEditCodes.length > 0 ||
    baggageFilter !== "ALL" ||
    destFilter !== "ALL" ||
    specialFilter !== "ALL" ||
    searchTerm.trim() !== "";

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const toggleFlightNumber = (flightNum: string) => {
    setSelectedFlightNumbers((prev) =>
      prev.includes(flightNum)
        ? prev.filter((n) => n !== flightNum)
        : [...prev, flightNum]
    );
  };

  const addEditCodeFilter = (code: string) => {
    if (!code) return;
    setSelectedEditCodes((prev) =>
      prev.includes(code) ? prev : [...prev, code]
    );
  };

  const toggleEditCodeFilter = (code: string) => {
    setSelectedEditCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const resetScope = () => {
    setSelectedDates([]);
    setSelectedFlightNumbers([]);
    setOriginFilter("ALL");
  };

  const resetPassengerFilters = () => {
    setCabinFilter("BOTH");
    setSeatStatusFilter("ALL");
    setGenderTypeFilter("ALL");
    setBookingClassFilter("ALL");
    setSelectedEditCodes([]);
    setEditCodeMatchMode("ANY");
    setBaggageFilter("ALL");
    setDestFilter("ALL");
    setSpecialFilter("ALL");
    setSearchTerm("");
  };

  const handleExportExcel = () => {
    if (filteredEntries.length === 0) return;

    const rows = filteredEntries.map(({ flight, passenger: p, normDate }) => {
      const infantInfo =
        p.infant ||
        extractInfantFromRawLines(p.rawLines, {
          date: flight.date,
          bookingClass: p.bookingClass,
          route: `${flight.origin}${p.destination}`,
        });
      const actualBags = Math.max(
        p.bags.length,
        p.bagsDeclaredCount || 0,
        p.bagsTotalDeclaredLine?.count || 0
      );
      return {
        Date: normDate,
        Vol: `${flight.airline} ${flight.flightNumber}`,
        Origine: flight.origin,
        Destination: p.destination,
        Cabine: p.cabinClass,
        Ordre: p.classSeq,
        Nom: p.lastName,
        Prénom: p.firstName,
        "Sexe / Type": p.isChild ? "CHD" : p.gender || "N/D",
        "Bébé (INF)": p.hasInfant
          ? infantInfo?.fullNameDisplay || "OUI"
          : "",
        "Classe Résa": p.bookingClass,
        Siège: p.seat || (p.isOffloadedOrNoSeat ? "SANS SIÈGE" : ""),
        "Check-in Web (WB)": isPassengerWebCheckin(p) ? "OUI" : "NON",
        "Statut Embarquement": isPassengerWithSeat(p)
          ? "Voyagé (Avec siège)"
          : "No-Show (Sans siège)",
        "Bagages (pcs)": actualBags,
        "Poids (kg)": p.totalBagWeight,
        "Poids Manquant": p.hasMissingBaggageWeight ? "OUI" : "NON",
        "Conformité Bagages": p.baggageCompliance,
        "Edit Codes": p.editCodes.join(" "),
        EMD: p.emdNumbers.join(", "),
        "FF / FQTV":
          p.kpFrequentFlyer?.number || p.partnerFrequentFlyer?.number || "",
        Billet: p.ticket?.ticketNumber || "",
        "Billet Bébé (IFET)": infantInfo?.ticket?.ticketNumber || "",
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
      { wch: 11 },
      { wch: 22 },
      { wch: 10 },
      { wch: 11 },
      { wch: 12 },
      { wch: 10 },
      { wch: 13 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Passagers Filtrés");

    const dateTag =
      selectedDates.length > 0 ? selectedDates.join("-") : "TOUTES_DATES";
    const flightTag =
      effectiveSelectedFlightNumbers.length > 0
        ? `KP${effectiveSelectedFlightNumbers.join("-")}`
        : "TOUS_VOLS";
    XLSX.writeFile(wb, `ASKY_Passagers_${dateTag}_${flightTag}.xlsx`);
  };

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = [
      "Date",
      "Flight",
      "Origin",
      "Destination",
      "Cabin",
      "Seq",
      "LastName",
      "FirstName",
      "Gender_Type",
      "Infant",
      "Class",
      "Seat",
      "Web_Checkin_WB",
      "Boarding_Status",
      "Bags_Pcs",
      "Weight_Kg",
      "Missing_Weight",
      "Compliance",
      "Edit_Codes",
      "EMD",
      "Loyalty",
      "Ticket",
    ];
    const escapeCsv = (val: string | number) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(",")];
    for (const { flight, passenger: p, normDate } of filteredEntries) {
      const infantInfo =
        p.infant ||
        extractInfantFromRawLines(p.rawLines, {
          date: flight.date,
          bookingClass: p.bookingClass,
          route: `${flight.origin}${p.destination}`,
        });
      const actualBags = Math.max(
        p.bags.length,
        p.bagsDeclaredCount || 0,
        p.bagsTotalDeclaredLine?.count || 0
      );
      lines.push(
        [
          normDate,
          `${flight.airline} ${flight.flightNumber}`,
          flight.origin,
          p.destination,
          p.cabinClass,
          p.classSeq,
          p.lastName,
          p.firstName,
          p.isChild ? "CHD" : p.gender || "N/A",
          p.hasInfant ? infantInfo?.fullNameDisplay || "INF" : "",
          p.bookingClass,
          p.seat || (p.isOffloadedOrNoSeat ? "NO_SEAT" : ""),
          isPassengerWebCheckin(p) ? "YES" : "NO",
          isPassengerWithSeat(p)
            ? "TRAVELED_SEATED"
            : "NO_SHOW_UNSEATED",
          actualBags,
          p.totalBagWeight,
          p.hasMissingBaggageWeight ? "YES" : "NO",
          p.baggageCompliance,
          p.editCodes.join(" "),
          p.emdNumbers.join(";"),
          p.kpFrequentFlyer?.number || p.partnerFrequentFlyer?.number || "",
          p.ticket?.ticketNumber || "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateTag =
      selectedDates.length > 0 ? selectedDates.join("-") : "ALL_DATES";
    const flightTag =
      effectiveSelectedFlightNumbers.length > 0
        ? `KP${effectiveSelectedFlightNumbers.join("-")}`
        : "ALL_FLIGHTS";
    a.href = url;
    a.download = `ASKY_Passengers_${dateTag}_${flightTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scopeSummaryText = useMemo(() => {
    const datePart =
      selectedDates.length === 0
        ? pick(
            `Toutes les dates (${availableDates.length})`,
            `All dates (${availableDates.length})`
          )
        : selectedDates.join(", ");
    const flightPart =
      effectiveSelectedFlightNumbers.length === 0
        ? pick(
            `Tous les vols (${scopedFlights.length} tronçons)`,
            `All flights (${scopedFlights.length} sectors)`
          )
        : effectiveSelectedFlightNumbers.map((n) => `KP ${n}`).join(", ") +
          ` (${scopedFlights.length} ${pick("tronçons", "sectors")})`;
    return `${datePart} · ${flightPart} · ${scopedEntries.length} pax`;
  }, [
    selectedDates,
    availableDates.length,
    effectiveSelectedFlightNumbers,
    scopedFlights.length,
    scopedEntries.length,
    pick,
  ]);

  return (
    <div className="space-y-4">
      {/* 1. Scope Selector: Multi-Date & Multi-Flight Number */}
      <CollapsiblePanel
        title={pick("Périmètre : Dates & Vols", "Scope: Dates & Flights")}
        subtitle={scopeSummaryText}
        icon={<Calendar className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={true}
        rightContent={
          hasScopeFilters ? (
            <button
              type="button"
              onClick={resetScope}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              {pick("Réinitialiser", "Reset")}
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          {/* Dates multi-select */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E472B] dark:text-[#F7BA42] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {pick("1. Dates :", "1. Dates:")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDates([])}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  selectedDates.length === 0
                    ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                    : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                }`}
              >
                {pick(
                  `Toutes les dates (${availableDates.length})`,
                  `All dates (${availableDates.length})`
                )}
              </button>

              {availableDates.map((d) => {
                const isSelected = selectedDates.includes(d.date);
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => toggleDate(d.date)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                        : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#321B0A] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                    }`}
                  >
                    <span>{d.date}</span>
                    <span
                      className={`text-[10px] ${
                        isSelected
                          ? "text-[#F3E9D8] dark:text-[#321B0A]"
                          : "text-[#6E472B] dark:text-[#DECAB1]"
                      }`}
                    >
                      ({d.flightsCount} {pick("vols", "fl.")} · {d.paxCount} pax)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flight Numbers multi-select + Origin selector */}
          <div className="pt-3 border-t border-[#E6D7C3]/70 dark:border-[#4C2812]/70">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E472B] dark:text-[#F7BA42] flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5" />
                {pick("2. Vols :", "2. Flights:")}
              </span>

              {availableOrigins.length > 1 && (
                <select
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                  className="px-2.5 py-1 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                  title={pick(
                    "Filtrer par station de départ",
                    "Filter by departure station"
                  )}
                >
                  <option value="ALL">
                    {pick(
                      `Origine : Toutes (${availableOrigins.length})`,
                      `Origin: All (${availableOrigins.length})`
                    )}
                  </option>
                  {availableOrigins.map((o) => (
                    <option key={o.code} value={o.code}>
                      {pick("Départ", "Dep.")} {o.code} ({o.count})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedFlightNumbers([])}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  effectiveSelectedFlightNumbers.length === 0
                    ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                    : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                }`}
              >
                {pick(
                  `Tous les vols (${availableFlightNumbers.length} n°)`,
                  `All flights (${availableFlightNumbers.length} #)`
                )}
              </button>

              {availableFlightNumbers.map((fn) => {
                const isSelected = effectiveSelectedFlightNumbers.includes(
                  fn.flightNumber
                );
                const originsLabel = Array.from(fn.origins).join("/");
                return (
                  <button
                    key={fn.flightNumber}
                    type="button"
                    onClick={() => toggleFlightNumber(fn.flightNumber)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                        : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#321B0A] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                    }`}
                    title={`${fn.airline} ${fn.flightNumber} (${originsLabel}) · ${fn.legsCount} ${pick("tronçon(s)", "sector(s)")} · ${fn.paxCount} pax`}
                  >
                    <span>
                      {fn.airline} {fn.flightNumber}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isSelected
                          ? "text-[#F3E9D8] dark:text-[#321B0A]"
                          : "text-[#6E472B] dark:text-[#DECAB1]"
                      }`}
                    >
                      {fn.legsCount > 1
                        ? `${fn.legsCount}× · ${fn.paxCount}p`
                        : `${originsLabel} · ${fn.paxCount}p`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsiblePanel>

      {/* 2. Passenger Criteria Filters */}
      <CollapsiblePanel
        title={pick("Filtres Passagers", "Passenger Filters")}
        subtitle={pick(
          `${filteredEntries.length} / ${scopedEntries.length} passagers${hasPassengerFilters ? " · Filtres actifs" : ""}`,
          `${filteredEntries.length} / ${scopedEntries.length} passengers${hasPassengerFilters ? " · Active filters" : ""}`
        )}
        icon={<Filter className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={true}
        rightContent={
          hasPassengerFilters ? (
            <button
              type="button"
              onClick={resetPassengerFilters}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              {pick("Effacer critères", "Clear criteria")}
            </button>
          ) : null
        }
      >
        <div className="space-y-3">
          {/* Top row: Cabin + Search + Sort + PageSize */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: "BOTH" as const,
                  label: pick(
                    `Toutes cabines (${scopedEntries.length})`,
                    `All cabins (${scopedEntries.length})`
                  ),
                },
                {
                  id: "C" as const,
                  label: `Business C (${filterMeta.counts.C})`,
                },
                {
                  id: "Y" as const,
                  label: pick(
                    `Économie Y (${filterMeta.counts.Y})`,
                    `Economy Y (${filterMeta.counts.Y})`
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

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={pick(
                    "Nom, billet, tag, EMD, FF, vol...",
                    "Name, ticket, tag, EMD, FF, flight..."
                  )}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                />
              </div>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
                title={pick("Ordre de tri", "Sort order")}
              >
                <option value="FLIGHT_ALPHA">
                  {pick(
                    "Tri : Date & Vol → Cabine → A-Z",
                    "Sort: Date & Flight → Cabin → A-Z"
                  )}
                </option>
                <option value="ALPHA">
                  {pick(
                    "Tri : Alphabétique global (A → Z)",
                    "Sort: Global alphabetical (A → Z)"
                  )}
                </option>
                <option value="WEIGHT_DESC">
                  {pick(
                    "Tri : Poids bagages décroissant",
                    "Sort: Baggage weight descending"
                  )}
                </option>
              </select>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={500}>500 / page</option>
              </select>
            </div>
          </div>

          {/* Seat / Boarding Status Quick Filter */}
          <div className="pt-3 border-t border-[#E6D7C3]/70 dark:border-[#4C2812]/70 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E472B] dark:text-[#F7BA42] mr-1">
              {pick("Statut :", "Status:")}
            </span>
            {[
              {
                id: "ALL" as const,
                label: pick(
                  `Tous (${scopedEntries.length})`,
                  `All (${scopedEntries.length})`
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

          {/* Criteria dropdowns */}
          <div className="pt-3 border-t border-[#E6D7C3]/70 dark:border-[#4C2812]/70 flex flex-wrap items-center gap-2">
            {/* Gender / Pax Type */}
            <select
              value={genderTypeFilter}
              onChange={(e) =>
                setGenderTypeFilter(e.target.value as GenderTypeFilter)
              }
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              title={pick(
                "Filtrer par sexe ou catégorie passager",
                "Filter by gender or passenger type"
              )}
            >
              <option value="ALL">
                {pick("Sexe / Catégorie : Tous", "Gender / Category: All")}
              </option>
              <option value="M">
                {pick("Hommes (M)", "Male (M)")} · {filterMeta.counts.M}
              </option>
              <option value="F">
                {pick("Femmes (F)", "Female (F)")} · {filterMeta.counts.F}
              </option>
              <option value="CHD">
                {pick("Enfants (CHD)", "Children (CHD)")} ·{" "}
                {filterMeta.counts.CHD}
              </option>
              <option value="INF">
                {pick("Avec Bébé (INF)", "With Infant (INF)")} ·{" "}
                {filterMeta.counts.INF}
              </option>
              <option value="NO_SEAT">
                {pick("Sans siège / OFL", "No seat / OFL")} ·{" "}
                {filterMeta.counts.NO_SEAT}
              </option>
              <option value="TRANSIT">
                {pick("En transit (#)", "Transit (#)")} ·{" "}
                {filterMeta.counts.TRANSIT}
              </option>
              <option value="CODESHARE">
                Codeshare (CS) · {filterMeta.counts.CODESHARE}
              </option>
              <option value="WEB_CHECKIN">
                Web Check-in (WB) · {filterMeta.counts.WEB_CHECKIN}
              </option>
            </select>

            {/* Booking Class */}
            <select
              value={bookingClassFilter}
              onChange={(e) => setBookingClassFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              title={pick(
                "Filtrer par classe de réservation",
                "Filter by booking class"
              )}
            >
              <option value="ALL">
                {pick("Classe Résa : Toutes", "Booking Class: All")}
              </option>
              {filterMeta.bookingClasses.map((c) => (
                <option key={c.code} value={c.code}>
                  {pick("Classe", "Class")} {c.code} ({c.count})
                </option>
              ))}
            </select>

            {/* Edit Code Adder (Multi-select enabled!) */}
            <select
              value=""
              onChange={(e) => addEditCodeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer max-w-[260px]"
              title={pick(
                "Sélectionner un ou plusieurs Edit Codes DCS",
                "Select one or multiple DCS Edit Codes"
              )}
            >
              <option value="">
                {selectedEditCodes.length === 0
                  ? pick(
                      `Edit Code : Tous (${filterMeta.editCodes.length} codes)`,
                      `Edit Code: All (${filterMeta.editCodes.length} codes)`
                    )
                  : pick(
                      `+ Ajouter un Edit Code (${selectedEditCodes.length} actif${selectedEditCodes.length > 1 ? "s" : ""})`,
                      `+ Add Edit Code (${selectedEditCodes.length} active)`
                    )}
              </option>
              {filterMeta.editCodes.map((ec) => {
                const label = getEditCodeLabel(ec.code, language);
                const already = selectedEditCodes.includes(ec.code);
                return (
                  <option key={ec.code} value={ec.code} disabled={already}>
                    {already ? "✓ " : ""}
                    {ec.code} ({ec.count})
                    {label ? ` — ${label}` : ""}
                  </option>
                );
              })}
            </select>

            {/* Baggage & Allowance */}
            <select
              value={baggageFilter}
              onChange={(e) =>
                setBaggageFilter(e.target.value as BaggageFilter)
              }
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              title={pick(
                "Filtrer par bagages ou conformité franchise",
                "Filter by baggage or allowance compliance"
              )}
            >
              <option value="ALL">
                {pick(
                  "Bagages & Franchise : Tous",
                  "Baggage & Allowance: All"
                )}
              </option>
              <option value="WITH_BAGS">
                {pick("Avec bagages en soute", "With checked baggage")}
              </option>
              <option value="NO_BAGS">
                {pick("Sans bagage (NB / 0)", "No baggage (NB / 0)")}
              </option>
              <option value="MISSING_WEIGHT">
                {pick("Poids bagage non spécifié", "Missing baggage weight")} ·{" "}
                {filterMeta.counts.MISSING_WEIGHT}
              </option>
              <option value="CONFORME">
                {pick("Franchise conforme", "Allowance compliant")}
              </option>
              <option value="ECART_NON_COUVERT">
                {pick("Écart sans EMD", "Excess without EMD")} ·{" "}
                {filterMeta.counts.ECART_NON_COUVERT}
              </option>
              <option value="COUVERT_EMD">
                {pick("Couvert par EMD / AE", "Covered by EMD / AE")} ·{" "}
                {filterMeta.counts.COUVERT_EMD}
              </option>
            </select>

            {/* Passenger Destination */}
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              title={pick(
                "Filtrer par destination passager",
                "Filter by passenger destination"
              )}
            >
              <option value="ALL">
                {pick("Destination : Toutes", "Destination: All")}
              </option>
              {filterMeta.destinations.map((d) => (
                <option key={d.code} value={d.code}>
                  → {d.code} ({d.count})
                </option>
              ))}
            </select>

            {/* Special attributes (EMD, FF, No ticket, Connection) */}
            <select
              value={specialFilter}
              onChange={(e) =>
                setSpecialFilter(e.target.value as SpecialFilter)
              }
              className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D] cursor-pointer"
              title={pick(
                "Filtrer par EMD, fidélité, billet ou correspondance",
                "Filter by EMD, loyalty, ticket, or connection"
              )}
            >
              <option value="ALL">
                {pick(
                  "Billet / EMD / Fidélité : Tous",
                  "Ticket / EMD / Loyalty: All"
                )}
              </option>
              <option value="HAS_EMD">
                {pick("Avec EMD / Ancillary", "With EMD / Ancillary")}
              </option>
              <option value="HAS_FF">
                {pick(
                  "Avec carte fidélité (FF / FQTV)",
                  "With Frequent Flyer (FF / FQTV)"
                )}
              </option>
              <option value="HAS_CONNECTION">
                {pick(
                  "Avec correspondance (IB / OB)",
                  "With connection (IB / OB)"
                )}
              </option>
              <option value="NO_TICKET">
                {pick("Sans billet électronique", "Without e-ticket")}
              </option>
            </select>
          </div>

          {/* Active Edit Codes chips bar */}
          {selectedEditCodes.length > 0 && (
            <div className="pt-2.5 border-t border-[#E6D7C3]/60 dark:border-[#4C2812]/60 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#6E472B] dark:text-[#F7BA42]">
                {pick("Edit Codes sélectionnés :", "Selected Edit Codes:")}
              </span>

              {selectedEditCodes.map((code) => {
                const desc = getEditCodeLabel(code, language);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleEditCodeFilter(code)}
                    className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] text-[11px] font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition"
                    title={desc || code}
                  >
                    <span>{code}</span>
                    {desc && (
                      <span className="font-sans font-medium opacity-90 max-w-[160px] truncate">
                        ({desc})
                      </span>
                    )}
                    <X className="w-3 h-3 shrink-0" />
                  </button>
                );
              })}

              {selectedEditCodes.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setEditCodeMatchMode((m) => (m === "ANY" ? "ALL" : "ANY"))
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#FDF4E3] dark:bg-[#3A2212] border border-[#E89C1D]/60 text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold cursor-pointer hover:bg-[#F3E9D8] dark:hover:bg-[#4C2812] transition"
                  title={pick(
                    "Basculer entre AU MOINS UN code (OU) et TOUS les codes (ET)",
                    "Toggle between ANY code (OR) and ALL codes (AND)"
                  )}
                >
                  {editCodeMatchMode === "ANY"
                    ? pick("Mode : OU (au moins un)", "Mode: OR (any)")
                    : pick("Mode : ET (tous requis)", "Mode: AND (all required)")}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedEditCodes([])}
                className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer ml-1"
              >
                {pick("Tout retirer", "Clear all")}
              </button>
            </div>
          )}
        </div>
      </CollapsiblePanel>

      {/* 3. Live Filtered Stats Bar + Export Actions */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-1.5 font-sans font-bold text-[#321B0A] dark:text-[#FAF7F2]">
            <Users className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42]" />
            <span>
              <strong className="font-mono text-sm text-[#4C2812] dark:text-[#F7BA42]">
                {filteredSummary.total}
              </strong>{" "}
              <span className="font-normal text-[#6E472B] dark:text-[#DECAB1]">
                / {scopedEntries.length} {pick("passagers", "passengers")}
              </span>
            </span>
          </div>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-[#6E472B] dark:text-[#DECAB1]">
            <strong className="text-[#321B0A] dark:text-[#FAF7F2]">
              {filteredSummary.flightsCount}
            </strong>{" "}
            {pick(
              `tronçon${filteredSummary.flightsCount > 1 ? "s" : ""}`,
              `sector${filteredSummary.flightsCount > 1 ? "s" : ""}`
            )}
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-[#6E472B] dark:text-[#DECAB1]">
            C:{" "}
            <strong className="text-[#4C2812] dark:text-[#F7BA42]">
              {filteredSummary.business}
            </strong>{" "}
            · Y:{" "}
            <strong className="text-[#321B0A] dark:text-[#FAF7F2]">
              {filteredSummary.economy}
            </strong>
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-[#6E472B] dark:text-[#DECAB1]">
            {filteredSummary.male}
            {pick("H", "M")} · {filteredSummary.female}F ·{" "}
            {filteredSummary.child} CHD ·{" "}
            <span className="text-[#8C5214] dark:text-[#F7BA42] font-semibold">
              {filteredSummary.infant} INF
            </span>
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-semibold">
            <WebCheckinBadge />
            <span>
              WB: {filteredSummary.webCheckin}
              {filteredSummary.total > 0
                ? ` (${((filteredSummary.webCheckin / filteredSummary.total) * 100).toFixed(0)}%)`
                : ""}
            </span>
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-[#321B0A] dark:text-[#FAF7F2] inline-flex items-center gap-1">
            <Luggage className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" />
            <strong>{filteredSummary.bags}</strong> pcs ·{" "}
            <strong className="text-[#4C2812] dark:text-[#F7BA42]">
              {filteredSummary.weight.toLocaleString(locale)} kg
            </strong>
          </span>
        </div>

        {filteredEntries.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title={pick(
                "Exporter la sélection filtrée en Excel (.xlsx)",
                "Export filtered selection to Excel (.xlsx)"
              )}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title={pick(
                "Exporter la sélection filtrée en CSV",
                "Export filtered selection to CSV"
              )}
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Multi-Flight Passenger Table */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden shadow-xs">
        {paginatedEntries.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-[#6E472B] dark:text-[#DECAB1]">
              {pick(
                "Aucun passager ne correspond aux filtres et dates/vols sélectionnés.",
                "No passengers match the selected dates, flights, and filters."
              )}
            </p>
            {(hasScopeFilters || hasPassengerFilters) && (
              <button
                type="button"
                onClick={() => {
                  resetScope();
                  resetPassengerFilters();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] text-xs font-semibold cursor-pointer"
              >
                {pick("Réinitialiser tous les filtres", "Reset all filters")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] text-[11px] font-semibold uppercase tracking-wider border-b border-[#321B0A] dark:border-[#5C351B]">
                  <th className="py-3 pl-5 pr-3">
                    {pick("Date & Vol", "Date & Flight")}
                  </th>
                  <th className="py-3 px-2 w-20">
                    {pick("Cab. / Ordre", "Cab. / Seq")}
                  </th>
                  <th className="py-3 px-3">{pick("Passager", "Passenger")}</th>
                  <th className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{pick("Résa / Siège", "Booking / Seat")}</span>
                      <span className="inline-flex items-center gap-1 text-sky-300 font-mono text-[10px]">
                        · <WebCheckinBadge /> {filteredSummary.webCheckin} WB
                      </span>
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    {pick("Bagages & Statut", "Baggage & Status")}
                  </th>
                  <th className="py-3 px-3">
                    {pick("Edit Codes / EMD / FF", "Edit Codes / EMD / FF")}
                  </th>
                  <th className="py-3 px-3">
                    {pick("Billet & Suite", "Ticket & Onward")}
                  </th>
                  <th className="py-3 pr-5 pl-2 text-right">
                    {pick("Dossier", "Record")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70 text-xs">
                {paginatedEntries.map((entry, rowIndex) => {
                  const { flight, passenger: pax, normDate } = entry;
                  const entryKey = `${flight.id}__${pax.id}`;
                  const infantInfo =
                    pax.infant ||
                    extractInfantFromRawLines(pax.rawLines, {
                      date: flight.date,
                      bookingClass: pax.bookingClass,
                      route: `${flight.origin}${pax.destination}`,
                    });
                  const hasInfant = pax.hasInfant || Boolean(infantInfo);
                  const actualBags = Math.max(
                    pax.bags.length,
                    pax.bagsDeclaredCount || 0,
                    pax.bagsTotalDeclaredLine?.count || 0
                  );
                  const orderNum = String(pax.classSeq || rowIndex + 1).padStart(
                    3,
                    "0"
                  );

                  const rowThemeClass =
                    pax.baggageCompliance === "ECART_NON_COUVERT"
                      ? rowIndex % 2 === 0
                        ? "bg-rose-50/75 dark:bg-rose-950/35 hover:bg-rose-100/75 dark:hover:bg-rose-950/55 border-l-4 border-l-rose-500"
                        : "bg-rose-100/45 dark:bg-rose-950/50 hover:bg-rose-100/80 dark:hover:bg-rose-950/65 border-l-4 border-l-rose-500"
                      : pax.hasMissingBaggageWeight
                      ? rowIndex % 2 === 0
                        ? "bg-amber-50/65 dark:bg-amber-950/30 hover:bg-amber-100/60 dark:hover:bg-amber-950/50 border-l-4 border-l-amber-500"
                        : "bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/55 border-l-4 border-l-amber-500"
                      : pax.baggageCompliance === "COUVERT_EMD"
                      ? rowIndex % 2 === 0
                        ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] border-l-4 border-l-[#E89C1D]"
                        : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] border-l-4 border-l-[#E89C1D]"
                      : rowIndex % 2 === 0
                      ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                      : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]";

                  return (
                    <tr
                      key={entryKey}
                      onClick={() => setDrawerKey(entryKey)}
                      className={`transition-colors cursor-pointer ${rowThemeClass}`}
                    >
                      {/* Date & Flight */}
                      <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-[#F3E9D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[10px] font-bold">
                            {normDate}
                          </span>
                          <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                            {flight.airline} {flight.flightNumber}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] mt-0.5 flex items-center gap-1.5">
                          <span>
                            {flight.origin} → {pax.destination}
                          </span>
                          {onInspectFlight && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectFlight(flight.id);
                              }}
                              className="text-[10px] font-sans font-semibold text-[#8C5214] dark:text-[#F7BA42] hover:underline cursor-pointer"
                              title={pick(
                                "Ouvrir le manifeste complet de ce vol",
                                "Open full manifest for this flight"
                              )}
                            >
                              {pick("Vol →", "Flight →")}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Cabin & Seq */}
                      <td className="py-3 px-2 font-mono font-bold tabular-nums whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pax.cabinClass === "C"
                                ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                                : "bg-[#EFE6D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#DECAB1]"
                            }`}
                          >
                            {pax.cabinClass}
                          </span>
                          <span className="text-[#4C2812] dark:text-[#F7BA42]">
                            {orderNum}
                          </span>
                          {pax.isTransitMarker && (
                            <span
                              className="text-[#8C5214] dark:text-[#E89C1D] font-bold"
                              title="Transit (#)"
                            >
                              #
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Passenger */}
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
                            <span className="font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                              {pax.firstName}
                            </span>
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
                              {" "}
                              · + {pick("Bébé", "Infant")}
                              {infantInfo?.fullNameDisplay
                                ? ` : ${infantInfo.fullNameDisplay}${
                                    infantInfo.birthDate
                                      ? ` (${infantInfo.birthDate})`
                                      : ""
                                  }`
                                : ""}
                            </span>
                          )}
                          {pax.isCodeshare && (
                            <span className="font-semibold"> · Codeshare</span>
                          )}
                        </div>
                      </td>

                      {/* Booking / Seat */}
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
                              <span className="text-[#8C5214]/80 dark:text-[#F7BA42]/80">
                                {" "}
                                (Bag {pax.baggageDestination})
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Baggage & Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
                          {actualBags} pcs ·{" "}
                          {pax.hasMissingBaggageWeight &&
                          pax.totalBagWeight === 0 ? (
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

                      {/* Edit Codes + EMD + FF */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {pax.editCodes.slice(0, 6).map((ec) => {
                            const isFiltered = selectedEditCodes.includes(ec);
                            const label = getEditCodeLabel(ec, language);
                            return (
                              <button
                                key={ec}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEditCodeFilter(ec);
                                }}
                                title={`${ec}${label ? ` — ${label}` : ""} (${pick("Cliquer pour filtrer", "Click to filter")})`}
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                  isFiltered
                                    ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                                    : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#DECAB1] border-[#E6D7C3] dark:border-[#5C351B] hover:border-[#E89C1D]"
                                }`}
                              >
                                {ec}
                              </button>
                            );
                          })}
                          {pax.editCodes.length > 6 && (
                            <span className="text-[10px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                              +{pax.editCodes.length - 6}
                            </span>
                          )}
                        </div>
                        {(pax.emdNumbers.length > 0 ||
                          pax.kpFrequentFlyer ||
                          pax.partnerFrequentFlyer) && (
                          <div className="mt-1 font-mono text-[10px] space-y-0.5">
                            {pax.emdNumbers.length > 0 && (
                              <div className="space-y-0.5">
                                {pax.emdNumbers.map((rawNum) => {
                                  const detail =
                                    emdDetailsMap[normalizeEmdNumber(rawNum)];
                                  return (
                                    <div key={rawNum}>
                                      <div className="font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                                        EMD {rawNum}
                                      </div>
                                      {detail && (
                                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                          {formatEmdMonetaryValue(
                                            detail.totalValue,
                                            language === "fr"
                                              ? "fr-FR"
                                              : "en-US"
                                          )}
                                          {detail.fopSummary
                                            ? ` · ${detail.fopSummary}`
                                            : ""}
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
                          </div>
                        )}
                      </td>

                      {/* Ticket & Onward */}
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
                            {pick("Suite :", "Onward:")}{" "}
                            {pax.outboundFlight.carrier}
                            {pax.outboundFlight.flightNumber} →{" "}
                            {pax.outboundFlight.destination}
                          </div>
                        )}
                        {pax.inboundFlight && (
                          <div className="text-[#6E472B] dark:text-[#DECAB1]">
                            {pick("Arrivée :", "Inbound:")}{" "}
                            {pax.inboundFlight.carrier}
                            {pax.inboundFlight.flightNumber} (
                            {pax.inboundFlight.origin})
                          </div>
                        )}
                      </td>

                      {/* Record Action */}
                      <td className="py-3 pr-5 pl-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrawerKey(entryKey);
                          }}
                          className="text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {pick("Dossier", "Record")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredEntries.length > 0 && (
          <div className="px-5 py-3 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums">
              {pick("Affichage", "Showing")} {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filteredEntries.length)}{" "}
              {pick("sur", "of")}{" "}
              <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {filteredEntries.length}
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
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

      {/* Slide-Over Passenger Dossier Drawer */}
      <PassengerDossierDrawer
        passenger={activeDrawerItem?.passenger || null}
        flight={activeDrawerItem?.flight || null}
        emdDetailsMap={emdDetailsMap}
        onClose={() => setDrawerKey(null)}
        hasPrev={drawerIndex > 0}
        hasNext={drawerIndex >= 0 && drawerIndex < filteredEntries.length - 1}
        onPrev={() => {
          if (drawerIndex > 0) {
            const prev = filteredEntries[drawerIndex - 1];
            setDrawerKey(`${prev.flight.id}__${prev.passenger.id}`);
          }
        }}
        onNext={() => {
          if (drawerIndex >= 0 && drawerIndex < filteredEntries.length - 1) {
            const next = filteredEntries[drawerIndex + 1];
            setDrawerKey(`${next.flight.id}__${next.passenger.id}`);
          }
        }}
      />
    </div>
  );
};
