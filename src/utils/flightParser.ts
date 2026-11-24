/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { FlightSegment, FlightScheduleParseResult } from "../types";

/**
 * Format raw 4-digit military time (e.g. 1415) into HH:MM (14:15)
 */
export function formatFlightTime(time: string): string {
  if (!time) return "";
  const cleaned = time.trim();
  if (cleaned.length === 4 && /^\d{4}$/.test(cleaned)) {
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
  }
  return cleaned;
}

export function isGdDepartureListText(rawText: string): boolean {
  if (!rawText) return false;
  return (
    /GD\*[A-Z]{3}\/\d{1,2}[A-Z]{3}/i.test(rawText) ||
    /DAILY\s+(?:DEPARTURE\s+)?FLIGHT\s+LIST/i.test(rawText) ||
    (/LINE\s+ALN\s+FLT/i.test(rawText) && /DEP\s+DEP\s+DEP\s+DEP/i.test(rawText))
  );
}

/**
 * Parse scheduled flights text log (VDS / SCHEDULED FLIGHTS or GD* station departure lists)
 */
export function parseFlightSchedule(rawText: string): FlightScheduleParseResult {
  if (isGdDepartureListText(rawText)) {
    return parseGdFlightSchedule(rawText);
  }
  const lines = rawText.split(/\r?\n/);
  
  // 1. Extract Date from header
  let detectedDate = "";
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    // e.g. "SCHEDULED FLIGHTS - 10NOV" or "VDS/10NOV"
    const schedMatch = line.match(/SCHEDULED\s+FLIGHTS\s*-\s*([0-9]{1,2}[A-Z]{3})/i);
    if (schedMatch) {
      detectedDate = schedMatch[1].toUpperCase();
      break;
    }
    const vdsMatch = line.match(/VDS\/([0-9]{1,2}[A-Z]{3})/i);
    if (vdsMatch) {
      detectedDate = vdsMatch[1].toUpperCase();
      break;
    }
  }

  // Fallback date if none found
  if (!detectedDate) {
    const generalDateMatch = rawText.match(/\b([0-9]{1,2}[A-Z]{3})\b/);
    detectedDate = generalDateMatch ? generalDateMatch[1].toUpperCase() : "10NOV";
  }

  const segments: FlightSegment[] = [];
  let currentFlightNumber = "";
  let currentSegmentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines, headers, metadata lines
    if (!trimmed) continue;
    if (trimmed.startsWith("VDS/") || 
        trimmed.includes("SCHEDULED FLIGHTS") || 
        trimmed.includes("DEP/ARR") || 
        trimmed.includes("STATION") || 
        trimmed.startsWith("FLT") || 
        trimmed.startsWith("END") || 
        trimmed.startsWith("HDQ.") ||
        trimmed.startsWith("\x0c")) {
      continue;
    }

    // Look for station pair pattern: e.g. "LFW/ABJ" or "CKY/NKC"
    const stationMatch = rawLine.match(/\b([A-Z]{3})\/([A-Z]{3})\b/);
    if (!stationMatch || stationMatch.index === undefined) {
      continue;
    }

    const origin = stationMatch[1].toUpperCase();
    const destination = stationMatch[2].toUpperCase();
    const stationIndex = stationMatch.index;

    // Check what is before the station pair
    const prefix = rawLine.substring(0, stationIndex).trim();
    let isSubSegment = false;

    if (prefix) {
      const flightNumMatch = prefix.match(/\d+/);
      if (flightNumMatch) {
        currentFlightNumber = flightNumMatch[0];
        currentSegmentIndex = 0;
        isSubSegment = false;
      }
    } else {
      // No flight number on this line -> inherits flight number from previous line
      isSubSegment = true;
      currentSegmentIndex++;
    }

    if (!currentFlightNumber) {
      // If we somehow didn't catch a flight number yet, skip or use placeholder
      continue;
    }

    // Look at everything after the station pair
    const afterStation = rawLine.substring(stationIndex + stationMatch[0].length).trim();
    // Example: "1415/1545" or "0930/1100 0930/" or "0730/0930 0733/"
    const tokens = afterStation.split(/\s+/).filter(Boolean);

    let schedDep = "";
    let schedArr = "";
    let actualDep = "";
    let actualArr = "";

    if (tokens.length > 0) {
      const schedToken = tokens[0];
      const schedParts = schedToken.split("/");
      schedDep = schedParts[0] || "";
      schedArr = schedParts[1] || "";
    }

    if (tokens.length > 1) {
      const actToken = tokens[1];
      const actParts = actToken.split("/");
      actualDep = actParts[0] || "";
      actualArr = actParts[1] || "";
    }

    // 1. Classification : 2 digits = Opéré par KP, > 2 digits = Codeshare opéré par une autre compagnie
    const isKpOperated = currentFlightNumber.length <= 2;
    const carrierType: "KP_OPERATED" | "CODESHARE" = isKpOperated ? "KP_OPERATED" : "CODESHARE";
    const status: "Opéré par KP" | "Codeshare (Info)" = isKpOperated ? "Opéré par KP" : "Codeshare (Info)";

    // 2. Gestion des horaires système
    // Note : Rien ne permet d'affirmer si un vol est parti à l'heure ou en retard.
    // Les horaires affichés sont ceux saisis dans le système.
    const hasSystemAdjustment = Boolean(actualDep || actualArr);
    let systemAdjustmentNote = "Non renseigné dans le système";

    if (hasSystemAdjustment) {
      if (actualDep && schedDep && actualDep.length === 4 && schedDep.length === 4) {
        const aH = parseInt(actualDep.slice(0, 2), 10);
        const aM = parseInt(actualDep.slice(2, 4), 10);
        const sH = parseInt(schedDep.slice(0, 2), 10);
        const sM = parseInt(schedDep.slice(2, 4), 10);
        let diff = (aH * 60 + aM) - (sH * 60 + sM);
        if (diff > 720) diff -= 1440;
        if (diff < -720) diff += 1440;

        if (diff === 0) {
          systemAdjustmentNote = "Ajustement système : identique à l'estimé (0 min)";
        } else if (diff > 0) {
          systemAdjustmentNote = `Ajustement système : départ saisi à +${diff} min`;
        } else {
          systemAdjustmentNote = `Ajustement système : départ saisi à ${diff} min`;
        }
      } else if (actualDep) {
        systemAdjustmentNote = `Ajustement système : départ saisi ${formatFlightTime(actualDep)}`;
      } else if (actualArr) {
        systemAdjustmentNote = `Ajustement système : arrivée saisie ${formatFlightTime(actualArr)}`;
      }
    }

    // Exact WINCMD string:
    // WINCMD("PTRG*L10/10NOVLFW‡BT/ET/IB/OB/ON/SS/FF/FQTV/AE/INF")
    const wincmd = `WINCMD("PTRG*L${currentFlightNumber}/${detectedDate}${origin}‡BT/ET/IB/OB/ON/SS/FF/FQTV/AE/INF")`;
    const ptrgWincmd = `WINCMD("PTRG*/KP${currentFlightNumber}/${detectedDate}${origin}/D")`;

    segments.push({
      id: `${currentFlightNumber}-${detectedDate}-${origin}-${destination}-${i}`,
      flightNumber: currentFlightNumber,
      date: detectedDate,
      origin,
      destination,
      schedDep,
      schedArr,
      schedDepFormatted: formatFlightTime(schedDep),
      schedArrFormatted: formatFlightTime(schedArr),
      actualDep,
      actualArr,
      actualDepFormatted: formatFlightTime(actualDep),
      actualArrFormatted: formatFlightTime(actualArr),
      isKpOperated,
      carrierType,
      hasSystemAdjustment,
      systemAdjustmentNote,
      isSubSegment,
      segmentIndex: currentSegmentIndex,
      rawLine,
      status,
      wincmd,
      ptrgWincmd,
    });
  }

  const uniqueFlightNumbers = Array.from(new Set(segments.map(s => s.flightNumber)));
  const kpSegments = segments.filter(s => s.isKpOperated);
  const codeshareSegments = segments.filter(s => !s.isKpOperated);
  const kpUniqueFlightsCount = new Set(kpSegments.map(s => s.flightNumber)).size;
  const codeshareUniqueFlightsCount = new Set(codeshareSegments.map(s => s.flightNumber)).size;

  const origins = Array.from(new Set(segments.map(s => s.origin))).sort();
  const destinations = Array.from(new Set(segments.map(s => s.destination))).sort();

  return {
    date: detectedDate,
    segments,
    uniqueFlightNumbers,
    uniqueFlightsCount: uniqueFlightNumbers.length,
    kpOperatedSegmentsCount: kpSegments.length,
    codeshareSegmentsCount: codeshareSegments.length,
    kpUniqueFlightsCount,
    codeshareUniqueFlightsCount,
    origins,
    destinations,
    rawText,
    sourceType: "VDS",
  };
}

