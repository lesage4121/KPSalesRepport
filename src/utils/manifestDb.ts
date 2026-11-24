/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ManifestFlight, ManifestParseResult } from "../types";
import {
  aggregateManifestFlights,
  getFlightWebCheckinCount,
  hydrateManifestResult,
} from "./manifestParser";

const DB_NAME = "kp_manifest_archive_db";
const DB_VERSION = 2;
const STORE_NAME = "daily_manifests";
const STATIONS_STORE_NAME = "stations";

export type StationScope = "KP_OPERATED" | "CODESHARE";

export interface AirportStationRecord {
  code: string; // IATA 3-letter code e.g. "LFW"
  city: string; // e.g. "Lomé"
  country: string; // e.g. "Togo"
  isHub?: boolean;
  scope: StationScope;
  active: boolean;
  source: "SEED_FLIGHT_EXAMPLES" | "MANUAL" | "DISCOVERED";
  createdAt: string;
}

/**
 * Stations extraites des exemples de vols étudiés (VDS SJPM3, Manifestes SJPM / KP_13-11, Détails PTRG*).
 * 30 stations opérées directement par ASKY (KP) + 10 stations partenaires / codeshares.
 */
export const DEFAULT_STUDIED_STATIONS: Array<
  Omit<AirportStationRecord, "source" | "createdAt">
> = [
  // Hub principal
  { code: "LFW", city: "Lomé", country: "Togo", isHub: true, scope: "KP_OPERATED", active: true },
  // Réseau KP (vols à 2 chiffres issus des exemples étudiés)
  { code: "ABJ", city: "Abidjan", country: "Côte d'Ivoire", scope: "KP_OPERATED", active: true },
  { code: "ABV", city: "Abuja", country: "Nigeria", scope: "KP_OPERATED", active: true },
  { code: "ACC", city: "Accra", country: "Ghana", scope: "KP_OPERATED", active: true },
  { code: "BGF", city: "Bangui", country: "RCA", scope: "KP_OPERATED", active: true },
  { code: "BJL", city: "Banjul", country: "Gambie", scope: "KP_OPERATED", active: true },
  { code: "BKO", city: "Bamako", country: "Mali", scope: "KP_OPERATED", active: true },
  { code: "BZV", city: "Brazzaville", country: "Congo", scope: "KP_OPERATED", active: true },
  { code: "CKY", city: "Conakry", country: "Guinée", scope: "KP_OPERATED", active: true },
  { code: "COO", city: "Cotonou", country: "Bénin", scope: "KP_OPERATED", active: true },
  { code: "DLA", city: "Douala", country: "Cameroun", scope: "KP_OPERATED", active: true },
  { code: "DSS", city: "Dakar (Diass)", country: "Sénégal", scope: "KP_OPERATED", active: true },
  { code: "FIH", city: "Kinshasa", country: "RDC", scope: "KP_OPERATED", active: true },
  { code: "FNA", city: "Freetown", country: "Sierra Leone", scope: "KP_OPERATED", active: true },
  { code: "JNB", city: "Johannesburg", country: "Afrique du Sud", scope: "KP_OPERATED", active: true },
  { code: "LBV", city: "Libreville", country: "Gabon", scope: "KP_OPERATED", active: true },
  { code: "LOS", city: "Lagos", country: "Nigeria", scope: "KP_OPERATED", active: true },
  { code: "NBJ", city: "Luanda (Agostinho Neto)", country: "Angola", scope: "KP_OPERATED", active: true },
  { code: "NBO", city: "Nairobi", country: "Kenya", scope: "KP_OPERATED", active: true },
  { code: "NDJ", city: "N'Djamena", country: "Tchad", scope: "KP_OPERATED", active: true },
  { code: "NIM", city: "Niamey", country: "Niger", scope: "KP_OPERATED", active: true },
  { code: "NKC", city: "Nouakchott", country: "Mauritanie", scope: "KP_OPERATED", active: true },
  { code: "NSI", city: "Yaoundé", country: "Cameroun", scope: "KP_OPERATED", active: true },
  { code: "OUA", city: "Ouagadougou", country: "Burkina Faso", scope: "KP_OPERATED", active: true },
  { code: "OXB", city: "Bissau", country: "Guinée-Bissau", scope: "KP_OPERATED", active: true },
  { code: "PNR", city: "Pointe-Noire", country: "Congo", scope: "KP_OPERATED", active: true },
  { code: "RAI", city: "Praia", country: "Cap-Vert", scope: "KP_OPERATED", active: true },
  { code: "ROB", city: "Monrovia", country: "Liberia", scope: "KP_OPERATED", active: true },
  { code: "SSG", city: "Malabo", country: "Guinée Équatoriale", scope: "KP_OPERATED", active: true },
  { code: "TMS", city: "São Tomé", country: "São Tomé-et-Principe", scope: "KP_OPERATED", active: true },
  // Stations partenaires / codeshares (issues du programme VDS étudié)
  { code: "ADD", city: "Addis-Abeba", country: "Éthiopie", scope: "CODESHARE", active: true },
  { code: "CDG", city: "Paris CDG", country: "France", scope: "CODESHARE", active: true },
  { code: "CMN", city: "Casablanca", country: "Maroc", scope: "CODESHARE", active: true },
  { code: "DMM", city: "Dammam", country: "Arabie Saoudite", scope: "CODESHARE", active: true },
  { code: "DXB", city: "Dubaï", country: "EAU", scope: "CODESHARE", active: true },
  { code: "EWR", city: "Newark", country: "USA", scope: "CODESHARE", active: true },
  { code: "FCO", city: "Rome", country: "Italie", scope: "CODESHARE", active: true },
  { code: "GRU", city: "São Paulo", country: "Brésil", scope: "CODESHARE", active: true },
  { code: "IAD", city: "Washington", country: "USA", scope: "CODESHARE", active: true },
  { code: "MBA", city: "Mombasa", country: "Kenya", scope: "CODESHARE", active: true },
];

