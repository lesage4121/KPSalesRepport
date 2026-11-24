/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EmdCouponDetail,
  EmdDocumentDetail,
  EmdFopEntry,
  EmdMonetaryValue,
  ManifestFlight,
} from "../types";
import { downloadAnsiFile } from "./flightParser";
import { getDcsFlightDateSortOrder } from "./manifestParser";

const EMD_AUDIT_STORAGE_KEY = "kp_emd_audit_details_v1";

export interface EmdAuditFlightRef {
  flightId: string;
  airline: string;
  flightNumber: string;
  date: string;
  origin: string;
  primaryDestination: string;
  route: string;
}

export interface EmdAuditRecord {
  emdNumber: string;
  wincmd: string;
  coupons: string[];
  passengerNames: string[];
  flights: EmdAuditFlightRef[];
  dates: string[];
  routes: string[];
  ancillaryDescriptions: string[];
  bagsCountDeclared: number;
  totalBagWeight: number;
}

export function normalizeEmdNumber(raw: string): string {
  return (raw || "")
    .trim()
    .toUpperCase()
    .replace(/^WEMD\*/, "")
    .replace(/^EMD-/, "");
}

export function generateEmdWincmdCommand(emdNumber: string): string {
  const clean = normalizeEmdNumber(emdNumber);
  return `WINCMD("PTRWEMD*${clean}")`;
}

export function formatEmdRoute(route: string): string {
  const clean = (route || "").trim().toUpperCase();
  if (/^[A-Z]{6}$/.test(clean)) {
    return `${clean.slice(0, 3)} → ${clean.slice(3, 6)}`;
  }
  return clean;
}

export function formatCleanNumber(
  num: number,
  locale = "fr-FR",
  minDigits = 0,
  maxDigits = 0
): string {
  if (!Number.isFinite(num)) return "—";
  return num
    .toLocaleString(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    })
    .replace(/[\u202F\u00A0]/g, " ");
}

export function formatEmdMonetaryValue(
  val?: EmdMonetaryValue,
  locale = "fr-FR"
): string {
  if (!val) return "—";
  const hasDecimals = /\.\d{1,2}$/.test(val.rawAmount.trim());
  const formattedNum = Number.isFinite(val.amount)
    ? formatCleanNumber(val.amount, locale, hasDecimals ? 2 : 0, hasDecimals ? 2 : 0)
    : val.rawAmount;
  return `${formattedNum} ${val.currency}`;
}

export function formatFopMethodLabel(
  code: string,
  language: "fr" | "en" = "fr"
): string {
  const upper = (code || "").trim().toUpperCase();
  if (upper === "CA") return language === "en" ? "Cash (CA)" : "Espèces (CA)";
  if (upper === "VI") return language === "en" ? "Visa Card (VI)" : "Carte Visa (VI)";
  if (upper === "MC" || upper === "CA/MC")
    return language === "en" ? "Mastercard (MC)" : "Mastercard (MC)";
  if (upper === "AX") return language === "en" ? "Amex (AX)" : "Amex (AX)";
  if (upper === "CC") return language === "en" ? "Credit Card (CC)" : "Carte Bancaire (CC)";
  if (upper === "CK") return language === "en" ? "Cheque (CK)" : "Chèque (CK)";
  return upper || "—";
}

export interface EmdIssuanceInfo {
  issuingOffice?: string;
  issuingStation?: string;
  issuingPointCode?: string;
  issuingAgent?: string; // Full station + sign-in e.g. COOC06
  issuingAgentSignIn?: string; // Raw sign-in e.g. C06
  issuingStationNumber?: string;
}

export function formatCompositeAgentId(
  station?: string,
  signIn?: string
): string | undefined {
  const st = (station || "").trim().toUpperCase();
  const ag = (signIn || "").trim().toUpperCase();
  if (!ag) return undefined;
  if (!st) return ag;
  if (ag.startsWith(st) && ag.length > st.length) return ag;
  return `${st}${ag}`;
}

export function parseIssuedAtLine(issuedAt?: string): EmdIssuanceInfo {
  const clean = (issuedAt || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!clean) return {};

  // Format: "COOAP COO C06 STA-03222962"
  const fullMatch = clean.match(
    /^([A-Z0-9]{3,10})\s+([A-Z]{3})\s+([A-Z0-9]+)\s+STA-([A-Z0-9]+)$/
  );
  if (fullMatch) {
    const issuingOffice = fullMatch[1];
    const issuingStation = fullMatch[2];
    const signIn = fullMatch[3];
    const issuingPointCode = issuingOffice.startsWith(issuingStation)
      ? issuingOffice.slice(issuingStation.length) || undefined
      : issuingOffice.length >= 5
      ? issuingOffice.slice(3, 5)
      : undefined;
    return {
      issuingOffice,
      issuingStation,
      issuingPointCode,
      issuingAgent: formatCompositeAgentId(issuingStation, signIn),
      issuingAgentSignIn: signIn,
      issuingStationNumber: fullMatch[4],
    };
  }

  // Fallback without STA- or with missing space
  const staMatch = clean.match(/\bSTA-([A-Z0-9]+)\b/);
  const tokens = clean.replace(/\bSTA-[A-Z0-9]+\b/, "").trim().split(/\s+/).filter(Boolean);
  const officeToken = tokens[0];
  const stationToken =
    tokens[1] && /^[A-Z]{3}$/.test(tokens[1])
      ? tokens[1]
      : officeToken && /^[A-Z]{3}/.test(officeToken)
      ? officeToken.slice(0, 3)
      : undefined;
  const signInToken =
    tokens[2] || (tokens[1] && tokens[1] !== stationToken ? tokens[1] : undefined);
  const pointCode =
    officeToken && stationToken && officeToken.startsWith(stationToken)
      ? officeToken.slice(stationToken.length) || undefined
      : undefined;

  return {
    issuingOffice: officeToken,
    issuingStation: stationToken,
    issuingPointCode: pointCode,
    issuingAgent: formatCompositeAgentId(stationToken, signInToken),
    issuingAgentSignIn: signInToken,
    issuingStationNumber: staMatch?.[1],
  };
}

