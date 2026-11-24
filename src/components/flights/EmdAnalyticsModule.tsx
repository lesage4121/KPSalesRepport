/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Building2,
  CreditCard,
  FileDown,
  FileText,
  Luggage,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmdDocumentDetail, ManifestFlight } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import {
  EmdAnalyticsFilterState,
  EmdAnalyticsScopeMode,
  computeEmdAnalytics,
} from "../../utils/emdAnalytics";
import {
  classifyEmdBaggagePieces,
  convertEmdDetailToCurrency,
  formatCurrencyAmount,
  formatCurrencyTotals,
  formatEmdMonetaryValue,
  formatEmdRoute,
  formatFopMethodLabel,
  formatIssuingPointLabel,
  formatTotalsWithTarget,
  getEmdIssuanceInfo,
  loadDisplayCurrency,
  loadXofRates,
  parseWemdOutputFile,
} from "../../utils/emdAudit";
import {
  exportEmdAuditListToCSV,
  exportEmdAuditListToPDF,
} from "../../utils/emdPdfExport";
import { Donut3DChart } from "../ui/Donut3DChart";
import { FilterCombobox } from "../ui/FilterCombobox";
import { XofRatesPopover } from "./XofRatesPopover";

interface EmdAnalyticsModuleProps {
  flights: ManifestFlight[];
  emdDetailsMap: Record<string, EmdDocumentDetail>;
  onImportEmdDetails: (emds: EmdDocumentDetail[]) => void;
  onClearEmdDetails: () => void;
  scopeLabel: string;
  chartsOnly?: boolean;
}

type AnalyticsSubTab = "BY_FLIGHT_STATION" | "BY_AGENT" | "EMD_LIST";
type PieDimension = "CHANNELS" | "PRODUCTS";

const DEFAULT_FILTERS: EmdAnalyticsFilterState = {
  scopeMode: "ALL_IMPORTED",
  station: "ALL",
  pointCode: "ALL",
  agent: "ALL",
  stationNumber: "ALL",
  reason: "ALL",
  currency: "ALL",
  fop: "ALL",
  search: "",
};

const PIE_PALETTE = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#0EA5E9",
  "#EC4899",
  "#8B5CF6",
];