export interface StoredFlightSummary {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  date: string;
  departureTimeFormatted: string;
  aircraftType: string;
  configRaw: string;
  isPureEconomy: boolean;
  passengersCount: number;
  businessCount: number;
  economyCount: number;
  bagsCount: number;
  totalWeight: number;
  uncoveredDeviations: number;
  coveredDeviations: number;
  emdCount: number;
  ffTotal: number;
  webCheckinCount?: number;
}

export interface StoredManifestDayRecord {
  dateKey: string;
  sortOrder: number;
  savedAt: string;
  sourceFileName: string;
  data: ManifestParseResult;
}

export interface StoredManifestDaySummary {
  dateKey: string;
  sortOrder: number;
  savedAt: string;
  sourceFileName: string;
  totalFlights: number;
  totalPassengers: number;
  totalBusinessPassengers: number;
  totalEconomyPassengers: number;
  totalBags: number;
  totalWeight: number;
  totalUncoveredDeviations: number;
  flights: StoredFlightSummary[];
}

export interface FlightKeySummary {
  key: string; // e.g. "69|NSI"
  airline: string;
  flightNumber: string;
  origin: string;
  daysCount: number;
  dates: string[];
  avgPassengers: number;
  avgWeight: number;
  lastDate: string;
}

export interface FlightEvolutionPoint {
  dateKey: string;
  sortOrder: number;
  airline: string;
  flightNumber: string;
  origin: string;
  flightId: string;
  departureTimeFormatted: string;
  aircraftType: string;
  configRaw: string;
  isPureEconomy: boolean;
  passengersTotal: number;
  businessCount: number;
  economyCount: number;
  bagsCount: number;
  totalWeight: number;
  avgWeightPerBag: number;
  avgWeightPerPax: number;
  uncoveredDeviations: number;
  coveredDeviations: number;
  emdCount: number;
  ffTotal: number;
  webCheckinCount: number;
}

const MONTH_MAP: Record<string, number> = {
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

export function normalizeDcsDateKey(rawDate: string): string {
  const clean = (rawDate || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})$/);
  if (!match) return clean || "SANS_DATE";
  const day = match[1].padStart(2, "0");
  return `${day}${match[2]}`;
}