export function getEmdIssuanceInfo(detail?: EmdDocumentDetail): EmdIssuanceInfo {
  if (!detail) return {};
  if (
    detail.issuingStation ||
    detail.issuingAgent ||
    detail.issuingStationNumber ||
    detail.issuingPointCode
  ) {
    const parsedFallback = detail.issuedAt ? parseIssuedAtLine(detail.issuedAt) : {};
    const station = detail.issuingStation || parsedFallback.issuingStation;
    const rawSignIn =
      detail.issuingAgentSignIn ||
      parsedFallback.issuingAgentSignIn ||
      detail.issuingAgent;
    return {
      issuingOffice: detail.issuingOffice || parsedFallback.issuingOffice,
      issuingStation: station,
      issuingPointCode: detail.issuingPointCode || parsedFallback.issuingPointCode,
      issuingAgent: formatCompositeAgentId(station, rawSignIn),
      issuingAgentSignIn: rawSignIn,
      issuingStationNumber:
        detail.issuingStationNumber || parsedFallback.issuingStationNumber,
    };
  }
  return parseIssuedAtLine(detail.issuedAt);
}

export function formatIssuingPointLabel(
  pointCode?: string,
  language: "fr" | "en" = "fr"
): string {
  const code = (pointCode || "").trim().toUpperCase();
  if (!code) return "";
  if (code === "AP") return language === "en" ? "Airport" : "Aéroport";
  if (code === "CT") return language === "en" ? "City Office" : "Agence Ville";
  if (code === "IB") return language === "en" ? "Online" : "En ligne";
  if (code === "EM") return language === "en" ? "Hub Counter" : "Comptoir Hub";
  return code;
}

export interface EmdBaggagePieceBreakdown {
  isExcessBaggage: boolean;
  pieces32kg: number;
  pieces23kg: number;
  specialBagPieces: number;
  inFlightUpgradeCount: number;
  otherServiceCount: number;
}

export function classifyEmdBaggagePieces(
  detail: EmdDocumentDetail
): EmdBaggagePieceBreakdown {
  const isBaggageReason = /BAGGAGE/i.test(detail.reasonForIssuance || "");
  const isInFlightReason = /IN-FLIGHT|UPGRADE/i.test(
    detail.reasonForIssuance || ""
  );

  // Use max quantity per category across coupons so multi-leg EMDs count billed pieces once
  let max32 = 0;
  let max23 = 0;
  let maxSpecial = 0;
  let maxUpgrade = 0;
  let maxOther = 0;

  for (const cpn of detail.coupons || []) {
    const qty = cpn.quantity && cpn.quantity > 0 ? cpn.quantity : 1;
    const sub = `${cpn.rfisc || ""} ${cpn.reasonForIssuanceSubCode || ""}`.toUpperCase();

    if (/0C6|UPTO70LB|32KG/.test(sub)) {
      max32 = Math.max(max32, qty);
    } else if (/0C3|UPTO50LB|23KG BAGGAGE/.test(sub)) {
      max23 = Math.max(max23, qty);
    } else if (/0HQ|026|OBT|PET|GOLF|SPORT|BIKE|BULK/.test(sub)) {
      maxSpecial = Math.max(maxSpecial, qty);
    } else if (/0BJ|UPGRADE/.test(sub) || isInFlightReason) {
      maxUpgrade = Math.max(maxUpgrade, qty);
    } else if (isBaggageReason) {
      maxSpecial = Math.max(maxSpecial, qty);
    } else {
      maxOther = Math.max(maxOther, qty);
    }
  }

  if ((detail.coupons || []).length === 0) {
    if (isBaggageReason) maxSpecial = 1;
    else if (isInFlightReason) maxUpgrade = 1;
    else maxOther = 1;
  }

  return {
    isExcessBaggage: isBaggageReason || max32 > 0 || max23 > 0 || maxSpecial > 0,
    pieces32kg: max32,
    pieces23kg: max23,
    specialBagPieces: maxSpecial,
    inFlightUpgradeCount: maxUpgrade,
    otherServiceCount: maxOther,
  };
}

export interface CurrencyTotalEntry {
  currency: string;
  amount: number;
}

export function accumulateCurrencyTotals(
  details: EmdDocumentDetail[],
  field: "totalValue" | "baseValue" = "totalValue"
): CurrencyTotalEntry[] {
  const byCurrency = new Map<string, number>();
  for (const d of details) {
    const mv = d[field] || (field === "totalValue" ? d.baseValue : undefined);
    if (!mv || !mv.currency || !Number.isFinite(mv.amount)) continue;
    const cur = mv.currency.trim().toUpperCase();
    byCurrency.set(cur, (byCurrency.get(cur) || 0) + mv.amount);
  }
  return Array.from(byCurrency.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));
}

export function formatCurrencyTotals(
  totals: CurrencyTotalEntry[],
  locale = "fr-FR"
): string {
  if (!totals || totals.length === 0) return "—";
  return totals
    .map((entry) => {
      const hasDecimals = Math.abs(entry.amount % 1) > 0.005;
      const numStr = formatCleanNumber(
        entry.amount,
        locale,
        hasDecimals ? 2 : 0,
        hasDecimals ? 2 : 0
      );
      return `${numStr} ${entry.currency}`;
    })
    .join(" · ");
}

const XOF_RATES_STORAGE_KEY = "kp_xof_exchange_rates_v1";

export const DEFAULT_XOF_RATES: Record<string, number> = {
  XOF: 1,
  XAF: 1,
  EUR: 655.957,
  USD: 598,
  NGN: 0.428,
  ZAR: 34.3,
  GHS: 49.8,
  MRU: 14.75,
  GMD: 8.5,
  LRD: 3.1,
  SLE: 26,
  SLL: 0.026,
  GBP: 760,
  CAD: 430,
  CHF: 685,
  MAD: 60,
  GNF: 0.069,
  CVE: 5.95,
  AOA: 0.65,
  CDF: 0.21,
};

