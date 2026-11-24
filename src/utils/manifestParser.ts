/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import {
  ManifestAncillaryItem,
  ManifestBagItem,
  ManifestBaggageCompliance,
  ManifestCabinTotals,
  ManifestConnectionFlight,
  ManifestFlight,
  ManifestInfantInfo,
  ManifestParseResult,
  ManifestPassenger,
  ManifestTicketInfo,
  TransportedPassengerReport,
} from "../types";

export const BUSINESS_BOOKING_CLASSES = new Set(["C", "J", "D", "Z", "I", "R"]);

export interface EditCodeMeta {
  code: string;
  label: string;
  labelEn: string;
  category: "CONNEXION" | "BILLET" | "DOCUMENT" | "FIDELITE" | "SERVICE" | "STATUT";
}

export const EDIT_CODE_DICTIONARY: Record<string, EditCodeMeta> = {
  OB: {
    code: "OB",
    label: "Correspondance sortante (Outbound Connection)",
    labelEn: "Outbound Connection",
    category: "CONNEXION",
  },
  IB: {
    code: "IB",
    label: "Correspondance entrante (Inbound Connection)",
    labelEn: "Inbound Connection",
    category: "CONNEXION",
  },
  EIB: {
    code: "EIB",
    label: "Correspondance entrante électronique",
    labelEn: "Electronic Inbound Connection",
    category: "CONNEXION",
  },
  ET: {
    code: "ET",
    label: "Billet électronique (Electronic Ticket)",
    labelEn: "Electronic Ticket",
    category: "BILLET",
  },
  ETI: {
    code: "ETI",
    label: "Billet synchronisé avec la réservation (In Sync)",
    labelEn: "Ticket Synchronized with Booking (In Sync)",
    category: "BILLET",
  },
  ETO: {
    code: "ETO",
    label: "Billet non synchronisé / Écart coupon (Out of Sync)",
    labelEn: "Ticket Out of Sync / Coupon Mismatch",
    category: "BILLET",
  },
  TKT: {
    code: "TKT",
    label: "Billet papier / Saisie manuelle",
    labelEn: "Paper Ticket / Manual Entry",
    category: "BILLET",
  },
  DOCV: {
    code: "DOCV",
    label: "Documents de voyage vérifiés / valides",
    labelEn: "Travel Documents Verified / Valid",
    category: "DOCUMENT",
  },
  DOCS: {
    code: "DOCS",
    label: "Informations passeport / document saisies (APIS)",
    labelEn: "Passport / Document Information Entered (APIS)",
    category: "DOCUMENT",
  },
  DCVI: {
    code: "DCVI",
    label: "Contrôle documentaire d'entrée vérifié",
    labelEn: "Inbound Document Check Verified",
    category: "DOCUMENT",
  },
  APP: {
    code: "APP",
    label: "Contrôle préalable APIS / Autorités approuvé",
    labelEn: "APIS Pre-Clearance / Authorities Approved",
    category: "DOCUMENT",
  },
  WB: {
    code: "WB",
    label: "Enregistrement en ligne (Web Check-in)",
    labelEn: "Web Check-in",
    category: "STATUT",
  },
  CS: {
    code: "CS",
    label: "Passager Codeshare (Partage de codes)",
    labelEn: "Codeshare Passenger",
    category: "STATUT",
  },
  PX: {
    code: "PX",
    label: "Passager prioritaire / Traitement spécial",
    labelEn: "Priority Passenger / Special Handling",
    category: "STATUT",
  },
  OFL: {
    code: "OFL",
    label: "Débarqué / Non embarqué (Offloaded)",
    labelEn: "Offloaded / Not Boarded",
    category: "STATUT",
  },
  CM: {
    code: "CM",
    label: "Remarque / Commentaire agent comptoir",
    labelEn: "Check-in Agent Comment / Remark",
    category: "STATUT",
  },
  OTHS: {
    code: "OTHS",
    label: "Mention particulière / Remarque SSR",
    labelEn: "Special Remark / SSR Note",
    category: "STATUT",
  },
  FF: {
    code: "FF",
    label: "Fréquent Flyer ASKY (Programme KP)",
    labelEn: "ASKY Frequent Flyer (KP Program)",
    category: "FIDELITE",
  },
  FQTV: {
    code: "FQTV",
    label: "Fréquent Flyer Partenaire (Autre compagnie)",
    labelEn: "Partner Frequent Flyer (Other Carrier)",
    category: "FIDELITE",
  },
  BRW: {
    code: "BRW",
    label: "Niveau Fidélité ASKY Brown",
    labelEn: "ASKY Loyalty Tier Brown",
    category: "FIDELITE",
  },
  SIL: {
    code: "SIL",
    label: "Niveau Fidélité ASKY Silver",
    labelEn: "ASKY Loyalty Tier Silver",
    category: "FIDELITE",
  },
  INF: {
    code: "INF",
    label: "Passager accompagné d'un bébé (Infant)",
    labelEn: "Passenger Traveling with an Infant",
    category: "SERVICE",
  },
  IFET: {
    code: "IFET",
    label: "Billet électronique bébé associé",
    labelEn: "Associated Infant Electronic Ticket",
    category: "SERVICE",
  },
  AE: {
    code: "AE",
    label: "Services additionnels payants (Ancillary / EMD)",
    labelEn: "Paid Ancillary Services (Ancillary / EMD)",
    category: "SERVICE",
  },
  EE: {
    code: "EE",
    label: "Exempté / Franchise spéciale",
    labelEn: "Exempt / Special Allowance",
    category: "SERVICE",
  },
  BF: {
    code: "BF",
    label: "Bagage prioritaire / Franchise Business",
    labelEn: "Priority Baggage / Business Allowance",
    category: "SERVICE",
  },
  BR: {
    code: "BR",
    label: "Bagage enregistré avec remarque",
    labelEn: "Checked Baggage with Remark",
    category: "SERVICE",
  },
  IR: {
    code: "IR",
    label: "Réacheminement / Irrégularité",
    labelEn: "Rerouting / Irregularity",
    category: "STATUT",
  },
};

export function getEditCodeLabel(code: string, language: "fr" | "en" = "fr"): string {
  const meta = EDIT_CODE_DICTIONARY[code];
  if (!meta) {
    return language === "en" ? "DCS system code" : "Code système DCS";
  }
  return language === "en" ? meta.labelEn : meta.label;
}

export function translateBaggageDeviation(
  deviation: string,
  language: "fr" | "en" = "fr"
): string {
  if (language === "fr") return deviation;
  const bagsMatch = deviation.match(
    /^Nombre de bagages \((\d+)\) > franchise \((\d+) pièces? max\)$/i
  );
  if (bagsMatch) {
    return `Number of bags (${bagsMatch[1]}) > allowance (${bagsMatch[2]} pieces max)`;
  }
  const weightMatch = deviation.match(
    /^Poids cumulé \((\d+)\s*kg\) > franchise cumulée \((\d+)\s*kg max\)$/i
  );
  if (weightMatch) {
    return `Combined weight (${weightMatch[1]} kg) > combined allowance (${weightMatch[2]} kg max)`;
  }
  return deviation;
}

export function translateMissingBaggageDetail(
  detail: string,
  language: "fr" | "en" = "fr"
): string {
  if (language === "fr") return detail;
  const tagListMatch = detail.match(
    /^Numéro\(s\) de bagage sans poids spécifié\s*:\s*(.+)$/i
  );
  if (tagListMatch) {
    return `Bag tag number(s) without specified weight: ${tagListMatch[1]}`;
  }
  const totalLineMatch = detail.match(
    /^Ligne total bagages \((\d+) pcs\) sans poids spécifié$/i
  );
  if (totalLineMatch) {
    return `Baggage total line (${totalLineMatch[1]} pcs) without specified weight`;
  }
  const countNoWeightMatch = detail.match(
    /^Nombre de bagages déclaré \((\d+) pcs\) sans aucun poids spécifié$/i
  );
  if (countNoWeightMatch) {
    return `Declared baggage count (${countNoWeightMatch[1]} pcs) with no weight specified`;
  }
  const partialTagMatch = detail.match(
    /^Nombre de bagages déclaré \((\d+)\) > talons avec poids \((\d+)\) sans total KG$/i
  );
  if (partialTagMatch) {
    return `Declared baggage count (${partialTagMatch[1]}) > weighted tags (${partialTagMatch[2]}) without KG total`;
  }
  return detail;
}

export function getCabinClass(bookingClass: string): "C" | "Y" {
  const clean = (bookingClass || "").trim().toUpperCase();
  return BUSINESS_BOOKING_CLASSES.has(clean) ? "C" : "Y";
}

function formatDepartureTime(raw: string): string {
  const digits = raw.trim().padStart(4, "0");
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }
  return raw;
}

function createEmptyTotals(): ManifestCabinTotals {
  return {
    male: 0,
    female: 0,
    unknown: 0,
    child: 0,
    infant: 0,
    passengersCount: 0,
    bagsCount: 0,
    totalWeight: 0,
  };
}

function getEffectiveBagsCount(pax: ManifestPassenger): number {
  return Math.max(
    pax.bags.length,
    pax.bagsDeclaredCount || 0,
    pax.bagsTotalDeclaredLine?.count || 0
  );
}

function computeTotals(passengers: ManifestPassenger[]): ManifestCabinTotals {
  const totals = createEmptyTotals();
  for (const pax of passengers) {
    totals.passengersCount += 1;
    if (pax.isChild) {
      totals.child += 1;
    } else if (pax.gender === "M") {
      totals.male += 1;
    } else if (pax.gender === "F") {
      totals.female += 1;
    } else {
      totals.unknown += 1;
    }
    if (pax.hasInfant) {
      totals.infant += 1;
    }
    totals.bagsCount += getEffectiveBagsCount(pax);
    totals.totalWeight += pax.totalBagWeight;
  }
  return totals;
}