export function getDateSortOrder(dateKey: string, extractedYear = "26"): number {
  const clean = (dateKey || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})$/);
  if (!match) return 0;
  const day = parseInt(match[1], 10) || 1;
  const month = MONTH_MAP[match[2]] || 0;
  const yrDigits = parseInt(extractedYear, 10);
  const year = Number.isFinite(yrDigits) ? (yrDigits < 100 ? 2000 + yrDigits : yrDigits) : 2026;
  return year * 10000 + month * 100 + day;
}

function normalizeFlightNum(num: string): string {
  return (num || "").trim().replace(/^0+/, "") || "0";
}

function openArchiveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB non disponible dans ce navigateur."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "dateKey" });
        store.createIndex("sortOrder", "sortOrder", { unique: false });
      }
      if (!db.objectStoreNames.contains(STATIONS_STORE_NAME)) {
        const stationsStore = db.createObjectStore(STATIONS_STORE_NAME, {
          keyPath: "code",
        });
        stationsStore.createIndex("scope", "scope", { unique: false });
        stationsStore.createIndex("country", "country", { unique: false });
        const now = new Date().toISOString();
        for (const st of DEFAULT_STUDIED_STATIONS) {
          stationsStore.put({
            ...st,
            source: "SEED_FLIGHT_EXAMPLES",
            createdAt: now,
          } satisfies AirportStationRecord);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Erreur ouverture base locale."));
  });
}

function toFlightSummary(f: ManifestFlight): StoredFlightSummary {
  return {
    id: f.id,
    airline: f.airline,
    flightNumber: normalizeFlightNum(f.flightNumber),
    origin: (f.origin || "").trim().toUpperCase(),
    date: normalizeDcsDateKey(f.date),
    departureTimeFormatted: f.departureTimeFormatted,
    aircraftType: f.aircraftType,
    configRaw: f.configRaw,
    isPureEconomy: f.isPureEconomy,
    passengersCount: f.grandTotals.passengersCount,
    businessCount: f.businessTotals.passengersCount,
    economyCount: f.economyTotals.passengersCount,
    bagsCount: f.grandTotals.bagsCount,
    totalWeight: f.grandTotals.totalWeight,
    uncoveredDeviations: f.baggageUncoveredDeviationsCount,
    coveredDeviations: f.baggageCoveredDeviationsCount,
    emdCount: f.emdCount,
    ffTotal: f.ffCount + f.fqtvCount,
    webCheckinCount: getFlightWebCheckinCount(f),
  };
}

function toDaySummary(rec: StoredManifestDayRecord): StoredManifestDaySummary {
  return {
    dateKey: rec.dateKey,
    sortOrder: rec.sortOrder,
    savedAt: rec.savedAt,
    sourceFileName: rec.sourceFileName,
    totalFlights: rec.data.totalFlights,
    totalPassengers: rec.data.totalPassengers,
    totalBusinessPassengers: rec.data.totalBusinessPassengers,
    totalEconomyPassengers: rec.data.totalEconomyPassengers,
    totalBags: rec.data.totalBags,
    totalWeight: rec.data.totalWeight,
    totalUncoveredDeviations: rec.data.totalUncoveredDeviations,
    flights: rec.data.flights.map(toFlightSummary),
  };
}

export async function getAllSavedManifestRecords(): Promise<StoredManifestDayRecord[]> {
  const db = await openArchiveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = ((req.result as StoredManifestDayRecord[]) || []).map(
        (rec) => ({
          ...rec,
          data: hydrateManifestResult(rec.data),
        })
      );
      list.sort((a, b) => b.sortOrder - a.sortOrder || b.savedAt.localeCompare(a.savedAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error || new Error("Erreur lecture base locale."));
    tx.oncomplete = () => db.close();
  });
}

export async function listSavedManifestDays(): Promise<StoredManifestDaySummary[]> {
  const records = await getAllSavedManifestRecords();
  return records.map(toDaySummary);
}