export function loadXofRates(): Record<string, number> {
  if (typeof window === "undefined") return { ...DEFAULT_XOF_RATES };
  try {
    const raw = window.localStorage.getItem(XOF_RATES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_XOF_RATES };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const merged = { ...DEFAULT_XOF_RATES };
      for (const [k, v] of Object.entries(parsed)) {
        const num = Number(v);
        if (k && Number.isFinite(num) && num > 0) {
          merged[k.trim().toUpperCase()] = num;
        }
      }
      merged.XOF = 1;
      merged.XAF = 1;
      return merged;
    }
  } catch {
    // Ignore storage read errors
  }
  return { ...DEFAULT_XOF_RATES };
}

export function saveXofRates(rates: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    const clean: Record<string, number> = { ...DEFAULT_XOF_RATES };
    for (const [k, v] of Object.entries(rates)) {
      const num = Number(v);
      if (k && Number.isFinite(num) && num > 0) {
        clean[k.trim().toUpperCase()] = num;
      }
    }
    clean.XOF = 1;
    clean.XAF = 1;
    window.localStorage.setItem(XOF_RATES_STORAGE_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent("kp-xof-rates-updated"));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetXofRates(): Record<string, number> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(XOF_RATES_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("kp-xof-rates-updated"));
    } catch {
      // Ignore
    }
  }
  return { ...DEFAULT_XOF_RATES };
}

export function convertAmountToXof(
  amount: number,
  currency: string,
  rates: Record<string, number> = DEFAULT_XOF_RATES
): number | null {
  if (!Number.isFinite(amount)) return null;
  const cur = (currency || "").trim().toUpperCase();
  if (!cur) return null;
  if (cur === "XOF" || cur === "XAF") return Math.round(amount);
  const rate = rates[cur] ?? DEFAULT_XOF_RATES[cur];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(amount * rate);
}

export function convertEmdDetailToXof(
  detail?: EmdDocumentDetail,
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  field: "totalValue" | "baseValue" = "totalValue"
): number | null {
  if (!detail) return null;
  if (field === "totalValue") {
    const tot = detail.totalValue;
    if (tot && (tot.currency === "XOF" || tot.currency === "XAF")) {
      return Math.round(tot.amount);
    }
    if (detail.equivValue && (detail.equivValue.currency === "XOF" || detail.equivValue.currency === "XAF")) {
      return Math.round(detail.equivValue.amount);
    }
    if (tot) {
      const direct = convertAmountToXof(tot.amount, tot.currency, rates);
      if (direct !== null) return direct;
    }
    if (detail.baseValue) {
      return convertAmountToXof(
        detail.baseValue.amount,
        detail.baseValue.currency,
        rates
      );
    }
    return null;
  } else {
    const bv = detail.baseValue;
    if (bv) {
      return convertAmountToXof(bv.amount, bv.currency, rates);
    }
    return convertEmdDetailToXof(detail, rates, "totalValue");
  }
}

export function computeEmdTotalXof(
  details: EmdDocumentDetail[],
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  field: "totalValue" | "baseValue" = "totalValue"
): { totalXof: number; convertedCount: number; missingCurrencies: string[] } {
  let totalXof = 0;
  let convertedCount = 0;
  const missing = new Set<string>();
  for (const d of details) {
    const val = convertEmdDetailToXof(d, rates, field);
    if (val !== null) {
      totalXof += val;
      convertedCount++;
    } else {
      const cur = d[field]?.currency || d.totalValue?.currency || d.baseValue?.currency;
      if (cur) missing.add(cur);
    }
  }
  return {
    totalXof,
    convertedCount,
    missingCurrencies: Array.from(missing).sort(),
  };
}

const DISPLAY_CURRENCY_STORAGE_KEY = "kp_emd_display_currency_v1";

export const ZERO_DECIMAL_CURRENCIES = new Set([
  "XOF",
  "XAF",
  "GNF",
  "CDF",
  "SLL",
  "CVE",
]);

export function loadDisplayCurrency(): string {
  if (typeof window === "undefined") return "XOF";
  try {
    const raw = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
    const clean = (raw || "").trim().toUpperCase();
    if (clean && /^[A-Z]{3}$/.test(clean)) return clean;
  } catch {
    // Ignore storage read errors
  }
  return "XOF";
}

export function saveDisplayCurrency(currency: string): void {
  if (typeof window === "undefined") return;
  const clean = (currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(clean)) return;
  try {
    window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, clean);
    window.dispatchEvent(new CustomEvent("kp-display-currency-updated"));
  } catch {
    // Ignore
  }
}

export function convertXofToCurrency(
  amountXof: number | null,
  targetCurrency: string,
  rates: Record<string, number> = DEFAULT_XOF_RATES
): number | null {
  if (amountXof === null || !Number.isFinite(amountXof)) return null;
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  if (target === "XOF" || target === "XAF") return Math.round(amountXof);
  const rate = rates[target] ?? DEFAULT_XOF_RATES[target];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  const raw = amountXof / rate;
  return ZERO_DECIMAL_CURRENCIES.has(target)
    ? Math.round(raw)
    : Number(raw.toFixed(2));
}

export function convertAmountBetweenCurrencies(
  amount: number,
  fromCurrency: string,
  targetCurrency: string,
  rates: Record<string, number> = DEFAULT_XOF_RATES
): number | null {
  if (!Number.isFinite(amount)) return null;
  const from = (fromCurrency || "").trim().toUpperCase();
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  if (!from || !target) return null;
  if (from === target) {
    return ZERO_DECIMAL_CURRENCIES.has(target)
      ? Math.round(amount)
      : Number(amount.toFixed(2));
  }
  if ((from === "XOF" && target === "XAF") || (from === "XAF" && target === "XOF")) {
    return Math.round(amount);
  }
  const fromRate = from === "XOF" || from === "XAF" ? 1 : rates[from] ?? DEFAULT_XOF_RATES[from];
  const targetRate = target === "XOF" || target === "XAF" ? 1 : rates[target] ?? DEFAULT_XOF_RATES[target];
  if (!fromRate || !targetRate || fromRate <= 0 || targetRate <= 0) return null;
  const converted = (amount * fromRate) / targetRate;
  return ZERO_DECIMAL_CURRENCIES.has(target)
    ? Math.round(converted)
    : Number(converted.toFixed(2));
}

