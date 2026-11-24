/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import {
  FlightScheduleParseResult,
  FlightSegment,
  ManifestFlight,
  ManifestParseResult,
} from "../types";
import { downloadAnsiFile } from "./flightParser";
import { normalizeDcsFlightDate } from "./manifestParser";

export type ReconciliationStatus =
  | "IMPORTED"
  | "MISSING_IN_MANIFEST"
  | "EXTRA_IN_MANIFEST"
  | "CODESHARE_INFO";

export interface ReconciliationItem {
  id: string;
  key: string; // e.g. "19NOV|69|NSI" (Date départ + Numéro vol + Station de départ)
  status: ReconciliationStatus;
  flightNumber: string;
  origin: string; // Station de départ
  destination: string; // Arrivée / escale issue du Programme des Vols
  manifestDestinationsSummary?: string; // Destinations des passagers dans le manifeste
  scheduledDate?: string;
  manifestDate?: string;
  scheduledDep?: string;
  scheduledArr?: string;
  manifestDep?: string;
  aircraftType?: string;
  configRaw?: string;
  isPureEconomy?: boolean;
  passengersCount?: number;
  businessCount?: number;
  economyCount?: number;
  bagsCount?: number;
  totalWeight?: number;
  uncoveredDeviations?: number;
  wincmdMissing?: string;
  otherOriginsInManifest?: string[];
  segment?: FlightSegment;
  manifestFlight?: ManifestFlight;
}

export interface ManifestReconciliationResult {
  scheduleDate: string;
  manifestDate: string;
  dateMismatch: boolean;
  totalKpScheduled: number;
  totalCodeshareScheduled: number;
  totalManifestFlights: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  coveragePercent: number;
  allKpCovered: boolean;
  items: ReconciliationItem[];
  matchedItems: ReconciliationItem[];
  missingItems: ReconciliationItem[];
  extraItems: ReconciliationItem[];
  codeshareItems: ReconciliationItem[];
}

function normalizeFlightNum(num: string): string {
  const cleaned = (num || "").trim().replace(/^0+/, "");
  return cleaned || "0";
}

function normalizeReconciliationDate(rawDate?: string): string {
  const clean = (rawDate || "").trim().toUpperCase();
  if (!clean) return "";
  const match = clean.match(/^(\d{1,2})([A-Z]{3})(?:\d{2,4})?$/);
  if (match) {
    return `${match[1].padStart(2, "0")}${match[2]}`;
  }
  const norm = normalizeDcsFlightDate(clean);
  return norm === "SANS_DATE" ? "" : norm;
}

/**
 * Clé unique de vol : (Date de départ normalisée, Numéro de vol normalisé, Origine)
 */
function buildMatchKey(
  flightNumber: string,
  origin: string,
  departureDate: string
): string {
  const normDate = normalizeReconciliationDate(departureDate) || "SANS_DATE";
  const normNum = normalizeFlightNum(flightNumber);
  const normOrigin = (origin || "").trim().toUpperCase();
  return `${normDate}|${normNum}|${normOrigin}`;
}

function formatManifestDests(mf: ManifestFlight): string {
  if (mf.destinationCounts && mf.destinationCounts.length > 0) {
    return mf.destinationCounts.map((d) => `${d.code} (${d.count})`).join(", ");
  }
  return mf.primaryDestination || "—";
}

/**
 * Rapproche les vols du programme actif (et des programmes archivés) avec les vols du manifeste.
 */