export async function getSavedManifestDay(
  dateKey: string
): Promise<StoredManifestDayRecord | null> {
  const normKey = normalizeDcsDateKey(dateKey);
  const db = await openArchiveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(normKey);
    req.onsuccess = () => {
      const rec = (req.result as StoredManifestDayRecord) || null;
      resolve(
        rec
          ? {
              ...rec,
              data: hydrateManifestResult(rec.data),
            }
          : null
      );
    };
    req.onerror = () => reject(req.error || new Error("Erreur lecture journée."));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Loads and merges flights from either ALL saved dates or a specific list of selected dates.
 */
export async function loadCombinedManifestForDates(
  dateKeys: string[] | "ALL"
): Promise<{
  data: ManifestParseResult;
  loadedDates: string[];
  sourceLabel: string;
  latestSavedAt: string;
} | null> {
  const allRecords = await getAllSavedManifestRecords();
  if (allRecords.length === 0) return null;

  const targetRecords =
    dateKeys === "ALL"
      ? allRecords
      : allRecords.filter((rec) =>
          dateKeys.some((dk) => normalizeDcsDateKey(dk) === rec.dateKey)
        );

  if (targetRecords.length === 0) return null;

  // Chronological newest first
  const sorted = [...targetRecords].sort((a, b) => b.sortOrder - a.sortOrder);
  const combinedFlights: ManifestFlight[] = [];
  const sourceNames: string[] = [];
  const loadedDates: string[] = [];

  for (const rec of sorted) {
    loadedDates.push(rec.dateKey);
    if (rec.sourceFileName && !sourceNames.includes(rec.sourceFileName)) {
      sourceNames.push(rec.sourceFileName);
    }
    combinedFlights.push(...rec.data.flights);
  }

  const aggregated = aggregateManifestFlights(combinedFlights);
  aggregated.manifestDate =
    loadedDates.length === 1
      ? loadedDates[0]
      : `${loadedDates[loadedDates.length - 1]} - ${loadedDates[0]} (${loadedDates.length}j)`;

  return {
    data: aggregated,
    loadedDates,
    sourceLabel:
      loadedDates.length === 1
        ? `${sourceNames[0] || "Archive"} (${loadedDates[0]})`
        : `Base Locale (${loadedDates.length} dates : ${loadedDates.join(", ")})`,
    latestSavedAt: sorted[0]?.savedAt || new Date().toISOString(),
  };
}

/**
 * Saves parsed manifest flights grouped by flight date into IndexedDB.
 * Merges with existing flights of the same date (new flights override matching flight+origin keys).
 */
export async function saveManifestToDb(
  result: ManifestParseResult,
  sourceFileName: string,
  options?: { replaceDay?: boolean }
): Promise<string[]> {
  if (!result || result.flights.length === 0) return [];

  const flightsByDate = new Map<string, ManifestFlight[]>();
  for (const flight of result.flights) {
    const key = normalizeDcsDateKey(flight.date || result.manifestDate || "SANS_DATE");
    const bucket = flightsByDate.get(key) || [];
    bucket.push(flight);
    flightsByDate.set(key, bucket);
  }

  const savedDates: string[] = [];
  const replaceDay = options?.replaceDay ?? false;

  // Read existing day records before starting write transaction
  const existingByDate = new Map<string, StoredManifestDayRecord | null>();
  for (const dateKey of flightsByDate.keys()) {
    existingByDate.set(dateKey, await getSavedManifestDay(dateKey));
  }

  const db = await openArchiveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    for (const [dateKey, newDayFlights] of flightsByDate.entries()) {
      const existing = existingByDate.get(dateKey);
      const combinedFlights =
        !replaceDay && existing
          ? [...newDayFlights, ...existing.data.flights]
          : newDayFlights;

      const dayData = aggregateManifestFlights(combinedFlights);
      dayData.manifestDate = dateKey;

      const firstYear = dayData.flights[0]?.extractedYear || "26";
      const sortOrder = getDateSortOrder(dateKey, firstYear);

      let mergedFileName = sourceFileName;
      if (!replaceDay && existing && existing.sourceFileName) {
        const parts = existing.sourceFileName
          .split(" + ")
          .map((p) => p.trim())
          .filter(Boolean);
        for (const incomingPart of sourceFileName.split(" + ").map((p) => p.trim())) {
          if (incomingPart && !parts.includes(incomingPart)) {
            parts.push(incomingPart);
          }
        }
        mergedFileName = parts.join(" + ");
      }

      const record: StoredManifestDayRecord = {
        dateKey,
        sortOrder,
        savedAt: new Date().toISOString(),
        sourceFileName: mergedFileName,
        data: dayData,
      };
      store.put(record);
      savedDates.push(dateKey);
    }

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur sauvegarde dans la base locale."));
    };
  });

  return savedDates;
}

