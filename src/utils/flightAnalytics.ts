/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FlightSegment, FlightStatusDetail, ManifestFlight } from "../types";
import {
  FlightStatusMatchLevel,
  normalizeStatusFlightNumber,
  resolveFlightStatusDetail,
} from "./flightStatusParser";
import {
  computeTransportedPassengerReport,
  getDcsFlightDateSortOrder,
  isPassengerNoShow,
  isPassengerWebCheckin,
  isPassengerWithSeat,
  normalizeDcsFlightDate,
} from "./manifestParser";

export interface FlightSegmentAnalytics {
  flight: ManifestFlight;
  dateKey: string;
  sortOrder: number;
  cleanFlightNumber: string;
  physicalDestination: string;
  physicalRoute: string;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  onBoardTotal: number;
  onBoardEco: number;
  onBoardBiz: number;
  listedTotal: number;
  unseatedTotal: number;
  noShowTotal: number;
  noShowEco: number;
  noShowBiz: number;
  noShowRatePct: number;
  bagsCount: number;
  totalWeight: number;
  statusDetail: FlightStatusDetail | null;
  matchLevel: FlightStatusMatchLevel;
  registration: string;
  aircraftType: string;
  cfg: string;
  departureStatus: string;
  boardingTimeFormatted: string;
  gate: string;
  capacityTotal: number | null;
  capacityEco: number | null;
  capacityBiz: number | null;
  loadFactorPct: number | null;
  ecoLoadFactorPct: number | null;
  bizLoadFactorPct: number | null;
  emptySeats: number | null; // positive = empty seats, negative = over-capacity
  webCheckinCount: number;
  airportCheckinCount: number;
  webCheckinRatePct: number;
  webCheckinEco: number;
  webCheckinBiz: number;
  webCheckinNoShow: number;
  webCheckinWithBagsCount: number;
}

export interface GlobalAviationKpis {
  totalSegments: number;
  totalDays: number;
  assignedSegments: number;
  assignmentCoveragePct: number;
  // Passenger & Cabin (traveled only)
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  bizSharePct: number;
  ecoSharePct: number;
  avgPaxPerSegment: number;
  // Capacity & Load Factor (over segments with PTRG* capacity details)
  offeredTotalCapacity: number;
  offeredEcoCapacity: number;
  offeredBizCapacity: number;
  assignedTraveledTotal: number;
  assignedTraveledEco: number;
  assignedTraveledBiz: number;
  globalLoadFactorPct: number | null;
  ecoLoadFactorPct: number | null;
  bizLoadFactorPct: number | null;
  emptySeatsTotal: number;
  spillageSegmentsCount: number;
  // Attrition & Integrity
  listedTotal: number;
  unseatedTotal: number;
  noShowTotal: number;
  noShowRatePct: number;
  unseatedRatePct: number;
  // Baggage & Payload
  totalBags: number;
  totalWeight: number;
  avgWeightPerPax: number;
  avgBagsPerPax: number;
  avgWeightPerBag: number;
  uncoveredDeviations: number;
  coveredDeviations: number;
  missingBagWeightCount: number;
  deviationRatePct: number;
  // Commercial, Network & Demographics
  emdCount: number;
  emdPenetrationPct: number;
  loyaltyCount: number;
  loyaltySharePct: number;
  transitCount: number;
  transitSharePct: number;
  codeshareCount: number;
  codeshareSharePct: number;
  maleCount: number;
  femaleCount: number;
  childCount: number;
  infantCount: number;
  // Web Check-in (Edit code WB)
  webCheckinTotal: number;
  airportCheckinTotal: number;
  webCheckinRatePct: number;
  webCheckinEco: number;
  webCheckinEcoRatePct: number;
  webCheckinBiz: number;
  webCheckinBizRatePct: number;
  webCheckinNoShow: number;
  webCheckinWithBagsCount: number;
  webCheckinBagsRatePct: number;
}

export interface DailyAnalyticsPoint {
  dateKey: string;
  sortOrder: number;
  segmentsCount: number;
  assignedSegmentsCount: number;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  listedTotal: number;
  noShowCount: number;
  noShowRatePct: number;
  unseatedCount: number;
  offeredCapacity: number;
  offeredEco: number;
  offeredBiz: number;
  assignedTraveled: number;
  loadFactorPct: number | null;
  ecoLfPct: number | null;
  bizLfPct: number | null;
  bagsCount: number;
  totalWeight: number;
  avgWeightPerPax: number;
  uncoveredDeviations: number;
  missingBagWeightCount: number;
  emdCount: number;
  webCheckinCount: number;
  airportCheckinCount: number;
  webCheckinRatePct: number;
}

export interface FlightNumberGroupAnalytics {
  flightNumber: string; // normalized e.g. "22"
  airline: string;
  segmentsCount: number;
  datesCount: number;
  origins: string[];
  destinations: string[];
  equipmentHints: string[];
  isPureEcoDominant: boolean;
  registrations: string[];
  primaryRegistration: string;
  primaryAircraftType: string;
  primaryStatusDetail: FlightStatusDetail | null;
  avgCapacity: number | null;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  avgTraveled: number;
  maxTraveled: number;
  maxTraveledEco: number;
  maxTraveledBiz: number;
  offeredCapacityTotal: number;
  loadFactorPct: number | null;
  ecoLfPct: number | null;
  bizLfPct: number | null;
  noShowTotal: number;
  noShowRatePct: number;
  totalWeight: number;
  avgWeightPerPax: number;
  uncoveredDeviations: number;
  emdCount: number;
  webCheckinCount: number;
  airportCheckinCount: number;
  webCheckinRatePct: number;
}

export interface WebCheckinStationRow {
  origin: string;
  segmentsCount: number;
  traveledTotal: number;
  webCheckinCount: number;
  airportCount: number;
  webCheckinRatePct: number;
  ecoWb: number;
  ecoTotal: number;
  ecoRatePct: number;
  bizWb: number;
  bizTotal: number;
  bizRatePct: number;
  withBagsCount: number;
}

export interface DestinationAnalyticsRow {
  code: string;
  passengers: number;
  sharePct: number;
  segmentsCount: number;
}

export interface RouteOndAnalyticsRow {
  route: string; // e.g. "ACC → ABJ"
  origin: string;
  destination: string;
  passengers: number;
  sharePct: number;
}

export interface SectorPerformanceRow {
  sector: string; // e.g. "LFW → ABJ"
  origin: string;
  destination: string;
  segmentsCount: number;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  avgTraveled: number;
  offeredSeats: number;
  loadFactorPct: number | null;
  noShowTotal: number;
  noShowRatePct: number;
  totalWeight: number;
}

export interface FlightRouteFlowFlightItem {
  airline: string;
  flightNumber: string;
  frequency: number;
  passengers: number;
  loadFactorPct?: number | null;
}

export interface FlightRouteFlowRow {
  id: string;
  route: string; // e.g. "LFW → ABJ"
  origin: string;
  destination: string;
  flightsCount: number;
  passengers: number;
  passengersEco: number;
  passengersBiz: number;
  offeredSeats: number;
  loadFactorPct: number | null;
  avgPaxPerFlight: number;
  flightNumbers: FlightRouteFlowFlightItem[];
}

export interface UnmappedMapFlightItem {
  airline: string;
  flightNumber: string;
  dateKey: string;
  origin: string;
  destination: string;
  passengers: number;
  reason: "NO_DEST" | "SAME_ORIGIN_DEST";
}

export interface BookingClassRow {
  bookingClass: string;
  cabin: "C" | "Y";
  passengers: number;
  sharePct: number;
}

export type SeatPositionType = "WINDOW" | "AISLE" | "MIDDLE" | "OTHER";

export interface SeatPositionRow {
  position: SeatPositionType;
  labelFr: string;
  labelEn: string;
  total: number;
  eco: number;
  biz: number;
  sharePct: number;
}

export interface SeatZoneRow {
  zone: "ZONE_A" | "ZONE_B" | "ZONE_C";
  labelFr: string;
  labelEn: string;
  rowRange: string;
  total: number;
  eco: number;
  biz: number;
  sharePct: number;
}

export interface SeatHeatmapRow {
  row: number;
  total: number;
  eco: number;
  biz: number;
  cols: Record<string, { total: number; eco: number; biz: number }>;
}

export interface TopSeatRow {
  seat: string;
  row: number;
  col: string;
  position: SeatPositionType;
  total: number;
  eco: number;
  biz: number;
}

export interface SeatOccupancyAnalytics {
  totalSeatedPax: number;
  totalEcoSeated: number;
  totalBizSeated: number;
  columns: string[];
  positionBreakdown: SeatPositionRow[];
  zoneBreakdown: SeatZoneRow[];
  rowHeatmap: SeatHeatmapRow[];
  topSeats: TopSeatRow[];
  avgRowOccupied: number;
  maxRowOccupied: number;
}

export interface TailUtilizationRow {
  tailNbr: string;
  equipmentType: string;
  aircraftConfig: string;
  seatCapacity: number;
  economyCapacity: number;
  businessCapacity: number;
  segmentsCount: number;
  flightNumbers: string[];
  offeredSeats: number;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  emptySeats: number;
  loadFactorPct: number;
  ecoLfPct: number;
  bizLfPct: number | null;
  bagsCount: number;
  totalWeight: number;
  avgWeightPerPax: number;
}

export interface EquipmentTypeSummaryRow {
  equipmentType: string;
  segmentsCount: number;
  traveledTotal: number;
  traveledEco: number;
  traveledBiz: number;
  offeredSeats: number;
  loadFactorPct: number | null;
}

export type ForecastMethod = "LINEAR" | "WMA";

export interface ForecastPoint {
  label: string;
  isForecast: boolean;
  historicalPax: number | null;
  historicalEco: number | null;
  historicalBiz: number | null;
  forecastPax: number | null;
  forecastEco: number | null;
  forecastBiz: number | null;
  forecastLow: number | null;
  forecastHigh: number | null;
  offeredCapacityRef: number | null;
  projectedLoadFactorPct: number | null;
}

export interface ForecastSummary {
  points: ForecastPoint[];
  horizonDays: number;
  method: ForecastMethod;
  historicalDaysCount: number;
  avgDailyHistoricalPax: number;
  avgDailyForecastPax: number;
  avgDailyCapacityRef: number | null;
  projectedAvgLoadFactorPct: number | null;
  slopePerDay: number;
  growthPctOverHorizon: number;
  rSquared: number;
}

export interface NoShowFlightRow {
  flightId: string;
  flightLabel: string;
  flightNumber: string;
  airline: string;
  dateKey: string;
  sortOrder: number;
  origin: string;
  destination: string;
  aircraftType: string;
  registration: string;
  capacityTotal: number | null;
  traveledTotal: number;
  noShowTotal: number;
  noShowEco: number;
  noShowBiz: number;
  listedTotal: number;
  noShowRatePct: number;
  loadFactorPct: number | null;
}

export interface NoShowPassengerRow {
  flightId: string;
  paxId: string;
  dateKey: string;
  sortOrder: number;
  flightLabel: string;
  origin: string;
  destination: string;
  cabinClass: "C" | "Y";
  bookingClass: string;
  seqLabel: string;
  fullNameDisplay: string;
  genderOrType: string;
  hasInfant: boolean;
  ticketNumber: string;
  ticketStatus: string;
  editCodes: string;
  partyCode: string;
}

export interface NoShowReportSummary {
  totalNoShow: number;
  noShowEco: number;
  noShowBiz: number;
  listedTotal: number;
  traveledTotal: number;
  noShowRatePct: number;
  flightsAffectedCount: number;
  totalFlightsCount: number;
}

export interface AircraftTimelineSegment {
  id: string;
  dateKey: string;
  sortOrder: number;
  flightLabel: string;
  fromStation: string;
  toStation: string;
  route: string;
  startMin: number; // 0..1440+
  endMin: number;
  durationMin: number;
  startLabel: string;
  endLabel: string;
  kind: "FLIGHT" | "GROUND";
}

export interface AircraftTimeUtilizationRow {
  tailNbr: string;
  equipmentType: string;
  aircraftConfig: string;
  activeDaysCount: number;
  legsCount: number;
  flightsCount: number;
  totalFlightMinutes: number;
  totalTurnaroundMinutes: number;
  totalBlockMinutes: number;
  totalFlightHours: number;
  totalTurnaroundHours: number;
  totalBlockHours: number;
  avgDailyFlightHours: number;
  avgDailyBlockHours: number;
  avgLegMinutes: number;
  utilizationRatePct: number; // % of 12h/day operational benchmark
  flightNumbers: string[];
  routes: string[];
  timelineSegments: AircraftTimelineSegment[];
}