function normIdentityToken(value?: string): string {
  return (value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Returns true if the passenger has an assigned seat (actually traveled / boarded).
 */
export function isPassengerWithSeat(pax: ManifestPassenger): boolean {
  return Boolean(pax.seat && pax.seat.trim().length > 0);
}

/**
 * Returns true if the passenger is a No-Show: listed on the manifest
 * without an assigned seat (!isPassengerWithSeat).
 */
export function isPassengerNoShow(pax: ManifestPassenger): boolean {
  return !isPassengerWithSeat(pax);
}

/**
 * Returns true if the passenger performed Web Check-in (edit code WB).
 */
export function isPassengerWebCheckin(pax: ManifestPassenger): boolean {
  return Boolean(
    pax.isWebCheckin || pax.editCodes?.some((c) => c.toUpperCase() === "WB")
  );
}

/**
 * Returns the number of seated passengers who checked in online (WB) on a flight.
 */
export function getFlightWebCheckinCount(flight: ManifestFlight): number {
  if (typeof flight.webCheckinCount === "number") {
    return flight.webCheckinCount;
  }
  return flight.passengers.filter(
    (p) => isPassengerWithSeat(p) && isPassengerWebCheckin(p)
  ).length;
}

/**
 * Computes the deduplicated report of transported passengers across a list of flights.
 * Rule:
 * - Only passengers who have an assigned seat (isPassengerWithSeat) are considered
 *   to have actually traveled and are included in this report.
 * - A passenger is identified by (lastName, firstName, ticketNumber).
 * - If the same passenger appears on multiple segments with the SAME flight number
 *   (e.g., through-flight continuing to another leg), they are counted ONCE.
 * - If the same passenger appears on segments with DIFFERENT flight numbers
 *   (e.g., connecting flight), they are counted once per distinct flight number.
 */
export function computeTransportedPassengerReport(
  flights: ManifestFlight[]
): TransportedPassengerReport {
  const report: TransportedPassengerReport = {
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
  };

  const seenFlightPassengers = new Set<string>();
  const adultsWithInfantCounted = new Set<string>();
  const seenExplicitInfants = new Set<string>();

  for (const flight of flights) {
    const airline = normIdentityToken(flight.airline || "KP");
    const rawFlightNum = normIdentityToken(flight.flightNumber);
    const normFlightNum = rawFlightNum.replace(/^0+/, "") || rawFlightNum;
    const flightKey = `${airline}|${normFlightNum}`;

    // Track per-segment occurrence index for un-ticketed passengers (e.g., CREW)
    // so multiple CREW on the same leg aren't collapsed, while identical legs are deduplicated.
    const noTicketCountsInSegment = new Map<string, number>();

    for (const pax of flight.passengers) {
      if (!isPassengerWithSeat(pax)) {
        continue;
      }

      report.rawPassengersCount += 1;

      const lastName = normIdentityToken(pax.lastName);
      const firstName = normIdentityToken(pax.firstName);
      const ticketNum = normIdentityToken(
        pax.ticket?.ticketNumber || pax.ticket?.paperTicketNumber
      );

      let paxIdentity: string;
      if (ticketNum) {
        paxIdentity = `${lastName}|${firstName}|${ticketNum}`;
      } else {
        const nameKey = `${lastName}|${firstName}`;
        const occ = noTicketCountsInSegment.get(nameKey) || 0;
        noTicketCountsInSegment.set(nameKey, occ + 1);
        paxIdentity = `${nameKey}|NO_TKT#${occ}`;
      }

      const uniqueFlightPaxKey = `${flightKey}::${paxIdentity}`;

      if (!seenFlightPassengers.has(uniqueFlightPaxKey)) {
        seenFlightPassengers.add(uniqueFlightPaxKey);
        report.totalPassengers += 1;

        if (pax.cabinClass === "C") {
          report.business += 1;
        } else {
          report.economy += 1;
        }

        if (pax.isChild) {
          report.child += 1;
        } else if (pax.gender === "M") {
          report.male += 1;
        } else if (pax.gender === "F") {
          report.female += 1;
        } else {
          report.unknownGender += 1;
        }

        if (isPassengerWebCheckin(pax)) {
          report.webCheckin += 1;
        }
      }

      const infantInfo =
        pax.infant ||
        extractInfantFromRawLines(pax.rawLines, {
          date: flight.date,
          bookingClass: pax.bookingClass,
          route: `${flight.origin}${pax.destination}`,
        });

      const hasInf = pax.hasInfant || Boolean(infantInfo);
      if (hasInf) {
        const infLast = normIdentityToken(infantInfo?.lastName);
        const infFirst = normIdentityToken(infantInfo?.firstName);
        const infTicket = normIdentityToken(
          infantInfo?.ticket?.ticketNumber ||
            infantInfo?.ticket?.paperTicketNumber
        );
        const explicitInfantKey =
          infLast || infFirst || infTicket
            ? `${flightKey}::INF::${infLast}|${infFirst}|${infTicket}`
            : "";

        if (
          !adultsWithInfantCounted.has(uniqueFlightPaxKey) &&
          (!explicitInfantKey || !seenExplicitInfants.has(explicitInfantKey))
        ) {
          adultsWithInfantCounted.add(uniqueFlightPaxKey);
          if (explicitInfantKey) {
            seenExplicitInfants.add(explicitInfantKey);
          }
          report.infant += 1;
        }
      }
    }
  }

  report.deduplicatedCount = Math.max(
    0,
    report.rawPassengersCount - report.totalPassengers
  );

  return report;
}

/**
 * Parses primary passenger line.
 * Formats seen across SJPM:
 *   1  AMA MOOR    VICKY      H   LFW 16L-F  2 F  OB ET ETI
 *  33# AMA MOOR    VICKY      H   LFW 16L-F  2 F  OB ET ETI
 *   2  AMBOMO OND  TIMOT AE2  E   LFW 29A-F  1 M  ET ETI
 *   8  DU          XIAOH      D   SSG  1A-F NB M  CS ET DOCS
 *  13  INKUNIMYEN  GAIL       H   LFW 20C-F  2 CHD OB ET DOCV
 *  22  MESSIMBOUD  CAMIL      Q   LFW     F  0 M  OB DOCS
 *  54  TOGO        HAMMA      L   LFW     F  0 OB DOCS
 * 136  CREW        CREW       Y   LFW 12C-S NB M
 */
function parsePrimaryPassengerLine(line: string): {
  seq: number;
  isTransitMarker: boolean;
  lastName: string;
  firstName: string;
  partyCode?: string;
  bookingClass: string;
  destination: string;
  seat: string;
  fareCode: string;
  bagsDeclaredCount: number;
  isNoBagDeclared: boolean;
  gender: "M" | "F" | "";
  isChild: boolean;
  hasInfant: boolean;
  editCodes: string[];
} | null {
  const seqMatch = line.match(/^\s{0,3}(\d+)(#?)\s+/);
  if (!seqMatch) return null;

  // Locate bookingClass + 3-letter segment destination around col 26..34
  // Pattern after name block: <1 upper letter class> <1-3 spaces> <3 upper letter dst> <1 space> <5-char seat/fare>
  const tailRegex = /^(.{20,32}?)\s+([A-Z])\s{1,3}([A-Z]{3})\s+(.+)$/;
  const match = line.match(tailRegex);
  if (!match) return null;

  const leftBlock = match[1];
  const bookingClass = match[2];
  const destination = match[3];
  const rest = match[4];

  const seq = parseInt(seqMatch[1], 10);
  const isTransitMarker = seqMatch[2] === "#";

  // Extract name fields from fixed DCS layout where possible, with token fallback
  let lastName = "";
  let firstName = "";
  let partyCode: string | undefined;

  if (line.length >= 27) {
    const rawLast = line.slice(4, 16).trim();
    const rawFirstField = line.slice(16, 27).trim();
    if (rawLast) {
      lastName = rawLast;
      const firstParts = rawFirstField.split(/\s+/).filter(Boolean);
      if (
        firstParts.length >= 2 &&
        /^[A-Z]{2}\d+$/.test(firstParts[firstParts.length - 1])
      ) {
        partyCode = firstParts.pop();
      }
      firstName = firstParts.join(" ");
    }
  }

  if (!lastName) {
    const cleanLeft = leftBlock.replace(/^\s*\d+#?\s+/, "").trim();
    const parts = cleanLeft.split(/\s{2,}/);
    lastName = parts[0] || cleanLeft;
    const rawFirst = parts.slice(1).join(" ").trim();
    const firstParts = rawFirst.split(/\s+/).filter(Boolean);
    if (
      firstParts.length >= 2 &&
      /^[A-Z]{2}\d+$/.test(firstParts[firstParts.length - 1])
    ) {
      partyCode = firstParts.pop();
    }
    firstName = firstParts.join(" ");
  }

  // Parse seat/fare, bags count, gender/CHD, and edit codes from `rest`
  // `rest` examples:
  // "16L-F  2 F  OB ET ETI"
  // " 1A-F NB M  CS ET DOCS"
  // "    F  0 M  OB DOCS"
  // "20C-F  2 CHD OB ET DOCV"
  // "    F  0 OB DOCS"
  // "12C-S NB M"
  const restTrimmed = rest.trimStart();
  let seat = "";
  let fareCode = "";
  let afterFare = restTrimmed;

  const seatFareMatch = restTrimmed.match(/^([0-9]{1,2}[A-Z])(?:-([A-Z]))?\s+(.*)$/);
  if (seatFareMatch) {
    seat = seatFareMatch[1].trim();
    fareCode = seatFareMatch[2] || "";
    afterFare = seatFareMatch[3];
  } else {
    const noSeatFareMatch = restTrimmed.match(/^-?([A-Z])\s+(.*)$/);
    if (noSeatFareMatch) {
      fareCode = noSeatFareMatch[1];
      afterFare = noSeatFareMatch[2];
    }
  }

  const tokens = afterFare.trim().split(/\s+/).filter(Boolean);
  let idx = 0;

  let bagsDeclaredCount = 0;
  let isNoBagDeclared = false;
  if (idx < tokens.length) {
    if (tokens[idx] === "NB") {
      isNoBagDeclared = true;
      bagsDeclaredCount = 0;
      idx++;
    } else if (/^\d+$/.test(tokens[idx])) {
      bagsDeclaredCount = parseInt(tokens[idx], 10);
      idx++;
    }
  }

  let gender: "M" | "F" | "" = "";
  let isChild = false;
  let hasInfant = false;

  if (idx < tokens.length) {
    if (tokens[idx] === "M" || tokens[idx] === "F") {
      gender = tokens[idx] as "M" | "F";
      idx++;
    } else if (tokens[idx] === "CHD") {
      isChild = true;
      idx++;
    }
  }

  const editCodes = tokens.slice(idx).map((t) => t.toUpperCase());
  if (editCodes.includes("INF") || editCodes.includes("IFET")) {
    hasInfant = true;
  }

  return {
    seq,
    isTransitMarker,
    lastName,
    firstName,
    partyCode,
    bookingClass,
    destination,
    seat,
    fareCode,
    bagsDeclaredCount,
    isNoBagDeclared,
    gender,
    isChild,
    hasInfant,
    editCodes,
  };
}

export function parseIfetTicketLine(
  trimmedLine: string,
  defaults?: { date?: string; bookingClass?: string; route?: string }
): ManifestTicketInfo | null {
  if (!/^IFET-(?=\S)|^IFET\s+(?=\d)/i.test(trimmedLine)) return null;
  const afterPrefix = trimmedLine.replace(/^IFET(?:-\s*|\s+)/i, "").trim();
  if (!afterPrefix) return null;

  // Standard DCS IFET format: 0323985402031  C01 15NOV L OUALFW USED
  const stdMatch = afterPrefix.match(
    /^([A-Z0-9]+)\s+(C\d{1,2})\s+(\d{1,2}[A-Z]{3})\s+([A-Z])\s+([A-Z]{6})\s+(.+)$/i
  );
  if (stdMatch) {
    return {
      ticketNumber: stdMatch[1].toUpperCase(),
      couponNumber: stdMatch[2].toUpperCase(),
      date: stdMatch[3].toUpperCase(),
      bookingClass: stdMatch[4].toUpperCase(),
      route: stdMatch[5].toUpperCase(),
      status: stdMatch[6].trim().toUpperCase(),
    };
  }

  // Flexible token fallback if spacing/fields differ slightly
  const tokens = afterPrefix.split(/\s+/).filter(Boolean);
  const ticketNumber = (tokens[0] || "").toUpperCase();
  if (!ticketNumber) return null;

  let couponNumber = "";
  let date = (defaults?.date || "").toUpperCase();
  let bookingClass = (defaults?.bookingClass || "").toUpperCase();
  let route = (defaults?.route || "").toUpperCase();
  const statusParts: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i].toUpperCase();
    if (!couponNumber && /^C\d{1,2}$/.test(tok)) {
      couponNumber = tok;
    } else if (/^\d{1,2}[A-Z]{3}$/.test(tok)) {
      date = tok;
    } else if (!bookingClass && /^[A-Z]$/.test(tok)) {
      bookingClass = tok;
    } else if (/^[A-Z]{6}$/.test(tok)) {
      route = tok;
    } else {
      statusParts.push(tok);
    }
  }

  return {
    ticketNumber,
    couponNumber,
    date,
    bookingClass,
    route,
    status: statusParts.join(" ") || "IFET",
  };
}

function parseInfantIdentityLine(trimmedLine: string): {
  lastName: string;
  firstName: string;
  birthDate?: string;
} | null {
  if (!trimmedLine || !trimmedLine.includes(",")) return null;
  if (/^[A-Z]{2}\s+[A-Z]{3}\s+\d{7,}/.test(trimmedLine)) return null;
  if (/^(?:AE-|EMD-|IFET[-\s]|OTHS|PAPER\b|\d+\s*\/\s*\d+\s*KG)/i.test(trimmedLine)) {
    return null;
  }

  const parts = trimmedLine.split(",").map((p) => p.trim());
  if (parts.length < 2 || !parts[0]) return null;

  return {
    lastName: parts[0].toUpperCase(),
    firstName: (parts[1] || "").toUpperCase(),
    birthDate: parts[2] ? parts[2].toUpperCase() : undefined,
  };
}

/**
 * Extracts infant identity + IFET ticket info directly from a passenger's DCS rawLines.
 * Rule: detect any line starting with `IFET-` (ticket number & coupon details) and read
 * the immediately preceding line for the baby's `LASTNAME,FIRSTNAME,BIRTHDATE`.
 */
export function extractInfantFromRawLines(
  rawLines: string[],
  defaults?: { date?: string; bookingClass?: string; route?: string }
): ManifestInfantInfo | undefined {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return undefined;

  let ifetIdx = -1;
  let ticket: ManifestTicketInfo | undefined;
  let rawTicketLine: string | undefined;

  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (/^IFET-(?=\S)|^IFET\s+(?=\d)/i.test(t)) {
      const parsed = parseIfetTicketLine(t, defaults);
      if (parsed) {
        ifetIdx = i;
        ticket = parsed;
        rawTicketLine = t;
        break;
      }
    }
  }

  let lastName = "";
  let firstName = "";
  let birthDate: string | undefined;
  let rawIdentityLine: string | undefined;

  // Rule 1: The non-empty line immediately preceding IFET- (excluding passenger header line 0)
  if (ifetIdx > 1) {
    for (let j = ifetIdx - 1; j >= 1; j--) {
      const prev = rawLines[j].trim();
      if (!prev) continue;
      const identity = parseInfantIdentityLine(prev);
      if (identity) {
        lastName = identity.lastName;
        firstName = identity.firstName;
        birthDate = identity.birthDate;
        rawIdentityLine = prev;
      }
      break;
    }
  }

  // Rule 2: Fallback scan for LAST,FIRST,DDMMMYY anywhere in sub-lines
  if (!lastName) {
    for (let i = 1; i < rawLines.length; i++) {
      const t = rawLines[i].trim();
      if (/^([^,]+?)\s*,\s*([^,]+?)\s*,\s*(\d{1,2}[A-Z]{3}\d{2,4})$/i.test(t)) {
        const identity = parseInfantIdentityLine(t);
        if (identity) {
          lastName = identity.lastName;
          firstName = identity.firstName;
          birthDate = identity.birthDate;
          rawIdentityLine = t;
          break;
        }
      }
    }
  }

  if (!ticket && !lastName) return undefined;

  return {
    lastName,
    firstName,
    fullNameDisplay: `${lastName} ${firstName}`.trim(),
    birthDate,
    ticket,
    rawIdentityLine,
    rawTicketLine,
  };
}

function parseBaggageTagLine(trimmed: string): ManifestBagItem[] | null {
  // Matches e.g.:
  // "KP BGF    3032019163.13,3032019164.14"
  // "KP LOS    3032019335P.4"
  // "KP ABJ    3032019149,3032019150" (bag tag numbers present without weight)
  // "KP ABJ    3032019149.24,3032019150" (mixed: one with weight, one without)
  const bagLineMatch = trimmed.match(
    /^([A-Z0-9]{2})\s+([A-Z]{3})\s+(\d{7,}.*)$/
  );
  if (!bagLineMatch) return null;

  const bagCarrier = bagLineMatch[1].toUpperCase();
  const bagDst = bagLineMatch[2].toUpperCase();
  const bagTokensStr = bagLineMatch[3];
  const rawTokens = bagTokensStr
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const items: ManifestBagItem[] = [];
  for (const tok of rawTokens) {
    const tagMatch = tok.match(/^(\d{7,})([A-Z]?)(?:\.(\d*))?$/i);
    if (!tagMatch) continue;
    const hasExplicitWeight =
      tagMatch[3] !== undefined && tagMatch[3].trim() !== "";
    const parsedWeight = hasExplicitWeight ? parseInt(tagMatch[3], 10) : 0;
    const safeWeight = Number.isFinite(parsedWeight) ? parsedWeight : 0;
    const isMissingWeight = !hasExplicitWeight || safeWeight <= 0;

    items.push({
      carrier: bagCarrier,
      destination: bagDst,
      tag: tagMatch[1],
      marker: tagMatch[2] ? tagMatch[2].toUpperCase() : undefined,
      weight: safeWeight,
      hasMissingWeight: isMissingWeight || undefined,
    });
  }

  return items.length > 0 ? items : null;
}

function parseBaggageTotalLine(
  trimmed: string
): { count: number; weight: number; hasMissingWeight?: boolean } | null {
  // Matches:
  // "2 / 27 KG", "6 / 138KG"
  // "2 /  KG", "2 / 0 KG", "2 / - KG", "2 /" (bag count present without specified weight)
  const stdMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)\s*KG$/i);
  if (stdMatch) {
    const count = parseInt(stdMatch[1], 10);
    const weight = parseInt(stdMatch[2], 10);
    return {
      count,
      weight,
      hasMissingWeight: count > 0 && weight <= 0 ? true : undefined,
    };
  }

  const missingMatch = trimmed.match(/^(\d+)\s*\/\s*(?:-\s*KG|KG|-\s*|)$/i);
  if (missingMatch) {
    const count = parseInt(missingMatch[1], 10);
    if (count > 0) {
      return {
        count,
        weight: 0,
        hasMissingWeight: true,
      };
    }
  }

  return null;
}

