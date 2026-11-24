/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FlightScheduleParseResult,
  FlightSegment,
  FlightStatusDetail,
  FlightStatusLeg,
} from "../types";
import { downloadAnsiFile, formatFlightTime } from "./flightParser";

const FLIGHT_STATUS_STORAGE_KEY = "kp_flight_status_details_v1";

export function normalizeStatusFlightNumber(flightNumber: string): string {
  const cleaned = (flightNumber || "").trim().toUpperCase().replace(/^KP\s*/i, "");
  return cleaned.replace(/^0+/, "") || cleaned || "0";
}

export function normalizeStatusDate(rawDate: string): string {
  const clean = (rawDate || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})(?:\d{2,4})?$/);
  if (!match) return clean;
  return `${match[1].padStart(2, "0")}${match[2]}`;
}

export function formatBoardingTime(rawTime: string): string {
  const cleaned = (rawTime || "").trim();
  if (/^\d{4}$/.test(cleaned)) {
    return `${cleaned.slice(0, 2)}h${cleaned.slice(2, 4)}`;
  }
  return cleaned;
}

export function buildFlightStatusId(
  flightNumber: string,
  date: string,
  origin: string
): string {
  return `${normalizeStatusFlightNumber(flightNumber)}|${normalizeStatusDate(date)}|${(origin || "").trim().toUpperCase()}`;
}

// Generates PTRG* extraction commands in ANSI format:
// WINCMD("PTRG*/KP22/19NOVLFW/D")
export function generatePtrgDetailCommands(segments: FlightSegment[]): {
  commands: string[];
  text: string;
  uniqueCount: number;
} {
  const seen = new Set<string>();
  const commands: string[] = [];

  for (const seg of segments) {
    const num = normalizeStatusFlightNumber(seg.flightNumber);
    const date = (seg.date || "").trim().toUpperCase();
    const origin = (seg.origin || "").trim().toUpperCase();
    if (!num || !date || !origin) continue;
    const key = `${num}|${date}|${origin}`;
    if (seen.has(key)) continue;
    seen.add(key);
    commands.push(seg.ptrgWincmd || `WINCMD("PTRG*/KP${num}/${date}${origin}/D")`);
  }

  return {
    commands,
    text: commands.length > 0 ? commands.join("\r\n") + "\r\n" : "",
    uniqueCount: commands.length,
  };
}

export function downloadPtrgDetailCommandsAnsi(
  segments: FlightSegment[],
  date: string,
  prefix = "WINCMD_DETAILS_VOLS"
): number {
  const { text, uniqueCount } = generatePtrgDetailCommands(segments);
  if (uniqueCount === 0) return 0;
  downloadAnsiFile(`${prefix}_${date}_PTRG_ANSI.txt`, text);
  return uniqueCount;
}