export async function deleteManifestDayFromDb(dateKey: string): Promise<void> {
  const normKey = normalizeDcsDateKey(dateKey);
  const db = await openArchiveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(normKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur suppression journée."));
    };
  });
}

export async function deleteFlightFromDayInDb(
  dateKey: string,
  flightId: string
): Promise<StoredManifestDayRecord | null> {
  const existing = await getSavedManifestDay(dateKey);
  if (!existing) return null;

  const remainingFlights = existing.data.flights.filter((f) => f.id !== flightId);
  if (remainingFlights.length === 0) {
    await deleteManifestDayFromDb(dateKey);
    return null;
  }

  const updatedData = aggregateManifestFlights(remainingFlights);
  updatedData.manifestDate = existing.dateKey;
  const updatedRecord: StoredManifestDayRecord = {
    ...existing,
    savedAt: new Date().toISOString(),
    data: updatedData,
  };

  const db = await openArchiveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(updatedRecord);
    tx.oncomplete = () => {
      db.close();
      resolve(updatedRecord);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur suppression vol."));
    };
  });
}

export async function clearAllManifestsFromDb(): Promise<void> {
  const db = await openArchiveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur nettoyage base locale."));
    };
  });
}

export async function listAllFlightKeysInDb(): Promise<FlightKeySummary[]> {
  const days = await listSavedManifestDays();
  // Sort days chronologically ascending for date list
  const chronoDays = [...days].sort((a, b) => a.sortOrder - b.sortOrder);

  const map = new Map<
    string,
    {
      airline: string;
      flightNumber: string;
      origin: string;
      dates: string[];
      totalPax: number;
      totalWeight: number;
    }
  >();

  for (const day of chronoDays) {
    for (const flt of day.flights) {
      const key = `${normalizeFlightNum(flt.flightNumber)}|${flt.origin}`;
      const existing = map.get(key) || {
        airline: flt.airline,
        flightNumber: normalizeFlightNum(flt.flightNumber),
        origin: flt.origin,
        dates: [],
        totalPax: 0,
        totalWeight: 0,
      };
      if (!existing.dates.includes(day.dateKey)) {
        existing.dates.push(day.dateKey);
        existing.totalPax += flt.passengersCount;
        existing.totalWeight += flt.totalWeight;
      }
      map.set(key, existing);
    }
  }

  return Array.from(map.entries())
    .map(([key, info]) => ({
      key,
      airline: info.airline,
      flightNumber: info.flightNumber,
      origin: info.origin,
      daysCount: info.dates.length,
      dates: info.dates,
      avgPassengers: Math.round(info.totalPax / Math.max(1, info.dates.length)),
      avgWeight: Math.round(info.totalWeight / Math.max(1, info.dates.length)),
      lastDate: info.dates[info.dates.length - 1] || "",
    }))
    .sort((a, b) => {
      if (b.daysCount !== a.daysCount) return b.daysCount - a.daysCount;
      const numA = parseInt(a.flightNumber, 10) || 0;
      const numB = parseInt(b.flightNumber, 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.origin.localeCompare(b.origin);
    });
}

export async function getFlightEvolutionSeries(
  flightNumber: string,
  origin: string
): Promise<FlightEvolutionPoint[]> {
  const targetNum = normalizeFlightNum(flightNumber);
  const targetOrigin = (origin || "").trim().toUpperCase();
  const days = await listSavedManifestDays();
  const chronoDays = [...days].sort((a, b) => a.sortOrder - b.sortOrder);

  const series: FlightEvolutionPoint[] = [];
  for (const day of chronoDays) {
    const match = day.flights.find(
      (f) => normalizeFlightNum(f.flightNumber) === targetNum && f.origin === targetOrigin
    );
    if (match) {
      series.push({
        dateKey: day.dateKey,
        sortOrder: day.sortOrder,
        airline: match.airline,
        flightNumber: match.flightNumber,
        origin: match.origin,
        flightId: match.id,
        departureTimeFormatted: match.departureTimeFormatted,
        aircraftType: match.aircraftType,
        configRaw: match.configRaw,
        isPureEconomy: match.isPureEconomy,
        passengersTotal: match.passengersCount,
        businessCount: match.businessCount,
        economyCount: match.economyCount,
        bagsCount: match.bagsCount,
        totalWeight: match.totalWeight,
        avgWeightPerBag:
          match.bagsCount > 0
            ? Number((match.totalWeight / match.bagsCount).toFixed(1))
            : 0,
        avgWeightPerPax:
          match.passengersCount > 0
            ? Number((match.totalWeight / match.passengersCount).toFixed(1))
            : 0,
        uncoveredDeviations: match.uncoveredDeviations,
        coveredDeviations: match.coveredDeviations,
        emdCount: match.emdCount,
        ffTotal: match.ffTotal,
        webCheckinCount: match.webCheckinCount ?? 0,
      });
    }
  }

  return series;
}

function sortStationRecords(list: AirportStationRecord[]): AirportStationRecord[] {
  return [...list].sort((a, b) => {
    if (a.isHub && !b.isHub) return -1;
    if (!a.isHub && b.isHub) return 1;
    if (a.scope !== b.scope) return a.scope === "KP_OPERATED" ? -1 : 1;
    return a.code.localeCompare(b.code);
  });
}

export async function getAllStationsFromDb(): Promise<AirportStationRecord[]> {
  try {
    const db = await openArchiveDb();
    const existing = await new Promise<AirportStationRecord[]>((resolve, reject) => {
      const tx = db.transaction(STATIONS_STORE_NAME, "readonly");
      const store = tx.objectStore(STATIONS_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as AirportStationRecord[]) || []);
      req.onerror = () => reject(req.error || new Error("Erreur lecture table stations."));
      tx.oncomplete = () => db.close();
    });

    if (existing.length > 0) {
      return sortStationRecords(existing);
    }

    // Si la table est vide, peupler automatiquement avec les stations issues des exemples étudiés
    return await resetStationsInDb();
  } catch {
    const now = new Date().toISOString();
    return sortStationRecords(
      DEFAULT_STUDIED_STATIONS.map((s) => ({
        ...s,
        source: "SEED_FLIGHT_EXAMPLES",
        createdAt: now,
      }))
    );
  }
}