/**
 * Parse consolidated GD*<STATION>/<DATE>/T0000-2359/ALL#A departure flight lists
 * and convert them into FlightSegment[] compatible with VDS schedule workflow.
 */
export function parseGdFlightSchedule(rawText: string): FlightScheduleParseResult {
  const lines = rawText.replace(/\x0c/g, "\n").split(/\r?\n/);

  let detectedDate = "";
  let currentOrigin = "";
  const queriedStations = new Set<string>();
  const stationsWithFlights = new Set<string>();

  interface RawGdSegment {
    airline: string;
    flightNumber: string;
    date: string;
    origin: string;
    destination: string;
    downlineStations: string[];
    schedDep: string;
    actualDep: string;
    gdLineNumber: string;
    gdTerminal: string;
    gdGate: string;
    gdFlightStatus: string;
    gdAircraftType: string;
    gdPaxBookedRaw: string;
    rawLine: string;
    lineIdx: number;
  }

  const rawEntries: RawGdSegment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // 1. Check GD* command line: e.g. GD*LFW/21NOV/T0000-2359/ALL#A
    const gdCmdMatch = trimmed.match(/^GD\*([A-Z]{3})\/(\d{1,2}[A-Z]{3})\b/i);
    if (gdCmdMatch) {
      currentOrigin = gdCmdMatch[1].toUpperCase();
      queriedStations.add(currentOrigin);
      const norm = normalizeDcsScheduleDate(gdCmdMatch[2]);
      if (!detectedDate && norm) detectedDate = norm;
      continue;
    }

    // 2. Check list header: e.g. "LFW   DAILY DEPARTURE FLIGHT LIST FOR KP" or "JNB    DAILY FLIGHT LIST"
    const listHeaderMatch = trimmed.match(
      /^([A-Z]{3})\s+DAILY\s+(?:DEPARTURE\s+)?FLIGHT\s+LIST\b/i
    );
    if (listHeaderMatch) {
      currentOrigin = listHeaderMatch[1].toUpperCase();
      queriedStations.add(currentOrigin);
      continue;
    }

    // 3. Skip table headers, separators, empty notices, footers
    if (
      trimmed.startsWith("---") ||
      trimmed.startsWith("LINE ") ||
      trimmed.startsWith("NBR ") ||
      trimmed.startsWith("HDQ.") ||
      /NO\s+DATA\s+FOR\s+THIS\s+SELECTION/i.test(trimmed)
    ) {
      continue;
    }

    // 4. Match primary departure row:
    // e.g. "001  KP  0022  21NOV 1    6    1230 PDC    @737 ACC   FNA"
    const mainMatch = rawLine.match(
      /^\s*(\d{3})\s+([A-Z0-9]{2})\s+(\d{1,4})\s+(\d{1,2}[A-Z]{3})\b(.*)$/i
    );
    if (!mainMatch || !currentOrigin) continue;

    const gdLineNumber = mainMatch[1];
    const airline = mainMatch[2].toUpperCase();
    const flightNumber = mainMatch[3].replace(/^0+/, "") || "0";
    const segDate = normalizeDcsScheduleDate(mainMatch[4]);
    if (!detectedDate && segDate) detectedDate = segDate;

    const afterDateStr = mainMatch[5] || "";
    const tailMatch = afterDateStr.match(
      /^(.*?)\b(\d{4})\s+([A-Z]{2,5})\s+(?:(@?[A-Z0-9]{2,4})\s+)?([A-Z]{3}(?:\s+[A-Z]{3})*)\s*$/i
    );
    if (!tailMatch) continue;

    const tmlGatePart = tailMatch[1] || "";
    const depTime = tailMatch[2];
    const gdFlightStatus = tailMatch[3].toUpperCase();
    const gdAircraftType = (tailMatch[4] || "").replace(/^@/, "").toUpperCase();
    const initialToStations = (tailMatch[5] || "")
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .filter((code) => /^[A-Z]{3}$/.test(code));

    let gdTerminal = "";
    let rawGate = "";
    if (tmlGatePart.length >= 6) {
      gdTerminal = tmlGatePart.slice(0, 5).trim().toUpperCase();
      rawGate = tmlGatePart.slice(5).trim().toUpperCase();
    } else {
      const tmlGateTokens = tmlGatePart.trim().split(/\s+/).filter(Boolean);
      if (tmlGateTokens.length >= 2) {
        gdTerminal = tmlGateTokens[0].toUpperCase();
        rawGate = tmlGateTokens[1].toUpperCase();
      } else if (tmlGateTokens.length === 1) {
        rawGate = tmlGateTokens[0].toUpperCase();
      }
    }
    const gdGate = rawGate === "GATE" ? "" : rawGate;

    // 5. Inspect continuation lines (pax booked count, STD time, additional downline stations)
    let stdTime = "";
    let gdPaxBookedRaw = "";
    const downlineStations = [...initialToStations];
    const rawLinesBlock = [rawLine];

    let j = i + 1;
    while (j < lines.length) {
      const nextRaw = lines[j];
      const nextTrimmed = nextRaw.trim();
      if (
        !nextTrimmed ||
        nextTrimmed.startsWith("HDQ.") ||
        nextTrimmed.startsWith("GD*") ||
        nextTrimmed.startsWith("---") ||
        /^\s*\d{3}\s+[A-Z0-9]{2}\s+\d{1,4}\s+\d{1,2}[A-Z]{3}\b/i.test(nextRaw) ||
        /^[A-Z]{3}\s+DAILY\s+(?:DEPARTURE\s+)?FLIGHT\s+LIST\b/i.test(nextTrimmed)
      ) {
        break;
      }

      rawLinesBlock.push(nextRaw);

      if (!gdPaxBookedRaw) {
        const paxMatch = nextTrimmed.match(/^(\d{1,3}\/\d{1,3}|\d{1,3})(?:\s|$)/);
        if (paxMatch) {
          gdPaxBookedRaw = paxMatch[1];
        }
      }

      const stdMatch = nextRaw.match(/\b(?:STD|ETD|ATD)\s+(\d{4})\b(.*)$/i);
      if (stdMatch) {
        if (!stdTime) stdTime = stdMatch[1];
        const extraStations = (stdMatch[2] || "")
          .trim()
          .toUpperCase()
          .split(/\s+/)
          .filter((code) => /^[A-Z]{3}$/.test(code));
        for (const st of extraStations) {
          if (!downlineStations.includes(st)) downlineStations.push(st);
        }
      } else if (nextRaw.length >= 45) {
        const trailingStations = nextRaw
          .slice(44)
          .trim()
          .toUpperCase()
          .split(/\s+/)
          .filter((code) => /^[A-Z]{3}$/.test(code));
        for (const st of trailingStations) {
          if (!downlineStations.includes(st)) downlineStations.push(st);
        }
      }

      i = j;
      j++;
    }

    const schedDep = stdTime || depTime;
    const actualDep = stdTime && depTime && depTime !== stdTime ? depTime : "";
    const destination = downlineStations[0] || "";
    if (!destination) continue;

    stationsWithFlights.add(currentOrigin);
    rawEntries.push({
      airline,
      flightNumber,
      date: segDate,
      origin: currentOrigin,
      destination,
      downlineStations,
      schedDep,
      actualDep,
      gdLineNumber,
      gdTerminal,
      gdGate,
      gdFlightStatus,
      gdAircraftType,
      gdPaxBookedRaw,
      rawLine: rawLinesBlock.join("\n"),
      lineIdx: i,
    });
  }

  // Deduplicate by (date, flightNumber, origin) just in case overlapping blocks are pasted
  const seenKeys = new Set<string>();
  const deduped: RawGdSegment[] = [];
  for (const entry of rawEntries) {
    const key = `${entry.date}|${entry.flightNumber}|${entry.origin}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(entry);
  }

  // Group by flightNumber to determine primary leg (segmentIndex = 0) vs continuing legs
  const byFlight = new Map<string, RawGdSegment[]>();
  for (const entry of deduped) {
    const bucket = byFlight.get(entry.flightNumber) || [];
    bucket.push(entry);
    byFlight.set(entry.flightNumber, bucket);
  }

  const sortedFlightKeys = Array.from(byFlight.keys()).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });

  const segments: FlightSegment[] = [];

  for (const fltKey of sortedFlightKeys) {
    const legs = byFlight.get(fltKey) || [];
    // Primary origin leg has the longest downline route (most remaining stops) and earliest departure time
    legs.sort((a, b) => {
      if (b.downlineStations.length !== a.downlineStations.length) {
        return b.downlineStations.length - a.downlineStations.length;
      }
      return a.schedDep.localeCompare(b.schedDep);
    });

    legs.forEach((leg, idx) => {
      const isSubSegment = idx > 0;
      const isKpOperated = leg.airline === "KP" && leg.flightNumber.length <= 2;
      const carrierType: "KP_OPERATED" | "CODESHARE" = isKpOperated
        ? "KP_OPERATED"
        : "CODESHARE";
      const status: "Opéré par KP" | "Codeshare (Info)" = isKpOperated
        ? "Opéré par KP"
        : "Codeshare (Info)";

      const hasSystemAdjustment = Boolean(leg.actualDep);
      let systemAdjustmentNote = "Non renseigné dans le système";
      if (hasSystemAdjustment && leg.actualDep.length === 4 && leg.schedDep.length === 4) {
        const aH = parseInt(leg.actualDep.slice(0, 2), 10);
        const aM = parseInt(leg.actualDep.slice(2, 4), 10);
        const sH = parseInt(leg.schedDep.slice(0, 2), 10);
        const sM = parseInt(leg.schedDep.slice(2, 4), 10);
        let diff = aH * 60 + aM - (sH * 60 + sM);
        if (diff > 720) diff -= 1440;
        if (diff < -720) diff += 1440;
        if (diff === 0) {
          systemAdjustmentNote = "Ajustement système : identique à l'estimé (0 min)";
        } else if (diff > 0) {
          systemAdjustmentNote = `Ajustement système : départ saisi à +${diff} min`;
        } else {
          systemAdjustmentNote = `Ajustement système : départ saisi à ${diff} min`;
        }
      }

      const segDate = leg.date || detectedDate || "21NOV";
      const wincmd = `WINCMD("PTRG*L${leg.flightNumber}/${segDate}${leg.origin}‡BT/ET/IB/OB/ON/SS/FF/FQTV/AE/INF")`;
      const ptrgWincmd = `WINCMD("PTRG*/KP${leg.flightNumber}/${segDate}${leg.origin}/D")`;

      segments.push({
        id: `${leg.flightNumber}-${segDate}-${leg.origin}-${leg.destination}-${leg.lineIdx}`,
        flightNumber: leg.flightNumber,
        date: segDate,
        origin: leg.origin,
        destination: leg.destination,
        schedDep: leg.schedDep,
        schedArr: "",
        schedDepFormatted: formatFlightTime(leg.schedDep),
        schedArrFormatted: "",
        actualDep: leg.actualDep,
        actualArr: "",
        actualDepFormatted: formatFlightTime(leg.actualDep),
        actualArrFormatted: "",
        isKpOperated,
        carrierType,
        hasSystemAdjustment,
        systemAdjustmentNote,
        isSubSegment,
        segmentIndex: idx,
        rawLine: leg.rawLine,
        status,
        wincmd,
        ptrgWincmd,
        gdLineNumber: leg.gdLineNumber,
        gdTerminal: leg.gdTerminal || undefined,
        gdGate: leg.gdGate || undefined,
        gdFlightStatus: leg.gdFlightStatus || undefined,
        gdAircraftType: leg.gdAircraftType || undefined,
        gdPaxBookedRaw: leg.gdPaxBookedRaw || undefined,
        gdDownlineStations: leg.downlineStations,
      });
    });
  }

  const finalDate = detectedDate || "21NOV";
  const uniqueFlightNumbers = Array.from(new Set(segments.map((s) => s.flightNumber)));
  const kpSegments = segments.filter((s) => s.isKpOperated);
  const codeshareSegments = segments.filter((s) => !s.isKpOperated);
  const kpUniqueFlightsCount = new Set(kpSegments.map((s) => s.flightNumber)).size;
  const codeshareUniqueFlightsCount = new Set(
    codeshareSegments.map((s) => s.flightNumber)
  ).size;
  const origins = Array.from(new Set(segments.map((s) => s.origin))).sort();
  const destinations = Array.from(new Set(segments.map((s) => s.destination))).sort();

  return {
    date: finalDate,
    segments,
    uniqueFlightNumbers,
    uniqueFlightsCount: uniqueFlightNumbers.length,
    kpOperatedSegmentsCount: kpSegments.length,
    codeshareSegmentsCount: codeshareSegments.length,
    kpUniqueFlightsCount,
    codeshareUniqueFlightsCount,
    origins,
    destinations,
    rawText,
    sourceType: "GD",
    stationsQueriedCount: queriedStations.size,
    stationsWithFlightsCount: stationsWithFlights.size,
  };
}

/**
 * Encode string into Windows-1252 / ANSI bytes.
 * Crucially encodes the double-dagger '‡' (U+2021) as byte 0x87.
 */
export function encodeToAnsi(text: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(text.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x2021) {
      // ‡ in Windows-1252 / ANSI is 0x87
      bytes[i] = 0x87;
    } else if (code <= 0xff) {
      bytes[i] = code;
    } else {
      bytes[i] = 0x3f; // '?'
    }
  }
  return bytes;
}

/**
 * Download ANSI formatted file (.txt)
 */
export function downloadAnsiFile(filename: string, content: string): void {
  const bytes = encodeToAnsi(content);
  const blob = new Blob([bytes], { type: "text/plain;charset=windows-1252" });
  triggerFileDownload(blob, filename);
}

/**
 * Split flight segments into two halves by unique flights.
 * Keeps all segments of a given flight together in the same part.
 */
export function splitSegmentsIntoTwoHalves(segments: FlightSegment[]): {
  part1: FlightSegment[];
  part2: FlightSegment[];
  part1FlightsCount: number;
  part2FlightsCount: number;
  part1FlightNumbers: string[];
  part2FlightNumbers: string[];
} {
  const uniqueFlights = Array.from(new Set(segments.map(s => s.flightNumber)));
  const half = Math.ceil(uniqueFlights.length / 2);
  const part1FlightNumbers = uniqueFlights.slice(0, half);
  const part2FlightNumbers = uniqueFlights.slice(half);
  const part1FlightSet = new Set(part1FlightNumbers);

  const part1 = segments.filter(s => part1FlightSet.has(s.flightNumber));
  const part2 = segments.filter(s => !part1FlightSet.has(s.flightNumber));

  return {
    part1,
    part2,
    part1FlightsCount: part1FlightNumbers.length,
    part2FlightsCount: part2FlightNumbers.length,
    part1FlightNumbers,
    part2FlightNumbers,
  };
}

/**
 * Download both parts in ANSI format sequentially
 */
export function downloadTwoHalvesAnsi(
  basePrefix: string,
  date: string,
  part1Content: string,
  part2Content: string
): void {
  downloadAnsiFile(`${basePrefix}_${date}_PARTIE_1_ANSI.txt`, part1Content);
  setTimeout(() => {
    downloadAnsiFile(`${basePrefix}_${date}_PARTIE_2_ANSI.txt`, part2Content);
  }, 400);
}

/**
 * Download standard UTF-8 text file (.txt)
 */
export function downloadUtf8File(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerFileDownload(blob, filename);
}

/**
 * Generate WINCMD commands for a list of flight segments
 */
export function generateWincmdText(segments: FlightSegment[]): string {
  return segments.map(s => s.wincmd).join("\r\n") + "\r\n";
}

export function getFlightSystemNoteLabel(
  segment: FlightSegment,
  language: "fr" | "en" = "fr"
): string {
  const note = segment.systemAdjustmentNote || "";
  if (language === "fr") return note;
  if (!segment.hasSystemAdjustment || note === "Non renseigné dans le système") {
    return "Not entered in system";
  }
  if (note.includes("identique à l'estimé")) {
    return "System adjustment: matches estimated (0 min)";
  }
  const diffMatch = note.match(/départ saisi à ([+-]?\d+)\s*min/i);
  if (diffMatch) {
    return `System adjustment: departure entered at ${diffMatch[1]} min`;
  }
  const depMatch = note.match(/départ saisi (\S+)/i);
  if (depMatch) {
    return `System adjustment: departure entered ${depMatch[1]}`;
  }
  const arrMatch = note.match(/arrivée saisie (\S+)/i);
  if (arrMatch) {
    return `System adjustment: arrival entered ${arrMatch[1]}`;
  }
  return note;
}

/**
 * Export flights to clean formatted text file
 */
export function exportFlightsToText(
  segments: FlightSegment[],
  date: string,
  language: "fr" | "en" = "fr"
): string {
  const isEn = language === "en";
  let out = `===================================================================================================================\n`;
  if (isEn) {
    out += `               FLIGHT SCHEDULE - DATE : ${date}\n`;
    out += `               Total segments : ${segments.length} | Extracted : ${new Date().toLocaleString("en-US")}\n`;
    out += `               IMPORTANT NOTE :\n`;
    out += `               - 2-digit flights are operated directly by KP (priority flights).\n`;
    out += `               - Other flight numbers (> 2 digits) are partner Codeshare flights (informational).\n`;
    out += `               - Displayed times strictly reflect those entered in the system.\n`;
    out += `===================================================================================================================\n\n`;
    out += `FLIGHT   TYPE           ORG   DST    ESTIMATED TIME    ACTUAL ENTERED TIME  SYSTEM ADJUSTMENT               STATUS\n`;
  } else {
    out += `               PROGRAMME DES VOLS - DATE : ${date}\n`;
    out += `               Total segments : ${segments.length} | Date extraction : ${new Date().toLocaleString("fr-FR")}\n`;
    out += `               NOTE IMPORTANTE :\n`;
    out += `               - Les vols à 2 chiffres sont opérés en propre par la compagnie KP (vols prioritaires).\n`;
    out += `               - Les autres numéros (> 2 chiffres) sont des vols Codeshares opérés par des partenaires (informatif).\n`;
    out += `               - Les horaires affichés correspondent uniquement à ceux saisis dans le système.\n`;
    out += `===================================================================================================================\n\n`;
    out += `VOL      TYPE VOL       ORG   DST    HORAIRE ESTIMÉ   HORAIRE RÉEL SAISI   AJUSTEMENT SYSTÈME              STATUT\n`;
  }
  out += `-------------------------------------------------------------------------------------------------------------------\n`;

  for (const s of segments) {
    const vol = s.flightNumber.padEnd(8);
    const type = (
      s.isKpOperated
        ? isEn
          ? "KP Operated"
          : "Opéré KP"
        : "Codeshare"
    ).padEnd(14);
    const org = s.origin.padEnd(5);
    const dst = s.destination.padEnd(6);
    const sched = `${s.schedDepFormatted || "--:--"} / ${s.schedArrFormatted || "--:--"}`.padEnd(16);
    const act = (s.hasSystemAdjustment
      ? `${s.actualDepFormatted || "--:--"} / ${s.actualArrFormatted || "--:--"}`
      : isEn
      ? "Not entered"
      : "Non renseigné").padEnd(20);
    const note = getFlightSystemNoteLabel(s, language).padEnd(32);
    const stat = s.isKpOperated
      ? isEn
        ? "Operated by KP"
        : "Opéré par KP"
      : "Codeshare (Info)";
    out += `${vol} ${type} ${org} ${dst} ${sched} ${act} ${note} ${stat}\n`;
  }

  out += `-------------------------------------------------------------------------------------------------------------------\n`;
  out += isEn
    ? `End of flight report - ${segments.length} segment(s).\n`
    : `Fin de l'état des vols - ${segments.length} tronçon(s).\n`;
  return out;
}

