/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmdDocumentDetail, ManifestFlight } from "../types";
import {
  CurrencyTotalEntry,
  accumulateCurrencyTotals,
  classifyEmdBaggagePieces,
  computeEmdTotalInCurrency,
  computeEmdTotalXof,
  computeStationFlightEmdSummary,
  convertEmdDetailToCurrency,
  convertEmdDetailToXof,
  convertXofToCurrency,
  extractUniqueEmdsFromFlights,
  formatIssuingPointLabel,
  getEmdIssuanceInfo,
  loadDisplayCurrency,
  loadXofRates,
  normalizeEmdNumber,
} from "./emdAudit";
import { getDcsFlightDateSortOrder, normalizeDcsFlightDate } from "./manifestParser";

export type EmdAnalyticsScopeMode =
  | "ALL_IMPORTED"
  | "LINKED_FLIGHTS"
  | "STATION_ORIGIN_ONLY";

export interface EmdAnalyticsFilterState {
  scopeMode: EmdAnalyticsScopeMode;
  station: string;
  pointCode: string;
  agent: string;
  stationNumber: string;
  reason: string;
  currency: string;
  fop: string;
  search: string;
}

export interface EmdStationStatRow {
  station: string;
  emdCount: number;
  excessBaggageCount: number;
  pieces32kg: number;
  pieces23kg: number;
  specialBagPieces: number;
  upgradesCount: number;
  pointCodes: string[];
  agents: string[];
  totalsByCurrency: CurrencyTotalEntry[];
  totalXof: number;
  totalTarget: number;
}

export interface EmdAgentStatRow {
  key: string;
  station: string;
  pointCode: string;
  agent: string;
  stationNumber: string;
  emdCount: number;
  pieces32kg: number;
  pieces23kg: number;
  specialBagPieces: number;
  upgradesCount: number;
  primaryFop: string;
  totalsByCurrency: CurrencyTotalEntry[];
  totalXof: number;
  totalTarget: number;
}

export interface EmdFlightStationRevenueRow {
  flightId: string;
  date: string;
  sortOrder: number;
  flightLabel: string;
  origin: string;
  primaryDestination: string;
  totalFlightEmds: number;
  stationIssuedCount: number;
  transitExcludedCount: number;
  unauditedCount: number;
  pieces32kg: number;
  pieces23kg: number;
  specialBagPieces: number;
  upgradesCount: number;
  stationTotalsByCurrency: CurrencyTotalEntry[];
  stationTotalXof: number;
  stationTotalTarget: number;
}

export interface EmdProductBreakdownRow {
  code: string;
  labelFr: string;
  labelEn: string;
  emdCount: number;
  piecesCount: number;
  totalXof: number;
  totalTarget: number;
}

export interface EmdFopBreakdownRow {
  methodCode: string;
  emdCount: number;
  sharePct: number;
  totalsByCurrency: CurrencyTotalEntry[];
  totalXof: number;
  totalTarget: number;
}

export interface EmdPointBreakdownRow {
  pointCode: string;
  emdCount: number;
  sharePct: number;
  pieces32kg: number;
  pieces23kg: number;
  totalsByCurrency: CurrencyTotalEntry[];
  totalXof: number;
  totalTarget: number;
}

export interface EmdDailyRevenueRow {
  dateKey: string;
  sortOrder: number;
  emdCount: number;
  pieces32kg: number;
  pieces23kg: number;
  specialBagPieces: number;
  upgradesCount: number;
  totalsByCurrency: CurrencyTotalEntry[];
  totalXof: number;
  totalTarget: number;
}