function formatCompactCurrencyAxis(val: number): string {
  if (!Number.isFinite(val)) return "0";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(val / 1_000)}k`;
  if (abs >= 10) return String(Math.round(val));
  return val.toFixed(0);
}

function parseTooltipNum(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "number" ? raw : Number(raw);
}

export const EmdAnalyticsModule: React.FC<EmdAnalyticsModuleProps> = ({
  flights,
  emdDetailsMap,
  onImportEmdDetails,
  onClearEmdDetails,
  scopeLabel,
  chartsOnly = false,
}) => {
  const { language, locale, pick } = useLanguage();
  const { isDark } = useTheme();
  const [filters, setFilters] = useState<EmdAnalyticsFilterState>(DEFAULT_FILTERS);
  const [subTab, setSubTab] = useState<AnalyticsSubTab>("BY_FLIGHT_STATION");
  const [pieDimension, setPieDimension] = useState<PieDimension>("CHANNELS");
  const [isStationRankOpen, setIsStationRankOpen] = useState(false);
  const [xofRates, setXofRates] = useState<Record<string, number>>(() =>
    loadXofRates()
  );
  const [displayCurrency, setDisplayCurrency] = useState<string>(() =>
    loadDisplayCurrency()
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncRates = () => setXofRates(loadXofRates());
    const syncCur = () => setDisplayCurrency(loadDisplayCurrency());
    window.addEventListener("kp-xof-rates-updated", syncRates);
    window.addEventListener("kp-display-currency-updated", syncCur);
    return () => {
      window.removeEventListener("kp-xof-rates-updated", syncRates);
      window.removeEventListener("kp-display-currency-updated", syncCur);
    };
  }, []);

  useEffect(() => {
    if (!isStationRankOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsStationRankOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isStationRankOpen]);

  const data = useMemo(
    () =>
      computeEmdAnalytics(
        flights,
        emdDetailsMap,
        filters,
        xofRates,
        displayCurrency
      ),
    [flights, emdDetailsMap, filters, xofRates, displayCurrency]
  );

  const hasActiveFilter =
    filters.scopeMode !== "ALL_IMPORTED" ||
    filters.station !== "ALL" ||
    filters.pointCode !== "ALL" ||
    filters.agent !== "ALL" ||
    filters.stationNumber !== "ALL" ||
    filters.reason !== "ALL" ||
    filters.currency !== "ALL" ||
    filters.fop !== "ALL" ||
    filters.search.trim() !== "";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    const parsed: EmdDocumentDetail[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const text = await files[i].text();
        const res = parseWemdOutputFile(text);
        parsed.push(...res.emds);
      }
      if (parsed.length === 0) {
        setUploadError(
          pick(
            "Aucun bloc WEMD* valide détecté dans ce fichier.",
            "No valid WEMD* blocks detected in this file."
          )
        );
      } else {
        onImportEmdDetails(parsed);
      }
    } catch {
      setUploadError(
        pick("Erreur de lecture du fichier WEMD*.", "Failed to read WEMD* file.")
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const axisTickColor = isDark ? "#94A3B8" : "#475569";
  const gridStroke = isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)";
  const tooltipStyle = {
    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    borderColor: isDark ? "#334155" : "#E2E8F0",
    borderRadius: "10px",
    color: isDark ? "#F8FAFC" : "#0F172A",
    fontSize: "12px",
  };

  const stationChartData = useMemo(
    () =>
      data.byStation.map((s) => ({
        station: s.station,
        totalTarget: s.totalTarget,
        emds: s.emdCount,
        pieces32kg: s.pieces32kg,
        pieces23kg: s.pieces23kg,
      })),
    [data.byStation]
  );

  const dailyChartData = useMemo(
    () =>
      data.dailyRevenue.map((d) => ({
        dateKey: d.dateKey,
        totalTarget: d.totalTarget,
        emdCount: d.emdCount,
        pieces: d.pieces32kg + d.pieces23kg + d.specialBagPieces,
      })),
    [data.dailyRevenue]
  );

  const channelPieSlices = useMemo(
    () =>
      data.pointBreakdown.map((pt, idx) => ({
        name:
          pt.pointCode === "N/D"
            ? "N/D"
            : `${pt.pointCode} (${formatIssuingPointLabel(pt.pointCode, language)})`,
        value: pt.totalTarget,
        color: PIE_PALETTE[idx % PIE_PALETTE.length],
      })),
    [data.pointBreakdown, language]
  );

  const productPieSlices = useMemo(
    () =>
      data.productBreakdown.map((p, idx) => ({
        name: language === "en" ? p.labelEn : p.labelFr,
        value: p.totalTarget,
        color: PIE_PALETTE[idx % PIE_PALETTE.length],
      })),
    [data.productBreakdown, language]
  );

  const totalTargetAllStations = useMemo(
    () => data.byStation.reduce((sum, s) => sum + s.totalTarget, 0),
    [data.byStation]
  );

  if (chartsOnly && data.allImportedCount === 0) {
    return null;
  }

  const chartsGrid = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Station Revenue (All Stations + Clickable Full Ranking Modal) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              type="button"
              onClick={() => setIsStationRankOpen(true)}
              className="text-left group inline-flex items-center gap-2 cursor-pointer"
              title={pick(
                "Voir le classement complet de toutes les stations",
                "View full all-station ranking"
              )}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                {pick(
                  `Recettes EMD (${displayCurrency}) par Station`,
                  `EMD Revenue (${displayCurrency}) by Station`
                )}
              </h4>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-mono text-[10px] font-bold">
                {data.byStation.length} {pick("stations", "stations")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsStationRankOpen(true)}
              className="text-[11px] font-semibold text-indigo-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{pick("Classement complet", "Full ranking")}</span>
            </button>
          </div>

          <div
            className="h-60 cursor-pointer"
            onClick={() => setIsStationRankOpen(true)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stationChartData}
                margin={{
                  top: 8,
                  right: 12,
                  left: 2,
                  bottom: stationChartData.length > 10 ? 18 : 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridStroke}
                  vertical={false}
                />
                <XAxis
                  dataKey="station"
                  interval={stationChartData.length <= 16 ? 0 : "preserveStartEnd"}
                  angle={stationChartData.length > 10 ? -35 : 0}
                  textAnchor={stationChartData.length > 10 ? "end" : "middle"}
                  tick={{
                    fill: axisTickColor,
                    fontSize: stationChartData.length > 12 ? 9.5 : 11,
                    fontFamily: "monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompactCurrencyAxis}
                  tick={{
                    fill: axisTickColor,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => {
                    const num = parseTooltipNum(value);
                    return [
                      formatCurrencyAmount(
                        Number.isFinite(num) ? num : null,
                        displayCurrency,
                        locale
                      ),
                      displayCurrency,
                    ];
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as
                      | (typeof stationChartData)[number]
                      | undefined;
                    if (!row) return String(label ?? "");
                    return `${label} · ${row.emds} EMD (32kg:${row.pieces32kg} / 23kg:${row.pieces23kg})`;
                  }}
                />
                <Bar
                  dataKey="totalTarget"
                  name={displayCurrency}
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={34}
                  onClick={() => setIsStationRankOpen(true)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Channels & Products Circular Pie */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {pick(
                `Canaux (AP/CT/IB/EM) & Produits (${displayCurrency})`,
                `Channels (AP/CT/IB/EM) & Products (${displayCurrency})`
              )}
            </h4>
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setPieDimension("CHANNELS")}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                  pieDimension === "CHANNELS"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {pick("Canaux", "Channels")}
              </button>
              <button
                type="button"
                onClick={() => setPieDimension("PRODUCTS")}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                  pieDimension === "PRODUCTS"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {pick("Produits", "Products")}
              </button>
            </div>
          </div>

          <Donut3DChart
            data={pieDimension === "CHANNELS" ? channelPieSlices : productPieSlices}
            variant="pie"
            heightClass="h-44"
            legendLayout="right"
            valueFormatter={(v) => formatCurrencyAmount(v, displayCurrency, locale)}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono tabular-nums">
            {data.productBreakdown.map((p) => (
              <div key={p.code} className="truncate">
                <div className="font-sans text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {language === "en" ? p.labelEn : p.labelFr}
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {p.piecesCount} pcs ·{" "}
                  {formatCurrencyAmount(p.totalTarget, displayCurrency, locale)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Daily EMD Revenue Evolution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {pick(
                `Évolution des Recettes EMD par Jour (${displayCurrency})`,
                `Daily EMD Revenue Evolution (${displayCurrency})`
              )}
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {dailyChartData.length} {pick("jour(s)", "day(s)")}
          </span>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={dailyChartData}
              margin={{ top: 8, right: 14, left: 2, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridStroke}
                vertical={false}
              />
              <XAxis
                dataKey="dateKey"
                tick={{
                  fill: axisTickColor,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="rev"
                tickFormatter={formatCompactCurrencyAxis}
                tick={{
                  fill: axisTickColor,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="cnt"
                orientation="right"
                allowDecimals={false}
                tick={{
                  fill: "#F59E0B",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  const num = parseTooltipNum(value);
                  if (name === "emdCount") {
                    return [`${Number.isFinite(num) ? num : 0} EMD`, "EMDs"];
                  }
                  return [
                    formatCurrencyAmount(
                      Number.isFinite(num) ? num : null,
                      displayCurrency,
                      locale
                    ),
                    displayCurrency,
                  ];
                }}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as
                    | (typeof dailyChartData)[number]
                    | undefined;
                  if (!row) return String(label ?? "");
                  return `${label} · ${row.emdCount} EMD · ${row.pieces} pcs`;
                }}
              />
              <Bar
                yAxisId="rev"
                dataKey="totalTarget"
                name={displayCurrency}
                fill="#4F46E5"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
              <Line
                yAxisId="cnt"
                type="monotone"
                dataKey="emdCount"
                name="emdCount"
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#F59E0B" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const stationRankingModal = isStationRankOpen && (
    <div
      onClick={() => setIsStationRankOpen(false)}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[82vh] flex flex-col overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {pick(
                `Classement EMD des Stations (${data.byStation.length})`,
                `All Stations EMD Ranking (${data.byStation.length})`
              )}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatCurrencyAmount(totalTargetAllStations, displayCurrency, locale)}
            </span>
            <button
              type="button"
              onClick={() => setIsStationRankOpen(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3 text-right">EMDs</th>
                <th className="py-2.5 px-3 text-right">32kg</th>
                <th className="py-2.5 px-3 text-right">23kg</th>
                <th className="py-2.5 px-3 text-right">Upg</th>
                <th className="py-2.5 px-3">{pick("Canaux", "Channels")}</th>
                <th className="py-2.5 px-3 text-right">{pick("Agents", "Agents")}</th>
                <th className="py-2.5 px-3 text-right">{pick("Monnaie Locale", "Local")}</th>
                <th className="py-2.5 px-3 text-right">Total {displayCurrency}</th>
                <th className="py-2.5 px-3 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
              {data.byStation.map((s, idx) => {
                const share =
                  totalTargetAllStations > 0
                    ? ((s.totalTarget / totalTargetAllStations) * 100).toFixed(1)
                    : "0.0";
                return (
                  <tr
                    key={s.station}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2 px-3 font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {s.station}
                    </td>
                    <td className="py-2 px-3 text-right font-bold">{s.emdCount}</td>
                    <td className="py-2 px-3 text-right">{s.pieces32kg}</td>
                    <td className="py-2 px-3 text-right">{s.pieces23kg}</td>
                    <td className="py-2 px-3 text-right">{s.upgradesCount}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                      {s.pointCodes.join(", ") || "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                      {s.agents.length}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatCurrencyTotals(s.totalsByCurrency, locale)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrencyAmount(s.totalTarget, displayCurrency, locale)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">
                      {share}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (chartsOnly) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {pick(
                `Recettes & Analyses EMD (${displayCurrency})`,
                `EMD Revenue & Analytics (${displayCurrency})`
              )}
            </h3>
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
              {data.kpis.totalEmds} EMD ·{" "}
              {formatCurrencyAmount(data.kpis.totalTarget, displayCurrency, locale)}
            </span>
          </div>
          <XofRatesPopover
            currenciesInUse={data.filterOptions.currencies}
            theme="slate"
          />
        </div>
        {chartsGrid}
        {stationRankingModal}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Control & Filters Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {pick(
                  `Analyse Émissions & Recettes EMD (${displayCurrency})`,
                  `EMD Issuance & Revenue (${displayCurrency})`
                )}
              </h3>
            </div>

            <div className="inline-flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl text-[11px] font-semibold">
              {(
                [
                  {
                    id: "ALL_IMPORTED" as EmdAnalyticsScopeMode,
                    label: pick(
                      `Tous (${data.allImportedCount})`,
                      `All (${data.allImportedCount})`
                    ),
                  },
                  {
                    id: "LINKED_FLIGHTS" as EmdAnalyticsScopeMode,
                    label: pick(
                      `Vols manifestés (${data.linkedToFlightsCount})`,
                      `Manifested (${data.linkedToFlightsCount})`
                    ),
                  },
                  {
                    id: "STATION_ORIGIN_ONLY" as EmdAnalyticsScopeMode,
                    label: pick(
                      `Station départ (${data.stationOriginMatchedCount})`,
                      `Dep. station (${data.stationOriginMatchedCount})`
                    ),
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, scopeMode: m.id }))
                  }
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filters.scopeMode === m.id
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.allImportedCount > 0 && (
              <XofRatesPopover
                currenciesInUse={data.filterOptions.currencies}
                theme="slate"
              />
            )}

            {data.filteredDetails.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    exportEmdAuditListToPDF({
                      details: data.filteredDetails,
                      scopeLabel: `${scopeLabel} · ${
                        filters.station !== "ALL" ? filters.station : "Global"
                      }`,
                      xofRates,
                      targetCurrency: displayCurrency,
                      language,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportEmdAuditListToCSV({
                      details: data.filteredDetails,
                      xofRates,
                      targetCurrency: displayCurrency,
                      language,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>CSV</span>
                </button>
              </>
            )}

            <label className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{pick("Importer WEMD*", "Import WEMD*")}</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.log,.dat,.out"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {data.allImportedCount > 0 && (
              <button
                type="button"
                onClick={onClearEmdDetails}
                className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                title={pick("Effacer", "Clear")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="text-xs font-medium text-rose-700 dark:text-rose-300">
            {uploadError}
          </div>
        )}

        {/* Filter Row with Typeable Comboboxes */}
        {data.allImportedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <FilterCombobox
              value={filters.station}
              onChange={(v) => setFilters((p) => ({ ...p, station: v }))}
              options={data.filterOptions.stations.map((s) => ({
                value: s,
                label: s,
              }))}
              placeholder={`Station (${data.filterOptions.stations.length})`}
              allLabel={pick("Toutes stations", "All stations")}
              theme="slate"
              widthClass="w-32"
            />

            <FilterCombobox
              value={filters.pointCode}
              onChange={(v) => setFilters((p) => ({ ...p, pointCode: v }))}
              options={data.filterOptions.pointCodes.map((pt) => ({
                value: pt,
                label: `${pt} (${formatIssuingPointLabel(pt, language)})`,
              }))}
              placeholder={`Point (${data.filterOptions.pointCodes.length})`}
              allLabel={pick("Tous points", "All points")}
              theme="slate"
              widthClass="w-36"
            />

            <FilterCombobox
              value={filters.agent}
              onChange={(v) => setFilters((p) => ({ ...p, agent: v }))}
              options={data.filterOptions.agents.map((a) => ({
                value: a,
                label: a,
              }))}
              placeholder={`Agent (${data.filterOptions.agents.length})`}
              allLabel={pick("Tous agents", "All agents")}
              theme="slate"
              widthClass="w-36"
            />

            <FilterCombobox
              value={filters.stationNumber}
              onChange={(v) => setFilters((p) => ({ ...p, stationNumber: v }))}
              options={data.filterOptions.stationNumbers.map((sn) => ({
                value: sn,
                label: `STA-${sn}`,
                searchText: sn,
              }))}
              placeholder={`N° STA (${data.filterOptions.stationNumbers.length})`}
              allLabel={pick("Tous N° STA", "All STA")}
              theme="slate"
              widthClass="w-36"
            />

            <FilterCombobox
              value={filters.reason}
              onChange={(v) => setFilters((p) => ({ ...p, reason: v }))}
              options={data.filterOptions.reasons.map((r) => ({
                value: r,
                label: r,
              }))}
              placeholder={pick("Raison", "Reason")}
              allLabel={pick("Toutes raisons", "All reasons")}
              theme="slate"
              widthClass="w-44"
            />

            <FilterCombobox
              value={filters.currency}
              onChange={(v) => setFilters((p) => ({ ...p, currency: v }))}
              options={data.filterOptions.currencies.map((c) => ({
                value: c,
                label: c,
              }))}
              placeholder={pick("Devise", "Currency")}
              allLabel={pick("Toutes devises", "All currencies")}
              theme="slate"
              widthClass="w-28"
            />

            <FilterCombobox
              value={filters.fop}
              onChange={(v) => setFilters((p) => ({ ...p, fop: v }))}
              options={data.filterOptions.fops.map((f) => ({
                value: f,
                label: f,
              }))}
              placeholder={`FOP (${data.filterOptions.fops.length})`}
              allLabel={pick("Tous FOP", "All FOP")}
              theme="slate"
              widthClass="w-28"
            />

            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, search: e.target.value }))
                }
                placeholder={pick("EMD, nom, route...", "EMD, name, route...")}
                className="w-full min-h-[34px] pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{pick("Réinitialiser", "Reset")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {data.allImportedCount === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <CreditCard className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {pick("Aucune donnée WEMD* importée", "No WEMD* data imported")}
          </div>
          <label className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{pick("Importer WEMD* (.txt)", "Import WEMD* (.txt)")}</span>
            <input
              type="file"
              multiple
              accept=".txt,.log,.dat,.out"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <>
          {/* 4-Card KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("EMDs Émis", "Issued EMDs")}</span>
                <CreditCard className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {data.kpis.totalEmds}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {data.kpis.excessBaggageEmds} C/BAGGAGE ·{" "}
                {data.kpis.inFlightServiceEmds} {pick("Services/Upg", "In-flight")}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Bagages Facturés", "Billed Baggage")}</span>
                <Luggage className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {data.kpis.totalExcessPieces}{" "}
                <span className="text-xs font-semibold">pcs</span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                32kg:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {data.kpis.pieces32kg}
                </strong>
                {" · "}23kg:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {data.kpis.pieces23kg}
                </strong>
                {data.kpis.specialBagPieces > 0
                  ? ` · Spéc: ${data.kpis.specialBagPieces}`
                  : ""}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>
                  {pick(
                    `Recette Totale (${displayCurrency})`,
                    `Total Revenue (${displayCurrency})`
                  )}
                </span>
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 leading-tight">
                {formatCurrencyAmount(data.kpis.totalTarget, displayCurrency, locale)}
              </div>
              <div
                className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate"
                title={formatCurrencyTotals(data.kpis.totalsByCurrency, locale)}
              >
                {formatCurrencyTotals(data.kpis.totalsByCurrency, locale)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Paiements (FOP)", "Payments (FOP)")}</span>
                <Building2 className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {data.kpis.cardSharePct}%{" "}
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  {pick("Cartes", "Cards")}
                </span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {data.kpis.cardPaymentsCount} {pick("Cartes", "Card")} ·{" "}
                {data.kpis.cashPaymentsCount} Cash
              </div>
            </div>
          </div>

          {chartsGrid}

          {/* 3 Detailed Scannable Tables */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSubTab("BY_FLIGHT_STATION")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    subTab === "BY_FLIGHT_STATION"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {pick(
                    `Par Vol · Station (${data.byFlightStationRevenue.length})`,
                    `By Flight · Station (${data.byFlightStationRevenue.length})`
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("BY_AGENT")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    subTab === "BY_AGENT"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {pick(
                    `Stations · Agents · STA (${data.byAgentStation.length})`,
                    `Stations · Agents · STA (${data.byAgentStation.length})`
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("EMD_LIST")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    subTab === "EMD_LIST"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {pick(
                    `Détail EMDs (${data.filteredDetails.length})`,
                    `EMD Details (${data.filteredDetails.length})`
                  )}
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {`${data.filteredDetails.length} EMD · ${formatTotalsWithTarget(
                  data.filteredDetails,
                  displayCurrency,
                  xofRates,
                  locale
                )}`}
              </div>
            </div>

            {subTab === "BY_FLIGHT_STATION" ? (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">{pick("Vol", "Flight")}</th>
                      <th className="py-2.5 px-3">{pick("Station Départ", "Dep. Station")}</th>
                      <th className="py-2.5 px-3 text-right">{pick("Émis Station", "Station")}</th>
                      <th className="py-2.5 px-3 text-right">{pick("Hors Station", "Foreign")}</th>
                      <th className="py-2.5 px-3 text-right">32kg</th>
                      <th className="py-2.5 px-3 text-right">23kg</th>
                      <th className="py-2.5 px-3 text-right">{pick("Monnaie Locale", "Local")}</th>
                      <th className="py-2.5 px-3 text-right">
                        {pick(`Équiv. ${displayCurrency}`, `Equiv. ${displayCurrency}`)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                    {data.byFlightStationRevenue.map((row) => (
                      <tr key={row.flightId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{row.date}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {row.flightLabel} → {row.primaryDestination}
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-700 dark:text-indigo-400">
                          {row.origin}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                          {row.stationIssuedCount} / {row.totalFlightEmds}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-700 dark:text-amber-400">
                          {row.transitExcludedCount}
                        </td>
                        <td className="py-2 px-3 text-right">{row.pieces32kg}</td>
                        <td className="py-2 px-3 text-right">{row.pieces23kg}</td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                          {formatCurrencyTotals(row.stationTotalsByCurrency, locale)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrencyAmount(
                            row.stationTotalTarget,
                            displayCurrency,
                            locale
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : subTab === "BY_AGENT" ? (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Station</th>
                      <th className="py-2.5 px-3">{pick("Point", "Point")}</th>
                      <th className="py-2.5 px-3">Agent</th>
                      <th className="py-2.5 px-3">N° STA</th>
                      <th className="py-2.5 px-3 text-right">EMDs</th>
                      <th className="py-2.5 px-3 text-right">32kg</th>
                      <th className="py-2.5 px-3 text-right">23kg</th>
                      <th className="py-2.5 px-3 text-right">Upg</th>
                      <th className="py-2.5 px-3">FOP</th>
                      <th className="py-2.5 px-3 text-right">{pick("Monnaie Locale", "Local")}</th>
                      <th className="py-2.5 px-3 text-right">Total {displayCurrency}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                    {data.byAgentStation.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{row.station}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {row.pointCode}
                          {formatIssuingPointLabel(row.pointCode, language)
                            ? ` (${formatIssuingPointLabel(row.pointCode, language)})`
                            : ""}
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-700 dark:text-indigo-400">{row.agent}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{row.stationNumber}</td>
                        <td className="py-2 px-3 text-right font-bold">{row.emdCount}</td>
                        <td className="py-2 px-3 text-right">{row.pieces32kg}</td>
                        <td className="py-2 px-3 text-right">{row.pieces23kg}</td>
                        <td className="py-2 px-3 text-right">{row.upgradesCount}</td>
                        <td className="py-2 px-3">{row.primaryFop}</td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                          {formatCurrencyTotals(row.totalsByCurrency, locale)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrencyAmount(row.totalTarget, displayCurrency, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">EMD</th>
                      <th className="py-2.5 px-3">Station / Agent / STA</th>
                      <th className="py-2.5 px-3">{pick("Passager / PNR", "Passenger / PNR")}</th>
                      <th className="py-2.5 px-3">{pick("Parcours", "Routes")}</th>
                      <th className="py-2.5 px-3">{pick("Raison / Pièces", "Reason / Pieces")}</th>
                      <th className="py-2.5 px-3 text-right">{pick("Montant Local", "Local")}</th>
                      <th className="py-2.5 px-3 text-right">
                        {pick(`Équiv. ${displayCurrency}`, `Equiv. ${displayCurrency}`)}
                      </th>
                      <th className="py-2.5 px-3">FOP</th>
                      <th className="py-2.5 px-3">Restrictions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                    {data.filteredDetails.map((d) => {
                      const iss = getEmdIssuanceInfo(d);
                      const cls = classifyEmdBaggagePieces(d);
                      const targetVal = convertEmdDetailToCurrency(
                        d,
                        displayCurrency,
                        xofRates,
                        "totalValue"
                      );
                      const pieceTag = [
                        cls.pieces32kg > 0 ? `${cls.pieces32kg}×32kg` : "",
                        cls.pieces23kg > 0 ? `${cls.pieces23kg}×23kg` : "",
                        cls.specialBagPieces > 0 ? `${cls.specialBagPieces}×Spéc` : "",
                        cls.inFlightUpgradeCount > 0 ? `${cls.inFlightUpgradeCount}×Upg` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <tr key={d.emdNumber} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {d.emdNumber}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {iss.issuingStation || "—"}
                              {iss.issuingPointCode ? `(${iss.issuingPointCode})` : ""}
                            </span>
                            {iss.issuingAgent ? ` · ${iss.issuingAgent}` : ""}
                            {iss.issuingStationNumber ? (
                              <div className="text-[10px] text-slate-500">STA-{iss.issuingStationNumber}</div>
                            ) : null}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-sans font-semibold text-slate-900 dark:text-slate-100">
                              {d.passengerName || "—"}
                            </div>
                            {d.pnr && <div className="text-[10px] text-slate-500">{d.pnr}</div>}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            {d.coupons.map((c) => formatEmdRoute(c.route)).join(" · ") || "—"}
                          </td>
                          <td className="py-2 px-3">
                            <div>{d.reasonForIssuance || "—"}</div>
                            {pieceTag && <div className="text-[10px] text-indigo-600 dark:text-indigo-400">{pieceTag}</div>}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatEmdMonetaryValue(d.totalValue, locale)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrencyAmount(targetVal, displayCurrency, locale)}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            {d.fopEntries.map((f) => formatFopMethodLabel(f.methodCode, language)).join(" / ") ||
                              d.fopSummary ||
                              "—"}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={d.endorsementsRestrictions || ""}>
                            {d.endorsementsRestrictions || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {stationRankingModal}
    </div>
  );
};