export function convertEmdDetailToCurrency(
  detail?: EmdDocumentDetail,
  targetCurrency = "XOF",
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  field: "totalValue" | "baseValue" = "totalValue"
): number | null {
  if (!detail) return null;
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  if (target === "XOF") {
    return convertEmdDetailToXof(detail, rates, field);
  }

  if (field === "totalValue") {
    if (detail.totalValue && detail.totalValue.currency.trim().toUpperCase() === target) {
      return ZERO_DECIMAL_CURRENCIES.has(target)
        ? Math.round(detail.totalValue.amount)
        : Number(detail.totalValue.amount.toFixed(2));
    }
    if (detail.equivValue && detail.equivValue.currency.trim().toUpperCase() === target) {
      return ZERO_DECIMAL_CURRENCIES.has(target)
        ? Math.round(detail.equivValue.amount)
        : Number(detail.equivValue.amount.toFixed(2));
    }
  } else if (detail.baseValue && detail.baseValue.currency.trim().toUpperCase() === target) {
    return ZERO_DECIMAL_CURRENCIES.has(target)
      ? Math.round(detail.baseValue.amount)
      : Number(detail.baseValue.amount.toFixed(2));
  }

  const xof = convertEmdDetailToXof(detail, rates, field);
  return convertXofToCurrency(xof, target, rates);
}

export function computeEmdTotalInCurrency(
  details: EmdDocumentDetail[],
  targetCurrency = "XOF",
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  field: "totalValue" | "baseValue" = "totalValue"
): { total: number; convertedCount: number; missingCurrencies: string[] } {
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  let total = 0;
  let convertedCount = 0;
  const missing = new Set<string>();
  for (const d of details) {
    const val = convertEmdDetailToCurrency(d, target, rates, field);
    if (val !== null) {
      total += val;
      convertedCount++;
    } else {
      const cur = d[field]?.currency || d.totalValue?.currency || d.baseValue?.currency;
      if (cur) missing.add(cur);
    }
  }
  const rounded = ZERO_DECIMAL_CURRENCIES.has(target)
    ? Math.round(total)
    : Number(total.toFixed(2));
  return {
    total: rounded,
    convertedCount,
    missingCurrencies: Array.from(missing).sort(),
  };
}

export function formatCurrencyAmount(
  amount: number | null,
  currency = "XOF",
  locale = "fr-FR"
): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  const cur = (currency || "XOF").trim().toUpperCase();
  const isZeroDec = ZERO_DECIMAL_CURRENCIES.has(cur) || Math.abs(amount % 1) < 0.005;
  const val = ZERO_DECIMAL_CURRENCIES.has(cur) ? Math.round(amount) : amount;
  return `${formatCleanNumber(val, locale, isZeroDec ? 0 : 2, isZeroDec ? 0 : 2)} ${cur}`;
}

export function formatXofAmount(amountXof: number | null, locale = "fr-FR"): string {
  return formatCurrencyAmount(amountXof, "XOF", locale);
}

export function formatEmdMonetaryWithTarget(
  detail?: EmdDocumentDetail,
  targetCurrency = "XOF",
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  locale = "fr-FR"
): string {
  if (!detail?.totalValue) return "—";
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  const localStr = formatEmdMonetaryValue(detail.totalValue, locale);
  const cur = detail.totalValue.currency.trim().toUpperCase();
  if (cur === target) return localStr;
  const converted = convertEmdDetailToCurrency(detail, target, rates, "totalValue");
  if (converted === null) return localStr;
  return `${localStr} (≈ ${formatCurrencyAmount(converted, target, locale)})`;
}

export function formatEmdMonetaryWithXof(
  detail?: EmdDocumentDetail,
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  locale = "fr-FR"
): string {
  return formatEmdMonetaryWithTarget(detail, "XOF", rates, locale);
}

export function formatTotalsWithTarget(
  details: EmdDocumentDetail[],
  targetCurrency = "XOF",
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  locale = "fr-FR"
): string {
  if (!details || details.length === 0) return "—";
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  const totals = accumulateCurrencyTotals(details, "totalValue");
  if (totals.length === 0) return "—";
  const localStr = formatCurrencyTotals(totals, locale);
  if (totals.length === 1 && totals[0].currency === target) {
    return localStr;
  }
  const { total } = computeEmdTotalInCurrency(details, target, rates, "totalValue");
  return `${localStr} · Total ≈ ${formatCurrencyAmount(total, target, locale)}`;
}

export function formatTotalsWithXof(
  details: EmdDocumentDetail[],
  rates: Record<string, number> = DEFAULT_XOF_RATES,
  locale = "fr-FR"
): string {
  return formatTotalsWithTarget(details, "XOF", rates, locale);
}

export interface StationFlightEmdSummary {
  flightOrigin: string;
  totalFlightEmdsCount: number;
  stationIssuedEmds: EmdDocumentDetail[];
  transitOrForeignEmds: EmdDocumentDetail[];
  unauditedEmdNumbers: string[];
  stationTotalsByCurrency: CurrencyTotalEntry[];
  stationTotalXof: number;
  stationTotalTarget: number;
  targetCurrency: string;
  stationExcessPieces32kg: number;
  stationExcessPieces23kg: number;
  stationSpecialBagPieces: number;
  stationInFlightUpgrades: number;
}

