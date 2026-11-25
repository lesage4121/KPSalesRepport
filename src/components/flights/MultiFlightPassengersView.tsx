import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  FileDown,
  FileText,
  Filter,
  Globe,
  Luggage,
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
  buildPriorFlightPaxKeysMap,
  extractInfantFromRawLines,
  getDcsFlightDateSortOrder,
  getEditCodeLabel,
  getPassengerDepartureType,
  isPassengerNoShow,
  isPassengerNoTicket,
  isPassengerPaperTicket,
  isPassengerWebCheckin,
  isPassengerWithSeat,
  normalizeDcsFlightDate,
  PassengerDepartureType,
} from "../../utils/manifestParser";
import {
  exportFilteredPassengersReportToPDF,
  exportGlobalStationDailyReportToPDF,
} from "../../utils/flightStatsExport";
import {
  formatEmdMonetaryValue,
  normalizeEmdNumber,
} from "../../utils/emdAudit";
import { PassengerDossierDrawer } from "./PassengerDossierDrawer";
import { BabyBottleIcon } from "./BabyBottleIcon";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { FilterOptionField, MultiFilterOptionField } from "./FilterOptionField";
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
type DepartureTypeFilter = "ALL" | PassengerDepartureType;
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
  | "PAPER_TKT"
  | "HAS_CONNECTION";
type SortMode = "FLIGHT_ALPHA" | "ALPHA" | "WEIGHT_DESC";
type EditCodeMatchMode = "ANY" | "ALL";

interface CrossFlightEntry {
  flight: ManifestFlight;
  legFlights: ManifestFlight[];
  passenger: ManifestPassenger;
  normDate: string;
  dateSortOrder: number;
  sectorStations: string[];
  sectorLabel: string;
  transitStops: string[];
  depType: PassengerDepartureType;
}