function parseSingleFlightStatusBlock(rawBlock: string): FlightStatusDetail | null {
  const cleanBlock = rawBlock.replace(/\f/g, "").trim();
  if (!cleanBlock) return null;

  const lines = cleanBlock
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, ""))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return null;

  let queryCommand = "";
  let airline = "KP";
  let flightNumber = "";
  let date = "";
  let origin = "";
  let gate = "";
  let etaHeader = "";
  let etdHeader = "";
  let headerStatus = "";
  let aircraftType = "";
  let cfg = "";
  let registration = "";
  let seatsRaw = "";
  let businessCapacity = 0;
  let economyCapacity = 0;
  let boardingTime = "";
  let boardingTimeFormatted = "";
  let autoOn = "";
  let ckInRule = "";
  let bagPw = "";
  let heldst = "";
  let som = "";
  let app = "";
  let footerTimestamp = "";
  const legs: FlightStatusLeg[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 1. Query line: G*/KP22/18NOVLFW/D
    const queryMatch = trimmed.match(
      /^(?:PT)?R?G\*\/([A-Z]{2})\s*(\d+)\/(\d{1,2}[A-Z]{3})([A-Z]{3})(?:\/[A-Z]+)?$/i
    );
    if (queryMatch) {
      queryCommand = trimmed;
      airline = queryMatch[1].toUpperCase();
      flightNumber = normalizeStatusFlightNumber(queryMatch[2]);
      date = normalizeStatusDate(queryMatch[3]);
      origin = queryMatch[4].toUpperCase();
      continue;
    }

    // 2. Header status line: KP      22  18NOV  LFW   GATE-6   ETA-ORIG  ETD-1230  PDC
    const headerMatch = trimmed.match(
      /^([A-Z]{2})\s+(\d+)\s+(\d{1,2}[A-Z]{3})\s+([A-Z]{3})\b(.*)$/i
    );
    if (headerMatch && (trimmed.includes("GATE-") || trimmed.includes("ETD-") || trimmed.includes("ETA-"))) {
      airline = headerMatch[1].toUpperCase();
      flightNumber = normalizeStatusFlightNumber(headerMatch[2]);
      date = normalizeStatusDate(headerMatch[3]);
      origin = headerMatch[4].toUpperCase();
      const rest = headerMatch[5] || "";

      const gateMatch = rest.match(/GATE-([A-Z0-9]+)/i);
      if (gateMatch) gate = gateMatch[1].toUpperCase();

      const etaMatch = rest.match(/ETA-([A-Z0-9]+)/i);
      if (etaMatch) etaHeader = etaMatch[1].toUpperCase();

      const etdMatch = rest.match(/ETD-([A-Z0-9]+)/i);
      if (etdMatch) etdHeader = etdMatch[1].toUpperCase();

      // Trailing status token after ETD-... e.g. PDC, CLS, OPN, CNL, FIN
      const afterEtd = rest.replace(/.*ETD-[A-Z0-9]+/i, "").trim();
      if (afterEtd) {
        const stMatch = afterEtd.match(/^([A-Z]{2,5})\b/i);
        if (stMatch) headerStatus = stMatch[1].toUpperCase();
      }
      continue;
    }

    // 3. Aircraft line: ACFT-737    CFG-4      REG-ETBAR
    if (/ACFT-/i.test(trimmed) || /REG-/i.test(trimmed)) {
      const acftMatch = trimmed.match(/ACFT-([A-Z0-9]+)/i);
      if (acftMatch) aircraftType = acftMatch[1].toUpperCase();

      const cfgMatch = trimmed.match(/CFG-([A-Z0-9]+)/i);
      if (cfgMatch) cfg = cfgMatch[1].toUpperCase();

      const regMatch = trimmed.match(/REG-([A-Z0-9]+)/i);
      if (regMatch) registration = regMatch[1].toUpperCase();
      continue;
    }

    // 4. Seats line: SEATS-16/144 or SEATS-183
    const seatsMatch = trimmed.match(/SEATS-\s*(\d+)(?:\s*\/\s*(\d+))?/i);
    if (seatsMatch) {
      if (seatsMatch[2] !== undefined) {
        businessCapacity = parseInt(seatsMatch[1], 10) || 0;
        economyCapacity = parseInt(seatsMatch[2], 10) || 0;
        seatsRaw = `${businessCapacity}/${economyCapacity}`;
      } else {
        businessCapacity = 0;
        economyCapacity = parseInt(seatsMatch[1], 10) || 0;
        seatsRaw = `${economyCapacity}`;
      }
      continue;
    }

    // 5. Operational rules line: AUTO-ON OFF  CK-IN RULE-4  BAG-PW  HELDST-ON  SOM-NN
    if (/AUTO-ON/i.test(trimmed) || /CK-IN/i.test(trimmed) || /HELDST-/i.test(trimmed)) {
      const autoMatch = trimmed.match(/AUTO-ON\s+([A-Z0-9]+)/i);
      if (autoMatch) autoOn = autoMatch[1].toUpperCase();

      const ckinMatch = trimmed.match(/CK-IN\s+RULE-([A-Z0-9]+)/i);
      if (ckinMatch) ckInRule = ckinMatch[1].toUpperCase();

      const bagMatch = trimmed.match(/BAG-([A-Z0-9]+)/i);
      if (bagMatch) bagPw = bagMatch[1].toUpperCase();

      const heldMatch = trimmed.match(/HELDST-([A-Z0-9]+)/i);
      if (heldMatch) heldst = heldMatch[1].toUpperCase();

      const somMatch = trimmed.match(/SOM-([A-Z0-9]+)/i);
      if (somMatch) som = somMatch[1].toUpperCase();
      continue;
    }

    // 6. Boarding time line: BOARDING TIME-1130                                    APP
    if (/BOARDING\s+TIME-/i.test(trimmed)) {
      const btMatch = trimmed.match(/BOARDING\s+TIME-(\d{4})/i);
      if (btMatch) {
        boardingTime = btMatch[1];
        boardingTimeFormatted = formatBoardingTime(boardingTime);
      }
      const appMatch = trimmed.match(/\b(APP)\b/i);
      if (appMatch) app = appMatch[1].toUpperCase();
      continue;
    }

    // 7. Footer timestamp: HDQ.HDQ8HEA 0508 19-NOV-2026 707E88
    if (/^HDQ\./i.test(trimmed)) {
      footerTimestamp = trimmed;
      continue;
    }

    // 8. Itinerary leg lines:
    //  LFW    PDC                   1230    18NOV      D-N  T-N  A-N
    //  ACC    PDC          1325     1400    18NOV      D-N  T-N  A-N
    //  BJL                 1815                        D-N  T-N  A-N
    const legStartMatch = trimmed.match(/^([A-Z]{3})\b(.*)$/);
    if (legStartMatch && (/\bD-[A-Z0-9]+\b/i.test(trimmed) || /\b\d{4}\b/.test(trimmed))) {
      const station = legStartMatch[1].toUpperCase();
      let remainder = legStartMatch[2] || "";

      const dFlagMatch = remainder.match(/\bD-([A-Z0-9]+)\b/i);
      const tFlagMatch = remainder.match(/\bT-([A-Z0-9]+)\b/i);
      const aFlagMatch = remainder.match(/\bA-([A-Z0-9]+)\b/i);

      remainder = remainder
        .replace(/\b[DTA]-[A-Z0-9]+\b/gi, " ")
        .trim();

      const dateMatch = remainder.match(/\b(\d{1,2}[A-Z]{3})\b/i);
      const legDate = dateMatch ? normalizeStatusDate(dateMatch[1]) : "";
      if (dateMatch) {
        remainder = remainder.replace(dateMatch[0], " ").trim();
      }

      const timeMatches = Array.from(remainder.matchAll(/\b(\d{4})(\*?)/g));
      const nonTimeHead = remainder.replace(/\b\d{4}\*?/g, " ").trim();
      const statusMatch = nonTimeHead.match(/^([A-Z]{2,5})\b/i);
      const legStatus = statusMatch ? statusMatch[1].toUpperCase() : "";

      let eta = "";
      let etd = "";
      let etaActual = false;
      let etdActual = false;
      if (timeMatches.length >= 2) {
        eta = timeMatches[0][1];
        etaActual = Boolean(timeMatches[0][2]);
        etd = timeMatches[1][1];
        etdActual = Boolean(timeMatches[1][2]);
      } else if (timeMatches.length === 1) {
        // Origin/departure leg carries a date and ETD; final destination leg has no date and carries ETA
        if (legDate || (station === origin && etaHeader === "ORIG")) {
          etd = timeMatches[0][1];
          etdActual = Boolean(timeMatches[0][2]);
        } else {
          eta = timeMatches[0][1];
          etaActual = Boolean(timeMatches[0][2]);
        }
      }

      legs.push({
        station,
        status: legStatus,
        eta,
        etd,
        etaActual: etaActual || undefined,
        etdActual: etdActual || undefined,
        date: legDate,
        dFlag: dFlagMatch?.[1]?.toUpperCase(),
        tFlag: tFlagMatch?.[1]?.toUpperCase(),
        aFlag: aFlagMatch?.[1]?.toUpperCase(),
        rawLine: line,
      });
    }
  }

  if (!flightNumber || !origin) return null;

  // Read status on the row matching departure station (e.g. LFW -> PDC, DLA -> PDC)
  const originLeg = legs.find((l) => l.station === origin);
  const departureStatus = originLeg?.status || headerStatus || "";
  const totalCapacity = businessCapacity + economyCapacity;

  return {
    id: buildFlightStatusId(flightNumber, date, origin),
    queryCommand: queryCommand || `G*/${airline}${flightNumber}/${date}${origin}/D`,
    airline,
    flightNumber,
    date,
    origin,
    gate,
    etaHeader,
    etdHeader,
    headerStatus,
    aircraftType,
    cfg,
    registration,
    seatsRaw,
    businessCapacity,
    economyCapacity,
    totalCapacity,
    boardingTime,
    boardingTimeFormatted,
    autoOn,
    ckInRule,
    bagPw,
    heldst,
    som,
    app,
    departureStatus,
    legs,
    footerTimestamp: footerTimestamp || undefined,
    rawBlock: cleanBlock,
  };
}