export function computeStationFlightEmdSummary(
  flight: ManifestFlight,
  emdDetailsMap: Record<string, EmdDocumentDetail>,
  xofRates: Record<string, number> = DEFAULT_XOF_RATES,
  targetCurrency = "XOF"
): StationFlightEmdSummary {
  const origin = (flight.origin || "").trim().toUpperCase();
  const target = (targetCurrency || "XOF").trim().toUpperCase();
  const uniqueEmdNums = new Set<string>();

  for (const pax of flight.passengers) {
    for (const rawNum of pax.emdNumbers || []) {
      const clean = normalizeEmdNumber(rawNum);
      if (clean) uniqueEmdNums.add(clean);
    }
    for (const anc of pax.ancillaries || []) {
      if (!anc.emdNumber) continue;
      const clean = normalizeEmdNumber(anc.emdNumber);
      if (clean) uniqueEmdNums.add(clean);
    }
  }

  const stationIssuedEmds: EmdDocumentDetail[] = [];
  const transitOrForeignEmds: EmdDocumentDetail[] = [];
  const unauditedEmdNumbers: string[] = [];

  for (const emdNum of uniqueEmdNums) {
    const detail = emdDetailsMap[emdNum];
    if (!detail) {
      unauditedEmdNumbers.push(emdNum);
      continue;
    }
    const issuance = getEmdIssuanceInfo(detail);
    if (issuance.issuingStation && issuance.issuingStation === origin) {
      stationIssuedEmds.push(detail);
    } else {
      transitOrForeignEmds.push(detail);
    }
  }

  let stationExcessPieces32kg = 0;
  let stationExcessPieces23kg = 0;
  let stationSpecialBagPieces = 0;
  let stationInFlightUpgrades = 0;

  for (const d of stationIssuedEmds) {
    const b = classifyEmdBaggagePieces(d);
    stationExcessPieces32kg += b.pieces32kg;
    stationExcessPieces23kg += b.pieces23kg;
    stationSpecialBagPieces += b.specialBagPieces;
    stationInFlightUpgrades += b.inFlightUpgradeCount;
  }

  const { totalXof } = computeEmdTotalXof(stationIssuedEmds, xofRates, "totalValue");
  const { total: stationTotalTarget } = computeEmdTotalInCurrency(
    stationIssuedEmds,
    target,
    xofRates,
    "totalValue"
  );

  return {
    flightOrigin: origin,
    totalFlightEmdsCount: uniqueEmdNums.size,
    stationIssuedEmds,
    transitOrForeignEmds,
    unauditedEmdNumbers,
    stationTotalsByCurrency: accumulateCurrencyTotals(stationIssuedEmds, "totalValue"),
    stationTotalXof: totalXof,
    stationTotalTarget,
    targetCurrency: target,
    stationExcessPieces32kg,
    stationExcessPieces23kg,
    stationSpecialBagPieces,
    stationInFlightUpgrades,
  };
}

export function extractUniqueEmdsFromFlights(
  flights: ManifestFlight[]
): EmdAuditRecord[] {
  interface MutableEmdAcc {
    emdNumber: string;
    coupons: Set<string>;
    passengerNames: Set<string>;
    flightsMap: Map<string, EmdAuditFlightRef>;
    dates: Set<string>;
    routes: Set<string>;
    ancillaryDescriptions: Set<string>;
    seenPaxKeys: Set<string>;
    bagsCountDeclared: number;
    totalBagWeight: number;
  }

  const byEmd = new Map<string, MutableEmdAcc>();

  const getOrCreate = (emdNumber: string): MutableEmdAcc => {
    let acc = byEmd.get(emdNumber);
    if (!acc) {
      acc = {
        emdNumber,
        coupons: new Set<string>(),
        passengerNames: new Set<string>(),
        flightsMap: new Map<string, EmdAuditFlightRef>(),
        dates: new Set<string>(),
        routes: new Set<string>(),
        ancillaryDescriptions: new Set<string>(),
        seenPaxKeys: new Set<string>(),
        bagsCountDeclared: 0,
        totalBagWeight: 0,
      };
      byEmd.set(emdNumber, acc);
    }
    return acc;
  };

  for (const flight of flights) {
    const flightDateSort = getDcsFlightDateSortOrder(
      flight.date,
      flight.extractedYear
    );
    void flightDateSort;

    for (const pax of flight.passengers) {
      const emdCouponsForPax = new Map<string, Set<string>>();
      const emdDescsForPax = new Map<string, Set<string>>();

      for (const rawEmd of pax.emdNumbers || []) {
        const clean = normalizeEmdNumber(rawEmd);
        if (!clean) continue;
        if (!emdCouponsForPax.has(clean)) {
          emdCouponsForPax.set(clean, new Set<string>());
        }
      }

      for (const anc of pax.ancillaries || []) {
        if (!anc.emdNumber) continue;
        const clean = normalizeEmdNumber(anc.emdNumber);
        if (!clean) continue;
        if (!emdCouponsForPax.has(clean)) {
          emdCouponsForPax.set(clean, new Set<string>());
        }
        if (anc.emdCoupon) {
          emdCouponsForPax.get(clean)!.add(anc.emdCoupon.trim().toUpperCase());
        }
        const desc = (anc.description || anc.serviceType || "").trim();
        if (desc) {
          if (!emdDescsForPax.has(clean)) {
            emdDescsForPax.set(clean, new Set<string>());
          }
          emdDescsForPax.get(clean)!.add(desc);
        }
      }

      if (emdCouponsForPax.size > 0 && Array.isArray(pax.rawLines)) {
        for (const line of pax.rawLines) {
          const m = line.trim().match(/^EMD-([A-Z0-9]+)(?:\s+(C\d+))?/i);
          if (!m) continue;
          const clean = normalizeEmdNumber(m[1]);
          if (clean && emdCouponsForPax.has(clean) && m[2]) {
            emdCouponsForPax.get(clean)!.add(m[2].toUpperCase());
          }
        }
      }

      if (emdCouponsForPax.size === 0) continue;

      const legDest = pax.destination || flight.primaryDestination || "";
      const legRoute = legDest
        ? `${flight.origin}-${legDest}`
        : flight.origin;
      const paxUniqueKey = `${flight.id}::${pax.id}`;

      for (const [emdNumber, coupons] of emdCouponsForPax.entries()) {
        const acc = getOrCreate(emdNumber);

        for (const c of coupons) acc.coupons.add(c);
        if (pax.fullNameDisplay) {
          acc.passengerNames.add(pax.fullNameDisplay);
        }
        if (flight.date) {
          acc.dates.add(flight.date);
        }
        if (legRoute) {
          acc.routes.add(legRoute);
        }
        if (!acc.flightsMap.has(flight.id)) {
          acc.flightsMap.set(flight.id, {
            flightId: flight.id,
            airline: flight.airline,
            flightNumber: flight.flightNumber,
            date: flight.date,
            origin: flight.origin,
            primaryDestination: flight.primaryDestination,
            route: legRoute,
          });
        }
        const descs = emdDescsForPax.get(emdNumber);
        if (descs) {
          for (const d of descs) acc.ancillaryDescriptions.add(d);
        }

        if (!acc.seenPaxKeys.has(paxUniqueKey)) {
          acc.seenPaxKeys.add(paxUniqueKey);
          acc.bagsCountDeclared += pax.bagsDeclaredCount || 0;
          acc.totalBagWeight += pax.totalBagWeight || 0;
        }
      }
    }
  }

  return Array.from(byEmd.values())
    .map((acc) => ({
      emdNumber: acc.emdNumber,
      wincmd: generateEmdWincmdCommand(acc.emdNumber),
      coupons: Array.from(acc.coupons).sort(),
      passengerNames: Array.from(acc.passengerNames),
      flights: Array.from(acc.flightsMap.values()),
      dates: Array.from(acc.dates),
      routes: Array.from(acc.routes),
      ancillaryDescriptions: Array.from(acc.ancillaryDescriptions),
      bagsCountDeclared: acc.bagsCountDeclared,
      totalBagWeight: acc.totalBagWeight,
    }))
    .sort((a, b) => a.emdNumber.localeCompare(b.emdNumber));
}