export function evaluateMissingBaggageWeight(pax: ManifestPassenger): {
  hasMissingBaggageWeight: boolean;
  missingBaggageWeightDetails: string[];
} {
  const details: string[] = [];
  const bagsWithoutWeight = pax.bags.filter(
    (b) => b.hasMissingWeight || b.weight <= 0
  );
  const declaredCount = Math.max(
    pax.bagsDeclaredCount || 0,
    pax.bagsTotalDeclaredLine?.count || 0
  );
  const actualBagsCount = Math.max(pax.bags.length, declaredCount);

  if (bagsWithoutWeight.length > 0) {
    details.push(
      `Numéro(s) de bagage sans poids spécifié : ${bagsWithoutWeight
        .map((b) => `${b.tag}${b.marker || ""}`)
        .join(", ")}`
    );
  }

  if (
    pax.bagsTotalDeclaredLine &&
    pax.bagsTotalDeclaredLine.count > 0 &&
    (pax.bagsTotalDeclaredLine.hasMissingWeight ||
      pax.bagsTotalDeclaredLine.weight <= 0)
  ) {
    details.push(
      `Ligne total bagages (${pax.bagsTotalDeclaredLine.count} pcs) sans poids spécifié`
    );
  }

  if (
    actualBagsCount > 0 &&
    pax.totalBagWeight <= 0 &&
    bagsWithoutWeight.length === 0 &&
    !pax.bagsTotalDeclaredLine?.hasMissingWeight
  ) {
    details.push(
      `Nombre de bagages déclaré (${actualBagsCount} pcs) sans aucun poids spécifié`
    );
  } else if (
    pax.bags.length > 0 &&
    actualBagsCount > pax.bags.length &&
    bagsWithoutWeight.length === 0 &&
    (!pax.bagsTotalDeclaredLine || pax.bagsTotalDeclaredLine.weight <= 0)
  ) {
    details.push(
      `Nombre de bagages déclaré (${actualBagsCount}) > talons avec poids (${pax.bags.length}) sans total KG`
    );
  }

  return {
    hasMissingBaggageWeight: details.length > 0,
    missingBaggageWeightDetails: details,
  };
}

function finalizePassenger(
  pax: ManifestPassenger,
  flightAirline: string,
  flightOrigin: string
): ManifestPassenger {
  const cabinClass = getCabinClass(pax.bookingClass);
  const allowedBagsCount = 2;
  const allowedWeightPerBag = cabinClass === "C" ? 32 : 24;
  const allowedTotalWeight = allowedBagsCount * allowedWeightPerBag;

  // Deduplicate edit codes preserving order
  const uniqueCodes: string[] = [];
  for (const code of pax.editCodes) {
    if (!uniqueCodes.includes(code)) uniqueCodes.push(code);
  }
  pax.editCodes = uniqueCodes;

  const rawInfant = extractInfantFromRawLines(pax.rawLines, {
    bookingClass: pax.bookingClass,
    route: `${flightOrigin}${pax.destination}`,
  });
  if (rawInfant) {
    pax.infant = {
      lastName: pax.infant?.lastName || rawInfant.lastName,
      firstName: pax.infant?.firstName || rawInfant.firstName,
      fullNameDisplay: "",
      birthDate: pax.infant?.birthDate || rawInfant.birthDate,
      ticket: pax.infant?.ticket || rawInfant.ticket,
      rawIdentityLine: pax.infant?.rawIdentityLine || rawInfant.rawIdentityLine,
      rawTicketLine: pax.infant?.rawTicketLine || rawInfant.rawTicketLine,
    };
  }

  pax.hasInfant =
    pax.hasInfant ||
    Boolean(pax.infant) ||
    uniqueCodes.includes("INF") ||
    uniqueCodes.includes("IFET");
  if (pax.infant) {
    pax.infant = {
      ...pax.infant,
      fullNameDisplay: `${pax.infant.lastName} ${pax.infant.firstName}`.trim(),
    };
    if (pax.infant.ticket && !pax.infant.ticket.route) {
      pax.infant.ticket.route = `${flightOrigin}${pax.destination}`;
    }
  }
  pax.isCodeshare = uniqueCodes.includes("CS");
  pax.isWebCheckin = uniqueCodes.includes("WB");
  pax.isOffloadedOrNoSeat = uniqueCodes.includes("OFL") || !pax.seat;
  pax.paxType = pax.isChild ? "CHD" : pax.hasInfant ? "INF" : "ADT";

  // Total weight: prefer bagsTotalDeclaredLine if > 0, else sum of parsed bags
  const sumBagsWeight = pax.bags.reduce((sum, b) => sum + b.weight, 0);
  if (pax.bagsTotalDeclaredLine && pax.bagsTotalDeclaredLine.weight > 0) {
    pax.totalBagWeight = pax.bagsTotalDeclaredLine.weight;
  } else {
    pax.totalBagWeight = sumBagsWeight;
  }

  if (!pax.baggageDestination) {
    pax.baggageDestination = pax.bags[0]?.destination || pax.destination;
  }

  // Evaluate baggage deviations against KP franchise rules (cumulative weight allowed, max 2 pieces)
  // Economy (Y): max 2 pieces, max 48 kg cumulative (2 x 24 kg)
  // Business (C): max 2 pieces, max 64 kg cumulative (2 x 32 kg)
  const actualBagsCount = getEffectiveBagsCount(pax);
  const deviations: string[] = [];

  if (actualBagsCount > allowedBagsCount) {
    deviations.push(
      `Nombre de bagages (${actualBagsCount}) > franchise (${allowedBagsCount} pièces max)`
    );
  }

  if (pax.totalBagWeight > allowedTotalWeight) {
    deviations.push(
      `Poids cumulé (${pax.totalBagWeight} kg) > franchise cumulée (${allowedTotalWeight} kg max)`
    );
  }

  const hasEmdOrAe =
    pax.emdNumbers.length > 0 ||
    pax.ancillaries.length > 0 ||
    uniqueCodes.includes("AE");

  let baggageCompliance: ManifestBaggageCompliance = "CONFORME";
  if (deviations.length > 0) {
    baggageCompliance = hasEmdOrAe ? "COUVERT_EMD" : "ECART_NON_COUVERT";
  }

  const missingWeightCheck = evaluateMissingBaggageWeight(pax);

  // Clean up duplicate EMD numbers
  pax.emdNumbers = Array.from(new Set(pax.emdNumbers));

  // Ensure ticket info defaults if unused
  if (pax.ticket && !pax.ticket.route) {
    pax.ticket.route = `${flightOrigin}${pax.destination}`;
  }

  return {
    ...pax,
    cabinClass,
    allowedBagsCount,
    allowedWeightPerBag,
    allowedTotalWeight,
    baggageCompliance,
    baggageDeviations: deviations,
    hasMissingBaggageWeight: missingWeightCheck.hasMissingBaggageWeight,
    missingBaggageWeightDetails: missingWeightCheck.missingBaggageWeightDetails,
    fullNameDisplay: `${pax.lastName} ${pax.firstName}`.trim(),
  };
}