export async function upsertStationInDb(
  station: Omit<AirportStationRecord, "createdAt"> & { createdAt?: string }
): Promise<AirportStationRecord[]> {
  const cleanCode = (station.code || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleanCode)) {
    throw new Error("Le code station IATA doit contenir exactement 3 lettres (ex : LFW).");
  }
  const db = await openArchiveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STATIONS_STORE_NAME, "readwrite");
    const store = tx.objectStore(STATIONS_STORE_NAME);
    store.put({
      ...station,
      code: cleanCode,
      city: (station.city || cleanCode).trim(),
      country: (station.country || "—").trim(),
      isHub: station.isHub ?? cleanCode === "LFW",
      createdAt: station.createdAt || new Date().toISOString(),
    } satisfies AirportStationRecord);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur enregistrement station."));
    };
  });
  return getAllStationsFromDb();
}

export async function deleteStationFromDb(code: string): Promise<AirportStationRecord[]> {
  const cleanCode = (code || "").trim().toUpperCase();
  const db = await openArchiveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STATIONS_STORE_NAME, "readwrite");
    tx.objectStore(STATIONS_STORE_NAME).delete(cleanCode);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur suppression station."));
    };
  });
  return getAllStationsFromDb();
}

export async function resetStationsInDb(): Promise<AirportStationRecord[]> {
  const db = await openArchiveDb();
  const now = new Date().toISOString();
  const seeded: AirportStationRecord[] = DEFAULT_STUDIED_STATIONS.map((st) => ({
    ...st,
    source: "SEED_FLIGHT_EXAMPLES",
    createdAt: now,
  }));

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STATIONS_STORE_NAME, "readwrite");
    const store = tx.objectStore(STATIONS_STORE_NAME);
    store.clear();
    for (const item of seeded) {
      store.put(item);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Erreur réinitialisation table stations."));
    };
  });

  return sortStationRecords(seeded);
}