/**
 * Parses a DCS flight details output file (e.g. Flight_status.txt containing G* / KP... blocks)
 */
export function parseFlightStatusFile(rawText: string): FlightStatusDetail[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize form-feeds or split directly before G*/KP... lines
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawBlocks = normalized.split(/(?=(?:^|\n|\f)\s*(?:PT)?R?G\*\/[A-Z]{2}\s*\d+)/i);

  const byId = new Map<string, FlightStatusDetail>();
  for (const blk of rawBlocks) {
    const parsed = parseSingleFlightStatusBlock(blk);
    if (parsed) {
      byId.set(parsed.id, parsed);
    }
  }

  return Array.from(byId.values());
}

export function mergeFlightStatusDetails(
  existing: FlightStatusDetail[],
  incoming: FlightStatusDetail[]
): FlightStatusDetail[] {
  const byId = new Map<string, FlightStatusDetail>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function loadStoredFlightStatusDetails(): FlightStatusDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FLIGHT_STATUS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlightStatusDetail[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredFlightStatusDetails(details: FlightStatusDetail[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLIGHT_STATUS_STORAGE_KEY, JSON.stringify(details));
  } catch {
    // Ignore storage quota issues
  }
}

export type FlightStatusMatchLevel = "EXACT" | "NONE";

export interface ResolvedFlightStatus {
  detail: FlightStatusDetail | null;
  resolvedStatus: string;
  matchLevel: FlightStatusMatchLevel;
}

/**
 * Strictly resolves aircraft registration, seat capacity, and departure station status
 * for a specific flight using the composite key (flightNumber + date + origin).
 * No fallback across different dates, different origins, or aircraft types.
 */
export function resolveFlightStatusDetail(
  flightNumber: string,
  date: string,
  origin: string,
  details: FlightStatusDetail[] | undefined | null
): ResolvedFlightStatus {
  if (!details || details.length === 0) {
    return { detail: null, resolvedStatus: "", matchLevel: "NONE" };
  }

  const normFn = normalizeStatusFlightNumber(flightNumber);
  const normDate = normalizeStatusDate(date);
  const normOrigin = (origin || "").trim().toUpperCase();

  if (!normFn || !normDate || !normOrigin) {
    return { detail: null, resolvedStatus: "", matchLevel: "NONE" };
  }

  const exact = details.find(
    (d) =>
      normalizeStatusFlightNumber(d.flightNumber) === normFn &&
      normalizeStatusDate(d.date) === normDate &&
      (d.origin || "").trim().toUpperCase() === normOrigin
  );

  if (!exact) {
    return { detail: null, resolvedStatus: "", matchLevel: "NONE" };
  }

  const leg = exact.legs.find((l) => l.station === normOrigin);
  return {
    detail: exact,
    resolvedStatus: leg?.status || exact.departureStatus || exact.headerStatus,
    matchLevel: "EXACT",
  };
}

function findArrivalInLegs(
  legs: FlightStatusLeg[],
  origin: string,
  destination: string
): { arrTime: string; isActual: boolean } | null {
  if (!legs || legs.length === 0 || !destination) return null;
  const originIdx = legs.findIndex((l) => l.station === origin);

  if (originIdx >= 0) {
    for (let i = originIdx + 1; i < legs.length; i++) {
      if (legs[i].station === destination && legs[i].eta) {
        return {
          arrTime: legs[i].eta,
          isActual: Boolean(legs[i].etaActual),
        };
      }
    }
    // Fallback to immediate next leg if destination is the immediate next stop
    const nextLeg = legs[originIdx + 1];
    if (nextLeg && nextLeg.station === destination && nextLeg.eta) {
      return {
        arrTime: nextLeg.eta,
        isActual: Boolean(nextLeg.etaActual),
      };
    }
  } else {
    const destLeg = legs.find((l) => l.station === destination && Boolean(l.eta));
    if (destLeg) {
      return {
        arrTime: destLeg.eta,
        isActual: Boolean(destLeg.etaActual),
      };
    }
  }
  return null;
}

/**
 * Resolves a segment's arrival time (e.g. from GD* schedules where arrival time is omitted)
 * using imported PTRG* flight status details (legs ETA/ATA such as "LFW 1029*").
 */
export function resolveArrivalTimeFromStatusDetail(
  segment: Pick<FlightSegment, "flightNumber" | "date" | "origin" | "destination">,
  details: FlightStatusDetail[] | undefined | null
): { arrTime: string; isActual: boolean } | null {
  if (!details || details.length === 0) return null;

  const normFn = normalizeStatusFlightNumber(segment.flightNumber);
  const normDate = normalizeStatusDate(segment.date);
  const normOrigin = (segment.origin || "").trim().toUpperCase();
  const normDest = (segment.destination || "").trim().toUpperCase();
  if (!normFn || !normDate || !normOrigin || !normDest) return null;

  // 1. Primary lookup: PTRG* record matching (flightNumber, date, origin)
  const exact = details.find(
    (d) =>
      normalizeStatusFlightNumber(d.flightNumber) === normFn &&
      normalizeStatusDate(d.date) === normDate &&
      (d.origin || "").trim().toUpperCase() === normOrigin
  );
  if (exact && !exact.isManualOnly && exact.legs.length > 0) {
    const found = findArrivalInLegs(exact.legs, normOrigin, normDest);
    if (found) return found;
  }

  // 2. Fallback lookup: another PTRG* record of the same (flightNumber, date) containing the full itinerary
  const sameFlightDetails = details.filter(
    (d) =>
      !d.isManualOnly &&
      normalizeStatusFlightNumber(d.flightNumber) === normFn &&
      normalizeStatusDate(d.date) === normDate &&
      d.legs.length > 0
  );
  for (const candidate of sameFlightDetails) {
    const originIdx = candidate.legs.findIndex((l) => l.station === normOrigin);
    if (originIdx >= 0) {
      const found = findArrivalInLegs(candidate.legs, normOrigin, normDest);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Enriches flight segments missing scheduled arrival time (notably GD* station lists)
 * with arrival times resolved from PTRG* flight status details.
 */
export function enrichScheduleSegmentsWithStatusDetails(
  segments: FlightSegment[],
  details: FlightStatusDetail[] | undefined | null
): FlightSegment[] {
  if (!segments || segments.length === 0) return segments;
  if (!details || details.length === 0) {
    return segments.map((s) =>
      s.arrFromPtrg
        ? {
            ...s,
            schedArr: "",
            schedArrFormatted: "",
            arrFromPtrg: false,
            arrIsActualFromPtrg: false,
          }
        : s
    );
  }

  return segments.map((seg) => {
    const hasNativeSchedArr = Boolean(seg.schedArr) && !seg.arrFromPtrg;
    if (hasNativeSchedArr) return seg;

    const resolved = resolveArrivalTimeFromStatusDetail(seg, details);
    if (resolved) {
      return {
        ...seg,
        schedArr: resolved.arrTime,
        schedArrFormatted: formatFlightTime(resolved.arrTime),
        arrFromPtrg: true,
        arrIsActualFromPtrg: resolved.isActual,
      };
    }

    if (seg.arrFromPtrg) {
      return {
        ...seg,
        schedArr: "",
        schedArrFormatted: "",
        arrFromPtrg: false,
        arrIsActualFromPtrg: false,
      };
    }
    return seg;
  });
}

export function enrichScheduleResultWithStatusDetails(
  schedule: FlightScheduleParseResult | null,
  details: FlightStatusDetail[] | undefined | null
): FlightScheduleParseResult | null {
  if (!schedule) return null;
  return {
    ...schedule,
    segments: enrichScheduleSegmentsWithStatusDetails(schedule.segments, details),
  };
}

export interface FleetEquipmentProfile {
  registration: string;
  aircraftType: string;
  cfg: string;
  businessCapacity: number;
  economyCapacity: number;
  totalCapacity: number;
  usageCount: number;
}

export function extractKnownFleetProfiles(
  details: FlightStatusDetail[]
): FleetEquipmentProfile[] {
  const byReg = new Map<string, FleetEquipmentProfile>();
  for (const d of details) {
    const reg = (d.registration || "").trim().toUpperCase();
    const acType = (d.aircraftType || "").trim().toUpperCase();
    if (!reg && !acType) continue;
    const key = reg || `${acType}-${d.businessCapacity}/${d.economyCapacity}`;
    const existing = byReg.get(key);
    if (existing) {
      existing.usageCount += 1;
      if (d.totalCapacity > 0 && existing.totalCapacity === 0) {
        existing.businessCapacity = d.businessCapacity;
        existing.economyCapacity = d.economyCapacity;
        existing.totalCapacity = d.totalCapacity;
        existing.aircraftType = acType || existing.aircraftType;
        existing.cfg = d.cfg || existing.cfg;
      }
    } else {
      byReg.set(key, {
        registration: reg,
        aircraftType: acType,
        cfg: (d.cfg || "").trim().toUpperCase(),
        businessCapacity: d.businessCapacity || 0,
        economyCapacity: d.economyCapacity || 0,
        totalCapacity:
          d.totalCapacity || (d.businessCapacity || 0) + (d.economyCapacity || 0),
        usageCount: 1,
      });
    }
  }

  return Array.from(byReg.values()).sort(
    (a, b) => b.usageCount - a.usageCount || a.registration.localeCompare(b.registration)
  );
}

export interface ManualEquipmentInput {
  airline?: string;
  flightNumber: string;
  date: string;
  origin: string;
  aircraftType: string;
  registration: string;
  businessCapacity: number;
  economyCapacity: number;
  cfg?: string;
  etdHeader?: string;
  gate?: string;
  existingDetail?: FlightStatusDetail | null;
}

export function buildManualFlightStatusDetail(
  input: ManualEquipmentInput
): FlightStatusDetail {
  const airline = (input.airline || input.existingDetail?.airline || "KP").trim().toUpperCase();
  const flightNumber = normalizeStatusFlightNumber(input.flightNumber);
  const date = normalizeStatusDate(input.date);
  const origin = (input.origin || "").trim().toUpperCase();
  const aircraftType = (input.aircraftType || "").trim().toUpperCase();
  const registration = (input.registration || "").trim().toUpperCase();
  const businessCapacity = Math.max(0, Math.round(input.businessCapacity || 0));
  const economyCapacity = Math.max(0, Math.round(input.economyCapacity || 0));
  const totalCapacity = businessCapacity + economyCapacity;
  const seatsRaw =
    businessCapacity > 0
      ? `${businessCapacity}/${economyCapacity}`
      : `${economyCapacity}`;
  const cfg = (input.cfg ?? input.existingDetail?.cfg ?? "").trim().toUpperCase();
  const id = input.existingDetail?.id || buildFlightStatusId(flightNumber, date, origin);

  if (input.existingDetail) {
    const existing = input.existingDetail;
    const originalEquipmentSnapshot =
      existing.originalEquipmentSnapshot ||
      (!existing.isManualOnly
        ? {
            aircraftType: existing.aircraftType,
            cfg: existing.cfg,
            registration: existing.registration,
            seatsRaw: existing.seatsRaw,
            businessCapacity: existing.businessCapacity,
            economyCapacity: existing.economyCapacity,
            totalCapacity: existing.totalCapacity,
          }
        : undefined);

    return {
      ...existing,
      id,
      aircraftType,
      cfg,
      registration,
      seatsRaw,
      businessCapacity,
      economyCapacity,
      totalCapacity,
      isManualOverride: true,
      originalEquipmentSnapshot,
    };
  }

  return {
    id,
    queryCommand: `G*/${airline}${flightNumber}/${date}${origin}/D`,
    airline,
    flightNumber,
    date,
    origin,
    gate: (input.gate || "").trim().toUpperCase(),
    etaHeader: "ORIG",
    etdHeader: (input.etdHeader || "").replace(":", "").trim(),
    headerStatus: "",
    aircraftType,
    cfg,
    registration,
    seatsRaw,
    businessCapacity,
    economyCapacity,
    totalCapacity,
    boardingTime: "",
    boardingTimeFormatted: "",
    autoOn: "",
    ckInRule: "",
    bagPw: "",
    heldst: "",
    som: "",
    app: "",
    departureStatus: "",
    legs: [],
    rawBlock: `MANUAL EQUIPMENT OVERRIDE: ${airline}${flightNumber}/${date}${origin} ACFT-${aircraftType} REG-${registration} SEATS-${seatsRaw}`,
    isManualOverride: true,
    isManualOnly: true,
  };
}

export function restoreOriginalFlightEquipment(
  detail: FlightStatusDetail
): FlightStatusDetail | null {
  if (!detail.originalEquipmentSnapshot) return null;
  const snap = detail.originalEquipmentSnapshot;
  return {
    ...detail,
    aircraftType: snap.aircraftType,
    cfg: snap.cfg,
    registration: snap.registration,
    seatsRaw: snap.seatsRaw,
    businessCapacity: snap.businessCapacity,
    economyCapacity: snap.economyCapacity,
    totalCapacity: snap.totalCapacity,
    isManualOverride: false,
    originalEquipmentSnapshot: undefined,
  };
}

export function upsertFlightStatusDetail(
  existing: FlightStatusDetail[],
  detail: FlightStatusDetail
): FlightStatusDetail[] {
  return mergeFlightStatusDetails(existing, [detail]);
}

export function removeFlightStatusDetailById(
  existing: FlightStatusDetail[],
  id: string
): FlightStatusDetail[] {
  return existing.filter((d) => d.id !== id);
}