function computeFlightStatisticalFields(
  allPassengers: ManifestPassenger[],
  businessPassengers: ManifestPassenger[],
  economyPassengers: ManifestPassenger[]
) {
  // Statistics & reports only consider passengers who actually traveled (with an assigned seat)
  const traveledPassengers = allPassengers.filter(isPassengerWithSeat);
  const traveledBusiness = businessPassengers.filter(isPassengerWithSeat);
  const traveledEconomy = economyPassengers.filter(isPassengerWithSeat);

  const destCounts: Record<string, number> = {};
  for (const p of traveledPassengers) {
    destCounts[p.destination] = (destCounts[p.destination] || 0) + 1;
  }
  const destinationCounts = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));
  const primaryDestination =
    destinationCounts[0]?.code || allPassengers[0]?.destination || "";

  const uniqueEmds = new Set<string>();
  let ancillariesCount = 0;
  let baggageUncoveredDeviationsCount = 0;
  let baggageCoveredDeviationsCount = 0;
  let baggageMissingWeightCount = 0;
  let ffCount = 0;
  let fqtvCount = 0;
  let codeshareCount = 0;
  let etoCount = 0;
  let transitPassengersCount = 0;
  let webCheckinCount = 0;

  for (const p of traveledPassengers) {
    p.emdNumbers.forEach((e) => uniqueEmds.add(e));
    ancillariesCount += p.ancillaries.length;
    if (p.baggageCompliance === "ECART_NON_COUVERT") {
      baggageUncoveredDeviationsCount += 1;
    } else if (p.baggageCompliance === "COUVERT_EMD") {
      baggageCoveredDeviationsCount += 1;
    }
    if (p.hasMissingBaggageWeight) {
      baggageMissingWeightCount += 1;
    }
    if (p.kpFrequentFlyer) ffCount += 1;
    if (p.partnerFrequentFlyer) fqtvCount += 1;
    if (p.isCodeshare) codeshareCount += 1;
    if (p.editCodes.includes("ETO")) etoCount += 1;
    if (p.isTransitMarker) transitPassengersCount += 1;
    if (isPassengerWebCheckin(p)) webCheckinCount += 1;
  }

  return {
    primaryDestination,
    destinationCounts,
    businessTotals: computeTotals(traveledBusiness),
    economyTotals: computeTotals(traveledEconomy),
    grandTotals: computeTotals(traveledPassengers),
    transitPassengersCount,
    emdCount: uniqueEmds.size,
    ancillariesCount,
    baggageUncoveredDeviationsCount,
    baggageCoveredDeviationsCount,
    baggageMissingWeightCount,
    ffCount,
    fqtvCount,
    codeshareCount,
    etoCount,
    webCheckinCount,
  };
}