export function reconcileManifestWithSchedule(
  schedule: FlightScheduleParseResult | null,
  manifest: ManifestParseResult,
  storedScheduleSegments: FlightSegment[] = []
): ManifestReconciliationResult {
  const manifestByKey = new Map<string, ManifestFlight>();
  const originsByDateAndFlightNum = new Map<string, string[]>();
  const manifestDatesSet = new Set<string>();

  for (const mf of manifest.flights) {
    const mfDate =
      normalizeReconciliationDate(mf.date) ||
      normalizeReconciliationDate(manifest.manifestDate) ||
      "SANS_DATE";
    if (mfDate !== "SANS_DATE") {
      manifestDatesSet.add(mfDate);
    }
    const normNum = normalizeFlightNum(mf.flightNumber);
    const org = (mf.origin || "").trim().toUpperCase();
    const key = buildMatchKey(mf.flightNumber, mf.origin, mfDate);
    if (!manifestByKey.has(key)) {
      manifestByKey.set(key, mf);
    }
    const dateFlightKey = `${mfDate}|${normNum}`;
    const existingOrigins = originsByDateAndFlightNum.get(dateFlightKey) || [];
    if (!existingOrigins.includes(org)) {
      existingOrigins.push(org);
      originsByDateAndFlightNum.set(dateFlightKey, existingOrigins);
    }
  }

  // Combiner le programme actif + les programmes archivés correspondant aux dates du manifeste
  const activeScheduleSegs = schedule?.segments || [];
  const activeScheduleDatesSet = new Set<string>();
  const activeHeaderDate = normalizeReconciliationDate(schedule?.date);
  if (activeHeaderDate) activeScheduleDatesSet.add(activeHeaderDate);
  for (const s of activeScheduleSegs) {
    const d = normalizeReconciliationDate(s.date);
    if (d) activeScheduleDatesSet.add(d);
  }

  const effectiveSegments: FlightSegment[] = [];
  const seenSegKeys = new Set<string>();
  const pushSegmentIfRelevant = (seg: FlightSegment, forceInclude: boolean) => {
    const segDate =
      normalizeReconciliationDate(seg.date) || activeHeaderDate || "SANS_DATE";
    if (
      !forceInclude &&
      !manifestDatesSet.has(segDate) &&
      !activeScheduleDatesSet.has(segDate)
    ) {
      return;
    }
    const dedupKey = `${segDate}|${normalizeFlightNum(seg.flightNumber)}|${(
      seg.origin || ""
    )
      .trim()
      .toUpperCase()}|${(seg.destination || "").trim().toUpperCase()}|${
      seg.carrierType
    }`;
    if (seenSegKeys.has(dedupKey)) return;
    seenSegKeys.add(dedupKey);
    effectiveSegments.push(segDate !== seg.date ? { ...seg, date: segDate } : seg);
  };

  for (const seg of activeScheduleSegs) {
    pushSegmentIfRelevant(seg, true);
  }
  for (const seg of storedScheduleSegments) {
    pushSegmentIfRelevant(seg, activeScheduleSegs.length === 0 && manifestDatesSet.size === 0);
  }

  const matchedManifestKeys = new Set<string>();
  const matchedItems: ReconciliationItem[] = [];
  const missingItems: ReconciliationItem[] = [];
  const codeshareItems: ReconciliationItem[] = [];
  const scheduleDatesSet = new Set<string>();

  for (const seg of effectiveSegments) {
    const segDate =
      normalizeReconciliationDate(seg.date) || activeHeaderDate || "SANS_DATE";
    if (segDate !== "SANS_DATE") {
      scheduleDatesSet.add(segDate);
    }
    const normNum = normalizeFlightNum(seg.flightNumber);
    const key = buildMatchKey(seg.flightNumber, seg.origin, segDate);

    if (!seg.isKpOperated) {
      codeshareItems.push({
        id: `cs-${segDate}-${seg.id}`,
        key,
        status: "CODESHARE_INFO",
        flightNumber: seg.flightNumber,
        origin: seg.origin,
        destination: seg.destination,
        scheduledDate: segDate,
        scheduledDep: seg.schedDepFormatted,
        scheduledArr: seg.schedArrFormatted,
        segment: seg,
      });
      continue;
    }

    const foundManifest = manifestByKey.get(key);
    if (foundManifest) {
      const mfDate =
        normalizeReconciliationDate(foundManifest.date) ||
        normalizeReconciliationDate(manifest.manifestDate) ||
        segDate;
      matchedManifestKeys.add(key);
      matchedItems.push({
        id: `ok-${segDate}-${seg.id}`,
        key,
        status: "IMPORTED",
        flightNumber: foundManifest.flightNumber,
        origin: foundManifest.origin,
        destination: seg.destination || foundManifest.primaryDestination,
        manifestDestinationsSummary: formatManifestDests(foundManifest),
        scheduledDate: segDate,
        manifestDate: mfDate,
        scheduledDep: seg.schedDepFormatted,
        scheduledArr: seg.schedArrFormatted,
        manifestDep: foundManifest.departureTimeFormatted,
        aircraftType: foundManifest.aircraftType,
        configRaw: foundManifest.configRaw,
        isPureEconomy: foundManifest.isPureEconomy,
        passengersCount: foundManifest.grandTotals.passengersCount,
        businessCount: foundManifest.businessTotals.passengersCount,
        economyCount: foundManifest.economyTotals.passengersCount,
        bagsCount: foundManifest.grandTotals.bagsCount,
        totalWeight: foundManifest.grandTotals.totalWeight,
        uncoveredDeviations: foundManifest.baggageUncoveredDeviationsCount,
        segment: seg,
        manifestFlight: foundManifest,
      });
    } else {
      const wincmdDate = segDate !== "SANS_DATE" ? segDate : seg.date || schedule?.date || "";
      const missingWincmd =
        seg.wincmd ||
        `WINCMD("PTRG*L${seg.flightNumber}/${wincmdDate}${seg.origin}‡BT/ET/IB/OB/ON/SS/FF/FQTV/AE/INF")`;
      const otherOrigins = (
        originsByDateAndFlightNum.get(`${segDate}|${normNum}`) || []
      ).filter((o) => o !== seg.origin.toUpperCase());
      missingItems.push({
        id: `miss-${segDate}-${seg.id}`,
        key,
        status: "MISSING_IN_MANIFEST",
        flightNumber: seg.flightNumber,
        origin: seg.origin,
        destination: seg.destination,
        scheduledDate: segDate,
        manifestDate: manifest.manifestDate,
        scheduledDep: seg.schedDepFormatted,
        scheduledArr: seg.schedArrFormatted,
        wincmdMissing: missingWincmd,
        otherOriginsInManifest: otherOrigins.length > 0 ? otherOrigins : undefined,
        segment: seg,
      });
    }
  }

  const extraItems: ReconciliationItem[] = [];
  for (const mf of manifest.flights) {
    const mfDate =
      normalizeReconciliationDate(mf.date) ||
      normalizeReconciliationDate(manifest.manifestDate) ||
      "SANS_DATE";
    const key = buildMatchKey(mf.flightNumber, mf.origin, mfDate);
    if (!matchedManifestKeys.has(key)) {
      extraItems.push({
        id: `extra-${mfDate}-${mf.id}`,
        key,
        status: "EXTRA_IN_MANIFEST",
        flightNumber: mf.flightNumber,
        origin: mf.origin,
        destination: mf.primaryDestination || "—",
        manifestDestinationsSummary: formatManifestDests(mf),
        manifestDate: mfDate,
        manifestDep: mf.departureTimeFormatted,
        aircraftType: mf.aircraftType,
        configRaw: mf.configRaw,
        isPureEconomy: mf.isPureEconomy,
        passengersCount: mf.grandTotals.passengersCount,
        businessCount: mf.businessTotals.passengersCount,
        economyCount: mf.economyTotals.passengersCount,
        bagsCount: mf.grandTotals.bagsCount,
        totalWeight: mf.grandTotals.totalWeight,
        uncoveredDeviations: mf.baggageUncoveredDeviationsCount,
        manifestFlight: mf,
      });
    }
  }

  const totalKpScheduled = matchedItems.length + missingItems.length;
  const coveragePercent =
    totalKpScheduled > 0
      ? Math.round((matchedItems.length / totalKpScheduled) * 100)
      : 0;

  const resolvedScheduleDates = Array.from(scheduleDatesSet);
  const resolvedManifestDates = Array.from(manifestDatesSet);
  const scheduleDateLabel =
    resolvedScheduleDates.join(", ") || activeHeaderDate || schedule?.date || "";
  const manifestDateLabel =
    resolvedManifestDates.join(", ") ||
    normalizeReconciliationDate(manifest.manifestDate) ||
    manifest.manifestDate ||
    "";

  const dateMismatch = Boolean(
    resolvedScheduleDates.length > 0 &&
      resolvedManifestDates.length > 0 &&
      (resolvedManifestDates.some((d) => !scheduleDatesSet.has(d)) ||
        resolvedScheduleDates.some((d) => !manifestDatesSet.has(d)))
  );

  // Sort missing first so user immediately sees what hasn't been imported, then extra, then matched
  const items: ReconciliationItem[] = [
    ...missingItems,
    ...extraItems,
    ...matchedItems,
  ];

  return {
    scheduleDate: scheduleDateLabel,
    manifestDate: manifestDateLabel,
    dateMismatch,
    totalKpScheduled,
    totalCodeshareScheduled: codeshareItems.length,
    totalManifestFlights: manifest.flights.length,
    matchedCount: matchedItems.length,
    missingCount: missingItems.length,
    extraCount: extraItems.length,
    coveragePercent,
    allKpCovered: totalKpScheduled > 0 && missingItems.length === 0,
    items,
    matchedItems,
    missingItems,
    extraItems,
    codeshareItems,
  };
}