export function generateEmdWincmdText(records: EmdAuditRecord[]): string {
  if (records.length === 0) return "";
  return records.map((r) => r.wincmd).join("\r\n") + "\r\n";
}

export function downloadEmdWincmdAnsi(
  records: EmdAuditRecord[],
  dateLabel?: string
): number {
  if (records.length === 0) return 0;
  const text = generateEmdWincmdText(records);
  const safeDate = (dateLabel || "GLOBAL")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const filename = `WINCMD_AUDIT_EMD_${safeDate || "GLOBAL"}_ANSI.txt`;
  downloadAnsiFile(filename, text);
  return records.length;
}

function parseMonetaryPair(currency: string, rawAmount: string): EmdMonetaryValue {
  const cleanRaw = rawAmount.trim();
  const numeric = parseFloat(cleanRaw.replace(/,/g, ""));
  return {
    currency: currency.trim().toUpperCase(),
    amount: Number.isFinite(numeric) ? numeric : 0,
    rawAmount: cleanRaw,
  };
}

function parseFopLine(rawAfterPrefix: string): EmdFopEntry {
  const collapsed = rawAfterPrefix.replace(/\s+/g, " ").trim();
  const appMatch = collapsed.match(/\bAPP\s+CODE-([A-Z0-9]+)$/i);
  const approvalCode = appMatch ? appMatch[1].trim() : undefined;
  const body = appMatch
    ? collapsed.slice(0, appMatch.index).trim()
    : collapsed;

  const tokens = body.split(/\s+/).filter(Boolean);
  const methodDetails = tokens[0] || collapsed;
  const methodCode = methodDetails.slice(0, 2).toUpperCase();
  const trailing = tokens.length > 1 ? tokens[tokens.length - 1] : undefined;
  const amount =
    trailing && /^[\d.,]+$/.test(trailing) ? trailing : undefined;

  return {
    methodCode,
    methodDetails,
    amount,
    approvalCode,
    raw: collapsed,
  };
}