export function parseManifestFile(rawContent: string): ManifestParseResult {
  const cleaned = rawContent.replace(/\u000c/g, "\n");
  const lines = cleaned.split(/\r?\n/);

  const flights: ManifestFlight[] = [];
  let currentFlight: ManifestFlight | null = null;
  let pendingCommandLine = "";
  let currentPax: ManifestPassenger | null = null;
  let lastAncillary: ManifestAncillaryItem | null = null;

  const commitCurrentPax = () => {
    if (currentFlight && currentPax) {
      const finalized = finalizePassenger(
        currentPax,
        currentFlight.airline,
        currentFlight.origin
      );
      currentFlight.passengers.push(finalized);
    }
    currentPax = null;
    lastAncillary = null;
  };

  const commitCurrentFlight = () => {
    commitCurrentPax();
    if (!currentFlight) return;

    const compareAlpha = (a: ManifestPassenger, b: ManifestPassenger) => {
      const lastCmp = a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" });
      if (lastCmp !== 0) return lastCmp;
      const firstCmp = a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" });
      if (firstCmp !== 0) return firstCmp;
      return a.seq - b.seq;
    };

    // Keep ALL passengers (seated, unseated, No-Show) in passenger lists so users can filter & inspect them
    const businessPassengers = currentFlight.passengers
      .filter((p) => p.cabinClass === "C")
      .sort(compareAlpha)
      .map((p, idx) => ({ ...p, classSeq: idx + 1 }));

    const economyPassengers = currentFlight.passengers
      .filter((p) => p.cabinClass === "Y")
      .sort(compareAlpha)
      .map((p, idx) => ({ ...p, classSeq: idx + 1 }));

    currentFlight.passengers = [...businessPassengers, ...economyPassengers];
    currentFlight.businessPassengers = businessPassengers;
    currentFlight.economyPassengers = economyPassengers;

    const stats = computeFlightStatisticalFields(
      currentFlight.passengers,
      businessPassengers,
      economyPassengers
    );

    currentFlight.primaryDestination = stats.primaryDestination;
    currentFlight.destinationCounts = stats.destinationCounts;
    currentFlight.businessTotals = stats.businessTotals;
    currentFlight.economyTotals = stats.economyTotals;
    currentFlight.grandTotals = stats.grandTotals;
    currentFlight.transitPassengersCount = stats.transitPassengersCount;
    currentFlight.emdCount = stats.emdCount;
    currentFlight.ancillariesCount = stats.ancillariesCount;
    currentFlight.baggageUncoveredDeviationsCount = stats.baggageUncoveredDeviationsCount;
    currentFlight.baggageCoveredDeviationsCount = stats.baggageCoveredDeviationsCount;
    currentFlight.baggageMissingWeightCount = stats.baggageMissingWeightCount;
    currentFlight.ffCount = stats.ffCount;
    currentFlight.fqtvCount = stats.fqtvCount;
    currentFlight.codeshareCount = stats.codeshareCount;
    currentFlight.etoCount = stats.etoCount;

    flights.push(currentFlight);
    currentFlight = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (!trimmed) continue;

    // 1. DCS G*L command line (supports optional prompt prefix like >G*L or PTRG*L)
    if (/(?:^|\s|>)G\*[A-Z0-9]*\//.test(line)) {
      commitCurrentFlight();
      pendingCommandLine = trimmed;
      continue;
    }

    // 2. Flight footer timestamp line: HDQ.HDQ8HEA 1123 12-NOV-2026 1CC450
    const footerMatch = trimmed.match(
      /^([A-Z0-9]+\.[A-Z0-9]+\s+\d{4}\s+\d{2}-[A-Z]{3}-(\d{4})\s+[A-Z0-9]+)$/
    );
    if (footerMatch && currentFlight) {
      commitCurrentPax();
      currentFlight.footerTimestamp = footerMatch[1];
      currentFlight.extractedYear = footerMatch[2].slice(2); // e.g. "26" from 2026
      continue;
    }

    // 3. Flight header line:
    //  KP    69 11NOV   NSI       830   738 BT ET IB OB    C6Y34
    //  KP    71 11NOV   JNB A3    500   738 BT ET IB OB    C1Y60
    //  KP    36 11NOV   LFW 9    1245   737 BT ET IB OB    Y58   (Pure Eco - Yx)
    //  KP    10 11NOV   LFW 3    1410   738 BT ET IB OB    C12Y102
    const flightPrefixMatch = line.match(
      /^\s*([A-Z0-9]{2})\s+(\d+)\s+(\d{1,2}[A-Z]{3})\s+([A-Z]{3})\s+(.+)$/
    );
    if (flightPrefixMatch) {
      const [, airline, flightNumber, date, origin, tail] = flightPrefixMatch;
      const tailTokens = tail.trim().split(/\s+/).filter(Boolean);
      const lastToken = tailTokens[tailTokens.length - 1] || "";
      const compMatch = lastToken.match(/^(?:C(\d+)Y(\d+)|C(\d+)|Y(\d+))$/i);

      if (compMatch || pendingCommandLine) {
        if (currentFlight) commitCurrentFlight();

        let configRaw = "";
        let configBusiness = 0;
        let configEconomy = 0;
        let isPureEconomy = false;
        let bodyTokens = tailTokens;

        if (compMatch) {
          configRaw = lastToken.toUpperCase();
          bodyTokens = tailTokens.slice(0, -1);
          if (compMatch[1] !== undefined && compMatch[2] !== undefined) {
            configBusiness = parseInt(compMatch[1], 10);
            configEconomy = parseInt(compMatch[2], 10);
          } else if (compMatch[3] !== undefined) {
            configBusiness = parseInt(compMatch[3], 10);
            configEconomy = 0;
          } else if (compMatch[4] !== undefined) {
            configBusiness = 0;
            configEconomy = parseInt(compMatch[4], 10);
            isPureEconomy = true;
          }
        }

        let gate: string | undefined;
        let departureTime = "";
        let aircraftType = "";
        let headerEditCodes: string[] = [];

        if (
          bodyTokens.length >= 2 &&
          /^\d{3,4}$/.test(bodyTokens[0]) &&
          /^[A-Z0-9]{3}$/.test(bodyTokens[1]) &&
          (bodyTokens.length === 2 || !/^\d{3}$/.test(bodyTokens[2]))
        ) {
          departureTime = bodyTokens[0];
          aircraftType = bodyTokens[1];
          headerEditCodes = bodyTokens.slice(2);
        } else if (
          bodyTokens.length >= 3 &&
          /^\d{3,4}$/.test(bodyTokens[1]) &&
          /^[A-Z0-9]{3}$/.test(bodyTokens[2])
        ) {
          gate = bodyTokens[0];
          departureTime = bodyTokens[1];
          aircraftType = bodyTokens[2];
          headerEditCodes = bodyTokens.slice(3);
        } else if (bodyTokens.length >= 1) {
          // Fallback if unusual spacing/tokens after G*L command
          const timeIdx = bodyTokens.findIndex((t) => /^\d{3,4}$/.test(t));
          if (timeIdx >= 0) {
            if (timeIdx > 0) gate = bodyTokens[0];
            departureTime = bodyTokens[timeIdx];
            aircraftType = bodyTokens[timeIdx + 1] || "";
            headerEditCodes = bodyTokens.slice(timeIdx + 2);
          } else {
            headerEditCodes = bodyTokens;
          }
        }

        currentFlight = {
          id: `${airline}${flightNumber}-${date}-${origin}-${flights.length + 1}`,
          commandLine: pendingCommandLine,
          airline,
          flightNumber: flightNumber.replace(/^0+/, "") || flightNumber,
          date: date.toUpperCase(),
          origin: origin.toUpperCase(),
          primaryDestination: "",
          destinationCounts: [],
          gate,
          departureTime,
          departureTimeFormatted: formatDepartureTime(departureTime),
          aircraftType,
          configRaw,
          configBusiness,
          configEconomy,
          isPureEconomy,
          headerEditCodes,
          extractedYear: "26",
          passengers: [],
          businessPassengers: [],
          economyPassengers: [],
          businessTotals: createEmptyTotals(),
          economyTotals: createEmptyTotals(),
          grandTotals: createEmptyTotals(),
          transitPassengersCount: 0,
          emdCount: 0,
          ancillariesCount: 0,
          baggageUncoveredDeviationsCount: 0,
          baggageCoveredDeviationsCount: 0,
          baggageMissingWeightCount: 0,
          ffCount: 0,
          fqtvCount: 0,
          codeshareCount: 0,
          etoCount: 0,
        };
        pendingCommandLine = "";
        continue;
      }
    }

    if (!currentFlight) continue;

    // 4. Primary passenger line (starts within 0..3 leading spaces)
    const paxPrimary = parsePrimaryPassengerLine(line);
    if (paxPrimary) {
      commitCurrentPax();
      const cabinClass = getCabinClass(paxPrimary.bookingClass);
      const allowedWeightPerBag = cabinClass === "C" ? 32 : 24;
      currentPax = {
        id: `${currentFlight.id}-P${paxPrimary.seq}-${currentFlight.passengers.length + 1}`,
        seq: paxPrimary.seq,
        classSeq: 0,
        isTransitMarker: paxPrimary.isTransitMarker,
        lastName: paxPrimary.lastName,
        firstName: paxPrimary.firstName,
        partyCode: paxPrimary.partyCode,
        fullNameDisplay: `${paxPrimary.lastName} ${paxPrimary.firstName}`.trim(),
        bookingClass: paxPrimary.bookingClass,
        cabinClass,
        destination: paxPrimary.destination,
        seat: paxPrimary.seat,
        fareCode: paxPrimary.fareCode,
        bagsDeclaredCount: paxPrimary.bagsDeclaredCount,
        isNoBagDeclared: paxPrimary.isNoBagDeclared,
        gender: paxPrimary.gender,
        paxType: paxPrimary.isChild ? "CHD" : paxPrimary.hasInfant ? "INF" : "ADT",
        hasInfant: paxPrimary.hasInfant,
        isChild: paxPrimary.isChild,
        isCodeshare: false,
        isWebCheckin: false,
        isOffloadedOrNoSeat: false,
        editCodes: [...paxPrimary.editCodes],
        bags: [],
        totalBagWeight: 0,
        baggageDestination: "",
        allowedBagsCount: 2,
        allowedWeightPerBag,
        allowedTotalWeight: 2 * allowedWeightPerBag,
        baggageCompliance: "CONFORME",
        baggageDeviations: [],
        ancillaries: [],
        emdNumbers: [],
        othsRemarks: [],
        cmRemarks: [],
        rawLines: [rawLine],
      };
      continue;
    }

    if (!currentPax) continue;
    currentPax.rawLines.push(rawLine);

    // 5. Sub-lines inside passenger block
    // 5a. Ancillary AE line: "         AE-KP 0071/JNBFIH/BG  BG /HI/4 /0"
    const aeMatch = trimmed.match(/^AE-([A-Z]{2}\s*\d+)\/([A-Z]{6})\/(\S+)\s+(.*)$/);
    if (aeMatch) {
      const qtyMatch = aeMatch[4].match(/\/(\d+)\s*\/\d+\s*$/);
      const item: ManifestAncillaryItem = {
        rawHeader: trimmed,
        flightCode: aeMatch[1].replace(/\s+/, " "),
        route: aeMatch[2],
        serviceType: aeMatch[3],
        quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : undefined,
        description: "",
      };
      currentPax.ancillaries.push(item);
      lastAncillary = item;
      continue;
    }

    // 5b. EMD line: "         EMD-0324400114134 C01"
    const emdMatch = trimmed.match(/^EMD-([A-Z0-9]+)(?:\s+(C\d+))?/);
    if (emdMatch) {
      const emdNum = emdMatch[1];
      const coupon = emdMatch[2];
      currentPax.emdNumbers.push(emdNum);
      if (lastAncillary && !lastAncillary.emdNumber) {
        lastAncillary.emdNumber = emdNum;
        lastAncillary.emdCoupon = coupon;
      }
      continue;
    }

    // 5b-bis. Infant electronic ticket line (IFET-):
    // e.g. "         IFET-0323985402031  C01 15NOV L OUALFW USED"
    // or   "         IFET-0322102152007  C02 15NOV Q LFWABJ USED"
    // or   "         IFET-0322102155314  C01 12NOV U LFWBGF USED"
    if (/^IFET-(?=\S)|^IFET\s+(?=\d)/i.test(trimmed)) {
      const parsedIfet = parseIfetTicketLine(trimmed, {
        date: currentFlight.date,
        bookingClass: currentPax.bookingClass,
        route: `${currentFlight.origin}${currentPax.destination}`,
      });
      if (parsedIfet) {
        currentPax.hasInfant = true;
        if (!currentPax.infant) {
          currentPax.infant = {
            lastName: "",
            firstName: "",
            fullNameDisplay: "",
          };
        }
        currentPax.infant.ticket = parsedIfet;
        currentPax.infant.rawTicketLine = trimmed;

        // Also check the immediately preceding line in currentPax.rawLines
        if (!currentPax.infant.lastName && currentPax.rawLines.length >= 3) {
          for (let j = currentPax.rawLines.length - 2; j >= 1; j--) {
            const prev = currentPax.rawLines[j].trim();
            if (!prev) continue;
            const identity = parseInfantIdentityLine(prev);
            if (identity) {
              currentPax.infant.lastName = identity.lastName;
              currentPax.infant.firstName = identity.firstName;
              currentPax.infant.fullNameDisplay =
                `${identity.lastName} ${identity.firstName}`.trim();
              currentPax.infant.birthDate = identity.birthDate;
              currentPax.infant.rawIdentityLine = prev;
            }
            break;
          }
        }
        continue;
      }
    }

    // 5b-ter. Infant identity line:
    // e.g. "         KOITA,HAMADOU,04MAR26"
    // or   "         GBENOU,DOLFLIE FLORENTY,25NOV24"
    const infantWithDobMatch = trimmed.match(
      /^([A-ZÀ-ÿ][A-ZÀ-ÿ0-9\s'\-.]*?)\s*,\s*([A-ZÀ-ÿ][A-ZÀ-ÿ0-9\s'\-.]*?)\s*,\s*(\d{1,2}[A-Z]{3}\d{2,4})$/i
    );
    if (infantWithDobMatch) {
      const infLast = infantWithDobMatch[1].trim().toUpperCase();
      const infFirst = infantWithDobMatch[2].trim().toUpperCase();
      const infBirthDate = infantWithDobMatch[3].trim().toUpperCase();
      currentPax.hasInfant = true;
      currentPax.infant = {
        ...(currentPax.infant || {}),
        lastName: infLast,
        firstName: infFirst,
        fullNameDisplay: `${infLast} ${infFirst}`.trim(),
        birthDate: infBirthDate,
        rawIdentityLine: trimmed,
      };
      continue;
    }

    const paxHasInfCode =
      currentPax.hasInfant ||
      currentPax.editCodes.includes("INF") ||
      currentPax.editCodes.includes("IFET");
    if (paxHasInfCode && !currentPax.infant?.lastName) {
      const infantNoDobMatch = trimmed.match(
        /^([A-ZÀ-ÿ][A-ZÀ-ÿ\s'\-.]{1,})\s*,\s*([A-ZÀ-ÿ][A-ZÀ-ÿ\s'\-.]{1,})$/
      );
      if (
        infantNoDobMatch &&
        !/^OTHS/i.test(trimmed) &&
        !/^AE-/i.test(trimmed) &&
        !/^EMD-/i.test(trimmed)
      ) {
        const infLast = infantNoDobMatch[1].trim().toUpperCase();
        const infFirst = infantNoDobMatch[2].trim().toUpperCase();
        currentPax.hasInfant = true;
        currentPax.infant = {
          ...(currentPax.infant || {}),
          lastName: infLast,
          firstName: infFirst,
          fullNameDisplay: `${infLast} ${infFirst}`.trim(),
          rawIdentityLine: trimmed,
        };
        continue;
      }
    }

    // 5c. Ancillary description line (follows AE header before EMD, 12 spaces indent)
    if (
      lastAncillary &&
      !lastAncillary.emdNumber &&
      /^\s{10,}/.test(line) &&
      !/^[A-Z0-9]{2}\s+[A-Z]{3}\s+\d{7,}/.test(trimmed) &&
      !/^\d+\s*\/\s*(?:\d*\s*KG|-\s*KG|-\s*|)$/i.test(trimmed)
    ) {
      lastAncillary.description = lastAncillary.description
        ? `${lastAncillary.description} ${trimmed}`
        : trimmed;
      continue;
    }

    // 5d. Baggage tag line (with or without weight):
    // e.g. "         KP BGF    3032019163.13,3032019164.14"
    // or   "         KP LOS    3032019335P.4"
    // or   "         KP ABJ    3032019149,3032019150"
    const parsedBagTags = parseBaggageTagLine(trimmed);
    if (parsedBagTags) {
      if (!currentPax.baggageDestination) {
        currentPax.baggageDestination = parsedBagTags[0].destination;
      }
      currentPax.bags.push(...parsedBagTags);
      continue;
    }

    // 5e. Baggage weight total line: "                   2 / 27 KG", "6 / 138KG", or "2 /  KG"
    const parsedBagTotal = parseBaggageTotalLine(trimmed);
    if (parsedBagTotal) {
      currentPax.bagsTotalDeclaredLine = parsedBagTotal;
      continue;
    }

    // 5f. KP Frequent Flyer (FF): "         KP997480584            BROWN"
    const ffMatch = trimmed.match(/^(KP\d{5,})(?:\s+([A-Z]+))?$/);
    if (ffMatch) {
      if (!currentPax.kpFrequentFlyer) {
        currentPax.kpFrequentFlyer = {
          number: ffMatch[1],
          tier: ffMatch[2] || undefined,
        };
      }
      continue;
    }

    // 5g. Partner Frequent Flyer (FQTV): "         ET00026031003" / "KL1056603725" / "AF..."
    const fqtvMatch = trimmed.match(/^([A-Z]{2})([A-Z0-9]{6,})$/);
    if (fqtvMatch && !trimmed.startsWith("OTHS") && /\d{5,}/.test(fqtvMatch[2])) {
      if (!currentPax.partnerFrequentFlyer) {
        currentPax.partnerFrequentFlyer = {
          carrier: fqtvMatch[1],
          number: `${fqtvMatch[1]}${fqtvMatch[2]}`,
        };
      }
      continue;
    }

    // 5h. Ticket coupon line: "         0323997602832  C01 11NOV H NSILFW USED"
    const ticketMatch = trimmed.match(
      /^(\d{10,15})\s+(C\d{2})\s+(\d{2}[A-Z]{3})\s+([A-Z])\s+([A-Z]{6})\s+([A-Z]+)$/
    );
    if (ticketMatch) {
      currentPax.ticket = {
        ticketNumber: ticketMatch[1],
        couponNumber: ticketMatch[2],
        date: ticketMatch[3],
        bookingClass: ticketMatch[4],
        route: ticketMatch[5],
        status: ticketMatch[6],
      };
      continue;
    }

    // 5i. Paper ticket line: "       1 PAPER TKT NBR:03200000000000"
    const paperTicketMatch = trimmed.match(/^\d+\s+PAPER\s+TKT\s+NBR:([A-Z0-9]+)$/i);
    if (paperTicketMatch) {
      currentPax.ticket = {
        ticketNumber: paperTicketMatch[1],
        couponNumber: "PPR",
        date: currentFlight.date,
        bookingClass: currentPax.bookingClass,
        route: `${currentFlight.origin}${currentPax.destination}`,
        status: "PAPER",
        isPaperTicket: true,
        paperTicketNumber: paperTicketMatch[1],
      };
      continue;
    }

    // 5j. Inbound / Outbound continuation flight lines:
    // Outbound: "         KP 34   H  LFW   BGF   11NOV ETD1320 1"
    // Inbound:  "         ET 949  U  ADD  10NOV SKD0100"
    //           "         KP 15   Q  NKC  11NOV/ETA1055"
    //           "         KP 35   B  DLA  11NOV ETA1135"
    const outboundMatch = trimmed.match(
      /^([A-Z0-9]{2})\s+(\d+)\s+([A-Z])\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{2}[A-Z]{3})[\s/]+(ETD)(\d{4})(?:\s+\S+)?$/
    );
    if (outboundMatch) {
      currentPax.outboundFlight = {
        direction: "OUTBOUND",
        carrier: outboundMatch[1],
        flightNumber: outboundMatch[2],
        bookingClass: outboundMatch[3],
        origin: outboundMatch[4],
        destination: outboundMatch[5],
        date: outboundMatch[6],
        timeType: "ETD",
        time: outboundMatch[8],
        rawLine: trimmed,
      };
      continue;
    }

    const inboundMatch = trimmed.match(
      /^([A-Z0-9]{2})\s+(\d+)\s+([A-Z])\s+([A-Z]{3})\s+(\d{2}[A-Z]{3})[\s/]+(ETA|SKD)(\d{4})(?:\s+\S+)?$/
    );
    if (inboundMatch) {
      currentPax.inboundFlight = {
        direction: "INBOUND",
        carrier: inboundMatch[1],
        flightNumber: inboundMatch[2],
        bookingClass: inboundMatch[3],
        origin: inboundMatch[4],
        date: inboundMatch[5],
        timeType: inboundMatch[6] as "ETA" | "SKD",
        time: inboundMatch[7],
        rawLine: trimmed,
      };
      continue;
    }

    // 5k. OTHS remark: "         OTHS-/ET1009S11NOV ET1009S11NOV"
    if (trimmed.startsWith("OTHS")) {
      currentPax.othsRemarks.push(trimmed);
      continue;
    }

    // 5l. CM numbered remark: "       1 ACC 02KG AMATH" or "       1 07030990901"
    if (/^\s{5,}\d+\s+/.test(line)) {
      currentPax.cmRemarks.push(trimmed);
      continue;
    }

    // 5m. Wrapped edit codes line (typically heavily indented, e.g. col 45):
    // "                                             DOCV DOCS ETI AE"
    if (/^\s{25,}/.test(line)) {
      const wrappedCodes = trimmed.split(/\s+/).filter(Boolean);
      for (const c of wrappedCodes) {
        currentPax.editCodes.push(c.toUpperCase());
      }
      continue;
    }
  }

  commitCurrentFlight();

  return aggregateManifestFlights(flights);
}

const DCS_MONTH_ORDER: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const FRENCH_MONTH_NAMES: Record<string, string> = {
  JAN: "janv.",
  FEB: "févr.",
  MAR: "mars",
  APR: "avr.",
  MAY: "mai",
  JUN: "juin",
  JUL: "juil.",
  AUG: "août",
  SEP: "sept.",
  OCT: "oct.",
  NOV: "nov.",
  DEC: "déc.",
};

const ENGLISH_MONTH_NAMES: Record<string, string> = {
  JAN: "Jan",
  FEB: "Feb",
  MAR: "Mar",
  APR: "Apr",
  MAY: "May",
  JUN: "Jun",
  JUL: "Jul",
  AUG: "Aug",
  SEP: "Sep",
  OCT: "Oct",
  NOV: "Nov",
  DEC: "Dec",
};