export interface EmdAnalyticsResult {
  targetCurrency: string;
  allImportedCount: number;
  linkedToFlightsCount: number;
  stationOriginMatchedCount: number;
  filteredDetails: EmdDocumentDetail[];
  filterOptions: {
    stations: string[];
    pointCodes: string[];
    agents: string[];
    stationNumbers: string[];
    reasons: string[];
    currencies: string[];
    fops: string[];
  };
  kpis: {
    totalEmds: number;
    excessBaggageEmds: number;
    inFlightServiceEmds: number;
    pieces32kg: number;
    pieces23kg: number;
    specialBagPieces: number;
    totalExcessPieces: number;
    upgradesCount: number;
    totalsByCurrency: CurrencyTotalEntry[];
    baseTotalsByCurrency: CurrencyTotalEntry[];
    totalXof: number;
    baseTotalXof: number;
    totalTarget: number;
    baseTotalTarget: number;
    cardPaymentsCount: number;
    cashPaymentsCount: number;
    cardSharePct: number;
  };
  dailyRevenue: EmdDailyRevenueRow[];
  byStation: EmdStationStatRow[];
  byAgentStation: EmdAgentStatRow[];
  byFlightStationRevenue: EmdFlightStationRevenueRow[];
  productBreakdown: EmdProductBreakdownRow[];
  fopBreakdown: EmdFopBreakdownRow[];
  pointBreakdown: EmdPointBreakdownRow[];
}

function matchesSubstringFilter(
  candidate: string | undefined,
  filterValue: string
): boolean {
  const f = (filterValue || "").trim().toLowerCase();
  if (!f || f === "all") return true;
  return (candidate || "").toLowerCase().includes(f);
}

function resolveEmdDateMeta(
  detail: EmdDocumentDetail,
  linkedFlight?: { date: string; flightId: string },
  flightYearMap?: Map<string, string | undefined>
): { dateKey: string; sortOrder: number } {
  if (linkedFlight?.date) {
    const dateKey = normalizeDcsFlightDate(linkedFlight.date);
    const yr = flightYearMap?.get(linkedFlight.flightId);
    const sortOrder = getDcsFlightDateSortOrder(linkedFlight.date, yr);
    if (dateKey) return { dateKey, sortOrder };
  }
  const rawIssue = (detail.dateOfIssue || "").trim().toUpperCase();
  const m = rawIssue.match(/^(\d{2}[A-Z]{3})(\d{2})?$/);
  if (m) {
    const dateKey = normalizeDcsFlightDate(m[1]);
    const year = m[2] ? `20${m[2]}` : undefined;
    return {
      dateKey,
      sortOrder: getDcsFlightDateSortOrder(m[1], year),
    };
  }
  if (rawIssue) {
    return {
      dateKey: rawIssue,
      sortOrder: getDcsFlightDateSortOrder(rawIssue),
    };
  }
  return { dateKey: "N/D", sortOrder: Number.MAX_SAFE_INTEGER };
}