export function downloadMissingWincmdAnsi(
  missingItems: ReconciliationItem[],
  dateLabel: string
): void {
  const cmds = missingItems
    .map((m) => m.wincmdMissing)
    .filter((c): c is string => Boolean(c));
  if (cmds.length === 0) return;
  downloadAnsiFile(
    `WINCMD_VOLS_MANQUANTS_${dateLabel || "KP"}_ANSI.txt`,
    cmds.join("\r\n") + "\r\n"
  );
}

export function exportReconciliationToExcel(
  reconciliation: ManifestReconciliationResult,
  filename?: string,
  language: "fr" | "en" = "fr"
): void {
  const wb = XLSX.utils.book_new();
  const isEn = language === "en";
  const allItems = [...reconciliation.items, ...reconciliation.codeshareItems];

  const rows = isEn
    ? allItems.map((item) => ({
        "Status":
          item.status === "IMPORTED"
            ? "Imported & Analyzed"
            : item.status === "MISSING_IN_MANIFEST"
            ? "Missing in Manifest"
            : item.status === "EXTRA_IN_MANIFEST"
            ? "Unscheduled"
            : "Codeshare (Info)",
        "Flight": `KP ${item.flightNumber}`,
        "Origin": item.origin,
        "Destination": item.destination,
        "Schedule Date": item.scheduledDate || "-",
        "Manifest Date": item.manifestDate || "-",
        "Schedule Time": item.scheduledDep || "-",
        "Manifest Time": item.manifestDep || "-",
        "Passengers": item.passengersCount ?? "-",
        "Business (C)": item.businessCount ?? "-",
        "Economy (Y)": item.economyCount ?? "-",
        "Bags (pcs)": item.bagsCount ?? "-",
        "Weight (kg)": item.totalWeight ?? "-",
        "Baggage Deviations": item.uncoveredDeviations ?? "-",
        "WINCMD Command (if missing)": item.wincmdMissing || "-",
      }))
    : allItems.map((item) => ({
        "Statut":
          item.status === "IMPORTED"
            ? "Importé & Analysé"
            : item.status === "MISSING_IN_MANIFEST"
            ? "Manquant dans Manifeste"
            : item.status === "EXTRA_IN_MANIFEST"
            ? "Hors Programme"
            : "Codeshare (Info)",
        "Vol": `KP ${item.flightNumber}`,
        "Origine": item.origin,
        "Destination": item.destination,
        "Date Programme": item.scheduledDate || "-",
        "Date Manifeste": item.manifestDate || "-",
        "Heure Programme": item.scheduledDep || "-",
        "Heure Manifeste": item.manifestDep || "-",
        "Passagers": item.passengersCount ?? "-",
        "Business (C)": item.businessCount ?? "-",
        "Économie (Y)": item.economyCount ?? "-",
        "Bagages (pcs)": item.bagsCount ?? "-",
        "Poids (kg)": item.totalWeight ?? "-",
        "Écarts Bagages": item.uncoveredDeviations ?? "-",
        "Commande WINCMD (si manquant)": item.wincmdMissing || "-",
      }));

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    isEn ? "Flight Reconciliation" : "Rapprochement Vols"
  );
  XLSX.writeFile(
    wb,
    filename ||
      `${isEn ? "Schedule_Manifest_Reconciliation" : "Rapprochement_Programme_Manifeste"}_${
        reconciliation.manifestDate || reconciliation.scheduleDate || "KP"
      }.xlsx`
  );
}