export function formatDcsBirthDate(
  rawDate?: string,
  language: "fr" | "en" = "fr"
): string {
  if (!rawDate) return "";
  const clean = rawDate.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
  if (!match) return clean;
  const day = match[1].padStart(2, "0");
  const monthCode = match[2];
  const monthNum = DCS_MONTH_ORDER[monthCode];
  const yr = match[3].length === 2 ? `20${match[3]}` : match[3];
  if (!monthNum) return clean;
  const monthLabel =
    language === "en"
      ? ENGLISH_MONTH_NAMES[monthCode] || monthCode
      : FRENCH_MONTH_NAMES[monthCode] || monthCode;
  return `${day} ${monthLabel} ${yr} (${day}/${String(monthNum).padStart(2, "0")}/${yr})`;
}

export function normalizeDcsFlightDate(rawDate: string): string {
  const clean = (rawDate || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})$/);
  if (!match) return clean || "SANS_DATE";
  return `${match[1].padStart(2, "0")}${match[2]}`;
}

export function getDcsFlightDateSortOrder(
  rawDate: string,
  extractedYear = "26"
): number {
  const clean = normalizeDcsFlightDate(rawDate);
  const match = clean.match(/^(\d{2})([A-Z]{3})$/);
  if (!match) return 0;
  const day = parseInt(match[1], 10) || 1;
  const month = DCS_MONTH_ORDER[match[2]] || 0;
  const yrDigits = parseInt(extractedYear, 10);
  const year = Number.isFinite(yrDigits)
    ? yrDigits < 100
      ? 2000 + yrDigits
      : yrDigits
    : 2026;
  return year * 10000 + month * 100 + day;
}

export function aggregateManifestFlights(
  flights: ManifestFlight[]
): ManifestParseResult {
  // Deduplicate flights sharing same (airline, flightNumber, normalizedDate, origin), keeping richest entry
  const uniqueMap = new Map<string, ManifestFlight>();
  for (const f of flights) {
    const normDate = normalizeDcsFlightDate(f.date);
    const normalizedFlight =
      normDate !== f.date ? { ...f, date: normDate } : f;
    const key = `${f.airline}|${f.flightNumber.replace(/^0+/, "") || f.flightNumber}|${normDate}|${f.origin}`;
    const existing = uniqueMap.get(key);
    if (!existing || f.passengers.length >= existing.passengers.length) {
      uniqueMap.set(key, normalizedFlight);
    }
  }

  // Sort flights: most recent date first, then flight number ascending, then departure time & origin
  const dedupedFlights = Array.from(uniqueMap.values()).sort((a, b) => {
    const dateOrderDiff =
      getDcsFlightDateSortOrder(b.date, b.extractedYear) -
      getDcsFlightDateSortOrder(a.date, a.extractedYear);
    if (dateOrderDiff !== 0) return dateOrderDiff;

    const numA = parseInt(a.flightNumber, 10) || 0;
    const numB = parseInt(b.flightNumber, 10) || 0;
    if (numA !== numB) return numA - numB;

    const timeDiff = (a.departureTime || "").localeCompare(b.departureTime || "");
    if (timeDiff !== 0) return timeDiff;

    return (a.origin || "").localeCompare(b.origin || "");
  });

  let totalPassengers = 0;
  let totalBusinessPassengers = 0;
  let totalEconomyPassengers = 0;
  let totalBags = 0;
  let totalWeight = 0;
  let totalUncoveredDeviations = 0;
  let totalCoveredDeviations = 0;
  let totalMissingBaggageWeightCount = 0;
  let totalEmds = 0;
  let totalLoyaltyCount = 0;
  let totalWebCheckin = 0;

  const uniqueDates: string[] = [];
  for (const f of dedupedFlights) {
    if (f.date && !uniqueDates.includes(f.date)) {
      uniqueDates.push(f.date);
    }
    totalPassengers += f.grandTotals.passengersCount;
    totalBusinessPassengers += f.businessTotals.passengersCount;
    totalEconomyPassengers += f.economyTotals.passengersCount;
    totalBags += f.grandTotals.bagsCount;
    totalWeight += f.grandTotals.totalWeight;
    totalUncoveredDeviations += f.baggageUncoveredDeviationsCount;
    totalCoveredDeviations += f.baggageCoveredDeviationsCount;
    totalMissingBaggageWeightCount += f.baggageMissingWeightCount || 0;
    totalEmds += f.emdCount;
    totalLoyaltyCount += f.ffCount + f.fqtvCount;
    totalWebCheckin += getFlightWebCheckinCount(f);
  }

  return {
    flights: dedupedFlights,
    totalFlights: dedupedFlights.length,
    totalPassengers,
    totalBusinessPassengers,
    totalEconomyPassengers,
    totalBags,
    totalWeight,
    totalUncoveredDeviations,
    totalCoveredDeviations,
    totalMissingBaggageWeightCount,
    totalEmds,
    totalLoyaltyCount,
    totalWebCheckin,
    manifestDate: uniqueDates.join(", ") || "",
    extractedTimestamp: dedupedFlights.find((f) => f.footerTimestamp)?.footerTimestamp,
  };
}

export function mergeManifestResults(
  existing: ManifestParseResult | null,
  newContents: string[]
): ManifestParseResult {
  const combinedFlights: ManifestFlight[] = existing ? [...existing.flights] : [];
  for (const content of newContents) {
    const parsed = parseManifestFile(content);
    combinedFlights.push(...parsed.flights);
  }
  return aggregateManifestFlights(combinedFlights);
}

/**
 * Re-enriches stored ManifestParseResult records (e.g. from IndexedDB)
 * so passenger infant identity & IFET tickets are always populated from rawLines.
 */
export function hydrateManifestResult(
  result: ManifestParseResult
): ManifestParseResult {
  if (!result || !Array.isArray(result.flights)) return result;

  let changed = false;
  const hydratedFlights = result.flights.map((flight) => {
    let flightChanged = false;
    const enrichPax = (pax: ManifestPassenger): ManifestPassenger => {
      let nextPax = pax;
      let paxChanged = false;

      if (!pax.infant || (!pax.infant.lastName && !pax.infant.ticket)) {
        const extracted = extractInfantFromRawLines(pax.rawLines, {
          date: flight.date,
          bookingClass: pax.bookingClass,
          route: `${flight.origin}${pax.destination}`,
        });
        if (extracted) {
          paxChanged = true;
          nextPax = {
            ...nextPax,
            hasInfant: true,
            paxType: nextPax.isChild ? "CHD" : "INF",
            infant: extracted,
          };
        }
      }

      if (nextPax.hasMissingBaggageWeight === undefined) {
        let reBags = nextPax.bags;
        let reDeclaredTotal = nextPax.bagsTotalDeclaredLine;
        if (Array.isArray(nextPax.rawLines) && nextPax.rawLines.length > 1) {
          const parsedTags: ManifestBagItem[] = [];
          let parsedTotal:
            | { count: number; weight: number; hasMissingWeight?: boolean }
            | undefined;
          for (let i = 1; i < nextPax.rawLines.length; i++) {
            const t = nextPax.rawLines[i].trim();
            if (!t) continue;
            const tags = parseBaggageTagLine(t);
            if (tags) parsedTags.push(...tags);
            const tot = parseBaggageTotalLine(t);
            if (tot) parsedTotal = tot;
          }
          if (parsedTags.length > reBags.length) {
            reBags = parsedTags;
          }
          if (parsedTotal && !reDeclaredTotal) {
            reDeclaredTotal = parsedTotal;
          }
        }
        const candidatePax: ManifestPassenger = {
          ...nextPax,
          bags: reBags,
          bagsTotalDeclaredLine: reDeclaredTotal,
        };
        const missingCheck = evaluateMissingBaggageWeight(candidatePax);
        paxChanged = true;
        nextPax = {
          ...candidatePax,
          hasMissingBaggageWeight: missingCheck.hasMissingBaggageWeight,
          missingBaggageWeightDetails: missingCheck.missingBaggageWeightDetails,
        };
      }

      if (paxChanged) {
        flightChanged = true;
        changed = true;
      }
      return nextPax;
    };

    const passengers = flight.passengers.map(enrichPax);
    const businessPassengers = passengers.filter((p) => p.cabinClass === "C");
    const economyPassengers = passengers.filter((p) => p.cabinClass === "Y");
    const stats = computeFlightStatisticalFields(
      passengers,
      businessPassengers,
      economyPassengers
    );

    const statsMismatch =
      flight.grandTotals?.passengersCount !== stats.grandTotals.passengersCount ||
      flight.businessTotals?.passengersCount !== stats.businessTotals.passengersCount ||
      flight.economyTotals?.passengersCount !== stats.economyTotals.passengersCount ||
      flight.grandTotals?.bagsCount !== stats.grandTotals.bagsCount ||
      flight.grandTotals?.totalWeight !== stats.grandTotals.totalWeight ||
      flight.baggageMissingWeightCount !== stats.baggageMissingWeightCount ||
      flight.baggageUncoveredDeviationsCount !== stats.baggageUncoveredDeviationsCount ||
      flight.baggageCoveredDeviationsCount !== stats.baggageCoveredDeviationsCount ||
      flight.emdCount !== stats.emdCount ||
      flight.ffCount !== stats.ffCount ||
      flight.fqtvCount !== stats.fqtvCount ||
      flight.webCheckinCount !== stats.webCheckinCount;

    if (!flightChanged && !statsMismatch) {
      return flight;
    }

    changed = true;
    return {
      ...flight,
      passengers,
      businessPassengers,
      economyPassengers,
      ...stats,
    };
  });

  const expectedTotalPassengers = hydratedFlights.reduce(
    (sum, f) => sum + f.grandTotals.passengersCount,
    0
  );
  const expectedTotalBusiness = hydratedFlights.reduce(
    (sum, f) => sum + f.businessTotals.passengersCount,
    0
  );
  const expectedTotalEconomy = hydratedFlights.reduce(
    (sum, f) => sum + f.economyTotals.passengersCount,
    0
  );
  const expectedTotalWebCheckin = hydratedFlights.reduce(
    (sum, f) => sum + getFlightWebCheckinCount(f),
    0
  );

  if (
    !changed &&
    result.totalPassengers === expectedTotalPassengers &&
    result.totalBusinessPassengers === expectedTotalBusiness &&
    result.totalEconomyPassengers === expectedTotalEconomy &&
    result.totalWebCheckin === expectedTotalWebCheckin
  ) {
    return result;
  }

  return {
    ...result,
    flights: hydratedFlights,
    totalPassengers: expectedTotalPassengers,
    totalBusinessPassengers: expectedTotalBusiness,
    totalEconomyPassengers: expectedTotalEconomy,
    totalBags: hydratedFlights.reduce((sum, f) => sum + f.grandTotals.bagsCount, 0),
    totalWeight: hydratedFlights.reduce((sum, f) => sum + f.grandTotals.totalWeight, 0),
    totalUncoveredDeviations: hydratedFlights.reduce(
      (sum, f) => sum + f.baggageUncoveredDeviationsCount,
      0
    ),
    totalCoveredDeviations: hydratedFlights.reduce(
      (sum, f) => sum + f.baggageCoveredDeviationsCount,
      0
    ),
    totalMissingBaggageWeightCount: hydratedFlights.reduce(
      (sum, f) => sum + (f.baggageMissingWeightCount || 0),
      0
    ),
    totalEmds: hydratedFlights.reduce((sum, f) => sum + f.emdCount, 0),
    totalLoyaltyCount: hydratedFlights.reduce(
      (sum, f) => sum + f.ffCount + f.fqtvCount,
      0
    ),
    totalWebCheckin: expectedTotalWebCheckin,
  };
}

/**
 * Formats an integer padded on the left with dots `.` (e.g. padDot(2, 3) => "..2")
 */
function padDotLeft(value: string | number, width: number): string {
  const s = String(value);
  if (s.length >= width) return s.slice(0, width);
  return ".".repeat(width - s.length) + s;
}