export interface NoShowReportData {
  summary: NoShowReportSummary;
  byFlight: NoShowFlightRow[];
  passengers: NoShowPassengerRow[];
}

function parseHHMMToMinutes(raw?: string): number | null {
  const clean = (raw || "").trim().replace(/[^0-9]/g, "");
  if (!clean || clean.length < 3 || clean.length > 4) return null;
  const padded = clean.padStart(4, "0");
  const hh = parseInt(padded.slice(0, 2), 10);
  const mm = parseInt(padded.slice(2, 4), 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 24 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

function formatMinutesClock(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440;
  const hh = Math.floor(norm / 60);
  const mm = norm % 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

export function formatMinutesAsDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const MONTHS_ORDERED = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const MONTH_DAYS: Record<string, number> = {
  JAN: 31,
  FEB: 28,
  MAR: 31,
  APR: 30,
  MAY: 31,
  JUN: 30,
  JUL: 31,
  AUG: 31,
  SEP: 30,
  OCT: 31,
  NOV: 30,
  DEC: 31,
};

function addDaysToDcsDate(dateKey: string, daysToAdd: number): string {
  const m = (dateKey || "").trim().toUpperCase().match(/^(\d{2})([A-Z]{3})$/);
  if (!m) return `+${daysToAdd}J`;
  let day = parseInt(m[1], 10);
  let monthIdx = MONTHS_ORDERED.indexOf(m[2]);
  if (monthIdx === -1 || !Number.isFinite(day)) return `+${daysToAdd}J`;

  for (let i = 0; i < daysToAdd; i++) {
    day += 1;
    const maxD = MONTH_DAYS[MONTHS_ORDERED[monthIdx]] || 30;
    if (day > maxD) {
      day = 1;
      monthIdx = (monthIdx + 1) % 12;
    }
  }
  return `${String(day).padStart(2, "0")}${MONTHS_ORDERED[monthIdx]}`;
}

export function computeFullAviationAnalytics(
  flights: ManifestFlight[],
  flightStatusDetails: FlightStatusDetail[] = [],
  scheduleSegments: FlightSegment[] = [],
  contextFlights?: ManifestFlight[]
) {
  // --- 0. Reconstruct True Physical Flight Leg Chains & On-Board Through-Passengers ---
  // In DCS manifests, a multi-stop flight (e.g. KP15 NKC->CKY->LFW or KP20 LFW->ACC->ABJ)
  // emits one manifest block per boarding station (KP15/NKC, KP15/CKY). Through-passengers
  // continuing past a stopover have their final leg destination (e.g. LFW or ABJ) on the earlier
  // manifest, even if 0 passengers disembark at the intermediate stop (e.g. CKY).
  // We resolve each manifest leg's immediate next physical stop via:
  //   1) PTRG* legs itinerary (FlightStatusDetail.legs)
  //   2) Schedule VDS legs (scheduleSegments)
  //   3) Peer manifests sharing (dateKey, cleanFlightNumber) ordered by topology + ETD
  //   4) Manifest primaryDestination fallback
  interface ResolvedPhysicalLegInfo {
    physicalDestination: string;
    onBoardTotal: number;
    onBoardEco: number;
    onBoardBiz: number;
  }

  const resolvedLegMap = new Map<string, ResolvedPhysicalLegInfo>();
  const chainPoolRaw =
    contextFlights && contextFlights.length >= flights.length
      ? [...flights, ...contextFlights]
      : flights;

  const uniqueChainFlightsMap = new Map<string, ManifestFlight>();
  for (const cf of chainPoolRaw) {
    const dk = normalizeDcsFlightDate(cf.date);
    const fn = normalizeStatusFlightNumber(cf.flightNumber);
    const orig = (cf.origin || "").trim().toUpperCase();
    const k = `${dk}|${fn}|${orig}`;
    if (!uniqueChainFlightsMap.has(k)) {
      uniqueChainFlightsMap.set(k, cf);
    }
  }

  const flightGroupsByDateNum = new Map<string, ManifestFlight[]>();
  for (const cf of uniqueChainFlightsMap.values()) {
    const dk = normalizeDcsFlightDate(cf.date);
    const fn = normalizeStatusFlightNumber(cf.flightNumber);
    const gKey = `${dk}|${fn}`;
    const arr = flightGroupsByDateNum.get(gKey) || [];
    arr.push(cf);
    flightGroupsByDateNum.set(gKey, arr);
  }

  for (const groupFlights of flightGroupsByDateNum.values()) {
    interface PeerNode {
      flight: ManifestFlight;
      dateKey: string;
      cleanFn: string;
      orig: string;
      depMin: number;
      statusDetail: FlightStatusDetail | null;
      explicitNext: string;
      fallbackDest: string;
      seatedPax: ReturnType<ManifestFlight["passengers"]["filter"]>;
      paxDests: Set<string>;
      physicalDest: string;
    }

    const peers: PeerNode[] = groupFlights.map((cf) => {
      const dateKey = normalizeDcsFlightDate(cf.date);
      const cleanFn = normalizeStatusFlightNumber(cf.flightNumber);
      const orig = (cf.origin || "").trim().toUpperCase();
      const resolved = resolveFlightStatusDetail(
        cf.flightNumber,
        dateKey,
        orig,
        flightStatusDetails
      );
      const sd = resolved.detail;
      const depMin =
        parseHHMMToMinutes(cf.departureTime) ??
        parseHHMMToMinutes(sd?.etdHeader) ??
        9999;

      // Priority 1: Programme des Vols (Schedule VDS segment: exact flightNumber + date + origin -> destination)
      let schedNext = "";
      if (scheduleSegments.length > 0) {
        const schedMatch =
          scheduleSegments.find(
            (s) =>
              normalizeStatusFlightNumber(s.flightNumber) === cleanFn &&
              normalizeDcsFlightDate(s.date) === dateKey &&
              (s.origin || "").trim().toUpperCase() === orig &&
              s.carrierType !== "CODESHARE"
          ) ||
          scheduleSegments.find(
            (s) =>
              normalizeStatusFlightNumber(s.flightNumber) === cleanFn &&
              normalizeDcsFlightDate(s.date) === dateKey &&
              (s.origin || "").trim().toUpperCase() === orig
          );
        if (schedMatch?.destination) {
          const cand = schedMatch.destination.trim().toUpperCase();
          if (cand && cand !== orig) schedNext = cand;
        }
      }

      // Priority 2: PTRG* itinerary legs
      let ptrgNext = "";
      if (!schedNext && sd?.legs && sd.legs.length > 1) {
        const legIdx = sd.legs.findIndex(
          (l) => (l.station || "").trim().toUpperCase() === orig
        );
        if (legIdx >= 0 && legIdx + 1 < sd.legs.length) {
          const cand = (sd.legs[legIdx + 1].station || "").trim().toUpperCase();
          if (cand && cand !== orig) ptrgNext = cand;
        }
      }

      const seatedPax = cf.passengers.filter(isPassengerWithSeat);
      const paxDests = new Set<string>();
      for (const p of seatedPax) {
        const d = (p.destination || "").trim().toUpperCase();
        if (d && d !== orig) paxDests.add(d);
      }

      let fallbackDest = (cf.primaryDestination || "").trim().toUpperCase();
      if (!fallbackDest || fallbackDest === orig) {
        fallbackDest =
          cf.destinationCounts?.find((dc) => dc.code && dc.code !== orig)?.code ||
          Array.from(paxDests)[0] ||
          "";
      }

      return {
        flight: cf,
        dateKey,
        cleanFn,
        orig,
        depMin,
        statusDetail: sd,
        explicitNext: schedNext || ptrgNext,
        fallbackDest,
        seatedPax,
        paxDests,
        physicalDest: "",
      };
    });

    // Build directed precedence graph for chronological/topological ordering
    const n = peers.length;
    const adj = Array.from({ length: n }, () => new Set<number>());
    const inDeg = new Array<number>(n).fill(0);

    const hasSetIntersection = (a: Set<string>, b: Set<string>): boolean => {
      for (const x of a) {
        if (b.has(x)) return true;
      }
      return false;
    };

    const addEdge = (u: number, v: number) => {
      if (u === v || adj[u].has(v)) return;
      adj[u].add(v);
      inDeg[v] += 1;
    };

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j || peers[i].orig === peers[j].orig) continue;
        if (peers[i].explicitNext === peers[j].orig) {
          addEdge(i, j);
        } else if (!peers[i].explicitNext) {
          const iServesJ = peers[i].paxDests.has(peers[j].orig);
          const jServesI = peers[j].paxDests.has(peers[i].orig);
          if (iServesJ && (!jServesI || peers[i].depMin < peers[j].depMin)) {
            addEdge(i, j);
          } else if (
            hasSetIntersection(peers[i].paxDests, peers[j].paxDests) &&
            peers[i].depMin < peers[j].depMin
          ) {
            addEdge(i, j);
          }
        }
      }
    }

    // Kahn topological sort with depMin ascending priority
    const ordered: PeerNode[] = [];
    const used = new Array<boolean>(n).fill(false);
    while (ordered.length < n) {
      let bestIdx = -1;
      for (let i = 0; i < n; i++) {
        if (used[i] || inDeg[i] !== 0) continue;
        if (
          bestIdx === -1 ||
          peers[i].depMin < peers[bestIdx].depMin ||
          (peers[i].depMin === peers[bestIdx].depMin &&
            peers[i].orig.localeCompare(peers[bestIdx].orig) < 0)
        ) {
          bestIdx = i;
        }
      }
      if (bestIdx === -1) {
        // Cycle fallback: pick earliest remaining depMin
        for (let i = 0; i < n; i++) {
          if (used[i]) continue;
          if (bestIdx === -1 || peers[i].depMin < peers[bestIdx].depMin) {
            bestIdx = i;
          }
        }
      }
      if (bestIdx === -1) break;
      used[bestIdx] = true;
      ordered.push(peers[bestIdx]);
      for (const nxt of adj[bestIdx]) {
        inDeg[nxt] = Math.max(0, inDeg[nxt] - 1);
      }
    }

    // Resolve immediate physicalDestination for every leg in ordered chain
    for (let i = 0; i < ordered.length; i++) {
      const curr = ordered[i];
      if (curr.explicitNext) {
        curr.physicalDest = curr.explicitNext;
      } else if (i + 1 < ordered.length) {
        const nextPeer = ordered[i + 1];
        const isConnected =
          nextPeer.orig !== curr.orig &&
          (curr.paxDests.has(nextPeer.orig) ||
            hasSetIntersection(curr.paxDests, nextPeer.paxDests) ||
            curr.paxDests.size === 0);
        curr.physicalDest = isConnected ? nextPeer.orig : curr.fallbackDest;
      } else {
        curr.physicalDest = curr.fallbackDest;
      }

      // Priority 5: Cross-date Schedule / PTRG* / peer-manifest fallback for 0-pax / empty segments
      if (!curr.physicalDest || curr.physicalDest === curr.orig) {
        let crossDateDest = "";
        if (scheduleSegments.length > 0) {
          const crossSched =
            scheduleSegments.find(
              (s) =>
                normalizeStatusFlightNumber(s.flightNumber) === curr.cleanFn &&
                (s.origin || "").trim().toUpperCase() === curr.orig &&
                s.carrierType !== "CODESHARE" &&
                (s.destination || "").trim().toUpperCase() !== curr.orig
            ) ||
            scheduleSegments.find(
              (s) =>
                normalizeStatusFlightNumber(s.flightNumber) === curr.cleanFn &&
                (s.origin || "").trim().toUpperCase() === curr.orig &&
                (s.destination || "").trim().toUpperCase() !== curr.orig
            );
          if (crossSched?.destination) {
            crossDateDest = crossSched.destination.trim().toUpperCase();
          }
        }
        if (!crossDateDest && flightStatusDetails.length > 0) {
          const crossPtrg = flightStatusDetails.find(
            (d) =>
              normalizeStatusFlightNumber(d.flightNumber) === curr.cleanFn &&
              (d.origin || "").trim().toUpperCase() === curr.orig &&
              Array.isArray(d.legs) &&
              d.legs.length > 1
          );
          if (crossPtrg?.legs) {
            const legIdx = crossPtrg.legs.findIndex(
              (l) => (l.station || "").trim().toUpperCase() === curr.orig
            );
            if (legIdx >= 0 && legIdx + 1 < crossPtrg.legs.length) {
              const cand = (crossPtrg.legs[legIdx + 1].station || "").trim().toUpperCase();
              if (cand && cand !== curr.orig) crossDateDest = cand;
            }
          }
        }
        if (!crossDateDest) {
          for (const peer of uniqueChainFlightsMap.values()) {
            if (
              normalizeStatusFlightNumber(peer.flightNumber) === curr.cleanFn &&
              (peer.origin || "").trim().toUpperCase() === curr.orig
            ) {
              const cand = (
                peer.primaryDestination ||
                peer.destinationCounts?.find((dc) => dc.code && dc.code !== curr.orig)?.code ||
                ""
              )
                .trim()
                .toUpperCase();
              if (cand && cand !== curr.orig) {
                crossDateDest = cand;
                break;
              }
            }
          }
        }
        if (crossDateDest && crossDateDest !== curr.orig) {
          curr.physicalDest = crossDateDest;
        }
      }
    }

    // Record strictly manifest-derived segment values
    for (let i = 0; i < ordered.length; i++) {
      const curr = ordered[i];
      const legTraveledTotal = curr.flight.grandTotals.passengersCount;
      const legTraveledEco = curr.flight.economyTotals.passengersCount;
      const legTraveledBiz = curr.flight.businessTotals.passengersCount;

      resolvedLegMap.set(`${curr.dateKey}|${curr.cleanFn}|${curr.orig}`, {
        physicalDestination: curr.physicalDest,
        onBoardTotal: legTraveledTotal,
        onBoardEco: legTraveledEco,
        onBoardBiz: legTraveledBiz,
      });
    }
  }

  const segmentMetrics: FlightSegmentAnalytics[] = flights.map((flight) => {
    const dateKey = normalizeDcsFlightDate(flight.date);
    const sortOrder = getDcsFlightDateSortOrder(dateKey, flight.extractedYear);
    const cleanFlightNumber = normalizeStatusFlightNumber(flight.flightNumber);
    const origNorm = (flight.origin || "").trim().toUpperCase();
    const legInfo = resolvedLegMap.get(`${dateKey}|${cleanFlightNumber}|${origNorm}`);

    const traveledTotal = flight.grandTotals.passengersCount;
    const traveledEco = flight.economyTotals.passengersCount;
    const traveledBiz = flight.businessTotals.passengersCount;
    const onBoardTotal = traveledTotal;
    const onBoardEco = traveledEco;
    const onBoardBiz = traveledBiz;
    const physicalDestination =
      legInfo?.physicalDestination || (flight.primaryDestination || "").trim().toUpperCase();
    const physicalRoute =
      origNorm && physicalDestination ? `${origNorm} → ${physicalDestination}` : "";

    const listedTotal = flight.passengers.length;
    const unseatedTotal = Math.max(0, listedTotal - traveledTotal);
    const noShowPaxList = flight.passengers.filter(isPassengerNoShow);
    const noShowTotal = noShowPaxList.length;
    const noShowBiz = noShowPaxList.filter((p) => p.cabinClass === "C").length;
    const noShowEco = noShowTotal - noShowBiz;
    const noShowRatePct =
      listedTotal > 0 ? Number(((noShowTotal / listedTotal) * 100).toFixed(1)) : 0;

    const resolved = resolveFlightStatusDetail(
      flight.flightNumber,
      dateKey,
      flight.origin,
      flightStatusDetails
    );
    const detail = resolved.detail;
    const hasCapacity = Boolean(detail && detail.totalCapacity > 0);
    const capacityTotal = hasCapacity && detail ? detail.totalCapacity : null;
    const capacityEco = hasCapacity && detail ? detail.economyCapacity : null;
    const capacityBiz = hasCapacity && detail ? detail.businessCapacity : null;

    const loadFactorPct =
      capacityTotal && capacityTotal > 0
        ? Number(((traveledTotal / capacityTotal) * 100).toFixed(1))
        : null;
    const ecoLoadFactorPct =
      capacityEco && capacityEco > 0
        ? Number(((traveledEco / capacityEco) * 100).toFixed(1))
        : null;
    const bizLoadFactorPct =
      capacityBiz && capacityBiz > 0
        ? Number(((traveledBiz / capacityBiz) * 100).toFixed(1))
        : null;
    const emptySeats =
      capacityTotal !== null ? capacityTotal - traveledTotal : null;

    const seatedPaxList = flight.passengers.filter(isPassengerWithSeat);
    const wbSeatedList = seatedPaxList.filter(isPassengerWebCheckin);
    const webCheckinCount = wbSeatedList.length;
    const airportCheckinCount = Math.max(0, traveledTotal - webCheckinCount);
    const webCheckinRatePct =
      traveledTotal > 0
        ? Number(((webCheckinCount / traveledTotal) * 100).toFixed(1))
        : 0;
    const webCheckinBiz = wbSeatedList.filter((p) => p.cabinClass === "C").length;
    const webCheckinEco = webCheckinCount - webCheckinBiz;
    const webCheckinNoShow = noShowPaxList.filter(isPassengerWebCheckin).length;
    const webCheckinWithBagsCount = wbSeatedList.filter(
      (p) => p.bags.length > 0 || p.totalBagWeight > 0 || p.bagsDeclaredCount > 0
    ).length;

    return {
      flight,
      dateKey,
      sortOrder,
      cleanFlightNumber,
      physicalDestination,
      physicalRoute,
      traveledTotal,
      traveledEco,
      traveledBiz,
      onBoardTotal,
      onBoardEco,
      onBoardBiz,
      listedTotal,
      unseatedTotal,
      noShowTotal,
      noShowEco,
      noShowBiz,
      noShowRatePct,
      bagsCount: flight.grandTotals.bagsCount,
      totalWeight: flight.grandTotals.totalWeight,
      statusDetail: detail,
      matchLevel: resolved.matchLevel,
      registration: detail?.registration || "",
      aircraftType: detail?.aircraftType || flight.aircraftType || "",
      cfg: detail?.cfg || "",
      departureStatus: resolved.resolvedStatus || detail?.departureStatus || "",
      boardingTimeFormatted: detail?.boardingTimeFormatted || "",
      gate: detail?.gate || flight.gate || "",
      capacityTotal,
      capacityEco,
      capacityBiz,
      loadFactorPct,
      ecoLoadFactorPct,
      bizLoadFactorPct,
      emptySeats,
      webCheckinCount,
      airportCheckinCount,
      webCheckinRatePct,
      webCheckinEco,
      webCheckinBiz,
      webCheckinNoShow,
      webCheckinWithBagsCount,
    };
  });

  // 1. Daily Time Series (chronological ascending)
  const dayMap = new Map<
    string,
    {
      dateKey: string;
      sortOrder: number;
      flights: ManifestFlight[];
      segmentsCount: number;
      assignedSegmentsCount: number;
      traveledTotal: number;
      traveledEco: number;
      traveledBiz: number;
      listedTotal: number;
      noShowCount: number;
      unseatedCount: number;
      offeredCapacity: number;
      offeredEco: number;
      offeredBiz: number;
      assignedTraveled: number;
      assignedTraveledEco: number;
      assignedTraveledBiz: number;
      bagsCount: number;
      totalWeight: number;
      uncoveredDeviations: number;
      missingBagWeightCount: number;
      emdCount: number;
    }
  >();

  // 2. Flight Number Group Map
  const fnMap = new Map<
    string,
    {
      flightNumber: string;
      airline: string;
      segments: FlightSegmentAnalytics[];
      dates: Set<string>;
      origins: Set<string>;
      destinations: Set<string>;
      equipmentCounts: Record<string, number>;
      pureEcoCount: number;
    }
  >();

  // 3. Destinations Map (traveled pax)
  const destMap = new Map<string, { pax: number; segments: Set<string> }>();

  // 4. Registration / Tail Utilization Map (from Tab 1 PTRG* details)
  const tailMap = new Map<
    string,
    {
      tailNbr: string;
      equipmentType: string;
      aircraftConfig: string;
      seatCapacity: number;
      economyCapacity: number;
      businessCapacity: number;
      segmentsCount: number;
      flightNumbers: Set<string>;
      offeredSeats: number;
      offeredEco: number;
      offeredBiz: number;
      traveledTotal: number;
      traveledEco: number;
      traveledBiz: number;
      bagsCount: number;
      totalWeight: number;
    }
  >();

  // 5. Equipment Type Summary (works with or without PTRG* details)
  const eqMap = new Map<
    string,
    {
      equipmentType: string;
      segmentsCount: number;
      traveledTotal: number;
      traveledEco: number;
      traveledBiz: number;
      offeredSeats: number;
      assignedTraveled: number;
    }
  >();

  let assignedSegments = 0;
  let traveledTotal = 0;
  let traveledEco = 0;
  let traveledBiz = 0;
  let offeredTotalCapacity = 0;
  let offeredEcoCapacity = 0;
  let offeredBizCapacity = 0;
  let assignedTraveledTotal = 0;
  let assignedTraveledEco = 0;
  let assignedTraveledBiz = 0;
  let emptySeatsTotal = 0;
  let spillageSegmentsCount = 0;

  let listedTotal = 0;
  let unseatedTotal = 0;
  let noShowTotal = 0;
  let totalBags = 0;
  let totalWeight = 0;
  let uncoveredDeviations = 0;
  let coveredDeviations = 0;
  let missingBagWeightCount = 0;
  let emdCount = 0;
  let loyaltyCount = 0;
  let transitCount = 0;
  let codeshareCount = 0;
  let maleCount = 0;
  let femaleCount = 0;
  let childCount = 0;
  let infantCount = 0;
  let webCheckinEcoTotal = 0;
  let webCheckinBizTotal = 0;
  let webCheckinNoShowTotal = 0;
  let webCheckinWithBagsTotal = 0;

  const wbStationMap = new Map<
    string,
    {
      origin: string;
      segmentsCount: number;
      traveledTotal: number;
      webCheckinCount: number;
      ecoWb: number;
      ecoTotal: number;
      bizWb: number;
      bizTotal: number;
      withBagsCount: number;
    }
  >();

  for (const seg of segmentMetrics) {
    const f = seg.flight;
    traveledTotal += seg.traveledTotal;
    traveledEco += seg.traveledEco;
    traveledBiz += seg.traveledBiz;
    listedTotal += seg.listedTotal;
    unseatedTotal += seg.unseatedTotal;
    noShowTotal += seg.noShowTotal;
    totalBags += seg.bagsCount;
    totalWeight += seg.totalWeight;
    uncoveredDeviations += f.baggageUncoveredDeviationsCount;
    coveredDeviations += f.baggageCoveredDeviationsCount;
    missingBagWeightCount += f.baggageMissingWeightCount || 0;
    emdCount += f.emdCount;
    loyaltyCount += f.ffCount + f.fqtvCount;
    transitCount += f.transitPassengersCount;
    codeshareCount += f.codeshareCount;
    maleCount += f.grandTotals.male;
    femaleCount += f.grandTotals.female;
    childCount += f.grandTotals.child;
    infantCount += f.grandTotals.infant;
    webCheckinEcoTotal += seg.webCheckinEco;
    webCheckinBizTotal += seg.webCheckinBiz;
    webCheckinNoShowTotal += seg.webCheckinNoShow;
    webCheckinWithBagsTotal += seg.webCheckinWithBagsCount;

    const stKey = (f.origin || "N/D").trim().toUpperCase() || "N/D";
    const stEntry = wbStationMap.get(stKey) || {
      origin: stKey,
      segmentsCount: 0,
      traveledTotal: 0,
      webCheckinCount: 0,
      ecoWb: 0,
      ecoTotal: 0,
      bizWb: 0,
      bizTotal: 0,
      withBagsCount: 0,
    };
    stEntry.segmentsCount += 1;
    stEntry.traveledTotal += seg.traveledTotal;
    stEntry.webCheckinCount += seg.webCheckinCount;
    stEntry.ecoWb += seg.webCheckinEco;
    stEntry.ecoTotal += seg.traveledEco;
    stEntry.bizWb += seg.webCheckinBiz;
    stEntry.bizTotal += seg.traveledBiz;
    stEntry.withBagsCount += seg.webCheckinWithBagsCount;
    wbStationMap.set(stKey, stEntry);

    if (seg.statusDetail && seg.capacityTotal !== null) {
      assignedSegments += 1;
      offeredTotalCapacity += seg.capacityTotal;
      offeredEcoCapacity += seg.capacityEco || 0;
      offeredBizCapacity += seg.capacityBiz || 0;
      assignedTraveledTotal += seg.onBoardTotal;
      assignedTraveledEco += seg.onBoardEco;
      assignedTraveledBiz += seg.onBoardBiz;
      emptySeatsTotal += seg.capacityTotal - seg.onBoardTotal;
      if (seg.onBoardTotal > seg.capacityTotal) {
        spillageSegmentsCount += 1;
      }

      const d = seg.statusDetail;
      const tailKey = d.registration || `${d.aircraftType || "ACFT"}-${d.seatsRaw}`;
      const tEntry = tailMap.get(tailKey) || {
        tailNbr: tailKey,
        equipmentType: d.aircraftType || f.aircraftType || "—",
        aircraftConfig: d.seatsRaw || `${d.businessCapacity}/${d.economyCapacity}`,
        seatCapacity: d.totalCapacity,
        economyCapacity: d.economyCapacity,
        businessCapacity: d.businessCapacity,
        segmentsCount: 0,
        flightNumbers: new Set<string>(),
        offeredSeats: 0,
        offeredEco: 0,
        offeredBiz: 0,
        traveledTotal: 0,
        traveledEco: 0,
        traveledBiz: 0,
        bagsCount: 0,
        totalWeight: 0,
      };
      tEntry.segmentsCount += 1;
      tEntry.flightNumbers.add(`${f.airline} ${seg.cleanFlightNumber}`);
      tEntry.offeredSeats += d.totalCapacity;
      tEntry.offeredEco += d.economyCapacity;
      tEntry.offeredBiz += d.businessCapacity;
      tEntry.traveledTotal += seg.onBoardTotal;
      tEntry.traveledEco += seg.onBoardEco;
      tEntry.traveledBiz += seg.onBoardBiz;
      tEntry.bagsCount += seg.bagsCount;
      tEntry.totalWeight += seg.totalWeight;
      tailMap.set(tailKey, tEntry);
    }

    // Equipment Type Summary
    const eqKey = seg.aircraftType || "N/D";
    const eqEntry = eqMap.get(eqKey) || {
      equipmentType: eqKey,
      segmentsCount: 0,
      traveledTotal: 0,
      traveledEco: 0,
      traveledBiz: 0,
      offeredSeats: 0,
      assignedTraveled: 0,
    };
    eqEntry.segmentsCount += 1;
    eqEntry.traveledTotal += seg.traveledTotal;
    eqEntry.traveledEco += seg.traveledEco;
    eqEntry.traveledBiz += seg.traveledBiz;
    if (seg.capacityTotal !== null) {
      eqEntry.offeredSeats += seg.capacityTotal;
      eqEntry.assignedTraveled += seg.onBoardTotal;
    }
    eqMap.set(eqKey, eqEntry);

    // Daily bucket
    const dEntry = dayMap.get(seg.dateKey) || {
      dateKey: seg.dateKey,
      sortOrder: seg.sortOrder,
      flights: [],
      segmentsCount: 0,
      assignedSegmentsCount: 0,
      traveledTotal: 0,
      traveledEco: 0,
      traveledBiz: 0,
      listedTotal: 0,
      noShowCount: 0,
      unseatedCount: 0,
      offeredCapacity: 0,
      offeredEco: 0,
      offeredBiz: 0,
      assignedTraveled: 0,
      assignedTraveledEco: 0,
      assignedTraveledBiz: 0,
      bagsCount: 0,
      totalWeight: 0,
      uncoveredDeviations: 0,
      missingBagWeightCount: 0,
      emdCount: 0,
    };
    dEntry.flights.push(f);
    dEntry.segmentsCount += 1;
    dEntry.traveledTotal += seg.traveledTotal;
    dEntry.traveledEco += seg.traveledEco;
    dEntry.traveledBiz += seg.traveledBiz;
    dEntry.listedTotal += seg.listedTotal;
    dEntry.noShowCount += seg.noShowTotal;
    dEntry.unseatedCount += seg.unseatedTotal;
    dEntry.bagsCount += seg.bagsCount;
    dEntry.totalWeight += seg.totalWeight;
    dEntry.uncoveredDeviations += f.baggageUncoveredDeviationsCount;
    dEntry.missingBagWeightCount += f.baggageMissingWeightCount || 0;
    dEntry.emdCount += f.emdCount;
    if (seg.capacityTotal !== null) {
      dEntry.assignedSegmentsCount += 1;
      dEntry.offeredCapacity += seg.capacityTotal;
      dEntry.offeredEco += seg.capacityEco || 0;
      dEntry.offeredBiz += seg.capacityBiz || 0;
      dEntry.assignedTraveled += seg.traveledTotal;
      dEntry.assignedTraveledEco += seg.traveledEco;
      dEntry.assignedTraveledBiz += seg.traveledBiz;
    }
    dayMap.set(seg.dateKey, dEntry);

    // Flight Number Group
    const fnEntry = fnMap.get(seg.cleanFlightNumber) || {
      flightNumber: seg.cleanFlightNumber,
      airline: f.airline,
      segments: [],
      dates: new Set<string>(),
      origins: new Set<string>(),
      destinations: new Set<string>(),
      equipmentCounts: {},
      pureEcoCount: 0,
    };
    fnEntry.segments.push(seg);
    fnEntry.dates.add(seg.dateKey);
    if (f.origin) fnEntry.origins.add(f.origin);
    if (seg.physicalDestination) fnEntry.destinations.add(seg.physicalDestination);
    if (seg.aircraftType) {
      fnEntry.equipmentCounts[seg.aircraftType] =
        (fnEntry.equipmentCounts[seg.aircraftType] || 0) + 1;
    }
    if (f.isPureEconomy) fnEntry.pureEcoCount += 1;
    fnMap.set(seg.cleanFlightNumber, fnEntry);

    // Destinations breakdown (traveled pax)
    if (f.destinationCounts && f.destinationCounts.length > 0) {
      for (const dc of f.destinationCounts) {
        if (!dc.code) continue;
        const curr = destMap.get(dc.code) || { pax: 0, segments: new Set<string>() };
        curr.pax += dc.count;
        curr.segments.add(f.id);
        destMap.set(dc.code, curr);
      }
    } else if (f.primaryDestination) {
      const curr = destMap.get(f.primaryDestination) || {
        pax: 0,
        segments: new Set<string>(),
      };
      curr.pax += seg.traveledTotal;
      curr.segments.add(f.id);
      destMap.set(f.primaryDestination, curr);
    }
  }

  const dailySeries: DailyAnalyticsPoint[] = Array.from(dayMap.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => {
      const dayTransported = computeTransportedPassengerReport(d.flights);
      const dayTraveledTotal = dayTransported.totalPassengers;
      const dayTraveledEco = dayTransported.economy;
      const dayTraveledBiz = dayTransported.business;
      const dayWb = dayTransported.webCheckin;
      const dayAirportCheckin = Math.max(0, dayTraveledTotal - dayWb);
      const dayWbRate =
        dayTraveledTotal > 0
          ? Number(((dayWb / dayTraveledTotal) * 100).toFixed(1))
          : 0;
      return {
        dateKey: d.dateKey,
        sortOrder: d.sortOrder,
        segmentsCount: d.segmentsCount,
        assignedSegmentsCount: d.assignedSegmentsCount,
        traveledTotal: dayTraveledTotal,
        traveledEco: dayTraveledEco,
        traveledBiz: dayTraveledBiz,
        listedTotal: d.listedTotal,
        noShowCount: d.noShowCount,
        noShowRatePct:
          d.listedTotal > 0
            ? Number(((d.noShowCount / d.listedTotal) * 100).toFixed(1))
            : 0,
        unseatedCount: d.unseatedCount,
        offeredCapacity: d.offeredCapacity,
        offeredEco: d.offeredEco,
        offeredBiz: d.offeredBiz,
        assignedTraveled: d.assignedTraveled,
        loadFactorPct:
          d.offeredCapacity > 0
            ? Number(((d.assignedTraveled / d.offeredCapacity) * 100).toFixed(1))
            : null,
        ecoLfPct:
          d.offeredEco > 0
            ? Number(((d.assignedTraveledEco / d.offeredEco) * 100).toFixed(1))
            : null,
        bizLfPct:
          d.offeredBiz > 0
            ? Number(((d.assignedTraveledBiz / d.offeredBiz) * 100).toFixed(1))
            : null,
        bagsCount: d.bagsCount,
        totalWeight: d.totalWeight,
        avgWeightPerPax:
          dayTraveledTotal > 0
            ? Number((d.totalWeight / dayTraveledTotal).toFixed(1))
            : 0,
        uncoveredDeviations: d.uncoveredDeviations,
        missingBagWeightCount: d.missingBagWeightCount,
        emdCount: d.emdCount,
        webCheckinCount: dayWb,
        airportCheckinCount: dayAirportCheckin,
        webCheckinRatePct: dayWbRate,
      };
    });

  const flightNumberGroups: FlightNumberGroupAnalytics[] = Array.from(
    fnMap.values()
  )
    .map((g) => {
      const n = g.segments.length;
      const totPax = g.segments.reduce((s, x) => s + x.traveledTotal, 0);
      const totOnBoard = g.segments.reduce((s, x) => s + x.onBoardTotal, 0);
      const totEco = g.segments.reduce((s, x) => s + x.traveledEco, 0);
      const totBiz = g.segments.reduce((s, x) => s + x.traveledBiz, 0);
      const totListed = g.segments.reduce((s, x) => s + x.listedTotal, 0);
      const totNoShow = g.segments.reduce((s, x) => s + x.noShowTotal, 0);
      const totWt = g.segments.reduce((s, x) => s + x.totalWeight, 0);
      const totUncov = g.segments.reduce(
        (s, x) => s + x.flight.baggageUncoveredDeviationsCount,
        0
      );
      const totEmd = g.segments.reduce((s, x) => s + x.flight.emdCount, 0);
      const totWb = g.segments.reduce((s, x) => s + x.webCheckinCount, 0);
      const airportCheckinCount = Math.max(0, totPax - totWb);
      const webCheckinRatePct =
        totPax > 0 ? Number(((totWb / totPax) * 100).toFixed(1)) : 0;
      const assignedSegs = g.segments.filter((s) => s.capacityTotal !== null);
      const capTot = assignedSegs.reduce((s, x) => s + (x.capacityTotal || 0), 0);
      const capEco = assignedSegs.reduce((s, x) => s + (x.capacityEco || 0), 0);
      const capBiz = assignedSegs.reduce((s, x) => s + (x.capacityBiz || 0), 0);
      const assPaxTot = assignedSegs.reduce((s, x) => s + x.onBoardTotal, 0);
      const assPaxEco = assignedSegs.reduce((s, x) => s + x.onBoardEco, 0);
      const assPaxBiz = assignedSegs.reduce((s, x) => s + x.onBoardBiz, 0);

      const regs = Array.from(
        new Set(
          g.segments
            .map((s) => s.registration)
            .filter((r) => Boolean(r && r.trim()))
        )
      );
      const eqHints = Object.entries(g.equipmentCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([code]) => code);

      const primaryStatusDetail =
        assignedSegs.find((s) => s.statusDetail)?.statusDetail || null;

      return {
        flightNumber: g.flightNumber,
        airline: g.airline,
        segmentsCount: n,
        datesCount: g.dates.size,
        origins: Array.from(g.origins).sort(),
        destinations: Array.from(g.destinations).sort(),
        equipmentHints: eqHints,
        isPureEcoDominant: g.pureEcoCount >= Math.ceil(n / 2),
        registrations: regs,
        primaryRegistration: regs[0] || "",
        primaryAircraftType:
          primaryStatusDetail?.aircraftType || eqHints[0] || "",
        primaryStatusDetail,
        avgCapacity:
          assignedSegs.length > 0
            ? Math.round(capTot / assignedSegs.length)
            : null,
        traveledTotal: totPax,
        traveledEco: totEco,
        traveledBiz: totBiz,
        avgTraveled: Math.round(totOnBoard / Math.max(1, n)),
        maxTraveled: Math.max(...g.segments.map((s) => s.traveledTotal)),
        maxTraveledEco: Math.max(...g.segments.map((s) => s.traveledEco)),
        maxTraveledBiz: Math.max(...g.segments.map((s) => s.traveledBiz)),
        offeredCapacityTotal: capTot,
        loadFactorPct:
          capTot > 0 ? Number(((assPaxTot / capTot) * 100).toFixed(1)) : null,
        ecoLfPct:
          capEco > 0 ? Number(((assPaxEco / capEco) * 100).toFixed(1)) : null,
        bizLfPct:
          capBiz > 0 ? Number(((assPaxBiz / capBiz) * 100).toFixed(1)) : null,
        noShowTotal: totNoShow,
        noShowRatePct:
          totListed > 0
            ? Number(((totNoShow / totListed) * 100).toFixed(1))
            : 0,
        totalWeight: totWt,
        avgWeightPerPax:
          totPax > 0 ? Number((totWt / totPax).toFixed(1)) : 0,
        uncoveredDeviations: totUncov,
        emdCount: totEmd,
        webCheckinCount: totWb,
        airportCheckinCount,
        webCheckinRatePct,
      };
    })
    .sort(
      (a, b) =>
        (parseInt(a.flightNumber, 10) || 0) -
        (parseInt(b.flightNumber, 10) || 0)
    );

  // --- Passenger Journey Stitching for True O&D (Origin & Destination) + Booking Class Mix ---
  const passengerJourneyMap = new Map<
    string,
    Array<{
      dateKey: string;
      sortOrder: number;
      departureTime: string;
      origin: string;
      destination: string;
      hasIb: boolean;
      hasOb: boolean;
    }>
  >();
  const bookingClassMap = new Map<
    string,
    { bookingClass: string; cabin: "C" | "Y"; passengers: number }
  >();

  for (const flight of flights) {
    const dateKey = normalizeDcsFlightDate(flight.date);
    const sortOrder = getDcsFlightDateSortOrder(dateKey, flight.extractedYear);
    for (const pax of flight.passengers) {
      if (!isPassengerWithSeat(pax)) continue;
      const bc = (pax.bookingClass || (pax.cabinClass === "C" ? "C" : "Y"))
        .trim()
        .toUpperCase();
      const bcKey = `${pax.cabinClass}:${bc}`;
      const bcCurr = bookingClassMap.get(bcKey) || {
        bookingClass: bc,
        cabin: pax.cabinClass,
        passengers: 0,
      };
      bcCurr.passengers += 1;
      bookingClassMap.set(bcKey, bcCurr);

      const tNum = (pax.ticket?.ticketNumber || pax.ticket?.paperTicketNumber || "").trim();
      const nameKey = `${(pax.lastName || "").trim().toUpperCase()}|${(pax.firstName || "").trim().toUpperCase()}`;
      const paxKey = tNum ? `TKT:${tNum}` : `NAME:${nameKey}`;

      const hasIb = pax.editCodes.includes("IB") || Boolean(pax.inboundFlight);
      const hasOb = pax.editCodes.includes("OB") || Boolean(pax.outboundFlight);
      const dest = pax.destination || flight.primaryDestination || "";
      if (!dest || !flight.origin) continue;

      const list = passengerJourneyMap.get(paxKey) || [];
      list.push({
        dateKey,
        sortOrder,
        departureTime: flight.departureTime || "0000",
        origin: flight.origin.trim().toUpperCase(),
        destination: dest.trim().toUpperCase(),
        hasIb,
        hasOb,
      });
      passengerJourneyMap.set(paxKey, list);
    }
  }

  const destMapOnd = new Map<string, { pax: number; segments: Set<string> }>();
  const origMapOnd = new Map<string, { pax: number; segments: Set<string> }>();
  const routeOndMap = new Map<
    string,
    { origin: string; destination: string; pax: number }
  >();

  for (const journeySegs of passengerJourneyMap.values()) {
    journeySegs.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.departureTime.localeCompare(b.departureTime)
    );

    // Split into distinct trips if legs are separated by >1 day without IB/OB connection
    const trips: typeof journeySegs[] = [];
    let currentTrip: typeof journeySegs = [];
    for (const leg of journeySegs) {
      if (currentTrip.length === 0) {
        currentTrip.push(leg);
      } else {
        const prev = currentTrip[currentTrip.length - 1];
        const dayGap = Math.abs(leg.sortOrder - prev.sortOrder);
        if (dayGap <= 1 && (prev.hasOb || leg.hasIb || prev.destination === leg.origin)) {
          currentTrip.push(leg);
        } else {
          trips.push(currentTrip);
          currentTrip = [leg];
        }
      }
    }
    if (currentTrip.length > 0) trips.push(currentTrip);

    for (const trip of trips) {
      // True Origin: first segment without IB (passengers must NOT be IB at origin station)
      const firstNonIb = trip.find((s) => !s.hasIb);
      const trueOrigin = firstNonIb ? firstNonIb.origin : "";

      // True Final Destination: last segment without OB (passengers must NOT be OB leaving final leg)
      let trueDest = "";
      for (let i = trip.length - 1; i >= 0; i--) {
        if (!trip[i].hasOb) {
          trueDest = trip[i].destination;
          break;
        }
      }

      if (trueDest) {
        const entry = destMapOnd.get(trueDest) || {
          pax: 0,
          segments: new Set<string>(),
        };
        entry.pax += 1;
        destMapOnd.set(trueDest, entry);
      }

      if (trueOrigin) {
        const entry = origMapOnd.get(trueOrigin) || {
          pax: 0,
          segments: new Set<string>(),
        };
        entry.pax += 1;
        origMapOnd.set(trueOrigin, entry);
      }

      if (trueOrigin && trueDest && trueOrigin !== trueDest) {
        const routeKey = `${trueOrigin} → ${trueDest}`;
        const rEntry = routeOndMap.get(routeKey) || {
          origin: trueOrigin,
          destination: trueDest,
          pax: 0,
        };
        rEntry.pax += 1;
        routeOndMap.set(routeKey, rEntry);
      }
    }
  }

  const totalOndDestPax = Array.from(destMapOnd.values()).reduce((s, v) => s + v.pax, 0);
  const totalOndOrigPax = Array.from(origMapOnd.values()).reduce((s, v) => s + v.pax, 0);
  const totalOndRoutesPax = Array.from(routeOndMap.values()).reduce((s, v) => s + v.pax, 0);

  const destinationBreakdown: DestinationAnalyticsRow[] = Array.from(
    destMapOnd.entries()
  )
    .map(([code, info]) => ({
      code,
      passengers: info.pax,
      sharePct:
        totalOndDestPax > 0
          ? Number(((info.pax / totalOndDestPax) * 100).toFixed(1))
          : 0,
      segmentsCount: info.segments.size || 1,
    }))
    .sort((a, b) => b.passengers - a.passengers);

  const originBreakdown: DestinationAnalyticsRow[] = Array.from(
    origMapOnd.entries()
  )
    .map(([code, info]) => ({
      code,
      passengers: info.pax,
      sharePct:
        totalOndOrigPax > 0
          ? Number(((info.pax / totalOndOrigPax) * 100).toFixed(1))
          : 0,
      segmentsCount: info.segments.size || 1,
    }))
    .sort((a, b) => b.passengers - a.passengers);

  const routeOndBreakdown: RouteOndAnalyticsRow[] = Array.from(
    routeOndMap.entries()
  )
    .map(([route, info]) => ({
      route,
      origin: info.origin,
      destination: info.destination,
      passengers: info.pax,
      sharePct:
        totalOndRoutesPax > 0
          ? Number(((info.pax / totalOndRoutesPax) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.passengers - a.passengers);

  // Physical Flight Sector Performance
  const sectorMap = new Map<
    string,
    {
      origin: string;
      destination: string;
      segmentsCount: number;
      traveledTotal: number;
      traveledEco: number;
      traveledBiz: number;
      offeredSeats: number;
      assignedTraveled: number;
      noShowTotal: number;
      listedTotal: number;
      totalWeight: number;
    }
  >();

  for (const seg of segmentMetrics) {
    const orig = (seg.flight.origin || "").trim().toUpperCase();
    const dst = (seg.physicalDestination || seg.flight.primaryDestination || "")
      .trim()
      .toUpperCase();
    if (!orig || !dst || orig === dst) continue;
    const key = `${orig} → ${dst}`;
    const curr = sectorMap.get(key) || {
      origin: orig,
      destination: dst,
      segmentsCount: 0,
      traveledTotal: 0,
      traveledEco: 0,
      traveledBiz: 0,
      offeredSeats: 0,
      assignedTraveled: 0,
      noShowTotal: 0,
      listedTotal: 0,
      totalWeight: 0,
    };
    curr.segmentsCount += 1;
    curr.traveledTotal += seg.onBoardTotal;
    curr.traveledEco += seg.onBoardEco;
    curr.traveledBiz += seg.onBoardBiz;
    if (seg.capacityTotal !== null) {
      curr.offeredSeats += seg.capacityTotal;
      curr.assignedTraveled += seg.onBoardTotal;
    }
    curr.noShowTotal += seg.noShowTotal;
    curr.listedTotal += seg.listedTotal;
    curr.totalWeight += seg.totalWeight;
    sectorMap.set(key, curr);
  }

  const sectorPerformance: SectorPerformanceRow[] = Array.from(sectorMap.entries())
    .map(([sector, s]) => ({
      sector,
      origin: s.origin,
      destination: s.destination,
      segmentsCount: s.segmentsCount,
      traveledTotal: s.traveledTotal,
      traveledEco: s.traveledEco,
      traveledBiz: s.traveledBiz,
      avgTraveled: Math.round(s.traveledTotal / Math.max(1, s.segmentsCount)),
      offeredSeats: s.offeredSeats,
      loadFactorPct:
        s.offeredSeats > 0
          ? Number(((s.assignedTraveled / s.offeredSeats) * 100).toFixed(1))
          : null,
      noShowTotal: s.noShowTotal,
      noShowRatePct:
        s.listedTotal > 0
          ? Number(((s.noShowTotal / s.listedTotal) * 100).toFixed(1))
          : 0,
      totalWeight: s.totalWeight,
    }))
    .sort((a, b) => b.traveledTotal - a.traveledTotal);

  // Flight Route Flows (Strict 1 Physical Leg per Manifest Segment -> Next Physical Stop, with Manifest Pax & LF%)
  const routeFlowMap = new Map<
    string,
    {
      origin: string;
      destination: string;
      flightsCount: number;
      passengers: number;
      passengersEco: number;
      passengersBiz: number;
      offeredSeats: number;
      assignedTraveled: number;
      fnMap: Map<
        string,
        FlightRouteFlowFlightItem & { offeredSeats: number; assignedTraveled: number }
      >;
    }
  >();

  const unmappedMapFlights: UnmappedMapFlightItem[] = [];

  for (const seg of segmentMetrics) {
    const origin = (seg.flight.origin || "").trim().toUpperCase();
    const dest = (seg.physicalDestination || seg.flight.primaryDestination || "")
      .trim()
      .toUpperCase();
    const airline = (seg.flight.airline || "KP").trim().toUpperCase();
    const cleanFn = seg.cleanFlightNumber || normalizeStatusFlightNumber(seg.flight.flightNumber);
    if (!origin || !dest) {
      unmappedMapFlights.push({
        airline,
        flightNumber: cleanFn,
        dateKey: seg.dateKey,
        origin: origin || "?",
        destination: dest || "?",
        passengers: seg.traveledTotal,
        reason: "NO_DEST",
      });
      continue;
    }
    if (origin === dest) {
      unmappedMapFlights.push({
        airline,
        flightNumber: cleanFn,
        dateKey: seg.dateKey,
        origin,
        destination: dest,
        passengers: seg.traveledTotal,
        reason: "SAME_ORIGIN_DEST",
      });
      continue;
    }

    const routeKey = `${origin} → ${dest}`;
    const flowEntry = routeFlowMap.get(routeKey) || {
      origin,
      destination: dest,
      flightsCount: 0,
      passengers: 0,
      passengersEco: 0,
      passengersBiz: 0,
      offeredSeats: 0,
      assignedTraveled: 0,
      fnMap: new Map<
        string,
        FlightRouteFlowFlightItem & { offeredSeats: number; assignedTraveled: number }
      >(),
    };

    flowEntry.flightsCount += 1;
    flowEntry.passengers += seg.traveledTotal;
    flowEntry.passengersEco += seg.traveledEco;
    flowEntry.passengersBiz += seg.traveledBiz;
    if (seg.capacityTotal !== null && seg.capacityTotal > 0) {
      flowEntry.offeredSeats += seg.capacityTotal;
      flowEntry.assignedTraveled += seg.traveledTotal;
    }

    const fnKey = `${airline}:${cleanFn}`;
    const fnItem = flowEntry.fnMap.get(fnKey) || {
      airline,
      flightNumber: cleanFn,
      frequency: 0,
      passengers: 0,
      offeredSeats: 0,
      assignedTraveled: 0,
    };
    fnItem.frequency += 1;
    fnItem.passengers += seg.traveledTotal;
    if (seg.capacityTotal !== null && seg.capacityTotal > 0) {
      fnItem.offeredSeats += seg.capacityTotal;
      fnItem.assignedTraveled += seg.traveledTotal;
    }
    flowEntry.fnMap.set(fnKey, fnItem);

    routeFlowMap.set(routeKey, flowEntry);
  }

  const flightRouteFlows: FlightRouteFlowRow[] = Array.from(routeFlowMap.entries())
    .map(([route, info]) => ({
      id: `${info.origin}-${info.destination}`,
      route,
      origin: info.origin,
      destination: info.destination,
      flightsCount: info.flightsCount,
      passengers: info.passengers,
      passengersEco: info.passengersEco,
      passengersBiz: info.passengersBiz,
      offeredSeats: info.offeredSeats,
      loadFactorPct:
        info.offeredSeats > 0
          ? Number(((info.assignedTraveled / info.offeredSeats) * 100).toFixed(1))
          : null,
      avgPaxPerFlight:
        info.flightsCount > 0 ? Math.round(info.passengers / info.flightsCount) : 0,
      flightNumbers: Array.from(info.fnMap.values())
        .map((fn) => ({
          airline: fn.airline,
          flightNumber: fn.flightNumber,
          frequency: fn.frequency,
          passengers: fn.passengers,
          loadFactorPct:
            fn.offeredSeats > 0
              ? Number(((fn.assignedTraveled / fn.offeredSeats) * 100).toFixed(1))
              : null,
        }))
        .sort(
          (a, b) =>
            b.frequency - a.frequency ||
            b.passengers - a.passengers ||
            a.flightNumber.localeCompare(b.flightNumber)
        ),
    }))
    .sort((a, b) => b.passengers - a.passengers || b.flightsCount - a.flightsCount);

  const totalBcPax = Array.from(bookingClassMap.values()).reduce(
    (s, b) => s + b.passengers,
    0
  );
  const bookingClassBreakdown: BookingClassRow[] = Array.from(
    bookingClassMap.values()
  )
    .map((b) => ({
      bookingClass: b.bookingClass,
      cabin: b.cabin,
      passengers: b.passengers,
      sharePct:
        totalBcPax > 0
          ? Number(((b.passengers / totalBcPax) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.passengers - a.passengers);

  const tailUtilization: TailUtilizationRow[] = Array.from(tailMap.values())
    .map((t) => ({
      tailNbr: t.tailNbr,
      equipmentType: t.equipmentType,
      aircraftConfig: t.aircraftConfig,
      seatCapacity: t.seatCapacity,
      economyCapacity: t.economyCapacity,
      businessCapacity: t.businessCapacity,
      segmentsCount: t.segmentsCount,
      flightNumbers: Array.from(t.flightNumbers).sort(),
      offeredSeats: t.offeredSeats,
      traveledTotal: t.traveledTotal,
      traveledEco: t.traveledEco,
      traveledBiz: t.traveledBiz,
      emptySeats: Math.max(0, t.offeredSeats - t.traveledTotal),
      loadFactorPct:
        t.offeredSeats > 0
          ? Number(((t.traveledTotal / t.offeredSeats) * 100).toFixed(1))
          : 0,
      ecoLfPct:
        t.offeredEco > 0
          ? Number(((t.traveledEco / t.offeredEco) * 100).toFixed(1))
          : 0,
      bizLfPct:
        t.offeredBiz > 0
          ? Number(((t.traveledBiz / t.offeredBiz) * 100).toFixed(1))
          : null,
      bagsCount: t.bagsCount,
      totalWeight: t.totalWeight,
      avgWeightPerPax:
        t.traveledTotal > 0
          ? Number((t.totalWeight / t.traveledTotal).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.traveledTotal - a.traveledTotal);

  const equipmentSummary: EquipmentTypeSummaryRow[] = Array.from(eqMap.values())
    .map((e) => ({
      equipmentType: e.equipmentType,
      segmentsCount: e.segmentsCount,
      traveledTotal: e.traveledTotal,
      traveledEco: e.traveledEco,
      traveledBiz: e.traveledBiz,
      offeredSeats: e.offeredSeats,
      loadFactorPct:
        e.offeredSeats > 0
          ? Number(((e.assignedTraveled / e.offeredSeats) * 100).toFixed(1))
          : null,
    }))
    .sort((a, b) => b.traveledTotal - a.traveledTotal);

  const globalTransported = computeTransportedPassengerReport(flights);
  traveledTotal = globalTransported.totalPassengers;
  traveledEco = globalTransported.economy;
  traveledBiz = globalTransported.business;
  const webCheckinTotal = globalTransported.webCheckin;
  const airportCheckinTotal = Math.max(0, traveledTotal - webCheckinTotal);
  const webCheckinRatePct =
    traveledTotal > 0
      ? Number(((webCheckinTotal / traveledTotal) * 100).toFixed(1))
      : 0;
  const wbSegSum = webCheckinEcoTotal + webCheckinBizTotal;
  const webCheckinEcoRatePct =
    traveledEco > 0
      ? Number(((webCheckinEcoTotal / traveledEco) * 100).toFixed(1))
      : 0;
  const webCheckinBizRatePct =
    traveledBiz > 0
      ? Number(((webCheckinBizTotal / traveledBiz) * 100).toFixed(1))
      : 0;
  const webCheckinBagsRatePct =
    wbSegSum > 0
      ? Number(((webCheckinWithBagsTotal / wbSegSum) * 100).toFixed(1))
      : 0;

  const webCheckinStationBreakdown: WebCheckinStationRow[] = Array.from(
    wbStationMap.values()
  )
    .map((st) => ({
      origin: st.origin,
      segmentsCount: st.segmentsCount,
      traveledTotal: st.traveledTotal,
      webCheckinCount: st.webCheckinCount,
      airportCount: Math.max(0, st.traveledTotal - st.webCheckinCount),
      webCheckinRatePct:
        st.traveledTotal > 0
          ? Number(((st.webCheckinCount / st.traveledTotal) * 100).toFixed(1))
          : 0,
      ecoWb: st.ecoWb,
      ecoTotal: st.ecoTotal,
      ecoRatePct:
        st.ecoTotal > 0
          ? Number(((st.ecoWb / st.ecoTotal) * 100).toFixed(1))
          : 0,
      bizWb: st.bizWb,
      bizTotal: st.bizTotal,
      bizRatePct:
        st.bizTotal > 0
          ? Number(((st.bizWb / st.bizTotal) * 100).toFixed(1))
          : 0,
      withBagsCount: st.withBagsCount,
    }))
    .sort((a, b) => b.webCheckinCount - a.webCheckinCount);

  const totalSegments = flights.length;
  const kpis: GlobalAviationKpis = {
    totalSegments,
    totalDays: dailySeries.length,
    assignedSegments,
    assignmentCoveragePct:
      totalSegments > 0
        ? Number(((assignedSegments / totalSegments) * 100).toFixed(1))
        : 0,
    traveledTotal,
    traveledEco,
    traveledBiz,
    bizSharePct:
      traveledTotal > 0
        ? Number(((traveledBiz / traveledTotal) * 100).toFixed(1))
        : 0,
    ecoSharePct:
      traveledTotal > 0
        ? Number(((traveledEco / traveledTotal) * 100).toFixed(1))
        : 0,
    avgPaxPerSegment:
      totalSegments > 0 ? Math.round(traveledTotal / totalSegments) : 0,
    offeredTotalCapacity,
    offeredEcoCapacity,
    offeredBizCapacity,
    assignedTraveledTotal,
    assignedTraveledEco,
    assignedTraveledBiz,
    globalLoadFactorPct:
      offeredTotalCapacity > 0
        ? Number(((assignedTraveledTotal / offeredTotalCapacity) * 100).toFixed(1))
        : null,
    ecoLoadFactorPct:
      offeredEcoCapacity > 0
        ? Number(((assignedTraveledEco / offeredEcoCapacity) * 100).toFixed(1))
        : null,
    bizLoadFactorPct:
      offeredBizCapacity > 0
        ? Number(((assignedTraveledBiz / offeredBizCapacity) * 100).toFixed(1))
        : null,
    emptySeatsTotal,
    spillageSegmentsCount,
    listedTotal,
    unseatedTotal,
    noShowTotal,
    noShowRatePct:
      listedTotal > 0
        ? Number(((noShowTotal / listedTotal) * 100).toFixed(1))
        : 0,
    unseatedRatePct:
      listedTotal > 0
        ? Number(((unseatedTotal / listedTotal) * 100).toFixed(1))
        : 0,
    totalBags,
    totalWeight,
    avgWeightPerPax:
      traveledTotal > 0 ? Number((totalWeight / traveledTotal).toFixed(1)) : 0,
    avgBagsPerPax:
      traveledTotal > 0 ? Number((totalBags / traveledTotal).toFixed(2)) : 0,
    avgWeightPerBag:
      totalBags > 0 ? Number((totalWeight / totalBags).toFixed(1)) : 0,
    uncoveredDeviations,
    coveredDeviations,
    missingBagWeightCount,
    deviationRatePct:
      traveledTotal > 0
        ? Number(
            (
              ((uncoveredDeviations + coveredDeviations) / traveledTotal) *
              100
            ).toFixed(1)
          )
        : 0,
    emdCount,
    emdPenetrationPct:
      traveledTotal > 0
        ? Number(((emdCount / traveledTotal) * 100).toFixed(1))
        : 0,
    loyaltyCount,
    loyaltySharePct:
      traveledTotal > 0
        ? Number(((loyaltyCount / traveledTotal) * 100).toFixed(1))
        : 0,
    transitCount,
    transitSharePct:
      traveledTotal > 0
        ? Number(((transitCount / traveledTotal) * 100).toFixed(1))
        : 0,
    codeshareCount,
    codeshareSharePct:
      traveledTotal > 0
        ? Number(((codeshareCount / traveledTotal) * 100).toFixed(1))
        : 0,
    maleCount,
    femaleCount,
    childCount,
    infantCount,
    webCheckinTotal,
    airportCheckinTotal,
    webCheckinRatePct,
    webCheckinEco: webCheckinEcoTotal,
    webCheckinEcoRatePct,
    webCheckinBiz: webCheckinBizTotal,
    webCheckinBizRatePct,
    webCheckinNoShow: webCheckinNoShowTotal,
    webCheckinWithBagsCount: webCheckinWithBagsTotal,
    webCheckinBagsRatePct,
  };

  const noShowByFlight: NoShowFlightRow[] = segmentMetrics
    .filter((seg) => seg.noShowTotal > 0)
    .map((seg) => ({
      flightId: seg.flight.id,
      flightLabel: `${seg.flight.airline} ${seg.cleanFlightNumber}`,
      flightNumber: seg.cleanFlightNumber,
      airline: seg.flight.airline,
      dateKey: seg.dateKey,
      sortOrder: seg.sortOrder,
      origin: seg.flight.origin,
      destination: seg.physicalDestination || seg.flight.primaryDestination,
      aircraftType: seg.aircraftType,
      registration: seg.registration,
      capacityTotal: seg.capacityTotal,
      traveledTotal: seg.traveledTotal,
      noShowTotal: seg.noShowTotal,
      noShowEco: seg.noShowEco,
      noShowBiz: seg.noShowBiz,
      listedTotal: seg.listedTotal,
      noShowRatePct: seg.noShowRatePct,
      loadFactorPct: seg.loadFactorPct,
    }))
    .sort((a, b) => b.noShowTotal - a.noShowTotal || b.sortOrder - a.sortOrder);

  const noShowPassengers: NoShowPassengerRow[] = [];
  let noShowEcoTotal = 0;
  let noShowBizTotal = 0;

  for (const seg of segmentMetrics) {
    for (const pax of seg.flight.passengers) {
      if (!isPassengerNoShow(pax)) continue;
      if (pax.cabinClass === "C") noShowBizTotal += 1;
      else noShowEcoTotal += 1;
      noShowPassengers.push({
        flightId: seg.flight.id,
        paxId: pax.id,
        dateKey: seg.dateKey,
        sortOrder: seg.sortOrder,
        flightLabel: `${seg.flight.airline} ${seg.cleanFlightNumber}`,
        origin: seg.flight.origin,
        destination: pax.destination || seg.flight.primaryDestination,
        cabinClass: pax.cabinClass,
        bookingClass: pax.bookingClass,
        seqLabel: `${String(pax.classSeq || pax.seq).padStart(3, "0")}${pax.isTransitMarker ? "#" : ""}`,
        fullNameDisplay: pax.fullNameDisplay,
        genderOrType: pax.isChild ? "CHD" : pax.gender || "—",
        hasInfant: pax.hasInfant,
        ticketNumber:
          pax.ticket?.ticketNumber || pax.ticket?.paperTicketNumber || "",
        ticketStatus: pax.ticket?.status || "",
        editCodes: pax.editCodes.join(" "),
        partyCode: pax.partyCode || "",
      });
    }
  }

  noShowPassengers.sort(
    (a, b) =>
      b.sortOrder - a.sortOrder ||
      a.flightLabel.localeCompare(b.flightLabel) ||
      a.fullNameDisplay.localeCompare(b.fullNameDisplay)
  );

  const noShowReport: NoShowReportData = {
    summary: {
      totalNoShow: noShowTotal,
      noShowEco: noShowEcoTotal,
      noShowBiz: noShowBizTotal,
      listedTotal,
      traveledTotal,
      noShowRatePct: kpis.noShowRatePct,
      flightsAffectedCount: noShowByFlight.length,
      totalFlightsCount: totalSegments,
    },
    byFlight: noShowByFlight,
    passengers: noShowPassengers,
  };

  // 6. Aircraft Utilization Time (Flight Hours + Ground Turnaround + 24h Rotation Timeline)
  interface CollectedTimeLeg {
    priority: number; // 2 = exact origin leg from PTRG*, 1 = downstream leg from PTRG*, 0 = schedule fallback
    registration: string;
    equipmentType: string;
    aircraftConfig: string;
    dateKey: string;
    sortOrder: number;
    flightLabel: string;
    fromStation: string;
    toStation: string;
    startMin: number;
    endMin: number;
    durationMin: number;
    kind: "FLIGHT" | "GROUND";
  }

  const collectedLegsByKey = new Map<string, CollectedTimeLeg>();

  const registerCollectedLeg = (key: string, entry: CollectedTimeLeg) => {
    const existing = collectedLegsByKey.get(key);
    if (!existing || entry.priority > existing.priority) {
      collectedLegsByKey.set(key, entry);
    }
  };

  for (const seg of segmentMetrics) {
    if (!seg.statusDetail) continue;
    const d = seg.statusDetail;
    const reg = d.registration || `${d.aircraftType || "ACFT"}-${d.seatsRaw || "STD"}`;
    const eqType = d.aircraftType || seg.aircraftType || "—";
    const cfgLabel = d.seatsRaw || `${d.businessCapacity}/${d.economyCapacity}`;
    const flightLabel = `${seg.flight.airline} ${seg.cleanFlightNumber}`;
    const legs = d.legs || [];

    const originIdxRaw = legs.findIndex((l) => l.station === seg.flight.origin);
    const startIdx = originIdxRaw >= 0 ? originIdxRaw : 0;

    let addedFromPtrg = false;

    for (let i = startIdx; i < legs.length - 1; i++) {
      const fromLeg = legs[i];
      const toLeg = legs[i + 1];
      const depStr = fromLeg.etd || (i === startIdx ? d.etdHeader : "");
      const arrStr = toLeg.eta || toLeg.etd;

      const depMin = parseHHMMToMinutes(depStr);
      const rawArrMin = parseHHMMToMinutes(arrStr);
      if (depMin !== null && rawArrMin !== null) {
        let endMin = rawArrMin;
        if (endMin < depMin) endMin += 1440;
        const durationMin = endMin - depMin;
        if (durationMin >= 10 && durationMin <= 960) {
          addedFromPtrg = true;
          const legKey = `FLT|${reg}|${seg.dateKey}|${seg.cleanFlightNumber}|${fromLeg.station}|${toLeg.station}`;
          registerCollectedLeg(legKey, {
            priority: i === startIdx ? 2 : 1,
            registration: reg,
            equipmentType: eqType,
            aircraftConfig: cfgLabel,
            dateKey: seg.dateKey,
            sortOrder: seg.sortOrder,
            flightLabel,
            fromStation: fromLeg.station,
            toStation: toLeg.station,
            startMin: depMin,
            endMin,
            durationMin,
            kind: "FLIGHT",
          });
        }
      }

      // Ground turnaround time at intermediate stop (toLeg) if both ETA and ETD exist
      if (i + 1 < legs.length - 1 && toLeg.eta && toLeg.etd) {
        const gStart = parseHHMMToMinutes(toLeg.eta);
        const rawGEnd = parseHHMMToMinutes(toLeg.etd);
        if (gStart !== null && rawGEnd !== null) {
          let gEnd = rawGEnd;
          if (gEnd < gStart) gEnd += 1440;
          const gDur = gEnd - gStart;
          if (gDur >= 5 && gDur <= 360) {
            const gKey = `GND|${reg}|${seg.dateKey}|${seg.cleanFlightNumber}|${toLeg.station}`;
            registerCollectedLeg(gKey, {
              priority: i === startIdx ? 2 : 1,
              registration: reg,
              equipmentType: eqType,
              aircraftConfig: cfgLabel,
              dateKey: seg.dateKey,
              sortOrder: seg.sortOrder,
              flightLabel,
              fromStation: toLeg.station,
              toStation: toLeg.station,
              startMin: gStart,
              endMin: gEnd,
              durationMin: gDur,
              kind: "GROUND",
            });
          }
        }
      }
    }

    // Fallback to matching Schedule VDS segment if PTRG* block lacked leg arrival timing
    if (!addedFromPtrg && scheduleSegments.length > 0) {
      const schedMatch = scheduleSegments.find(
        (s) =>
          normalizeStatusFlightNumber(s.flightNumber) === seg.cleanFlightNumber &&
          normalizeDcsFlightDate(s.date) === seg.dateKey &&
          (s.origin || "").trim().toUpperCase() === seg.flight.origin
      );
      if (schedMatch) {
        const depStr = schedMatch.actualDep || schedMatch.schedDep;
        const arrStr = schedMatch.actualArr || schedMatch.schedArr;
        const depMin = parseHHMMToMinutes(depStr);
        const rawArrMin = parseHHMMToMinutes(arrStr);
        if (depMin !== null && rawArrMin !== null) {
          let endMin = rawArrMin;
          if (endMin < depMin) endMin += 1440;
          const durationMin = endMin - depMin;
          if (durationMin >= 10 && durationMin <= 960) {
            const legKey = `FLT|${reg}|${seg.dateKey}|${seg.cleanFlightNumber}|${schedMatch.origin}|${schedMatch.destination}`;
            registerCollectedLeg(legKey, {
              priority: 0,
              registration: reg,
              equipmentType: eqType,
              aircraftConfig: cfgLabel,
              dateKey: seg.dateKey,
              sortOrder: seg.sortOrder,
              flightLabel,
              fromStation: schedMatch.origin,
              toStation: schedMatch.destination,
              startMin: depMin,
              endMin,
              durationMin,
              kind: "FLIGHT",
            });
          }
        }
      }
    }
  }

  const timeAccMap = new Map<
    string,
    {
      tailNbr: string;
      equipmentType: string;
      aircraftConfig: string;
      activeDays: Set<string>;
      flightNumbers: Set<string>;
      routes: Set<string>;
      legsCount: number;
      totalFlightMinutes: number;
      totalTurnaroundMinutes: number;
      timelineSegments: AircraftTimelineSegment[];
    }
  >();

  for (const [legKey, leg] of collectedLegsByKey.entries()) {
    const acc = timeAccMap.get(leg.registration) || {
      tailNbr: leg.registration,
      equipmentType: leg.equipmentType,
      aircraftConfig: leg.aircraftConfig,
      activeDays: new Set<string>(),
      flightNumbers: new Set<string>(),
      routes: new Set<string>(),
      legsCount: 0,
      totalFlightMinutes: 0,
      totalTurnaroundMinutes: 0,
      timelineSegments: [],
    };

    acc.activeDays.add(leg.dateKey);
    acc.flightNumbers.add(leg.flightLabel);

    if (leg.kind === "FLIGHT") {
      acc.legsCount += 1;
      acc.totalFlightMinutes += leg.durationMin;
      acc.routes.add(`${leg.fromStation}→${leg.toStation}`);
    } else {
      acc.totalTurnaroundMinutes += leg.durationMin;
    }

    acc.timelineSegments.push({
      id: legKey,
      dateKey: leg.dateKey,
      sortOrder: leg.sortOrder,
      flightLabel: leg.flightLabel,
      fromStation: leg.fromStation,
      toStation: leg.toStation,
      route:
        leg.kind === "FLIGHT"
          ? `${leg.fromStation} → ${leg.toStation}`
          : `Escale ${leg.fromStation}`,
      startMin: leg.startMin,
      endMin: leg.endMin,
      durationMin: leg.durationMin,
      startLabel: formatMinutesClock(leg.startMin),
      endLabel: formatMinutesClock(leg.endMin),
      kind: leg.kind,
    });

    timeAccMap.set(leg.registration, acc);
  }

  const aircraftTimeUtilization: AircraftTimeUtilizationRow[] = Array.from(
    timeAccMap.values()
  )
    .map((acc) => {
      const activeDaysCount = Math.max(1, acc.activeDays.size);
      const totalBlockMinutes = acc.totalFlightMinutes + acc.totalTurnaroundMinutes;
      const totalFlightHours = Number((acc.totalFlightMinutes / 60).toFixed(2));
      const totalTurnaroundHours = Number((acc.totalTurnaroundMinutes / 60).toFixed(2));
      const totalBlockHours = Number((totalBlockMinutes / 60).toFixed(2));
      const avgDailyFlightHours = Number((totalFlightHours / activeDaysCount).toFixed(2));
      const avgDailyBlockHours = Number((totalBlockHours / activeDaysCount).toFixed(2));
      const avgLegMinutes =
        acc.legsCount > 0 ? Math.round(acc.totalFlightMinutes / acc.legsCount) : 0;
      const utilizationRatePct = Number(
        Math.min(100, (avgDailyFlightHours / 12) * 100).toFixed(1)
      );

      acc.timelineSegments.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.startMin - b.startMin
      );

      return {
        tailNbr: acc.tailNbr,
        equipmentType: acc.equipmentType,
        aircraftConfig: acc.aircraftConfig,
        activeDaysCount,
        legsCount: acc.legsCount,
        flightsCount: acc.flightNumbers.size,
        totalFlightMinutes: acc.totalFlightMinutes,
        totalTurnaroundMinutes: acc.totalTurnaroundMinutes,
        totalBlockMinutes,
        totalFlightHours,
        totalTurnaroundHours,
        totalBlockHours,
        avgDailyFlightHours,
        avgDailyBlockHours,
        avgLegMinutes,
        utilizationRatePct,
        flightNumbers: Array.from(acc.flightNumbers).sort(),
        routes: Array.from(acc.routes),
        timelineSegments: acc.timelineSegments,
      };
    })
    .sort((a, b) => b.totalBlockMinutes - a.totalBlockMinutes);

  // 7. Seat Occupancy Analytics (Row x Column Heatmap, Window/Aisle/Middle, Front/Mid/Rear Zones)
  const classifySeatPos = (col: string): SeatPositionType => {
    const c = col.toUpperCase();
    if (c === "A" || c === "F" || c === "L") return "WINDOW";
    if (c === "C" || c === "D" || c === "J" || c === "G") return "AISLE";
    if (c === "B" || c === "E" || c === "K" || c === "H") return "MIDDLE";
    return "OTHER";
  };

  let seatTotal = 0;
  let seatEcoTotal = 0;
  let seatBizTotal = 0;
  let rowSum = 0;
  let maxRowObserved = 0;

  const posMap: Record<SeatPositionType, { total: number; eco: number; biz: number }> = {
    WINDOW: { total: 0, eco: 0, biz: 0 },
    AISLE: { total: 0, eco: 0, biz: 0 },
    MIDDLE: { total: 0, eco: 0, biz: 0 },
    OTHER: { total: 0, eco: 0, biz: 0 },
  };
  const zoneMap: Record<"ZONE_A" | "ZONE_B" | "ZONE_C", { total: number; eco: number; biz: number }> = {
    ZONE_A: { total: 0, eco: 0, biz: 0 },
    ZONE_B: { total: 0, eco: 0, biz: 0 },
    ZONE_C: { total: 0, eco: 0, biz: 0 },
  };
  const colSet = new Set<string>();
  const rowMap = new Map<
    number,
    {
      row: number;
      total: number;
      eco: number;
      biz: number;
      cols: Record<string, { total: number; eco: number; biz: number }>;
    }
  >();
  const exactSeatMap = new Map<string, TopSeatRow>();

  for (const flight of flights) {
    for (const pax of flight.passengers) {
      if (!isPassengerWithSeat(pax)) continue;
      const rawSeat = (pax.seat || "").trim().toUpperCase();
      const match = rawSeat.match(/^0*([1-9][0-9]*)([A-Z])$/);
      if (!match) continue;
      const rowNum = parseInt(match[1], 10);
      const colChar = match[2];
      const isBiz = pax.cabinClass === "C";

      seatTotal += 1;
      if (isBiz) seatBizTotal += 1;
      else seatEcoTotal += 1;
      rowSum += rowNum;
      if (rowNum > maxRowObserved) maxRowObserved = rowNum;

      const pos = classifySeatPos(colChar);
      posMap[pos].total += 1;
      if (isBiz) posMap[pos].biz += 1;
      else posMap[pos].eco += 1;

      const zoneKey: "ZONE_A" | "ZONE_B" | "ZONE_C" =
        rowNum <= 10 ? "ZONE_A" : rowNum <= 29 ? "ZONE_B" : "ZONE_C";
      zoneMap[zoneKey].total += 1;
      if (isBiz) zoneMap[zoneKey].biz += 1;
      else zoneMap[zoneKey].eco += 1;

      colSet.add(colChar);
      const rEntry = rowMap.get(rowNum) || {
        row: rowNum,
        total: 0,
        eco: 0,
        biz: 0,
        cols: {},
      };
      rEntry.total += 1;
      if (isBiz) rEntry.biz += 1;
      else rEntry.eco += 1;
      if (!rEntry.cols[colChar]) rEntry.cols[colChar] = { total: 0, eco: 0, biz: 0 };
      rEntry.cols[colChar].total += 1;
      if (isBiz) rEntry.cols[colChar].biz += 1;
      else rEntry.cols[colChar].eco += 1;
      rowMap.set(rowNum, rEntry);

      const normSeat = `${rowNum}${colChar}`;
      const sEntry = exactSeatMap.get(normSeat) || {
        seat: normSeat,
        row: rowNum,
        col: colChar,
        position: pos,
        total: 0,
        eco: 0,
        biz: 0,
      };
      sEntry.total += 1;
      if (isBiz) sEntry.biz += 1;
      else sEntry.eco += 1;
      exactSeatMap.set(normSeat, sEntry);
    }
  }

  const COL_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"];
  const columns = Array.from(colSet).sort((a, b) => {
    const ia = COL_ORDER.indexOf(a);
    const ib = COL_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const positionMeta: Array<{ key: SeatPositionType; fr: string; en: string }> = [
    { key: "WINDOW", fr: "Hublot (A / F / L)", en: "Window (A / F / L)" },
    { key: "AISLE", fr: "Couloir (C / D / J)", en: "Aisle (C / D / J)" },
    { key: "MIDDLE", fr: "Milieu (B / E / K)", en: "Middle (B / E / K)" },
    { key: "OTHER", fr: "Autres lettres", en: "Other seats" },
  ];

  const positionBreakdown: SeatPositionRow[] = positionMeta
    .map((m) => ({
      position: m.key,
      labelFr: m.fr,
      labelEn: m.en,
      total: posMap[m.key].total,
      eco: posMap[m.key].eco,
      biz: posMap[m.key].biz,
      sharePct:
        seatTotal > 0 ? Number(((posMap[m.key].total / seatTotal) * 100).toFixed(1)) : 0,
    }))
    .filter((p) => p.total > 0 || p.position !== "OTHER");

  const zoneBreakdown: SeatZoneRow[] = [
    {
      zone: "ZONE_A",
      labelFr: "Zone A · Business (1–4)",
      labelEn: "Zone A · Business (1–4)",
      rowRange: "1–4",
      total: zoneMap.ZONE_A.total,
      eco: zoneMap.ZONE_A.eco,
      biz: zoneMap.ZONE_A.biz,
      sharePct:
        seatTotal > 0 ? Number(((zoneMap.ZONE_A.total / seatTotal) * 100).toFixed(1)) : 0,
    },
    {
      zone: "ZONE_B",
      labelFr: "Zone B (11–29)",
      labelEn: "Zone B (11–29)",
      rowRange: "11–29",
      total: zoneMap.ZONE_B.total,
      eco: zoneMap.ZONE_B.eco,
      biz: zoneMap.ZONE_B.biz,
      sharePct:
        seatTotal > 0 ? Number(((zoneMap.ZONE_B.total / seatTotal) * 100).toFixed(1)) : 0,
    },
    {
      zone: "ZONE_C",
      labelFr: "Zone C (30+)",
      labelEn: "Zone C (30+)",
      rowRange: "30+",
      total: zoneMap.ZONE_C.total,
      eco: zoneMap.ZONE_C.eco,
      biz: zoneMap.ZONE_C.biz,
      sharePct:
        seatTotal > 0 ? Number(((zoneMap.ZONE_C.total / seatTotal) * 100).toFixed(1)) : 0,
    },
  ];

  const rowHeatmap: SeatHeatmapRow[] = Array.from(rowMap.values()).sort(
    (a, b) => a.row - b.row
  );
  const topSeats: TopSeatRow[] = Array.from(exactSeatMap.values())
    .sort((a, b) => b.total - a.total || a.row - b.row || a.col.localeCompare(b.col))
    .slice(0, 12);

  const seatOccupancy: SeatOccupancyAnalytics = {
    totalSeatedPax: seatTotal,
    totalEcoSeated: seatEcoTotal,
    totalBizSeated: seatBizTotal,
    columns,
    positionBreakdown,
    zoneBreakdown,
    rowHeatmap,
    topSeats,
    avgRowOccupied: seatTotal > 0 ? Number((rowSum / seatTotal).toFixed(1)) : 0,
    maxRowOccupied: maxRowObserved,
  };

  return {
    kpis,
    segmentMetrics,
    dailySeries,
    flightNumberGroups,
    destinationBreakdown,
    originBreakdown,
    routeOndBreakdown,
    sectorPerformance,
    flightRouteFlows,
    unmappedMapFlights,
    bookingClassBreakdown,
    tailUtilization,
    equipmentSummary,
    noShowReport,
    aircraftTimeUtilization,
    seatOccupancy,
    webCheckinStationBreakdown,
  };
}

/**
 * Generates short/medium-term daily passenger & load factor forecasts
 * from historical daily series using OLS Linear Regression or Weighted Moving Average.
 */
export function computeTrafficForecast(
  dailySeries: DailyAnalyticsPoint[],
  horizonDays: number,
  method: ForecastMethod
): ForecastSummary {
  const n = dailySeries.length;
  if (n === 0) {
    return {
      points: [],
      horizonDays,
      method,
      historicalDaysCount: 0,
      avgDailyHistoricalPax: 0,
      avgDailyForecastPax: 0,
      avgDailyCapacityRef: null,
      projectedAvgLoadFactorPct: null,
      slopePerDay: 0,
      growthPctOverHorizon: 0,
      rSquared: 0,
    };
  }

  const paxValues = dailySeries.map((d) => d.traveledTotal);
  const ecoValues = dailySeries.map((d) => d.traveledEco);
  const bizValues = dailySeries.map((d) => d.traveledBiz);

  const avgDailyHistoricalPax = Math.round(
    paxValues.reduce((s, v) => s + v, 0) / n
  );

  const daysWithCap = dailySeries.filter((d) => d.offeredCapacity > 0);
  const avgDailyCapacityRef =
    daysWithCap.length > 0
      ? Math.round(
          daysWithCap.reduce((s, d) => s + d.offeredCapacity, 0) /
            daysWithCap.length
        )
      : null;

  let slope = 0;
  let intercept = avgDailyHistoricalPax;
  let rSquared = 0;
  let stdErr = Math.max(10, Math.round(avgDailyHistoricalPax * 0.08));

  if (n >= 2) {
    const xMean = (n - 1) / 2;
    const yMean = paxValues.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (paxValues[i] - yMean);
      den += (i - xMean) * (i - xMean);
    }
    slope = den > 0 ? num / den : 0;
    intercept = yMean - slope * xMean;

    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const pred = intercept + slope * i;
      ssRes += (paxValues[i] - pred) ** 2;
      ssTot += (paxValues[i] - yMean) ** 2;
    }
    rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
    if (n > 2) {
      stdErr = Math.max(8, Math.sqrt(ssRes / (n - 2)));
    }
  }

  const sumEco = ecoValues.reduce((s, v) => s + v, 0);
  const sumBiz = bizValues.reduce((s, v) => s + v, 0);
  const sumTotal = sumEco + sumBiz;
  const bizRatio = sumTotal > 0 ? sumBiz / sumTotal : 0.08;

  const wmaWindow = Math.min(n, 7);
  let wmaBase = avgDailyHistoricalPax;
  if (wmaWindow > 0) {
    let wSum = 0;
    let valSum = 0;
    const startIdx = n - wmaWindow;
    for (let i = 0; i < wmaWindow; i++) {
      const w = i + 1;
      wSum += w;
      valSum += w * paxValues[startIdx + i];
    }
    wmaBase = valSum / Math.max(1, wSum);
  }

  const points: ForecastPoint[] = dailySeries.map((d, idx) => ({
    label: d.dateKey,
    isForecast: false,
    historicalPax: d.traveledTotal,
    historicalEco: d.traveledEco,
    historicalBiz: d.traveledBiz,
    forecastPax: idx === n - 1 ? d.traveledTotal : null,
    forecastEco: idx === n - 1 ? d.traveledEco : null,
    forecastBiz: idx === n - 1 ? d.traveledBiz : null,
    forecastLow: idx === n - 1 ? d.traveledTotal : null,
    forecastHigh: idx === n - 1 ? d.traveledTotal : null,
    offeredCapacityRef:
      d.offeredCapacity > 0 ? d.offeredCapacity : avgDailyCapacityRef,
    projectedLoadFactorPct: d.loadFactorPct,
  }));

  const lastDateKey = dailySeries[n - 1].dateKey;
  const forecastTotals: number[] = [];

  for (let step = 1; step <= horizonDays; step++) {
    const rawProj =
      method === "LINEAR"
        ? intercept + slope * (n - 1 + step)
        : wmaBase + slope * 0.35 * step;

    const projPax = Math.max(0, Math.round(rawProj));
    const projBiz = Math.round(projPax * bizRatio);
    const projEco = Math.max(0, projPax - projBiz);
    const band = Math.round(stdErr * (1 + step * 0.08));
    const forecastLow = Math.max(0, projPax - band);
    const forecastHigh = projPax + band;

    forecastTotals.push(projPax);

    const lf =
      avgDailyCapacityRef && avgDailyCapacityRef > 0
        ? Number(((projPax / avgDailyCapacityRef) * 100).toFixed(1))
        : null;

    points.push({
      label: addDaysToDcsDate(lastDateKey, step),
      isForecast: true,
      historicalPax: null,
      historicalEco: null,
      historicalBiz: null,
      forecastPax: projPax,
      forecastEco: projEco,
      forecastBiz: projBiz,
      forecastLow,
      forecastHigh,
      offeredCapacityRef: avgDailyCapacityRef,
      projectedLoadFactorPct: lf,
    });
  }

  const avgDailyForecastPax = Math.round(
    forecastTotals.reduce((s, v) => s + v, 0) /
      Math.max(1, forecastTotals.length)
  );
  const projectedAvgLoadFactorPct =
    avgDailyCapacityRef && avgDailyCapacityRef > 0
      ? Number(((avgDailyForecastPax / avgDailyCapacityRef) * 100).toFixed(1))
      : null;

  const lastHistPax = dailySeries[n - 1].traveledTotal;
  const lastForecastPax =
    forecastTotals[forecastTotals.length - 1] ?? lastHistPax;
  const growthPctOverHorizon =
    lastHistPax > 0
      ? Number((((lastForecastPax - lastHistPax) / lastHistPax) * 100).toFixed(1))
      : 0;

  return {
    points,
    horizonDays,
    method,
    historicalDaysCount: n,
    avgDailyHistoricalPax,
    avgDailyForecastPax,
    avgDailyCapacityRef,
    projectedAvgLoadFactorPct,
    slopePerDay: Number(slope.toFixed(1)),
    growthPctOverHorizon,
    rSquared: Number(rSquared.toFixed(2)),
  };
}