export function computeEmdAnalytics(
  flights: ManifestFlight[],
  emdDetailsMap: Record<string, EmdDocumentDetail>,
  filters: EmdAnalyticsFilterState,
  xofRates: Record<string, number> = loadXofRates(),
  targetCurrency: string = loadDisplayCurrency()
): EmdAnalyticsResult {
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  const allImported = (
    Object.values(emdDetailsMap) as EmdDocumentDetail[]
  ).sort((a, b) => a.emdNumber.localeCompare(b.emdNumber));

  const manifestEmds = extractUniqueEmdsFromFlights(flights);
  const manifestByNum = new Map(
    manifestEmds.map((m) => [normalizeEmdNumber(m.emdNumber), m])
  );
  const flightYearMap = new Map(
    flights.map((f) => [f.id, f.extractedYear])
  );

  const stationsSet = new Set<string>();
  const pointCodesSet = new Set<string>();
  const agentsSet = new Set<string>();
  const stationNumbersSet = new Set<string>();
  const reasonsSet = new Set<string>();
  const currenciesSet = new Set<string>();
  const fopsSet = new Set<string>();

  let linkedToFlightsCount = 0;
  let stationOriginMatchedCount = 0;

  for (const d of allImported) {
    const key = normalizeEmdNumber(d.emdNumber);
    const iss = getEmdIssuanceInfo(d);
    if (iss.issuingStation) stationsSet.add(iss.issuingStation);
    if (iss.issuingPointCode) pointCodesSet.add(iss.issuingPointCode);
    if (iss.issuingAgent) agentsSet.add(iss.issuingAgent);
    if (iss.issuingStationNumber) stationNumbersSet.add(iss.issuingStationNumber);
    if (d.reasonForIssuance) reasonsSet.add(d.reasonForIssuance);
    if (d.totalValue?.currency) currenciesSet.add(d.totalValue.currency);
    for (const f of d.fopEntries || []) {
      if (f.methodCode) fopsSet.add(f.methodCode);
    }

    const mRef = manifestByNum.get(key);
    if (mRef) {
      linkedToFlightsCount++;
      if (
        iss.issuingStation &&
        mRef.flights.some((fl) => fl.origin === iss.issuingStation)
      ) {
        stationOriginMatchedCount++;
      }
    }
  }

  const q = filters.search.trim().toLowerCase();

  const filteredDetails = allImported.filter((d) => {
    const key = normalizeEmdNumber(d.emdNumber);
    const iss = getEmdIssuanceInfo(d);
    const mRef = manifestByNum.get(key);

    if (filters.scopeMode === "LINKED_FLIGHTS" && !mRef) return false;
    if (filters.scopeMode === "STATION_ORIGIN_ONLY") {
      if (
        !mRef ||
        !iss.issuingStation ||
        !mRef.flights.some((fl) => fl.origin === iss.issuingStation)
      ) {
        return false;
      }
    }

    if (!matchesSubstringFilter(iss.issuingStation, filters.station)) {
      return false;
    }
    if (
      !matchesSubstringFilter(
        `${iss.issuingPointCode || ""} ${formatIssuingPointLabel(iss.issuingPointCode, "fr")} ${formatIssuingPointLabel(iss.issuingPointCode, "en")}`,
        filters.pointCode
      )
    ) {
      return false;
    }
    if (!matchesSubstringFilter(iss.issuingAgent, filters.agent)) {
      return false;
    }
    if (
      !matchesSubstringFilter(
        iss.issuingStationNumber ? `STA-${iss.issuingStationNumber}` : "",
        filters.stationNumber
      )
    ) {
      return false;
    }
    if (!matchesSubstringFilter(d.reasonForIssuance, filters.reason)) {
      return false;
    }
    if (!matchesSubstringFilter(d.totalValue?.currency, filters.currency)) {
      return false;
    }
    if (
      filters.fop &&
      filters.fop.trim().toUpperCase() !== "ALL" &&
      !(d.fopEntries || []).some((f) =>
        matchesSubstringFilter(`${f.methodCode} ${f.methodDetails}`, filters.fop)
      )
    ) {
      return false;
    }

    if (q) {
      const hay = [
        d.emdNumber,
        d.passengerName,
        d.pnr || "",
        d.reasonForIssuance,
        iss.issuingStation || "",
        iss.issuingPointCode || "",
        iss.issuingAgent || "",
        iss.issuingStationNumber || "",
        d.fopSummary,
        d.endorsementsRestrictions || "",
        ...d.coupons.map((c) => `${c.route} ${c.rfisc} ${c.reasonForIssuanceSubCode}`),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  let excessBaggageEmds = 0;
  let inFlightServiceEmds = 0;
  let pieces32kg = 0;
  let pieces23kg = 0;
  let specialBagPieces = 0;
  let upgradesCount = 0;
  let cardPaymentsCount = 0;
  let cashPaymentsCount = 0;

  const dailyAcc = new Map<
    string,
    {
      dateKey: string;
      sortOrder: number;
      details: EmdDocumentDetail[];
      pieces32kg: number;
      pieces23kg: number;
      specialBagPieces: number;
      upgradesCount: number;
    }
  >();

  const stationAcc = new Map<
    string,
    {
      details: EmdDocumentDetail[];
      excessBaggageCount: number;
      pieces32kg: number;
      pieces23kg: number;
      specialBagPieces: number;
      upgradesCount: number;
      pointCodes: Set<string>;
      agents: Set<string>;
    }
  >();

  const agentAcc = new Map<
    string,
    {
      station: string;
      pointCode: string;
      agent: string;
      stationNumber: string;
      details: EmdDocumentDetail[];
      pieces32kg: number;
      pieces23kg: number;
      specialBagPieces: number;
      upgradesCount: number;
      fopCounts: Record<string, number>;
    }
  >();

  const fopAcc = new Map<string, EmdDocumentDetail[]>();
  const pointAcc = new Map<
    string,
    {
      details: EmdDocumentDetail[];
      pieces32kg: number;
      pieces23kg: number;
    }
  >();

  let emd32Count = 0;
  let emd23Count = 0;
  let emdSpecialCount = 0;
  let emdUpgradeCount = 0;
  let emdOtherCount = 0;
  let otherServicePieces = 0;

  let xof32 = 0;
  let xof23 = 0;
  let xofSpecial = 0;
  let xofUpgrade = 0;
  let xofOther = 0;

  let target32 = 0;
  let target23 = 0;
  let targetSpecial = 0;
  let targetUpgrade = 0;
  let targetOther = 0;

  for (const d of filteredDetails) {
    const key = normalizeEmdNumber(d.emdNumber);
    const mRef = manifestByNum.get(key);
    const iss = getEmdIssuanceInfo(d);
    const cls = classifyEmdBaggagePieces(d);
    const emdXof = convertEmdDetailToXof(d, xofRates, "totalValue") || 0;
    const emdTarget =
      convertEmdDetailToCurrency(d, target, xofRates, "totalValue") || 0;

    if (cls.isExcessBaggage) excessBaggageEmds++;
    if (
      /IN-FLIGHT|UPGRADE/i.test(d.reasonForIssuance || "") ||
      cls.inFlightUpgradeCount > 0
    ) {
      inFlightServiceEmds++;
    }

    pieces32kg += cls.pieces32kg;
    pieces23kg += cls.pieces23kg;
    specialBagPieces += cls.specialBagPieces;
    upgradesCount += cls.inFlightUpgradeCount;
    otherServicePieces += cls.otherServiceCount;

    if (cls.pieces32kg > 0) emd32Count++;
    if (cls.pieces23kg > 0) emd23Count++;
    if (cls.specialBagPieces > 0) emdSpecialCount++;
    if (cls.inFlightUpgradeCount > 0) emdUpgradeCount++;
    if (
      cls.pieces32kg === 0 &&
      cls.pieces23kg === 0 &&
      cls.specialBagPieces === 0 &&
      cls.inFlightUpgradeCount === 0
    ) {
      emdOtherCount++;
    }

    const totalUnits =
      cls.pieces32kg +
      cls.pieces23kg +
      cls.specialBagPieces +
      cls.inFlightUpgradeCount +
      cls.otherServiceCount;
    if (totalUnits > 0) {
      xof32 += Math.round((emdXof * cls.pieces32kg) / totalUnits);
      xof23 += Math.round((emdXof * cls.pieces23kg) / totalUnits);
      xofSpecial += Math.round((emdXof * cls.specialBagPieces) / totalUnits);
      xofUpgrade += Math.round((emdXof * cls.inFlightUpgradeCount) / totalUnits);
      xofOther += Math.round((emdXof * cls.otherServiceCount) / totalUnits);

      target32 += (emdTarget * cls.pieces32kg) / totalUnits;
      target23 += (emdTarget * cls.pieces23kg) / totalUnits;
      targetSpecial += (emdTarget * cls.specialBagPieces) / totalUnits;
      targetUpgrade += (emdTarget * cls.inFlightUpgradeCount) / totalUnits;
      targetOther += (emdTarget * cls.otherServiceCount) / totalUnits;
    } else {
      xofOther += emdXof;
      targetOther += emdTarget;
    }

    const dateMeta = resolveEmdDateMeta(d, mRef?.flights[0], flightYearMap);
    const dayEntry = dailyAcc.get(dateMeta.dateKey) || {
      dateKey: dateMeta.dateKey,
      sortOrder: dateMeta.sortOrder,
      details: [],
      pieces32kg: 0,
      pieces23kg: 0,
      specialBagPieces: 0,
      upgradesCount: 0,
    };
    dayEntry.sortOrder = Math.min(dayEntry.sortOrder, dateMeta.sortOrder);
    dayEntry.details.push(d);
    dayEntry.pieces32kg += cls.pieces32kg;
    dayEntry.pieces23kg += cls.pieces23kg;
    dayEntry.specialBagPieces += cls.specialBagPieces;
    dayEntry.upgradesCount += cls.inFlightUpgradeCount;
    dailyAcc.set(dateMeta.dateKey, dayEntry);

    const primaryFop = d.fopEntries[0]?.methodCode || "AUTRE";
    if (primaryFop === "CA") cashPaymentsCount++;
    else if (/^(VI|MC|AX|CC)$/.test(primaryFop)) cardPaymentsCount++;

    if (!fopAcc.has(primaryFop)) fopAcc.set(primaryFop, []);
    fopAcc.get(primaryFop)!.push(d);

    const pt = iss.issuingPointCode || "N/D";
    if (!pointAcc.has(pt)) {
      pointAcc.set(pt, { details: [], pieces32kg: 0, pieces23kg: 0 });
    }
    const ptEntry = pointAcc.get(pt)!;
    ptEntry.details.push(d);
    ptEntry.pieces32kg += cls.pieces32kg;
    ptEntry.pieces23kg += cls.pieces23kg;

    const st = iss.issuingStation || "N/D";
    if (!stationAcc.has(st)) {
      stationAcc.set(st, {
        details: [],
        excessBaggageCount: 0,
        pieces32kg: 0,
        pieces23kg: 0,
        specialBagPieces: 0,
        upgradesCount: 0,
        pointCodes: new Set<string>(),
        agents: new Set<string>(),
      });
    }
    const stEntry = stationAcc.get(st)!;
    stEntry.details.push(d);
    if (cls.isExcessBaggage) stEntry.excessBaggageCount++;
    stEntry.pieces32kg += cls.pieces32kg;
    stEntry.pieces23kg += cls.pieces23kg;
    stEntry.specialBagPieces += cls.specialBagPieces;
    stEntry.upgradesCount += cls.inFlightUpgradeCount;
    if (iss.issuingPointCode) stEntry.pointCodes.add(iss.issuingPointCode);
    if (iss.issuingAgent) stEntry.agents.add(iss.issuingAgent);

    const agKey = `${st}|${pt}|${iss.issuingAgent || "N/D"}|${
      iss.issuingStationNumber || "—"
    }`;
    if (!agentAcc.has(agKey)) {
      agentAcc.set(agKey, {
        station: st,
        pointCode: pt,
        agent: iss.issuingAgent || "N/D",
        stationNumber: iss.issuingStationNumber || "—",
        details: [],
        pieces32kg: 0,
        pieces23kg: 0,
        specialBagPieces: 0,
        upgradesCount: 0,
        fopCounts: {},
      });
    }
    const agEntry = agentAcc.get(agKey)!;
    agEntry.details.push(d);
    agEntry.pieces32kg += cls.pieces32kg;
    agEntry.pieces23kg += cls.pieces23kg;
    agEntry.specialBagPieces += cls.specialBagPieces;
    agEntry.upgradesCount += cls.inFlightUpgradeCount;
    agEntry.fopCounts[primaryFop] = (agEntry.fopCounts[primaryFop] || 0) + 1;
  }

  const dailyRevenue: EmdDailyRevenueRow[] = Array.from(dailyAcc.values())
    .map((v) => ({
      dateKey: v.dateKey,
      sortOrder: v.sortOrder,
      emdCount: v.details.length,
      pieces32kg: v.pieces32kg,
      pieces23kg: v.pieces23kg,
      specialBagPieces: v.specialBagPieces,
      upgradesCount: v.upgradesCount,
      totalsByCurrency: accumulateCurrencyTotals(v.details, "totalValue"),
      totalXof: computeEmdTotalXof(v.details, xofRates, "totalValue").totalXof,
      totalTarget: computeEmdTotalInCurrency(
        v.details,
        target,
        xofRates,
        "totalValue"
      ).total,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.dateKey.localeCompare(b.dateKey));

  const byStation: EmdStationStatRow[] = Array.from(stationAcc.entries())
    .map(([station, v]) => ({
      station,
      emdCount: v.details.length,
      excessBaggageCount: v.excessBaggageCount,
      pieces32kg: v.pieces32kg,
      pieces23kg: v.pieces23kg,
      specialBagPieces: v.specialBagPieces,
      upgradesCount: v.upgradesCount,
      pointCodes: Array.from(v.pointCodes).sort(),
      agents: Array.from(v.agents).sort(),
      totalsByCurrency: accumulateCurrencyTotals(v.details, "totalValue"),
      totalXof: computeEmdTotalXof(v.details, xofRates, "totalValue").totalXof,
      totalTarget: computeEmdTotalInCurrency(
        v.details,
        target,
        xofRates,
        "totalValue"
      ).total,
    }))
    .sort(
      (a, b) =>
        b.totalXof - a.totalXof ||
        b.emdCount - a.emdCount ||
        a.station.localeCompare(b.station)
    );

  const byAgentStation: EmdAgentStatRow[] = Array.from(agentAcc.entries())
    .map(([key, v]) => {
      const sortedFops = Object.entries(v.fopCounts).sort((a, b) => b[1] - a[1]);
      return {
        key,
        station: v.station,
        pointCode: v.pointCode,
        agent: v.agent,
        stationNumber: v.stationNumber,
        emdCount: v.details.length,
        pieces32kg: v.pieces32kg,
        pieces23kg: v.pieces23kg,
        specialBagPieces: v.specialBagPieces,
        upgradesCount: v.upgradesCount,
        primaryFop: sortedFops[0]?.[0] || "—",
        totalsByCurrency: accumulateCurrencyTotals(v.details, "totalValue"),
        totalXof: computeEmdTotalXof(v.details, xofRates, "totalValue").totalXof,
        totalTarget: computeEmdTotalInCurrency(
          v.details,
          target,
          xofRates,
          "totalValue"
        ).total,
      };
    })
    .sort(
      (a, b) =>
        b.totalXof - a.totalXof ||
        b.emdCount - a.emdCount ||
        a.station.localeCompare(b.station)
    );

  const totalFiltered = filteredDetails.length;
  const fopBreakdown: EmdFopBreakdownRow[] = Array.from(fopAcc.entries())
    .map(([methodCode, list]) => ({
      methodCode,
      emdCount: list.length,
      sharePct:
        totalFiltered > 0
          ? Number(((list.length / totalFiltered) * 100).toFixed(1))
          : 0,
      totalsByCurrency: accumulateCurrencyTotals(list, "totalValue"),
      totalXof: computeEmdTotalXof(list, xofRates, "totalValue").totalXof,
      totalTarget: computeEmdTotalInCurrency(
        list,
        target,
        xofRates,
        "totalValue"
      ).total,
    }))
    .sort((a, b) => b.totalXof - a.totalXof || b.emdCount - a.emdCount);

  const pointBreakdown: EmdPointBreakdownRow[] = Array.from(pointAcc.entries())
    .map(([pointCode, v]) => ({
      pointCode,
      emdCount: v.details.length,
      sharePct:
        totalFiltered > 0
          ? Number(((v.details.length / totalFiltered) * 100).toFixed(1))
          : 0,
      pieces32kg: v.pieces32kg,
      pieces23kg: v.pieces23kg,
      totalsByCurrency: accumulateCurrencyTotals(v.details, "totalValue"),
      totalXof: computeEmdTotalXof(v.details, xofRates, "totalValue").totalXof,
      totalTarget: computeEmdTotalInCurrency(
        v.details,
        target,
        xofRates,
        "totalValue"
      ).total,
    }))
    .sort((a, b) => b.totalXof - a.totalXof || b.emdCount - a.emdCount);

  const roundBucket = (val: number, xofFallback: number): number => {
    if (target === "XOF") return xofFallback;
    if (Number.isFinite(val) && val > 0) {
      return Number(val.toFixed(2));
    }
    return convertXofToCurrency(xofFallback, target, xofRates) || 0;
  };

  const productBreakdown: EmdProductBreakdownRow[] = [
    {
      code: "0C6",
      labelFr: "Excédent Bagage 32 kg (UPTO70LB)",
      labelEn: "Excess Baggage 32 kg (UPTO70LB)",
      emdCount: emd32Count,
      piecesCount: pieces32kg,
      totalXof: xof32,
      totalTarget: roundBucket(target32, xof32),
    },
    {
      code: "0C3",
      labelFr: "Excédent Bagage 23 kg (UPTO50LB)",
      labelEn: "Excess Baggage 23 kg (UPTO50LB)",
      emdCount: emd23Count,
      piecesCount: pieces23kg,
      totalXof: xof23,
      totalTarget: roundBucket(target23, xof23),
    },
    {
      code: "0HQ/PET",
      labelFr: "Bagages spéciaux (Golf / Animaux)",
      labelEn: "Special Baggage (Golf / Pets)",
      emdCount: emdSpecialCount,
      piecesCount: specialBagPieces,
      totalXof: xofSpecial,
      totalTarget: roundBucket(targetSpecial, xofSpecial),
    },
    {
      code: "0BJ",
      labelFr: "Last Minute Upgrade (En vol)",
      labelEn: "Last Minute Upgrade (In-flight)",
      emdCount: emdUpgradeCount,
      piecesCount: upgradesCount,
      totalXof: xofUpgrade,
      totalTarget: roundBucket(targetUpgrade, xofUpgrade),
    },
    {
      code: "AUTRE",
      labelFr: "Autres services",
      labelEn: "Other services",
      emdCount: emdOtherCount,
      piecesCount: otherServicePieces,
      totalXof: xofOther,
      totalTarget: roundBucket(targetOther, xofOther),
    },
  ]
    .filter((p) => p.emdCount > 0 || p.piecesCount > 0 || p.totalXof > 0)
    .sort((a, b) => b.totalXof - a.totalXof);

  const filteredSet = new Set(
    filteredDetails.map((d) => normalizeEmdNumber(d.emdNumber))
  );

  const byFlightStationRevenue: EmdFlightStationRevenueRow[] = [];
  for (const flight of flights) {
    const rawSummary = computeStationFlightEmdSummary(
      flight,
      emdDetailsMap,
      xofRates,
      target
    );
    if (rawSummary.totalFlightEmdsCount === 0) continue;

    const activeStationEmds = rawSummary.stationIssuedEmds.filter((d) =>
      filteredSet.has(normalizeEmdNumber(d.emdNumber))
    );
    const activeTransitExcluded = rawSummary.transitOrForeignEmds.filter((d) =>
      filteredSet.has(normalizeEmdNumber(d.emdNumber))
    );

    let f32 = 0;
    let f23 = 0;
    let fSpec = 0;
    let fUpg = 0;
    for (const d of activeStationEmds) {
      const c = classifyEmdBaggagePieces(d);
      f32 += c.pieces32kg;
      f23 += c.pieces23kg;
      fSpec += c.specialBagPieces;
      fUpg += c.inFlightUpgradeCount;
    }

    const stationXof = computeEmdTotalXof(
      activeStationEmds,
      xofRates,
      "totalValue"
    ).totalXof;
    const stationTarget = computeEmdTotalInCurrency(
      activeStationEmds,
      target,
      xofRates,
      "totalValue"
    ).total;

    byFlightStationRevenue.push({
      flightId: flight.id,
      date: normalizeDcsFlightDate(flight.date),
      sortOrder: getDcsFlightDateSortOrder(flight.date, flight.extractedYear),
      flightLabel: `${flight.airline} ${flight.flightNumber}`,
      origin: rawSummary.flightOrigin,
      primaryDestination: flight.primaryDestination,
      totalFlightEmds: rawSummary.totalFlightEmdsCount,
      stationIssuedCount: activeStationEmds.length,
      transitExcludedCount:
        filters.station === "ALL" &&
        filters.agent === "ALL" &&
        filters.stationNumber === "ALL"
          ? rawSummary.transitOrForeignEmds.length
          : activeTransitExcluded.length,
      unauditedCount: rawSummary.unauditedEmdNumbers.length,
      pieces32kg: f32,
      pieces23kg: f23,
      specialBagPieces: fSpec,
      upgradesCount: fUpg,
      stationTotalsByCurrency: accumulateCurrencyTotals(
        activeStationEmds,
        "totalValue"
      ),
      stationTotalXof: stationXof,
      stationTotalTarget: stationTarget,
    });
  }

  byFlightStationRevenue.sort(
    (a, b) =>
      b.sortOrder - a.sortOrder ||
      b.stationTotalXof - a.stationTotalXof ||
      a.flightLabel.localeCompare(b.flightLabel)
  );

  const knownPayments = cardPaymentsCount + cashPaymentsCount;
  const { totalXof } = computeEmdTotalXof(filteredDetails, xofRates, "totalValue");
  const { totalXof: baseTotalXof } = computeEmdTotalXof(
    filteredDetails,
    xofRates,
    "baseValue"
  );
  const { total: totalTarget } = computeEmdTotalInCurrency(
    filteredDetails,
    target,
    xofRates,
    "totalValue"
  );
  const { total: baseTotalTarget } = computeEmdTotalInCurrency(
    filteredDetails,
    target,
    xofRates,
    "baseValue"
  );

  return {
    targetCurrency: target,
    allImportedCount: allImported.length,
    linkedToFlightsCount,
    stationOriginMatchedCount,
    filteredDetails,
    filterOptions: {
      stations: Array.from(stationsSet).sort(),
      pointCodes: Array.from(pointCodesSet).sort(),
      agents: Array.from(agentsSet).sort(),
      stationNumbers: Array.from(stationNumbersSet).sort(),
      reasons: Array.from(reasonsSet).sort(),
      currencies: Array.from(currenciesSet).sort(),
      fops: Array.from(fopsSet).sort(),
    },
    kpis: {
      totalEmds: filteredDetails.length,
      excessBaggageEmds,
      inFlightServiceEmds,
      pieces32kg,
      pieces23kg,
      specialBagPieces,
      totalExcessPieces: pieces32kg + pieces23kg + specialBagPieces,
      upgradesCount,
      totalsByCurrency: accumulateCurrencyTotals(filteredDetails, "totalValue"),
      baseTotalsByCurrency: accumulateCurrencyTotals(filteredDetails, "baseValue"),
      totalXof,
      baseTotalXof,
      totalTarget,
      baseTotalTarget,
      cardPaymentsCount,
      cashPaymentsCount,
      cardSharePct:
        knownPayments > 0
          ? Number(((cardPaymentsCount / knownPayments) * 100).toFixed(1))
          : 0,
    },
    dailyRevenue,
    byStation,
    byAgentStation,
    byFlightStationRevenue,
    productBreakdown,
    fopBreakdown,
    pointBreakdown,
  };
}