function formatEnhancedPassengerRows(
  passengers: ManifestPassenger[],
  excludeUnboarded: boolean
): { lines: string[]; totals: ManifestCabinTotals } {
  const included = excludeUnboarded
    ? passengers.filter((p) => isPassengerWithSeat(p))
    : passengers;

  const lines: string[] = [];

  for (const pax of included) {
    const seqCol = String(pax.seq).padStart(3, "0");
    // Format: LNAME/FNAME padded/truncated to 13 chars
    const combinedName = `${pax.lastName}/${pax.firstName}`;
    const nameCol =
      combinedName.length >= 13
        ? combinedName.slice(0, 13)
        : combinedName.padEnd(13, " ");

    // TYPE: 2 chars -> "M.", "F.", or ".." if child or unknown
    const typeCol = pax.isChild
      ? ".."
      : pax.gender === "M"
      ? "M."
      : pax.gender === "F"
      ? "F."
      : "..";

    // SEAT: 3 chars dot-left-padded -> ".2L" or "19L" or "..."
    const seatCol = pax.seat ? padDotLeft(pax.seat, 3) : "...";

    // BAGS: 3 chars dot-left-padded -> "..2", "..0"
    const actualBagsCount = getEffectiveBagsCount(pax);
    const bagsCol = padDotLeft(actualBagsCount, 3);

    // WEIGHT: 6 chars dot-left-padded -> "....46" or "......" if 0 bags or missing weight
    const weightCol =
      pax.totalBagWeight > 0
        ? padDotLeft(pax.totalBagWeight, 6)
        : "......";

    // BAGTAG: 10 chars -> bag 1 tag or ".........."
    const bagTagCol = pax.bags[0]?.tag
      ? pax.bags[0].tag.slice(0, 10).padStart(10, ".")
      : "..........";

    // TKT#: 13 chars -> ticketNumber or "............." (Paper ticket shows dots like KP_13-11-2026 line 100)
    const rawTkt =
      pax.ticket && !pax.ticket.isPaperTicket ? pax.ticket.ticketNumber : "";
    const tktCol = rawTkt
      ? rawTkt.slice(0, 13).padStart(13, ".")
      : ".............";

    // IN.FLT & TR.ORG
    const inFltCol = pax.inboundFlight
      ? `${pax.inboundFlight.carrier}${pax.inboundFlight.flightNumber.padStart(5, "0")}`.slice(
          0,
          7
        )
      : ".......";
    const trOrgCol = pax.inboundFlight?.origin
      ? pax.inboundFlight.origin.slice(0, 3).padEnd(3, ".")
      : "...";

    // OT.FLT & F.DST
    const otFltCol = pax.outboundFlight
      ? `${pax.outboundFlight.carrier}${pax.outboundFlight.flightNumber.padStart(5, "0")}`.slice(
          0,
          7
        )
      : ".......";
    const fDstCol = pax.outboundFlight?.destination
      ? pax.outboundFlight.destination.slice(0, 3).padEnd(3, ".")
      : "...";

    // SPECIAL: 4 chars -> "INF." / "CHD." / "...."
    const specialCol = pax.hasInfant
      ? "INF."
      : pax.isChild
      ? "CHD."
      : "....";

    const row = `${seqCol} ${nameCol}/${typeCol}/${seatCol}/${bagsCol}/${weightCol}/${bagTagCol}/${tktCol}/${inFltCol}/${trOrgCol}/${otFltCol}/${fDstCol}/${specialCol}`;
    lines.push(row);

    // Extra baggage lines (. + 33 spaces + TAG.WEIGHT)
    for (let bIdx = 1; bIdx < pax.bags.length; bIdx++) {
      const b = pax.bags[bIdx];
      lines.push(
        `.                                 ${b.tag}${b.hasMissingWeight || b.weight <= 0 ? "" : `.${b.weight}`}`
      );
    }
  }

  return {
    lines,
    totals: computeTotals(included),
  };
}

function formatEnhancedTotalsLines(totals: ManifestCabinTotals, includeHeader = true): string[] {
  const out: string[] = [];
  if (includeHeader) {
    out.push("TOTALS:   MALE  FEMALE  UNKNOWN  CHILD  INFANT  BAGS    WEIGHT");
    out.push("");
  }
  // Column end indices in header (62 chars total):
  // TOTALS:(6) MALE(13) FEMALE(21) UNKNOWN(30) CHILD(37) INFANT(45) BAGS(51) WEIGHT(61)
  const totalPaxStr = String(totals.passengersCount).padStart(7, " ");
  const maleStr = String(totals.male).padStart(7, " ");
  const femaleStr = String(totals.female).padStart(8, " ");
  const unknownStr = String(totals.unknown).padStart(9, " ");
  const childStr = String(totals.child).padStart(7, " ");
  const infantStr = String(totals.infant).padStart(8, " ");
  const bagsStr = String(totals.bagsCount).padStart(6, " ");
  const weightStr = String(totals.totalWeight).padStart(10, " ");
  out.push(`${totalPaxStr}${maleStr}${femaleStr}${unknownStr}${childStr}${infantStr}${bagsStr}${weightStr}`);
  return out;
}

/**
 * Generates exact ENHANCED PASSENGER MANIFEST text matching KP_13-11-2026_10-11-34878.txt
 */
export function generateEnhancedManifestText(
  flight: ManifestFlight,
  options?: { excludeUnboarded?: boolean }
): string {
  const excludeUnboarded = options?.excludeUnboarded ?? true;
  const lines: string[] = [];

  const fltNumPadded = flight.flightNumber.padStart(4, " ");
  const dateWithYear = `${flight.date}${flight.extractedYear || "26"}`;
  const embarkPadded = (flight.origin || "...").padEnd(13, " ");
  const dest = flight.primaryDestination || "...";

  lines.push("ENHANCED PASSENGER MANIFEST");
  lines.push(`FLIGHT: ${flight.airline} ${fltNumPadded}             DATE: ${dateWithYear}`);
  lines.push(`A/C REG. .......        PT.OF EMBARKATION: ${embarkPadded}PT.OF DEST: ${dest}`);
  lines.push("-".repeat(80));
  lines.push("LNAME/FNAME/TYPE/SEAT/BAGS/WEIGHT/BAGTAG/TKT#/IN.FLT/TR.ORG/OT.FLT/F.DST/SPECIAL");
  lines.push("");

  // C CLASS
  lines.push("C CLASS");
  lines.push("");
  const cResult = formatEnhancedPassengerRows(flight.businessPassengers, excludeUnboarded);
  lines.push(...cResult.lines);
  lines.push("");
  lines.push("");
  lines.push(...formatEnhancedTotalsLines(cResult.totals, true));
  lines.push("");
  lines.push("");

  // Y CLASS
  lines.push("Y CLASS");
  lines.push("");
  const yResult = formatEnhancedPassengerRows(flight.economyPassengers, excludeUnboarded);
  lines.push(...yResult.lines);
  lines.push("");
  lines.push("");
  lines.push(...formatEnhancedTotalsLines(yResult.totals, true));
  lines.push("");
  lines.push("");

  // GRAND TOTALS
  const grandTotals: ManifestCabinTotals = {
    male: cResult.totals.male + yResult.totals.male,
    female: cResult.totals.female + yResult.totals.female,
    unknown: cResult.totals.unknown + yResult.totals.unknown,
    child: cResult.totals.child + yResult.totals.child,
    infant: cResult.totals.infant + yResult.totals.infant,
    passengersCount: cResult.totals.passengersCount + yResult.totals.passengersCount,
    bagsCount: cResult.totals.bagsCount + yResult.totals.bagsCount,
    totalWeight: cResult.totals.totalWeight + yResult.totals.totalWeight,
  };

  lines.push(`TOTALS PASSENGERS: ${grandTotals.passengersCount}`);
  lines.push("-".repeat(80));
  lines.push("TOTALS:   MALE  FEMALE  UNKNOWN  CHILD  INFANT  BAGS    WEIGHT");
  lines.push(...formatEnhancedTotalsLines(grandTotals, false));
  lines.push("");
  lines.push("");
  lines.push("IN.FLT/TR.ORGN/OT.FLT/F.SDT");
  lines.push("INBOUND FLIGHT/TRUE ORIGIN/OUTBOUND FLIGHT/FINAL DESTINATION");

  return lines.join("\r\n") + "\r\n";
}