function normPaxToken(value?: string): string {
  return (value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function normFlightNumToken(value?: string): string {
  return (value || "").trim().toUpperCase().replace(/^0+(?=\d)/, "");
}

function padDcsTimeToken(time?: string): string {
  const digits = (time || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(4, "0").slice(-4);
}

function getCrossEntryKey(entry: CrossFlightEntry): string {
  return `${entry.legFlights.map((l) => l.id).join("+")}__${entry.passenger.id}`;
}

interface RawLegEntry {
  flight: ManifestFlight;
  passenger: ManifestPassenger;
  normDate: string;
  dateSortOrder: number;
  depType: PassengerDepartureType;
}

function sortLegsChronologically(legs: RawLegEntry[]): RawLegEntry[] {
  if (legs.length <= 1) return legs;
  const allHaveTimes = legs.every((l) => padDcsTimeToken(l.flight.departureTime) !== "");
  if (allHaveTimes) {
    return [...legs].sort((a, b) => {
      const ta = padDcsTimeToken(a.flight.departureTime);
      const tb = padDcsTimeToken(b.flight.departureTime);
      if (ta !== tb) return ta.localeCompare(tb);
      return a.flight.origin.localeCompare(b.flight.origin);
    });
  }

  // Chain legs when some departure times are unavailable
  const remaining = [...legs];
  const ordered: RawLegEntry[] = [];
  // Pick initial leg: prefer non-TRANSIT, then earliest departure time, then leg not listed as another's primaryDestination
  remaining.sort((a, b) => {
    const aIsTransit = a.depType === "TRANSIT" ? 1 : 0;
    const bIsTransit = b.depType === "TRANSIT" ? 1 : 0;
    if (aIsTransit !== bIsTransit) return aIsTransit - bIsTransit;
    const ta = padDcsTimeToken(a.flight.departureTime);
    const tb = padDcsTimeToken(b.flight.departureTime);
    if (ta && tb && ta !== tb) return ta.localeCompare(tb);
    return a.flight.origin.localeCompare(b.flight.origin);
  });
  ordered.push(remaining.shift()!);

  while (remaining.length > 0) {
    const prev = ordered[ordered.length - 1];
    const prevPrimaryDest = (prev.flight.primaryDestination || "").trim().toUpperCase();
    const prevTime = padDcsTimeToken(prev.flight.departureTime);
    let nextIdx = remaining.findIndex(
      (cand) =>
        prevPrimaryDest &&
        (cand.flight.origin || "").trim().toUpperCase() === prevPrimaryDest
    );
    if (nextIdx === -1 && prevTime) {
      let bestIdx = -1;
      let bestTime = "";
      remaining.forEach((cand, idx) => {
        const ct = padDcsTimeToken(cand.flight.departureTime);
        if (ct && ct >= prevTime && (bestIdx === -1 || ct < bestTime)) {
          bestIdx = idx;
          bestTime = ct;
        }
      });
      nextIdx = bestIdx;
    }
    if (nextIdx === -1) nextIdx = 0;
    ordered.push(remaining.splice(nextIdx, 1)[0]);
  }

  return ordered;
}

function consolidateMultiLegEntries(legs: RawLegEntry[]): CrossFlightEntry {
  const sorted = sortLegsChronologically(legs);
  const firstLeg = sorted[0];
  const lastLeg = sorted[sorted.length - 1];

  const sectorStations: string[] = [];
  for (const leg of sorted) {
    const orig = (leg.flight.origin || "").trim().toUpperCase();
    if (orig && sectorStations[sectorStations.length - 1] !== orig) {
      sectorStations.push(orig);
    }
  }
  const finalDest = (
    lastLeg.passenger.destination ||
    firstLeg.passenger.destination ||
    ""
  )
    .trim()
    .toUpperCase();
  if (finalDest && sectorStations[sectorStations.length - 1] !== finalDest) {
    sectorStations.push(finalDest);
  }

  const sectorLabel = sectorStations.join(" → ");
  const transitStops =
    sectorStations.length >= 3 ? sectorStations.slice(1, -1) : [];

  if (sorted.length === 1) {
    return {
      flight: firstLeg.flight,
      legFlights: [firstLeg.flight],
      passenger: firstLeg.passenger,
      normDate: firstLeg.normDate,
      dateSortOrder: firstLeg.dateSortOrder,
      sectorStations,
      sectorLabel,
      transitStops,
      depType: firstLeg.depType,
    };
  }

  // Pick single-leg baggage authority (never double-count checked bags/weight across stopovers)
  const bagSourcePax = sorted.reduce((best, cur) => {
    const curWt = cur.passenger.totalBagWeight || 0;
    const bestWt = best.totalBagWeight || 0;
    if (curWt !== bestWt) return curWt > bestWt ? cur.passenger : best;
    const curBags = Math.max(
      cur.passenger.bags.length,
      cur.passenger.bagsDeclaredCount || 0,
      cur.passenger.bagsTotalDeclaredLine?.count || 0
    );
    const bestBags = Math.max(
      best.bags.length,
      best.bagsDeclaredCount || 0,
      best.bagsTotalDeclaredLine?.count || 0
    );
    return curBags > bestBags ? cur.passenger : best;
  }, firstLeg.passenger);

  const mergedEditCodes = Array.from(
    new Set(sorted.flatMap((l) => l.passenger.editCodes))
  );
  const mergedEmdNumbers = Array.from(
    new Set(sorted.flatMap((l) => l.passenger.emdNumbers))
  );
  const firstSeat =
    firstLeg.passenger.seat ||
    sorted.find((l) => l.passenger.seat)?.passenger.seat ||
    "";

  const mergedPassenger: ManifestPassenger = {
    ...firstLeg.passenger,
    destination: finalDest || firstLeg.passenger.destination,
    baggageDestination:
      lastLeg.passenger.baggageDestination ||
      firstLeg.passenger.baggageDestination,
    seat: firstSeat,
    isOffloadedOrNoSeat: sorted.every((l) => l.passenger.isOffloadedOrNoSeat),
    ticket:
      firstLeg.passenger.ticket ||
      sorted.find((l) => l.passenger.ticket)?.passenger.ticket,
    inboundFlight: firstLeg.passenger.inboundFlight,
    outboundFlight: lastLeg.passenger.outboundFlight,
    editCodes: mergedEditCodes,
    emdNumbers: mergedEmdNumbers,
    kpFrequentFlyer:
      firstLeg.passenger.kpFrequentFlyer ||
      sorted.find((l) => l.passenger.kpFrequentFlyer)?.passenger
        .kpFrequentFlyer,
    partnerFrequentFlyer:
      firstLeg.passenger.partnerFrequentFlyer ||
      sorted.find((l) => l.passenger.partnerFrequentFlyer)?.passenger
        .partnerFrequentFlyer,
    infant:
      firstLeg.passenger.infant ||
      sorted.find((l) => l.passenger.infant)?.passenger.infant,
    hasInfant: sorted.some((l) => l.passenger.hasInfant),
    isCodeshare: sorted.some((l) => l.passenger.isCodeshare),
    isTransitMarker: sorted.some((l) => l.passenger.isTransitMarker),
    bags: bagSourcePax.bags,
    totalBagWeight: bagSourcePax.totalBagWeight,
    bagsDeclaredCount: bagSourcePax.bagsDeclaredCount,
    bagsTotalDeclaredLine: bagSourcePax.bagsTotalDeclaredLine,
    hasMissingBaggageWeight: bagSourcePax.hasMissingBaggageWeight,
    baggageCompliance: bagSourcePax.baggageCompliance,
    ancillaries:
      bagSourcePax.ancillaries.length > 0
        ? bagSourcePax.ancillaries
        : firstLeg.passenger.ancillaries,
    isNoBagDeclared: bagSourcePax.isNoBagDeclared,
    baggageDeviations: bagSourcePax.baggageDeviations,
    allowedWeightPerBag: bagSourcePax.allowedWeightPerBag,
    allowedTotalWeight: bagSourcePax.allowedTotalWeight,
    allowedBagsCount: bagSourcePax.allowedBagsCount,
  };

  return {
    flight: firstLeg.flight,
    legFlights: sorted.map((l) => l.flight),
    passenger: mergedPassenger,
    normDate: firstLeg.normDate,
    dateSortOrder: firstLeg.dateSortOrder,
    sectorStations,
    sectorLabel,
    transitStops,
    depType: firstLeg.depType,
  };
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
  const [departureTypeFilter, setDepartureTypeFilter] =
    useState<DepartureTypeFilter>("ALL");
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

  // Cross-leg transit lookup across all loaded flights (handles intermediate stopovers even without '#')
  const priorLegPaxKeysMap = useMemo(
    () => buildPriorFlightPaxKeysMap(parsedResult.flights),
    [parsedResult.flights]
  );

  // All passenger entries inside the selected scope (consolidated across through-transit legs when viewing ALL stations)
  const scopedEntries = useMemo<CrossFlightEntry[]>(() => {
    const out: CrossFlightEntry[] = [];

    if (originFilter !== "ALL") {
      // Station-specific view: keep only departures from the selected station without cross-station consolidation
      for (const f of scopedFlights) {
        const normDate = normalizeDcsFlightDate(f.date);
        const dateSortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
        const priorKeys = priorLegPaxKeysMap.get(f.id);
        const orderedPax = [...f.businessPassengers, ...f.economyPassengers];
        for (const p of orderedPax) {
          const orig = (f.origin || "").trim().toUpperCase();
          const dest = (p.destination || "").trim().toUpperCase();
          const sectorStations =
            orig && dest && orig !== dest
              ? [orig, dest]
              : [orig || dest].filter(Boolean);
          out.push({
            flight: f,
            legFlights: [f],
            passenger: p,
            normDate,
            dateSortOrder,
            sectorStations,
            sectorLabel: sectorStations.join(" → "),
            transitStops: [],
            depType: getPassengerDepartureType(p, f, priorKeys),
          });
        }
      }
    } else {
      // All-stations view: consolidate multi-leg through-transit passengers on the same flight & date
      const groupedLegs = new Map<string, RawLegEntry[]>();

      for (const f of scopedFlights) {
        const normDate = normalizeDcsFlightDate(f.date);
        const dateSortOrder = getDcsFlightDateSortOrder(normDate, f.extractedYear);
        const priorKeys = priorLegPaxKeysMap.get(f.id);
        const airline = normPaxToken(f.airline || "KP");
        const flightNum = normFlightNumToken(f.flightNumber);
        const noTicketCountsInLeg = new Map<string, number>();

        const orderedPax = [...f.businessPassengers, ...f.economyPassengers];
        for (const p of orderedPax) {
          const depType = getPassengerDepartureType(p, f, priorKeys);
          const last = normPaxToken(p.lastName);
          const first = normPaxToken(p.firstName);
          const ticketNum = normPaxToken(
            p.ticket?.ticketNumber || p.ticket?.paperTicketNumber
          );

          let paxIdentity: string;
          if (ticketNum) {
            paxIdentity = `${last}|${first}|${ticketNum}`;
          } else {
            const nameKey = `${last}|${first}`;
            const occ = noTicketCountsInLeg.get(nameKey) || 0;
            noTicketCountsInLeg.set(nameKey, occ + 1);
            paxIdentity = `${nameKey}|NO_TKT#${occ}`;
          }

          const groupKey = `${normDate}|${airline}|${flightNum}::${paxIdentity}`;
          const list = groupedLegs.get(groupKey);
          const item: RawLegEntry = {
            flight: f,
            passenger: p,
            normDate,
            dateSortOrder,
            depType,
          };
          if (list) {
            list.push(item);
          } else {
            groupedLegs.set(groupKey, [item]);
          }
        }
      }

      for (const legs of groupedLegs.values()) {
        if (legs.length === 1) {
          out.push(consolidateMultiLegEntries(legs));
          continue;
        }
        // Group distinct-origin through-legs together; keep duplicate same-origin entries separate if any exist
        const hasTransitOrMultiStop =
          new Set(legs.map((l) => (l.flight.origin || "").trim().toUpperCase())).size > 1;
        if (hasTransitOrMultiStop) {
          out.push(consolidateMultiLegEntries(legs));
        } else {
          for (const single of legs) {
            out.push(consolidateMultiLegEntries([single]));
          }
        }
      }
    }

    // Default deterministic order: most recent date -> flight number -> origin -> cabin C/Y -> alphabetical
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
      const lastCmp = a.passenger.lastName.localeCompare(b.passenger.lastName);
      if (lastCmp !== 0) return lastCmp;
      return a.passenger.firstName.localeCompare(b.passenger.firstName);
    });
    return out;
  }, [scopedFlights, originFilter, priorLegPaxKeysMap]);

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
      DEP_LOCAL: 0,
      DEP_TRANSIT: 0,
      DEP_CONNECTION: 0,
    };

    for (const { passenger: p, depType, transitStops } of scopedEntries) {
      if (p.cabinClass === "C") counts.C++;
      else counts.Y++;

      if (isPassengerWithSeat(p)) counts.WITH_SEAT++;
      else counts.UNSEATED++;
      if (isPassengerNoShow(p)) counts.NO_SHOW++;

      if (depType === "LOCAL") counts.DEP_LOCAL++;
      else if (depType === "TRANSIT") counts.DEP_TRANSIT++;
      else counts.DEP_CONNECTION++;

      if (depType !== "TRANSIT" && transitStops.length > 0) {
        counts.DEP_TRANSIT++;
      }

      if (!p.isChild && p.gender === "M") counts.M++;
      if (!p.isChild && p.gender === "F") counts.F++;
      if (p.isChild) counts.CHD++;
      if (p.hasInfant) counts.INF++;
      if (p.isOffloadedOrNoSeat) counts.NO_SEAT++;
      if (depType === "TRANSIT" || transitStops.length > 0) counts.TRANSIT++;
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

    const matched = scopedEntries.filter((entry) => {
      const { flight, passenger: pax, normDate, depType, transitStops } = entry;
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

      // 1c. Departure Origin Type (Local vs Same-Aircraft Transit vs Different-Flight Connection)
      if (departureTypeFilter !== "ALL") {
        if (departureTypeFilter === "TRANSIT") {
          if (depType !== "TRANSIT" && transitStops.length === 0) return false;
        } else if (depType !== departureTypeFilter) {
          return false;
        }
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
      if (
        genderTypeFilter === "TRANSIT" &&
        depType !== "TRANSIT" &&
        transitStops.length === 0
      ) {
        return false;
      }
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
      if (specialFilter === "NO_TICKET" && !isPassengerNoTicket(pax)) {
        return false;
      }
      if (specialFilter === "PAPER_TKT" && !isPassengerPaperTicket(pax)) {
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
        entry.sectorLabel,
        ...entry.sectorStations,
        ...entry.transitStops,
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
    departureTypeFilter,
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
    let noEt = 0;
    let tkt = 0;
    let noShow = 0;
    const emdSet = new Set<string>();
    const flightIds = new Set<string>();

    for (const { legFlights, passenger: p } of filteredEntries) {
      legFlights.forEach((lf) => flightIds.add(lf.id));
      if (p.cabinClass === "C") business++;
      else economy++;

      if (!p.isChild && p.gender === "M") male++;
      else if (!p.isChild && p.gender === "F") female++;
      else if (p.isChild) child++;

      if (p.hasInfant) infant++;
      if (isPassengerWebCheckin(p)) webCheckin++;
      if (isPassengerNoTicket(p)) noEt++;
      if (isPassengerPaperTicket(p)) tkt++;
      if (isPassengerNoShow(p)) noShow++;
      p.emdNumbers.forEach((e) => emdSet.add(e));

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
      noEt,
      tkt,
      noShow,
      emdCount: emdSet.size,
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
    departureTypeFilter,
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
    return filteredEntries.findIndex((item) => getCrossEntryKey(item) === drawerKey);
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
    departureTypeFilter !== "ALL" ||
    genderTypeFilter !== "ALL" ||
    bookingClassFilter !== "ALL" ||
    selectedEditCodes.length > 0 ||
    baggageFilter !== "ALL" ||
    destFilter !== "ALL" ||
    specialFilter !== "ALL" ||
    searchTerm.trim() !== "";

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
    setDepartureTypeFilter("ALL");
    setGenderTypeFilter("ALL");
    setBookingClassFilter("ALL");
    setSelectedEditCodes([]);
    setEditCodeMatchMode("ANY");
    setBaggageFilter("ALL");
    setDestFilter("ALL");
    setSpecialFilter("ALL");
    setSearchTerm("");
  };

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (originFilter !== "ALL") parts.push(`${pick("Station", "Station")}: ${originFilter}`);
    if (cabinFilter !== "BOTH") parts.push(`${pick("Cabine", "Cabin")}: ${cabinFilter}`);
    if (seatStatusFilter !== "ALL") parts.push(seatStatusFilter);
    if (departureTypeFilter !== "ALL") parts.push(departureTypeFilter);
    if (genderTypeFilter !== "ALL") parts.push(genderTypeFilter);
    if (bookingClassFilter !== "ALL") parts.push(`${pick("Classe", "Cls")}: ${bookingClassFilter}`);
    if (selectedEditCodes.length > 0) parts.push(`Codes: ${selectedEditCodes.join(",")}`);
    if (baggageFilter !== "ALL") parts.push(baggageFilter);
    if (destFilter !== "ALL") parts.push(`Dest: ${destFilter}`);
    if (specialFilter !== "ALL") parts.push(specialFilter);
    if (searchTerm.trim()) parts.push(`"${searchTerm.trim()}"`);
    return parts.join(" · ");
  }, [
    originFilter,
    cabinFilter,
    seatStatusFilter,
    departureTypeFilter,
    genderTypeFilter,
    bookingClassFilter,
    selectedEditCodes,
    baggageFilter,
    destFilter,
    specialFilter,
    searchTerm,
    pick,
  ]);

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = [
      "Date",
      "Flight",
      "Sector",
      "Origin",
      "Departure_Type",
      "Transit_Stops",
      "Destination",
      "Cabin",
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
    for (const {
      flight,
      passenger: p,
      normDate,
      sectorLabel,
      depType,
      transitStops,
    } of filteredEntries) {
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
          sectorLabel,
          flight.origin,
          depType,
          transitStops.join(";"),
          p.destination,
          p.cabinClass,
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
      {/* 1. Passenger Filters (including Scope: Dates, Station départ, Vols) */}
      <CollapsiblePanel
        title={pick("Filtres Passagers", "Passenger Filters")}
        subtitle={`${scopeSummaryText} · ${filteredEntries.length} / ${scopedEntries.length} ${pick("passagers", "passengers")}${hasScopeFilters || hasPassengerFilters ? ` · ${pick("Filtres actifs", "Active filters")}` : ""}`}
        icon={<Filter className="w-4 h-4 text-[#4C2812] dark:text-[#F7BA42]" />}
        defaultOpen={true}
        rightContent={
          hasScopeFilters || hasPassengerFilters ? (
            <button
              type="button"
              onClick={() => {
                resetScope();
                resetPassengerFilters();
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              {pick("Réinitialiser", "Reset")}
            </button>
          ) : null
        }
      >
        <div className="space-y-2.5">
          {/* Scope Row: Dates, Departure Station, Flights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MultiFilterOptionField
              values={selectedDates}
              onChange={setSelectedDates}
              prefixLabel={pick("Dates", "Dates")}
              allLabel={pick(
                `Toutes (${availableDates.length})`,
                `All (${availableDates.length})`
              )}
              placeholder={pick("Saisir ou choisir date(s)...", "Type or select date(s)...")}
              options={availableDates.map((d) => ({
                value: d.date,
                label: d.date,
                count: `${d.flightsCount} ${pick("vols", "fl.")} · ${d.paxCount}p`,
                keywords: d.date,
              }))}
              title={pick("Choisir ou saisir une ou plusieurs dates", "Select or type one or more dates")}
            />

            <FilterOptionField
              value={originFilter}
              onChange={setOriginFilter}
              prefixLabel={pick("Station départ", "Dep. station")}
              allLabel={pick(
                `Toutes (${availableOrigins.length})`,
                `All (${availableOrigins.length})`
              )}
              placeholder={pick("Saisir ou choisir station...", "Type or select station...")}
              options={availableOrigins.map((o) => ({
                value: o.code,
                label: o.code,
                count: `${o.count} ${pick("vol(s)", "fl.")}`,
                keywords: o.code,
              }))}
              title={pick("Filtrer par station de départ", "Filter by departure station")}
            />

            <MultiFilterOptionField
              values={effectiveSelectedFlightNumbers}
              onChange={setSelectedFlightNumbers}
              prefixLabel={pick("Vols", "Flights")}
              allLabel={pick(
                `Tous (${availableFlightNumbers.length} n°)`,
                `All (${availableFlightNumbers.length} #)`
              )}
              placeholder={pick("Saisir ou choisir n° vol...", "Type or select flight #...")}
              options={availableFlightNumbers.map((fn) => {
                const originsLabel = Array.from(fn.origins).join("/");
                return {
                  value: fn.flightNumber,
                  label: `${fn.airline} ${fn.flightNumber} (${originsLabel})`,
                  count: `${fn.legsCount > 1 ? `${fn.legsCount}× · ` : ""}${fn.paxCount}p`,
                  keywords: `${fn.airline}${fn.flightNumber} ${fn.flightNumber} ${originsLabel}`,
                };
              })}
              title={pick("Choisir ou saisir un ou plusieurs vols", "Select or type one or more flights")}
            />
          </div>

          {/* Row 1: Free-text Search + Sort + PageSize */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 min-w-0 sm:max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={pick(
                  "Rechercher : nom, billet, tag, EMD, FF, vol...",
                  "Search: name, ticket, tag, EMD, FF, flight..."
                )}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] rounded-lg text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

          {/* Row 2: Unified Searchable Option Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            <FilterOptionField
              value={cabinFilter}
              onChange={(v) => setCabinFilter(v as CabinFilter)}
              allValue="BOTH"
              prefixLabel={pick("Cabine", "Cabin")}
              allLabel={pick(
                `Toutes (${scopedEntries.length})`,
                `All (${scopedEntries.length})`
              )}
              placeholder={pick("Cabine...", "Cabin...")}
              options={[
                {
                  value: "C",
                  label: "Business (C)",
                  count: filterMeta.counts.C,
                  keywords: "business c",
                },
                {
                  value: "Y",
                  label: pick("Économie (Y)", "Economy (Y)"),
                  count: filterMeta.counts.Y,
                  keywords: "economie economy y",
                },
              ]}
            />

            <FilterOptionField
              value={seatStatusFilter}
              onChange={(v) => setSeatStatusFilter(v as SeatStatusFilter)}
              prefixLabel={pick("Statut", "Status")}
              allLabel={pick(
                `Tous (${scopedEntries.length})`,
                `All (${scopedEntries.length})`
              )}
              placeholder={pick("Statut siège...", "Seat status...")}
              options={[
                {
                  value: "WITH_SEAT",
                  label: pick("Avec siège", "Seated"),
                  count: filterMeta.counts.WITH_SEAT,
                  keywords: "avec siege seated boarded",
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
              prefixLabel={
                originFilter !== "ALL"
                  ? pick(`Départ ${originFilter}`, `Dep. ${originFilter}`)
                  : pick("Provenance", "Origin type")
              }
              allLabel={pick(
                `Tous (${scopedEntries.length})`,
                `All (${scopedEntries.length})`
              )}
              placeholder={pick("Local / Transit / Corresp...", "Local / Transit / Conn...")}
              options={[
                {
                  value: "LOCAL",
                  label: pick(
                    `Locaux${originFilter !== "ALL" ? ` · ${originFilter}` : ""}`,
                    `Local${originFilter !== "ALL" ? ` · ${originFilter}` : ""}`
                  ),
                  count: filterMeta.counts.DEP_LOCAL,
                  keywords: "local locaux station",
                },
                {
                  value: "TRANSIT",
                  label: pick("Transit (même avion)", "Transit (same aircraft)"),
                  count: filterMeta.counts.DEP_TRANSIT,
                  keywords: "transit escale meme avion through #",
                },
                {
                  value: "CONNECTION",
                  label: pick(
                    "Correspondance (transfert)",
                    "Connection (transfer)"
                  ),
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
                  keywords: "bebe infant inf ifet",
                },
                {
                  value: "NO_SEAT",
                  label: pick("Sans siège / OFL", "No seat / OFL"),
                  count: filterMeta.counts.NO_SEAT,
                  keywords: "ofl sans siege offloaded",
                },
                {
                  value: "CODESHARE",
                  label: "Codeshare (CS)",
                  count: filterMeta.counts.CODESHARE,
                  keywords: "codeshare cs",
                },
                {
                  value: "WEB_CHECKIN",
                  label: "Web Check-in (WB)",
                  count: filterMeta.counts.WEB_CHECKIN,
                  keywords: "web check-in wb online",
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

            <MultiFilterOptionField
              values={selectedEditCodes}
              onChange={setSelectedEditCodes}
              prefixLabel="Edit Codes"
              allLabel={pick(
                `Tous (${filterMeta.editCodes.length})`,
                `All (${filterMeta.editCodes.length})`
              )}
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
              title={pick(
                "Sélectionner ou saisir un ou plusieurs Edit Codes DCS",
                "Select or type one or multiple DCS Edit Codes"
              )}
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
                  count: filterMeta.counts.MISSING_WEIGHT,
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
                  count: filterMeta.counts.ECART_NON_COUVERT,
                  keywords: "ecart exces excess emd",
                },
                {
                  value: "COUVERT_EMD",
                  label: pick("Couvert par EMD / AE", "Covered by EMD / AE"),
                  count: filterMeta.counts.COUVERT_EMD,
                  keywords: "couvert emd ae",
                },
              ]}
            />

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

            <FilterOptionField
              value={specialFilter}
              onChange={(v) => setSpecialFilter(v as SpecialFilter)}
              prefixLabel={pick("Billet / EMD", "Ticket / EMD")}
              allLabel={pick("Tous", "All")}
              placeholder={pick("EMD, FF, Billet...", "EMD, FF, Ticket...")}
              options={[
                {
                  value: "HAS_EMD",
                  label: pick("Avec EMD / Ancillary", "With EMD / Ancillary"),
                  keywords: "emd ancillary ae",
                },
                {
                  value: "HAS_FF",
                  label: pick("Carte fidélité (FF/FQTV)", "Frequent Flyer (FF/FQTV)"),
                  keywords: "fidelite loyalty ff fqtv",
                },
                {
                  value: "HAS_CONNECTION",
                  label: pick("Correspondance (IB / OB)", "Connection (IB / OB)"),
                  keywords: "correspondance ib ob connection",
                },
                {
                  value: "NO_TICKET",
                  label: pick("Sans billet (NO ET)", "Without ticket (NO ET)"),
                  keywords: "sans billet no ticket et",
                },
                {
                  value: "PAPER_TKT",
                  label: pick("Billet papier (TKT)", "Paper ticket (TKT)"),
                  keywords: "billet papier tkt paper ticket",
                },
              ]}
            />
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

      {/* 2. General Report Bar + Export Actions */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-mono tabular-nums">
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

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-rose-700 dark:text-rose-400 font-semibold">
            NO ET: <strong>{filteredSummary.noEt}</strong>
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-[#4C2812] dark:text-[#F7BA42] font-semibold">
            TKT: <strong>{filteredSummary.tkt}</strong>
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-amber-800 dark:text-amber-300 font-semibold">
            NOSHOW: <strong>{filteredSummary.noShow}</strong>
          </span>

          <span className="text-[#D4BC9E] dark:text-[#5C351B]">|</span>

          <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
            EMD: <strong>{filteredSummary.emdCount}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {filteredEntries.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  exportFilteredPassengersReportToPDF({
                    entries: filteredEntries.map(
                      ({
                        flight,
                        passenger,
                        normDate,
                        sectorLabel,
                        depType,
                        transitStops,
                      }) => ({
                        flight,
                        passenger,
                        normDate,
                        sectorLabel,
                        depType,
                        transitStops,
                      })
                    ),
                    flightsCount: filteredSummary.flightsCount,
                    scopeLabel: scopeSummaryText,
                    activeFilterSummary,
                    priorLegPaxKeysMap,
                    language,
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                title={pick(
                  "Exporter le rapport général et la liste des passagers filtrés en PDF",
                  "Export general report and filtered passenger list as PDF"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
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
            </>
          )}
          {parsedResult.flights.length > 0 && (
            <button
              type="button"
              onClick={() =>
                exportGlobalStationDailyReportToPDF({
                  flights: parsedResult.flights,
                  priorLegPaxKeysMap,
                  language,
                })
              }
              className="px-2.5 py-1.5 rounded-lg border border-[#E89C1D] bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title={pick(
                "Télécharger le rapport global journalier par station en PDF (tous les vols, indépendant des filtres)",
                "Download global daily station report as PDF (all flights, independent of filters)"
              )}
            >
              <Globe className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
              <span>{pick("Rapport Global PDF", "Global Report PDF")}</span>
            </button>
          )}
        </div>
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
                  <th className="py-3 px-2 w-16">
                    {pick("Cabine", "Cabin")}
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
                  const {
                    flight,
                    passenger: pax,
                    normDate,
                    sectorLabel,
                    depType,
                    transitStops,
                  } = entry;
                  const entryKey = getCrossEntryKey(entry);
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
                        <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-[#4C2812] dark:text-[#FAF7F2]">
                            {sectorLabel}
                          </span>
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
                              ? pick("Corresp.", "Conn.")
                              : pick("Local", "Local")}
                          </span>
                          {transitStops.length > 0 && depType !== "TRANSIT" && (
                            <span className="px-1.5 py-0.5 rounded font-sans text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                              {pick("Transit", "Transit")} {transitStops.join(", ")}
                            </span>
                          )}
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

                      {/* Cabin (no sequence number) */}
                      <td className="py-3 px-2 font-mono font-bold whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              pax.cabinClass === "C"
                                ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                                : "bg-[#EFE6D8] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#DECAB1]"
                            }`}
                          >
                            {pax.cabinClass}
                          </span>
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
                            {pax.ticket.isPaperTicket
                              ? `TKT ${pax.ticket.paperTicketNumber || pax.ticket.ticketNumber || ""}`.trim()
                              : `${pax.ticket.ticketNumber} · ${pax.ticket.couponNumber}`}
                          </div>
                        ) : isPassengerPaperTicket(pax) ? (
                          <span className="text-[#8C5214] dark:text-[#F7BA42] font-semibold">
                            TKT ({pick("Papier", "Paper")})
                          </span>
                        ) : (
                          <span className="text-[#8C5214]/70 dark:text-[#DECAB1]/60 font-sans">
                            {pick("Sans billet (NO ET)", "No ticket (NO ET)")}
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
            setDrawerKey(getCrossEntryKey(prev));
          }
        }}
        onNext={() => {
          if (drawerIndex >= 0 && drawerIndex < filteredEntries.length - 1) {
            const next = filteredEntries[drawerIndex + 1];
            setDrawerKey(getCrossEntryKey(next));
          }
        }}
      />
    </div>
  );
};