/**
 * Export flights to Excel (.xlsx) using SheetJS
 */
export function exportFlightsToExcel(
  segments: FlightSegment[],
  filename = "liste_des_vols.xlsx",
  language: "fr" | "en" = "fr"
): void {
  const isEn = language === "en";
  const worksheetData = isEn
    ? segments.map((s, idx) => ({
        "No.": idx + 1,
        "Flight No.": s.flightNumber,
        "Flight Type": s.isKpOperated
          ? "Operated by KP (Primary)"
          : "Codeshare (Informational)",
        "Date": s.date,
        "Origin": s.origin,
        "Destination": s.destination,
        "Segment": `${s.origin}/${s.destination}`,
        "Estimated Time (System)": `${s.schedDepFormatted || "-"} / ${s.schedArrFormatted || "-"}`,
        "Actual Time Entered (System)": s.hasSystemAdjustment
          ? `${s.actualDepFormatted || "-"} / ${s.actualArrFormatted || "-"}`
          : "Not entered in system",
        "System Adjustment?": s.hasSystemAdjustment ? "Yes" : "No (Initial schedule)",
        "System Adjustment Detail": getFlightSystemNoteLabel(s, "en"),
        "Stopover Segment": s.isSubSegment ? "Yes (Stopover)" : "No (Departure)",
        "WINCMD Command": s.wincmd,
      }))
    : segments.map((s, idx) => ({
        "N°": idx + 1,
        "N° Vol": s.flightNumber,
        "Type de Vol": s.isKpOperated ? "Opéré par KP (Principal)" : "Codeshare (Informatif)",
        "Date": s.date,
        "Origine": s.origin,
        "Destination": s.destination,
        "Tronçon": `${s.origin}/${s.destination}`,
        "Horaire Estimé (Système)": `${s.schedDepFormatted || "-"} / ${s.schedArrFormatted || "-"}`,
        "Horaire Réel Saisi (Système)": s.hasSystemAdjustment
          ? `${s.actualDepFormatted || "-"} / ${s.actualArrFormatted || "-"}`
          : "Non renseigné dans le système",
        "Ajustement Saisi Système ?": s.hasSystemAdjustment ? "Oui" : "Non (Horaire initial)",
        "Détail Ajustement Système": s.systemAdjustmentNote,
        "Segment Escale": s.isSubSegment ? "Oui (Escale)" : "Non (Départ)",
        "Commande WINCMD": s.wincmd,
      }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set nice column widths
  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 26 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
    { wch: 32 },
    { wch: 16 },
    { wch: 64 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, isEn ? "Flights" : "Vols");
  XLSX.writeFile(workbook, filename);
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SCHEDULE_STORAGE_KEY = "kp_flight_schedule_data_v1";
const SCHEDULE_HISTORY_STORAGE_KEY = "kp_flight_schedules_by_date_v1";

function normScheduleDateKey(rawDate: string): string {
  const clean = (rawDate || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})(?:\d{2,4})?$/);
  if (!match) return clean;
  return `${match[1].padStart(2, "0")}${match[2]}`;
}

export function loadStoredScheduleData(): FlightScheduleParseResult | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlightScheduleParseResult;
    if (!parsed || !Array.isArray(parsed.segments)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadStoredScheduleSegments(): FlightSegment[] {
  try {
    const rawHist = localStorage.getItem(SCHEDULE_HISTORY_STORAGE_KEY);
    if (rawHist) {
      const record = JSON.parse(rawHist) as Record<string, FlightSegment[]>;
      if (record && typeof record === "object") {
        const all: FlightSegment[] = [];
        for (const segs of Object.values(record)) {
          if (Array.isArray(segs)) all.push(...segs);
        }
        if (all.length > 0) return all;
      }
    }
    const active = loadStoredScheduleData();
    return active?.segments || [];
  } catch {
    return [];
  }
}

export function saveStoredScheduleData(
  data: FlightScheduleParseResult | null
): FlightSegment[] {
  try {
    if (!data) {
      localStorage.removeItem(SCHEDULE_STORAGE_KEY);
      return loadStoredScheduleSegments();
    }
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(data));
    const dateKey = normScheduleDateKey(data.date);
    let history: Record<string, FlightSegment[]> = {};
    try {
      const rawHist = localStorage.getItem(SCHEDULE_HISTORY_STORAGE_KEY);
      if (rawHist) {
        const parsedHist = JSON.parse(rawHist) as Record<string, FlightSegment[]>;
        if (parsedHist && typeof parsedHist === "object") history = parsedHist;
      }
    } catch {
      history = {};
    }
    if (dateKey && Array.isArray(data.segments)) {
      history[dateKey] = data.segments;
      localStorage.setItem(SCHEDULE_HISTORY_STORAGE_KEY, JSON.stringify(history));
    }
    const all: FlightSegment[] = [];
    for (const segs of Object.values(history)) {
      if (Array.isArray(segs)) all.push(...segs);
    }
    return all;
  } catch {
    return data?.segments || [];
  }
}

const DCS_MONTHS = [
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
] as const;

export function normalizeDcsScheduleDate(raw: string): string {
  const clean = (raw || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})(?:\d{2,4})?$/);
  if (!match) return clean;
  return `${match[1].padStart(2, "0")}${match[2]}`;
}