export function generateAllEnhancedManifestsText(
  flights: ManifestFlight[],
  options?: { excludeUnboarded?: boolean }
): string {
  return flights
    .map((flight) => generateEnhancedManifestText(flight, options))
    .join("\r\n" + "=".repeat(80) + "\r\n\r\n");
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportManifestToExcel(
  flights: ManifestFlight[],
  filename: string,
  language: "fr" | "en" = "fr"
): void {
  const wb = XLSX.utils.book_new();
  const isEn = language === "en";

  if (isEn) {
    const flightsSummaryRows = flights.map((f) => {
      const noShowCount = f.passengers.filter(isPassengerNoShow).length;
      const unseatedCount = f.passengers.length - f.grandTotals.passengersCount;
      const wbCount = getFlightWebCheckinCount(f);
      const wbPct =
        f.grandTotals.passengersCount > 0
          ? Number(((wbCount / f.grandTotals.passengersCount) * 100).toFixed(1))
          : 0;
      return {
        "Flight": `${f.airline} ${f.flightNumber}`,
        "Date": f.date,
        "Origin": f.origin,
        "Primary Dest.": f.primaryDestination,
        "Gate": f.gate || "-",
        "Departure Time": f.departureTimeFormatted,
        "Aircraft": f.aircraftType,
        "Config (C/Y)": f.configRaw,
        "Traveled Passengers": f.grandTotals.passengersCount,
        "Business (C)": f.businessTotals.passengersCount,
        "Economy (Y)": f.economyTotals.passengersCount,
        "Web Check-in (WB)": wbCount,
        "Web Check-in %": `${wbPct}%`,
        "No-Show": noShowCount,
        "Unseated (Total)": unseatedCount,
        "Male (M)": f.grandTotals.male,
        "Female (F)": f.grandTotals.female,
        "Child (CHD)": f.grandTotals.child,
        "Infant (INF)": f.grandTotals.infant,
        "Total Bags": f.grandTotals.bagsCount,
        "Total Weight (kg)": f.grandTotals.totalWeight,
        "Uncovered Deviations": f.baggageUncoveredDeviationsCount,
        "EMD Covered": f.baggageCoveredDeviationsCount,
        "Missing Bag Weights": f.baggageMissingWeightCount || 0,
        "Total EMD": f.emdCount,
        "FF / FQTV": f.ffCount + f.fqtvCount,
        "Transit (#)": f.transitPassengersCount,
      };
    });

    const wsSummary = XLSX.utils.json_to_sheet(flightsSummaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Flights Summary");

    const paxRows = flights.flatMap((f) =>
      f.passengers.map((p) => ({
        "Flight": `${f.airline} ${f.flightNumber}`,
        "Date": f.date,
        "Origin": f.origin,
        "Seq No.": `${String(p.classSeq || p.seq).padStart(3, "0")}${p.isTransitMarker ? "#" : ""}`,
        "Boarding Status": isPassengerWithSeat(p)
          ? "Traveled (Seated)"
          : "No-Show (Unseated)",
        "Web Check-in (WB)": isPassengerWebCheckin(p) ? "YES" : "NO",
        "Transit (#)": p.isTransitMarker ? "Yes" : "No",
        "Cabin": p.cabinClass === "C" ? "C (Business)" : "Y (Economy)",
        "Booking Class": p.bookingClass,
        "Last Name": p.lastName,
        "First Name": p.firstName,
        "Party Code": p.partyCode || "-",
        "Gender / Type": p.isChild ? "CHD" : p.gender || "-",
        "Infant": p.hasInfant ? "INF" : "-",
        "Infant Name (INF)": p.infant?.fullNameDisplay || "-",
        "Infant DOB": p.infant?.birthDate || "-",
        "Infant Ticket (IFET)": p.infant?.ticket?.ticketNumber || "-",
        "Seat": p.seat || "Unassigned",
        "Fare": p.fareCode || "-",
        "Segment Dest.": p.destination,
        "Final Bag Dest.": p.baggageDestination || p.destination,
        "Bags Count": getEffectiveBagsCount(p),
        "Total Weight (kg)": p.hasMissingBaggageWeight && p.totalBagWeight === 0 ? "MISSING" : p.totalBagWeight,
        "Combined Allowance (kg)": p.allowedTotalWeight,
        "Baggage Compliance":
          p.baggageCompliance === "CONFORME"
            ? p.hasMissingBaggageWeight
              ? "Missing Weight"
              : "Compliant"
            : p.baggageCompliance === "COUVERT_EMD"
            ? "Covered by EMD"
            : "Uncovered Deviation",
        "Missing Weight Flag": p.hasMissingBaggageWeight ? "YES" : "NO",
        "Baggage Alerts": [
          ...p.baggageDeviations.map((d) => translateBaggageDeviation(d, "en")),
          ...(p.missingBaggageWeightDetails || []).map((d) =>
            translateMissingBaggageDetail(d, "en")
          ),
        ].join(" | "),
        "Bag Tags": p.bags
          .map((b) =>
            `${b.tag}${b.marker || ""}${
              b.hasMissingWeight || b.weight <= 0 ? " (missing wt)" : `.${b.weight}kg`
            }`
          )
          .join(", "),
        "EMD": p.emdNumbers.join(", "),
        "AE Services": p.ancillaries
          .map((a) => `${a.rawHeader}${a.description ? ` (${a.description})` : ""}`)
          .join(" | "),
        "FF KP": p.kpFrequentFlyer
          ? `${p.kpFrequentFlyer.number}${p.kpFrequentFlyer.tier ? ` (${p.kpFrequentFlyer.tier})` : ""}`
          : "-",
        "Partner FQTV": p.partnerFrequentFlyer ? p.partnerFrequentFlyer.number : "-",
        "Inbound Flight": p.inboundFlight
          ? `${p.inboundFlight.carrier}${p.inboundFlight.flightNumber} ${p.inboundFlight.origin} ${p.inboundFlight.timeType}${p.inboundFlight.time}`
          : "-",
        "Outbound Flight": p.outboundFlight
          ? `${p.outboundFlight.carrier}${p.outboundFlight.flightNumber} ${p.outboundFlight.destination} ETD${p.outboundFlight.time}`
          : "-",
        "Ticket No.": p.ticket?.ticketNumber || "-",
        "Coupon": p.ticket?.couponNumber || "-",
        "Ticket Status": p.ticket?.status || "-",
        "Edit Codes": p.editCodes.join(" "),
      }))
    );

    const wsPax = XLSX.utils.json_to_sheet(paxRows);
    XLSX.utils.book_append_sheet(wb, wsPax, "Detailed Manifest");

    const deviationRows = flights.flatMap((f) =>
      f.passengers
        .filter(
          (p) =>
            isPassengerWithSeat(p) &&
            (p.baggageCompliance !== "CONFORME" || p.hasMissingBaggageWeight)
        )
        .map((p) => ({
          "Date": f.date,
          "Flight": `${f.airline} ${f.flightNumber}`,
          "Origin": f.origin,
          "Seq No.": `${String(p.classSeq || p.seq).padStart(3, "0")}${p.isTransitMarker ? "#" : ""}`,
          "Passenger": p.fullNameDisplay,
          "Cabin": p.cabinClass === "C" ? "Business (C - 2 pcs / 64 kg)" : "Economy (Y - 2 pcs / 48 kg)",
          "Seat": p.seat || "-",
          "Bags Count": getEffectiveBagsCount(p),
          "Total Weight (kg)": p.hasMissingBaggageWeight && p.totalBagWeight === 0 ? "MISSING" : p.totalBagWeight,
          "Status":
            p.baggageCompliance === "ECART_NON_COUVERT"
              ? "UNCOVERED DEVIATION"
              : p.baggageCompliance === "COUVERT_EMD"
              ? "COVERED BY EMD"
              : "MISSING WEIGHT",
          "Deviation Details": [
            ...p.baggageDeviations.map((d) => translateBaggageDeviation(d, "en")),
            ...(p.missingBaggageWeightDetails || []).map((d) =>
              translateMissingBaggageDetail(d, "en")
            ),
          ].join(" | "),
          "Associated EMD": p.emdNumbers.join(", ") || "NONE",
          "Bag Tags": p.bags
            .map((b) =>
              `${b.tag} (${b.hasMissingWeight || b.weight <= 0 ? "missing wt" : `${b.weight}kg`})`
            )
            .join(", "),
        }))
    );

    if (deviationRows.length > 0) {
      const wsDev = XLSX.utils.json_to_sheet(deviationRows);
      XLSX.utils.book_append_sheet(wb, wsDev, "Baggage Deviations");
    }

    XLSX.writeFile(wb, filename);
    return;
  }

  // Sheet 1: Résumé des Vols (Passagers ayant voyagé / avec siège)
  const flightsSummaryRows = flights.map((f) => {
    const noShowCount = f.passengers.filter(isPassengerNoShow).length;
    const unseatedCount = f.passengers.length - f.grandTotals.passengersCount;
    const wbCount = getFlightWebCheckinCount(f);
    const wbPct =
      f.grandTotals.passengersCount > 0
        ? Number(((wbCount / f.grandTotals.passengersCount) * 100).toFixed(1))
        : 0;
    return {
      "Vol": `${f.airline} ${f.flightNumber}`,
      "Date": f.date,
      "Origine": f.origin,
      "Dest. Principale": f.primaryDestination,
      "Porte": f.gate || "-",
      "Heure Départ": f.departureTimeFormatted,
      "Appareil": f.aircraftType,
      "Composition Actuelle (C/Y)": f.configRaw,
      "Passagers Ayant Voyagé": f.grandTotals.passengersCount,
      "Passagers C (Business)": f.businessTotals.passengersCount,
      "Passagers Y (Éco)": f.economyTotals.passengersCount,
      "Check-in En Ligne (WB)": wbCount,
      "Taux WB (%)": `${wbPct}%`,
      "No-Show": noShowCount,
      "Sans Siège (Total)": unseatedCount,
      "Hommes (M)": f.grandTotals.male,
      "Femmes (F)": f.grandTotals.female,
      "Enfants (CHD)": f.grandTotals.child,
      "Bébés (INF)": f.grandTotals.infant,
      "Total Bagages": f.grandTotals.bagsCount,
      "Poids Total (kg)": f.grandTotals.totalWeight,
      "Écarts Sans EMD": f.baggageUncoveredDeviationsCount,
      "Écarts Couverts EMD": f.baggageCoveredDeviationsCount,
      "Poids Bag. Manquants": f.baggageMissingWeightCount || 0,
      "Total EMD": f.emdCount,
      "FF / FQTV": f.ffCount + f.fqtvCount,
      "Transit (#)": f.transitPassengersCount,
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(flightsSummaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Résumé des Vols");

  // Sheet 2: Manifeste Détaillé Passagers (conserve tous les passagers pour filtrage)
  const paxRows = flights.flatMap((f) =>
    f.passengers.map((p) => ({
      "Vol": `${f.airline} ${f.flightNumber}`,
      "Date": f.date,
      "Origine": f.origin,
      "N° Ordre": `${String(p.classSeq || p.seq).padStart(3, "0")}${p.isTransitMarker ? "#" : ""}`,
      "Statut Embarquement": isPassengerWithSeat(p)
        ? "Voyagé (Avec siège)"
        : "No-Show (Sans siège)",
      "Check-in Web (WB)": isPassengerWebCheckin(p) ? "OUI" : "NON",
      "Transit (#)": p.isTransitMarker ? "Oui" : "Non",
      "Cabine": p.cabinClass === "C" ? "C (Business)" : "Y (Éco)",
      "Classe Résa": p.bookingClass,
      "Nom": p.lastName,
      "Prénom": p.firstName,
      "Code Groupe": p.partyCode || "-",
      "Sexe / Type": p.isChild ? "CHD" : p.gender || "-",
      "Bébé": p.hasInfant ? "INF" : "-",
      "Nom Bébé (INF)": p.infant?.fullNameDisplay || "-",
      "Date Naiss. Bébé": p.infant?.birthDate || "-",
      "N° Billet Bébé (IFET)": p.infant?.ticket?.ticketNumber || "-",
      "Siège": p.seat || "Non attribué",
      "Tarif": p.fareCode || "-",
      "Destination Segment": p.destination,
      "Dest. Finale Bagage": p.baggageDestination || p.destination,
      "Nb Bagages": getEffectiveBagsCount(p),
      "Poids Total (kg)": p.hasMissingBaggageWeight && p.totalBagWeight === 0 ? "MANQUANT" : p.totalBagWeight,
      "Franchise Cumulée (kg)": p.allowedTotalWeight,
      "Conformité Bagages":
        p.baggageCompliance === "CONFORME"
          ? p.hasMissingBaggageWeight
            ? "Poids non spécifié"
            : "Conforme"
          : p.baggageCompliance === "COUVERT_EMD"
          ? "Couvert EMD"
          : "Écart sans EMD",
      "Poids Manquant": p.hasMissingBaggageWeight ? "OUI" : "NON",
      "Alertes Bagages": [...p.baggageDeviations, ...(p.missingBaggageWeightDetails || [])].join(" | "),
      "Talons Bagages": p.bags
        .map((b) =>
          `${b.tag}${b.marker || ""}${
            b.hasMissingWeight || b.weight <= 0 ? " (poids manquant)" : `.${b.weight}kg`
          }`
        )
        .join(", "),
      "EMD": p.emdNumbers.join(", "),
      "Services AE": p.ancillaries
        .map((a) => `${a.rawHeader}${a.description ? ` (${a.description})` : ""}`)
        .join(" | "),
      "FF KP": p.kpFrequentFlyer
        ? `${p.kpFrequentFlyer.number}${p.kpFrequentFlyer.tier ? ` (${p.kpFrequentFlyer.tier})` : ""}`
        : "-",
      "FQTV Partenaire": p.partnerFrequentFlyer ? p.partnerFrequentFlyer.number : "-",
      "Vol Entrant": p.inboundFlight
        ? `${p.inboundFlight.carrier}${p.inboundFlight.flightNumber} ${p.inboundFlight.origin} ${p.inboundFlight.timeType}${p.inboundFlight.time}`
        : "-",
      "Vol Sortant": p.outboundFlight
        ? `${p.outboundFlight.carrier}${p.outboundFlight.flightNumber} ${p.outboundFlight.destination} ETD${p.outboundFlight.time}`
        : "-",
      "N° Billet": p.ticket?.ticketNumber || "-",
      "Coupon": p.ticket?.couponNumber || "-",
      "Statut Billet": p.ticket?.status || "-",
      "Edit Codes": p.editCodes.join(" "),
    }))
  );

  const wsPax = XLSX.utils.json_to_sheet(paxRows);
  XLSX.utils.book_append_sheet(wb, wsPax, "Manifeste Détaillé");

  // Sheet 3: Écarts & Alertes Bagages (passagers ayant voyagé)
  const deviationRows = flights.flatMap((f) =>
    f.passengers
      .filter(
        (p) =>
          isPassengerWithSeat(p) &&
          (p.baggageCompliance !== "CONFORME" || p.hasMissingBaggageWeight)
      )
      .map((p) => ({
        "Date": f.date,
        "Vol": `${f.airline} ${f.flightNumber}`,
        "Origine": f.origin,
        "N° Ordre": `${String(p.classSeq || p.seq).padStart(3, "0")}${p.isTransitMarker ? "#" : ""}`,
        "Passager": p.fullNameDisplay,
        "Cabine": p.cabinClass === "C" ? "Business (C - 2 pcs / 64 kg)" : "Éco (Y - 2 pcs / 48 kg)",
        "Siège": p.seat || "-",
        "Nb Bagages": getEffectiveBagsCount(p),
        "Poids Total (kg)": p.hasMissingBaggageWeight && p.totalBagWeight === 0 ? "MANQUANT" : p.totalBagWeight,
        "Statut":
          p.baggageCompliance === "ECART_NON_COUVERT"
            ? "ÉCART NON COUVERT"
            : p.baggageCompliance === "COUVERT_EMD"
            ? "COUVERT PAR EMD"
            : "POIDS NON SPÉCIFIÉ",
        "Détail Écart": [...p.baggageDeviations, ...(p.missingBaggageWeightDetails || [])].join(" | "),
        "EMD Associé": p.emdNumbers.join(", ") || "AUCUN",
        "Talons": p.bags
          .map((b) =>
            `${b.tag} (${b.hasMissingWeight || b.weight <= 0 ? "poids manquant" : `${b.weight}kg`})`
          )
          .join(", "),
      }))
  );

  if (deviationRows.length > 0) {
    const wsDev = XLSX.utils.json_to_sheet(deviationRows);
    XLSX.utils.book_append_sheet(wb, wsDev, "Écarts Bagages");
  }

  XLSX.writeFile(wb, filename);
}