function parseSingleWemdBlock(blockLines: string[]): EmdDocumentDetail | null {
  let emdNumber = "";
  let passengerName = "";
  let pnr: string | undefined;
  let dateOfIssue: string | undefined;
  let totalCouponsCount: number | undefined;
  let reasonForIssuance = "";
  let baseValue: EmdMonetaryValue | undefined;
  let equivValue: EmdMonetaryValue | undefined;
  let totalValue: EmdMonetaryValue | undefined;
  let valueCalc: string | undefined;
  const fopEntries: EmdFopEntry[] = [];
  let issuedAt: string | undefined;
  let issuedInConnectionWith: string | undefined;
  const endorsementLines: string[] = [];

  const summaryCoupons: EmdCouponDetail[] = [];
  const detailCoupons: EmdCouponDetail[] = [];
  let currentDetailCoupon: EmdCouponDetail | null = null;

  let section: "HEADER" | "SUMMARY_COUPONS" | "ENDORSEMENTS" | "COUPON_DETAILS" =
    "HEADER";

  for (const rawLine of blockLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (section === "SUMMARY_COUPONS" && summaryCoupons.length > 0) {
        section = "HEADER";
      }
      continue;
    }

    if (/^HDQ\./i.test(trimmed)) {
      section = "HEADER";
      continue;
    }

    const wemdHdr = trimmed.match(/^WEMD\*([A-Z0-9]+)/i);
    if (wemdHdr) {
      emdNumber = normalizeEmdNumber(wemdHdr[1]);
      continue;
    }

    if (/^\*{3,}\s*VALUE COUPONS DETAILS\s*\*{3,}/i.test(trimmed)) {
      section = "COUPON_DETAILS";
      currentDetailCoupon = null;
      continue;
    }

    // Document number + Passenger Name line
    const docNameMatch = trimmed.match(/^([A-Z0-9]{10,18})\s+NAME-(.+)$/i);
    if (docNameMatch) {
      if (!emdNumber) {
        emdNumber = normalizeEmdNumber(docNameMatch[1]);
      }
      passengerName = docNameMatch[2].trim();
      continue;
    }

    if (!passengerName) {
      const nameOnly = trimmed.match(/\bNAME-(.+)$/);
      if (nameOnly) {
        passengerName = nameOnly[1].trim();
      }
    }

    const ttlMatch = trimmed.match(/TTL NBR OF CPNS-(\d+)/i);
    if (ttlMatch) {
      totalCouponsCount = parseInt(ttlMatch[1], 10);
    }

    const doiMatch = trimmed.match(/DATE OF ISSUE-([A-Z0-9]+)/i);
    if (doiMatch && !dateOfIssue) {
      dateOfIssue = doiMatch[1].trim().toUpperCase();
    }

    const pnrMatch = trimmed.match(/\bPNR-([A-Z0-9]+)/i);
    if (pnrMatch) {
      pnr = pnrMatch[1].trim().toUpperCase();
    }

    const reasonHeaderMatch = trimmed.match(
      /^REASON FOR ISSUANCE CODE-(.+)$/i
    );
    if (reasonHeaderMatch) {
      reasonForIssuance = reasonHeaderMatch[1].trim();
      section = "HEADER";
      continue;
    }

    if (section === "COUPON_DETAILS") {
      const cpnMarker = trimmed.match(/^CPN\s+(\d+)\s+OF\s+(\d+)/i);
      if (cpnMarker) {
        currentDetailCoupon = {
          couponNumber: cpnMarker[1].padStart(2, "0"),
          airline: "",
          route: "",
          rfisc: "",
          status: "",
          reasonForIssuanceSubCode: "",
        };
        detailCoupons.push(currentDetailCoupon);
        continue;
      }

      if (/^CPN\s+A\/L\s+BRDOFF/i.test(trimmed)) {
        continue;
      }

      // Note: intentionally ignore CPN BASE VALUE and CPN TOTAL VALUE per user instruction
      if (/^CPN\s+(BASE|TOTAL)\s+VALUE\b/i.test(trimmed)) {
        continue;
      }

      if (currentDetailCoupon) {
        const cpnRowMatch = trimmed.match(
          /^(\d{1,2})\s+([A-Z0-9]{2})\s+([A-Z]{6})\s+([A-Z0-9]{2,4})\s+([A-Z]+)(?:\s+(\d+))?$/i
        );
        if (cpnRowMatch) {
          currentDetailCoupon.couponNumber = cpnRowMatch[1].padStart(2, "0");
          currentDetailCoupon.airline = cpnRowMatch[2].toUpperCase();
          currentDetailCoupon.route = cpnRowMatch[3].toUpperCase();
          currentDetailCoupon.rfisc = cpnRowMatch[4].toUpperCase();
          currentDetailCoupon.status = cpnRowMatch[5].toUpperCase();
          if (cpnRowMatch[6]) {
            currentDetailCoupon.quantity = parseInt(cpnRowMatch[6], 10);
          }
          continue;
        }

        const subReasonMatch = trimmed.match(
          /^REASON FOR ISSUANCE SUB CODE-(.+)$/i
        );
        if (subReasonMatch) {
          currentDetailCoupon.reasonForIssuanceSubCode = subReasonMatch[1].trim();
          continue;
        }

        const connDocMatch = trimmed.match(
          /^IN CONNECTION WITH DOCUMENT-([^\s]+)(?:\s+(ASSOCIATED|DISASSOCIATED))?/i
        );
        if (connDocMatch) {
          currentDetailCoupon.inConnectionWithDocument = connDocMatch[1].trim();
          if (connDocMatch[2]) {
            currentDetailCoupon.associationStatus = connDocMatch[2].toUpperCase();
          }
          continue;
        }
      }
      continue;
    }

    if (/^CPN\s+A\/L\s+BRDOFF/i.test(trimmed)) {
      section = "SUMMARY_COUPONS";
      continue;
    }

    if (section === "SUMMARY_COUPONS") {
      const sumMatch = trimmed.match(
        /^(\d{1,2})\s+([A-Z0-9]{2})\s+([A-Z]{6})\s+([A-Z0-9]{2,4})\s+([A-Z]+)$/i
      );
      if (sumMatch) {
        summaryCoupons.push({
          couponNumber: sumMatch[1].padStart(2, "0"),
          airline: sumMatch[2].toUpperCase(),
          route: sumMatch[3].toUpperCase(),
          rfisc: sumMatch[4].toUpperCase(),
          status: sumMatch[5].toUpperCase(),
          reasonForIssuanceSubCode: "",
        });
        continue;
      }
      section = "HEADER";
    }

    if (/^ENDORSEMENTS\/RESTRICTIONS-/i.test(trimmed)) {
      section = "ENDORSEMENTS";
      const inlineText = trimmed
        .replace(/^ENDORSEMENTS\/RESTRICTIONS-/i, "")
        .trim();
      if (inlineText) endorsementLines.push(inlineText);
      continue;
    }

    if (section === "ENDORSEMENTS") {
      endorsementLines.push(trimmed);
      continue;
    }

    // Monetary lines (EMD global values only)
    if (/\bBASE VALUE\b/i.test(trimmed)) {
      const bMatch = trimmed.match(/BASE VALUE\s+([A-Z]{3})\s+([\d.,]+)/i);
      if (bMatch) {
        baseValue = parseMonetaryPair(bMatch[1], bMatch[2]);
      }
      const eMatch = trimmed.match(/EQUIV VALUE\s+([A-Z]{3})\s+([\d.,]+)/i);
      if (eMatch) {
        equivValue = parseMonetaryPair(eMatch[1], eMatch[2]);
      }
      continue;
    }

    const totalMatch = trimmed.match(/^TOTAL VALUE\s+([A-Z]{3})\s+([\d.,]+)/i);
    if (totalMatch) {
      totalValue = parseMonetaryPair(totalMatch[1], totalMatch[2]);
      continue;
    }

    const valCalcMatch = trimmed.match(/^VALUE CALC\s+(.+)$/i);
    if (valCalcMatch) {
      valueCalc = valCalcMatch[1].trim();
      continue;
    }

    const fopMatch = trimmed.match(/^FOP-\s*(.+)$/i);
    if (fopMatch) {
      fopEntries.push(parseFopLine(fopMatch[1]));
      continue;
    }

    const issuedAtMatch = trimmed.match(/ISSUED AT-(.+)$/i);
    if (issuedAtMatch) {
      issuedAt = issuedAtMatch[1].replace(/\s+/g, " ").trim();
      continue;
    }

    const connMatch = trimmed.match(
      /^ISSUED IN CONNECTION WITH\s*-\s*([A-Z0-9]+)/i
    );
    if (connMatch) {
      issuedInConnectionWith = connMatch[1].trim().toUpperCase();
      continue;
    }
  }

  if (!emdNumber) return null;

  // Merge coupon details with summary rows (never keeping per-coupon monetary totals)
  const mergedCouponsMap = new Map<string, EmdCouponDetail>();
  for (const s of summaryCoupons) {
    mergedCouponsMap.set(s.couponNumber, { ...s });
  }
  for (const d of detailCoupons) {
    const existing = mergedCouponsMap.get(d.couponNumber);
    mergedCouponsMap.set(d.couponNumber, {
      couponNumber: d.couponNumber,
      airline: d.airline || existing?.airline || "",
      route: d.route || existing?.route || "",
      rfisc: d.rfisc || existing?.rfisc || "",
      status: d.status || existing?.status || "",
      quantity: d.quantity ?? existing?.quantity,
      reasonForIssuanceSubCode:
        d.reasonForIssuanceSubCode || existing?.reasonForIssuanceSubCode || "",
      inConnectionWithDocument:
        d.inConnectionWithDocument || existing?.inConnectionWithDocument,
      associationStatus: d.associationStatus || existing?.associationStatus,
    });
  }

  const coupons = Array.from(mergedCouponsMap.values()).sort((a, b) =>
    a.couponNumber.localeCompare(b.couponNumber)
  );

  const fopSummary =
    fopEntries.length > 0
      ? fopEntries
          .map((f) => {
            const parts = [f.methodDetails];
            if (f.amount) parts.push(f.amount);
            if (f.approvalCode) parts.push(`APP ${f.approvalCode}`);
            return parts.join(" · ");
          })
          .join(" / ")
      : "";

  const endorsementsRestrictions =
    endorsementLines.length > 0 ? endorsementLines.join(" · ") : undefined;
  const issuance = parseIssuedAtLine(issuedAt);

  return {
    emdNumber,
    passengerName,
    pnr,
    dateOfIssue,
    totalCouponsCount,
    reasonForIssuance,
    coupons,
    baseValue,
    equivValue,
    totalValue,
    valueCalc,
    fopEntries,
    fopSummary,
    endorsementsRestrictions,
    issuedAt,
    issuingOffice: issuance.issuingOffice,
    issuingStation: issuance.issuingStation,
    issuingPointCode: issuance.issuingPointCode,
    issuingAgent: issuance.issuingAgent,
    issuingAgentSignIn: issuance.issuingAgentSignIn,
    issuingStationNumber: issuance.issuingStationNumber,
    issuedInConnectionWith,
    updatedAt: new Date().toISOString(),
  };
}