export function formatIsoDateToDcs(isoDate: string): string {
  const m = (isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const monthIdx = parseInt(m[2], 10) - 1;
  const day = m[3].padStart(2, "0");
  if (monthIdx < 0 || monthIdx >= 12) return "";
  return `${day}${DCS_MONTHS[monthIdx]}`;
}

export function formatDcsDateToIso(
  dcsDate: string,
  fallbackYear = new Date().getFullYear()
): string {
  const clean = normalizeDcsScheduleDate(dcsDate);
  const m = clean.match(/^(\d{2})([A-Z]{3})$/);
  if (!m) return "";
  const monthIdx = DCS_MONTHS.indexOf(m[2] as (typeof DCS_MONTHS)[number]);
  if (monthIdx === -1) return "";
  const month = String(monthIdx + 1).padStart(2, "0");
  return `${fallbackYear}-${month}-${m[1]}`;
}

export function getTodayDcsDate(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mmm = DCS_MONTHS[now.getMonth()] || "JAN";
  return `${dd}${mmm}`;
}

export function generateStationPtrgdCommand(
  stationCode: string,
  dcsDate: string
): string {
  const station = (stationCode || "").trim().toUpperCase();
  const date = normalizeDcsScheduleDate(dcsDate);
  return `WINCMD("PTRGD*${station}/${date}/T0000-2359/ALL\u2021A")`;
}

export function generateStationsPtrgdText(
  stationCodes: string[],
  dcsDate: string
): { commands: string[]; text: string; count: number } {
  const date = normalizeDcsScheduleDate(dcsDate);
  if (!date || !/^\d{2}[A-Z]{3}$/.test(date)) {
    return { commands: [], text: "", count: 0 };
  }
  const seen = new Set<string>();
  const commands: string[] = [];
  for (const rawCode of stationCodes) {
    const code = (rawCode || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    commands.push(generateStationPtrgdCommand(code, date));
  }
  return {
    commands,
    text: commands.length > 0 ? commands.join("\r\n") + "\r\n" : "",
    count: commands.length,
  };
}

export function downloadStationsPtrgdAnsi(
  stationCodes: string[],
  dcsDate: string,
  prefix = "WINCMD_STATIONS_PTRGD"
): number {
  const normDate = normalizeDcsScheduleDate(dcsDate);
  const { text, count } = generateStationsPtrgdText(stationCodes, normDate);
  if (count === 0) return 0;
  downloadAnsiFile(`${prefix}_${normDate}_ANSI.txt`, text);
  return count;
}