export interface WemdParseResult {
  emds: EmdDocumentDetail[];
  blocksCount: number;
  duplicatesMerged: number;
}

export function parseWemdOutputFile(content: string): WemdParseResult {
  const normalized = (content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawChunks = normalized.split("\f");

  const blocks: string[][] = [];
  for (const chunk of rawChunks) {
    const lines = chunk.split("\n");
    let current: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^WEMD\*[A-Z0-9]+/i.test(trimmed)) {
        if (current.some((l) => l.trim().length > 0)) {
          blocks.push(current);
        }
        current = [line];
      } else if (
        /^ELECTRONIC MISCELLANEOUS DOCUMENT/i.test(trimmed) &&
        current.some((l) => /^NAME-|\bPNR-|REASON FOR ISSUANCE/i.test(l.trim()))
      ) {
        blocks.push(current);
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.some((l) => l.trim().length > 0)) {
      blocks.push(current);
    }
  }

  const byEmd = new Map<string, EmdDocumentDetail>();
  let blocksCount = 0;
  let duplicatesMerged = 0;

  for (const block of blocks) {
    const parsed = parseSingleWemdBlock(block);
    if (!parsed) continue;
    blocksCount++;
    if (byEmd.has(parsed.emdNumber)) {
      duplicatesMerged++;
    }
    byEmd.set(parsed.emdNumber, parsed);
  }

  return {
    emds: Array.from(byEmd.values()).sort((a, b) =>
      a.emdNumber.localeCompare(b.emdNumber)
    ),
    blocksCount,
    duplicatesMerged,
  };
}

export function loadStoredEmdDetails(): Record<string, EmdDocumentDetail> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EMD_AUDIT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, EmdDocumentDetail>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveStoredEmdDetails(
  map: Record<string, EmdDocumentDetail>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EMD_AUDIT_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("kp-emd-details-updated"));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function upsertEmdDetails(
  prev: Record<string, EmdDocumentDetail>,
  incoming: EmdDocumentDetail[]
): Record<string, EmdDocumentDetail> {
  const next = { ...prev };
  for (const item of incoming) {
    const key = normalizeEmdNumber(item.emdNumber);
    if (!key) continue;
    next[key] = { ...item, emdNumber: key };
  }
  return next;
}

export function clearStoredEmdDetails(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(EMD_AUDIT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("kp-emd-details-updated"));
  } catch {
    // Ignore
  }
}
