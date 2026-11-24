/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  RotateCcw,
  FileText,
  FileDown,
  Layers,
  Plane,
  UserX,
  Search,
  FileSpreadsheet,
  Clock,
  Users,
  Gauge,
  Briefcase,
  Compass,
  LayoutGrid,
  Armchair,
  Globe,
  CreditCard,
} from "lucide-react";
import { DateRangePicker, dcsDateToIso } from "../ui/DateRangePicker";
import { Donut3DChart } from "../ui/Donut3DChart";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";
import { FlightBiMatrices } from "./FlightBiMatrices";
import { FlightRouteMapModule } from "./FlightRouteMapModule";
import { FlightSeatOccupancyModule } from "./FlightSeatOccupancyModule";
import { EmdAnalyticsModule } from "./EmdAnalyticsModule";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  EmdDocumentDetail,
  FlightScheduleParseResult,
  FlightSegment,
  FlightStatusDetail,
  ManifestFlight,
  ManifestParseResult,
} from "../../types";
import { StoredManifestDayRecord } from "../../utils/manifestDb";
import {
  aggregateManifestFlights,
  getDcsFlightDateSortOrder,
  normalizeDcsFlightDate,
} from "../../utils/manifestParser";
import {
  normalizeStatusFlightNumber,
  resolveFlightStatusDetail,
} from "../../utils/flightStatusParser";
import {
  clearStoredEmdDetails,
  loadStoredEmdDetails,
  saveStoredEmdDetails,
  upsertEmdDetails,
} from "../../utils/emdAudit";
import {
  ForecastMethod,
  computeFullAviationAnalytics,
  computeTrafficForecast,
  formatMinutesAsDuration,
} from "../../utils/flightAnalytics";
import {
  exportFlightAnalyticsReportToCSV,
  exportFlightAnalyticsReportToPDF,
  exportNoShowReportToCSV,
  exportNoShowReportToExcel,
  exportNoShowReportToPDF,
} from "../../utils/flightStatsExport";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

export type BiLens =
  | "ALL"
  | "TRAFFIC"
  | "MAP"
  | "FLEET"
  | "CABIN_SEATS"
  | "WEB_CHECKIN"
  | "BAGGAGE"
  | "EMD"
  | "NOSHOW";

interface FlightAnalyticsDashboardViewProps {
  savedRecords: StoredManifestDayRecord[];
  activeManifest: ManifestParseResult | null;
  flightStatusDetails?: FlightStatusDetail[];
  scheduleData?: FlightScheduleParseResult | null;
  storedScheduleSegments?: FlightSegment[];
  focusedFlightNumber?: string;
  onGoToManifestUpload: () => void;
  onGoToSchedule?: () => void;
  activeLens?: BiLens;
  onChangeLens?: (lens: BiLens) => void;
}

type DataSourceScope = "ALL_DATA" | "LOCAL_DB" | "ACTIVE_ONLY";
type AircraftTimeChartMode = "CUMUL" | "DAILY" | "GANTT";

const CHART_COLORS = {
  eco: "#4F46E5", // Indigo 600
  biz: "#8B5CF6", // Violet 500
  capacity: "#0EA5E9", // Sky 500
  emptySeats: "#CBD5E1", // Slate 300
  loadFactor: "#10B981", // Emerald 500
  forecast: "#F59E0B", // Amber 500
  forecastBand: "#FDE68A", // Amber 200
  noShow: "#F43F5E", // Rose 500
  teal: "#14B8A6", // Teal 500
  blue: "#3B82F6", // Blue 500
  flightTime: "#0284C7", // Sky 600
  groundTime: "#F59E0B", // Amber 500
};

interface Bar3DProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  gradId: string;
  sideColor: string;
  topColor: string;
  showShadow?: boolean;
  opacity?: number;
}

const IsometricBar3DShape: React.FC<Bar3DProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  gradId,
  sideColor,
  topColor,
  showShadow = false,
  opacity = 1,
}) => {
  if (!width || !height || height <= 0 || Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }
  const dx = Math.min(8, Math.max(4, Math.round(width * 0.22)));
  const dy = Math.min(6, Math.max(3, Math.round(dx * 0.72)));

  const frontPath = `M ${x},${y} L ${x + width},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
  const rightPath = `M ${x + width},${y} L ${x + width + dx},${y - dy} L ${x + width + dx},${y + height - dy} L ${x + width},${y + height} Z`;
  const topPath = `M ${x},${y} L ${x + dx},${y - dy} L ${x + width + dx},${y - dy} L ${x + width},${y} Z`;

  return (
    <g opacity={opacity}>
      {showShadow && (
        <ellipse
          cx={x + width / 2 + dx * 0.5}
          cy={y + height + 2}
          rx={width * 0.56}
          ry={3.2}
          fill="rgba(15, 23, 42, 0.16)"
        />
      )}
      <path d={rightPath} fill={sideColor} />
      <path d={topPath} fill={topColor} />
      <path d={frontPath} fill={`url(#${gradId})`} />
      {/* Subtle glossy specular bevel lines */}
      <line
        x1={x}
        y1={y}
        x2={x + width}
        y2={y}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />
      <line
        x1={x + 0.5}
        y1={y}
        x2={x + 0.5}
        y2={y + height}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
    </g>
  );
};

const HorizontalBar3DShape: React.FC<Bar3DProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  gradId,
  sideColor,
  topColor,
}) => {
  if (!width || !height || width <= 0 || Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }
  const dx = 6;
  const dy = Math.min(5, Math.max(3, Math.round(height * 0.24)));

  const frontPath = `M ${x},${y} L ${x + width},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
  const topPath = `M ${x},${y} L ${x + dx},${y - dy} L ${x + width + dx},${y - dy} L ${x + width},${y} Z`;
  const rightPath = `M ${x + width},${y} L ${x + width + dx},${y - dy} L ${x + width + dx},${y + height - dy} L ${x + width},${y + height} Z`;

  return (
    <g>
      <path d={topPath} fill={topColor} />
      <path d={rightPath} fill={sideColor} />
      <path d={frontPath} fill={`url(#${gradId})`} />
      <line
        x1={x}
        y1={y}
        x2={x + width}
        y2={y}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1}
      />
    </g>
  );
};

export const FlightAnalyticsDashboardView: React.FC<
  FlightAnalyticsDashboardViewProps
> = ({
  savedRecords,
  activeManifest,
  flightStatusDetails = [],
  scheduleData = null,
  storedScheduleSegments = [],
  focusedFlightNumber = "",
  onGoToManifestUpload,
  onGoToSchedule,
  activeLens: controlledActiveLens,
  onChangeLens,
}) => {
  const { language, locale, pick } = useLanguage();
  const { isDark } = useTheme();

  const [sourceScope, setSourceScope] = useState<DataSourceScope>("ALL_DATA");
  const [periodStart, setPeriodStart] = useState<string>(""); // ISO "YYYY-MM-DD"
  const [periodEnd, setPeriodEnd] = useState<string>(""); // ISO "YYYY-MM-DD"
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [flightFilter, setFlightFilter] = useState<string>(
    focusedFlightNumber ? normalizeStatusFlightNumber(focusedFlightNumber) : "ALL"
  );
  const [originFilter, setOriginFilter] = useState<string>("ALL");
  const [aircraftFilter, setAircraftFilter] = useState<string>("ALL");

  // Forecasting Controls
  const [forecastHorizon, setForecastHorizon] = useState<7 | 14 | 30>(14);
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>("LINEAR");

  // No-Show, Baggage & Web Check-in Audit Controls
  const [noShowViewMode, setNoShowViewMode] = useState<"FLIGHTS" | "PASSENGERS">("FLIGHTS");
  const [noShowSearch, setNoShowSearch] = useState<string>("");
  const [baggageSearch, setBaggageSearch] = useState<string>("");
  const [baggageOnlyIssues, setBaggageOnlyIssues] = useState<boolean>(false);
  const [webCheckinTableMode, setWebCheckinTableMode] = useState<
    "BY_ORIGIN" | "BY_FLIGHT" | "BY_SEGMENT"
  >("BY_ORIGIN");
  const [webCheckinSearch, setWebCheckinSearch] = useState<string>("");

  // Aircraft Utilization Time Chart Controls
  const [aircraftTimeMode, setAircraftTimeMode] =
    useState<AircraftTimeChartMode>("CUMUL");

  // BI Dashboard Lens & Tail Sort (Global View with charts only by default)
  const [internalBiLens, setInternalBiLens] = useState<BiLens>("ALL");
  const biLens = controlledActiveLens ?? internalBiLens;
  const setBiLens = (nextLens: BiLens) => {
    setInternalBiLens(nextLens);
    onChangeLens?.(nextLens);
  };
  const [tailSortMode, setTailSortMode] = useState<"PAX" | "LF">("PAX");

  useEffect(() => {
    if (focusedFlightNumber) {
      setFlightFilter(normalizeStatusFlightNumber(focusedFlightNumber));
    }
  }, [focusedFlightNumber]);

  const [emdDetailsMap, setEmdDetailsMap] = useState<
    Record<string, EmdDocumentDetail>
  >(() => loadStoredEmdDetails());

  useEffect(() => {
    const syncEmd = () => setEmdDetailsMap(loadStoredEmdDetails());
    window.addEventListener("kp-emd-details-updated", syncEmd);
    window.addEventListener("storage", syncEmd);
    return () => {
      window.removeEventListener("kp-emd-details-updated", syncEmd);
      window.removeEventListener("storage", syncEmd);
    };
  }, []);

  const handleImportEmdDetails = (incoming: EmdDocumentDetail[]) => {
    setEmdDetailsMap((prev) => {
      const next = upsertEmdDetails(prev, incoming);
      saveStoredEmdDetails(next);
      return next;
    });
  };

  const handleClearEmdDetails = () => {
    clearStoredEmdDetails();
    setEmdDetailsMap({});
  };

  // Combined deduplicated flight corpus for selected DataSourceScope
  const baseFlights = useMemo<ManifestFlight[]>(() => {
    const bucket: ManifestFlight[] = [];
    if (sourceScope === "ALL_DATA" || sourceScope === "LOCAL_DB") {
      for (const rec of savedRecords) {
        bucket.push(...rec.data.flights);
      }
    }
    if (
      (sourceScope === "ALL_DATA" || sourceScope === "ACTIVE_ONLY") &&
      activeManifest
    ) {
      if (sourceScope === "ALL_DATA") {
        const merged = aggregateManifestFlights([
          ...activeManifest.flights,
          ...bucket,
        ]);
        return merged.flights;
      }
      bucket.push(...activeManifest.flights);
    }
    if (bucket.length === 0) return [];
    return aggregateManifestFlights(bucket).flights;
  }, [savedRecords, activeManifest, sourceScope]);

  // Filter options derived from baseFlights + Tab 1 flightStatusDetails
  const filterMeta = useMemo(() => {
    const dateMap = new Map<string, number>();
    const fnSet = new Set<string>();
    const originSet = new Set<string>();
    const regOrEqSet = new Map<string, string>(); // value -> label

    for (const f of baseFlights) {
      const dk = normalizeDcsFlightDate(f.date);
      dateMap.set(dk, getDcsFlightDateSortOrder(dk, f.extractedYear));
      fnSet.add(normalizeStatusFlightNumber(f.flightNumber));
      if (f.origin) originSet.add(f.origin);

      const resolved = resolveFlightStatusDetail(
        f.flightNumber,
        dk,
        f.origin,
        flightStatusDetails
      );
      if (resolved.detail?.registration) {
        const reg = resolved.detail.registration;
        const eq = resolved.detail.aircraftType || f.aircraftType;
        regOrEqSet.set(`REG:${reg}`, `${reg} (${eq})`);
      }
    }

    const datesAsc = Array.from(dateMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([d, sortOrder]) => ({ date: d, sortOrder }));
    const datesDesc = [...datesAsc].reverse().map((x) => x.date);
    const flightNumbers = Array.from(fnSet).sort(
      (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)
    );
    const origins = Array.from(originSet).sort();
    const aircraftOptions = Array.from(regOrEqSet.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { datesAsc, datesDesc, flightNumbers, origins, aircraftOptions };
  }, [baseFlights, flightStatusDetails]);

  const availableIsoDates = useMemo(() => {
    const out = new Set<string>();
    for (const f of baseFlights) {
      const iso = dcsDateToIso(f.date, f.extractedYear);
      if (iso) out.add(iso);
    }
    return Array.from(out).sort();
  }, [baseFlights]);

  // Determine effective period bounds from ISO date range picker
  const effectiveDateRange = useMemo(() => {
    const parseIsoOrder = (iso: string): number | null => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      const n = parseInt(iso.replace(/-/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };
    const s = periodStart ? parseIsoOrder(periodStart) : null;
    const e = periodEnd ? parseIsoOrder(periodEnd) : null;
    if (s === null && e === null) {
      return { active: false, minOrder: -Infinity, maxOrder: Infinity };
    }
    if (s !== null && e !== null) {
      return { active: true, minOrder: Math.min(s, e), maxOrder: Math.max(s, e) };
    }
    return {
      active: true,
      minOrder: s ?? -Infinity,
      maxOrder: e ?? Infinity,
    };
  }, [periodStart, periodEnd]);

  const scopedFlights = useMemo(() => {
    return baseFlights.filter((f) => {
      const dk = normalizeDcsFlightDate(f.date);
      const sortOrder = getDcsFlightDateSortOrder(dk, f.extractedYear);

      if (dateFilter !== "ALL") {
        if (dk !== dateFilter) return false;
      } else if (effectiveDateRange.active) {
        if (
          sortOrder < effectiveDateRange.minOrder ||
          sortOrder > effectiveDateRange.maxOrder
        ) {
          return false;
        }
      }

      if (
        flightFilter !== "ALL" &&
        normalizeStatusFlightNumber(f.flightNumber) !== flightFilter
      ) {
        return false;
      }

      if (originFilter !== "ALL" && f.origin !== originFilter) {
        return false;
      }

      if (aircraftFilter !== "ALL") {
        const resolved = resolveFlightStatusDetail(
          f.flightNumber,
          dk,
          f.origin,
          flightStatusDetails
        );
        if (aircraftFilter.startsWith("REG:")) {
          const targetReg = aircraftFilter.slice(4);
          if (resolved.detail?.registration !== targetReg) return false;
        }
      }

      return true;
    });
  }, [
    baseFlights,
    dateFilter,
    effectiveDateRange,
    flightFilter,
    originFilter,
    aircraftFilter,
    flightStatusDetails,
  ]);

  const effectiveScheduleSegments = useMemo(() => {
    const activeSegs = scheduleData?.segments || [];
    if (storedScheduleSegments.length === 0) return activeSegs;
    const seen = new Set<string>();
    const combined: FlightSegment[] = [];
    const pushSeg = (s: FlightSegment) => {
      const k = `${normalizeDcsFlightDate(s.date)}|${normalizeStatusFlightNumber(
        s.flightNumber
      )}|${(s.origin || "").trim().toUpperCase()}|${(
        s.destination || ""
      )
        .trim()
        .toUpperCase()}|${s.carrierType}`;
      if (seen.has(k)) return;
      seen.add(k);
      combined.push(s);
    };
    for (const s of activeSegs) pushSeg(s);
    for (const s of storedScheduleSegments) pushSeg(s);
    return combined;
  }, [scheduleData, storedScheduleSegments]);

  const analytics = useMemo(
    () =>
      computeFullAviationAnalytics(
        scopedFlights,
        flightStatusDetails,
        effectiveScheduleSegments,
        baseFlights
      ),
    [scopedFlights, flightStatusDetails, effectiveScheduleSegments, baseFlights]
  );

  const forecast = useMemo(
    () =>
      computeTrafficForecast(
        analytics.dailySeries,
        forecastHorizon,
        forecastMethod
      ),
    [analytics.dailySeries, forecastHorizon, forecastMethod]
  );

  const hasActiveFilters =
    Boolean(periodStart || periodEnd) ||
    dateFilter !== "ALL" ||
    flightFilter !== "ALL" ||
    originFilter !== "ALL" ||
    aircraftFilter !== "ALL";

  const resetFilters = () => {
    setPeriodStart("");
    setPeriodEnd("");
    setDateFilter("ALL");
    setFlightFilter("ALL");
    setOriginFilter("ALL");
    setAircraftFilter("ALL");
  };

  // Chart Styling (Neutral modern palette, dark/light safe)
  const axisTickColor = isDark ? "#94A3B8" : "#475569";
  const gridStroke = isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)";
  const tooltipStyle = {
    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    borderColor: isDark ? "#334155" : "#E2E8F0",
    borderRadius: "12px",
    color: isDark ? "#F8FAFC" : "#0F172A",
    fontSize: "12px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
  };

  const { kpis } = analytics;

  const cabinPieData = useMemo(
    () =>
      [
        {
          name: pick("Économie (Y)", "Economy (Y)"),
          value: kpis.traveledEco,
          color: CHART_COLORS.eco,
        },
        {
          name: pick("Business (C)", "Business (C)"),
          value: kpis.traveledBiz,
          color: CHART_COLORS.biz,
        },
      ].filter((d) => d.value > 0),
    [kpis.traveledEco, kpis.traveledBiz, pick]
  );

  const seatStatusPieData = useMemo(
    () =>
      [
        {
          name: pick("Transportés (Avec siège)", "Traveled (Seated)"),
          value: kpis.traveledTotal,
          color: CHART_COLORS.loadFactor,
        },
        {
          name: pick("No-Show (Sans siège)", "No-Show (Unseated)"),
          value: kpis.noShowTotal,
          color: CHART_COLORS.noShow,
        },
      ].filter((d) => d.value > 0),
    [kpis.traveledTotal, kpis.noShowTotal, pick]
  );

  const demographicsBarData = useMemo(
    () => [
      { name: pick("Hommes (M)", "Men (M)"), count: kpis.maleCount, fill: "#3B82F6" },
      { name: pick("Femmes (F)", "Women (F)"), count: kpis.femaleCount, fill: "#8B5CF6" },
      { name: pick("Enfants (CHD)", "Children (CHD)"), count: kpis.childCount, fill: "#10B981" },
      { name: pick("Bébés (INF)", "Infants (INF)"), count: kpis.infantCount, fill: "#F59E0B" },
    ],
    [kpis.maleCount, kpis.femaleCount, kpis.childCount, kpis.infantCount, pick]
  );

  const baggageCompliancePieData = useMemo(() => {
    const compliant = Math.max(
      0,
      kpis.traveledTotal - kpis.uncoveredDeviations - kpis.coveredDeviations
    );
    return [
      {
        name: pick("Conformes", "Compliant"),
        value: compliant,
        color: CHART_COLORS.loadFactor,
      },
      {
        name: pick("Couverts EMD", "EMD Covered"),
        value: kpis.coveredDeviations,
        color: CHART_COLORS.capacity,
      },
      {
        name: pick("Écarts sans EMD", "Uncovered"),
        value: kpis.uncoveredDeviations,
        color: CHART_COLORS.noShow,
      },
      {
        name: pick("Poids manquant", "Missing weight"),
        value: kpis.missingBagWeightCount,
        color: CHART_COLORS.forecast,
      },
    ].filter((d) => d.value > 0);
  }, [
    kpis.traveledTotal,
    kpis.uncoveredDeviations,
    kpis.coveredDeviations,
    kpis.missingBagWeightCount,
    pick,
  ]);

  const equipmentPieData = useMemo(() => {
    const palette = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    return analytics.equipmentSummary.map((eq, idx) => ({
      name: eq.equipmentType,
      value: eq.traveledTotal,
      color: palette[idx % palette.length],
    }));
  }, [analytics.equipmentSummary]);

  const sortedTailUtilization = useMemo(() => {
    const rows = [...analytics.tailUtilization];
    if (tailSortMode === "LF") {
      rows.sort((a, b) => b.loadFactorPct - a.loadFactorPct || b.traveledTotal - a.traveledTotal);
    } else {
      rows.sort((a, b) => b.traveledTotal - a.traveledTotal);
    }
    return rows;
  }, [analytics.tailUtilization, tailSortMode]);

  const fleetHoursSummary = useMemo(() => {
    const totalFlightMin = analytics.aircraftTimeUtilization.reduce(
      (s, a) => s + a.totalFlightMinutes,
      0
    );
    const totalGroundMin = analytics.aircraftTimeUtilization.reduce(
      (s, a) => s + a.totalTurnaroundMinutes,
      0
    );
    const totalLegs = analytics.aircraftTimeUtilization.reduce(
      (s, a) => s + a.legsCount,
      0
    );
    return { totalFlightMin, totalGroundMin, totalLegs };
  }, [analytics.aircraftTimeUtilization]);

  const filteredBaggageSegments = useMemo(() => {
    const q = baggageSearch.trim().toLowerCase();
    return analytics.segmentMetrics
      .filter((seg) => {
        if (
          baggageOnlyIssues &&
          seg.flight.baggageUncoveredDeviationsCount === 0 &&
          (seg.flight.baggageMissingWeightCount || 0) === 0
        ) {
          return false;
        }
        if (!q) return true;
        return [
          `${seg.flight.airline}${seg.cleanFlightNumber}`,
          seg.dateKey,
          seg.flight.origin,
          seg.flight.primaryDestination,
          seg.registration,
          seg.aircraftType,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.totalWeight - a.totalWeight || b.sortOrder - a.sortOrder);
  }, [analytics.segmentMetrics, baggageSearch, baggageOnlyIssues]);

  const webCheckinChannelPieData = useMemo(
    () =>
      [
        {
          name: pick("Check-in En Ligne (WB)", "Web Check-in (WB)"),
          value: kpis.webCheckinTotal,
          color: "#2563EB",
        },
        {
          name: pick("Comptoir Aéroport", "Airport Counter"),
          value: kpis.airportCheckinTotal,
          color: isDark ? "#475569" : "#94A3B8",
        },
      ].filter((d) => d.value > 0),
    [kpis.webCheckinTotal, kpis.airportCheckinTotal, pick, isDark]
  );

  const webCheckinCabinBarData = useMemo(
    () => [
      {
        name: pick("Économie (Y)", "Economy (Y)"),
        wbCount: kpis.webCheckinEco,
        counterCount: Math.max(0, kpis.traveledEco - kpis.webCheckinEco),
        ratePct: kpis.webCheckinEcoRatePct,
      },
      {
        name: pick("Business (C)", "Business (C)"),
        wbCount: kpis.webCheckinBiz,
        counterCount: Math.max(0, kpis.traveledBiz - kpis.webCheckinBiz),
        ratePct: kpis.webCheckinBizRatePct,
      },
    ],
    [
      kpis.webCheckinEco,
      kpis.traveledEco,
      kpis.webCheckinEcoRatePct,
      kpis.webCheckinBiz,
      kpis.traveledBiz,
      kpis.webCheckinBizRatePct,
      pick,
    ]
  );

  const webCheckinTopFlightsData = useMemo(
    () =>
      [...analytics.flightNumberGroups]
        .sort((a, b) => b.webCheckinCount - a.webCheckinCount || b.traveledTotal - a.traveledTotal)
        .slice(0, 12)
        .map((fg) => ({
          name: `KP${fg.flightNumber}`,
          webCheckinCount: fg.webCheckinCount,
          airportCheckinCount: fg.airportCheckinCount,
          webCheckinRatePct: fg.webCheckinRatePct,
        })),
    [analytics.flightNumberGroups]
  );

  const filteredWbStations = useMemo(() => {
    const q = webCheckinSearch.trim().toLowerCase();
    if (!q) return analytics.webCheckinStationBreakdown;
    return analytics.webCheckinStationBreakdown.filter((s) =>
      s.origin.toLowerCase().includes(q)
    );
  }, [analytics.webCheckinStationBreakdown, webCheckinSearch]);

  const filteredWbFlights = useMemo(() => {
    const q = webCheckinSearch.trim().toLowerCase();
    const sorted = [...analytics.flightNumberGroups].sort(
      (a, b) => b.webCheckinCount - a.webCheckinCount || b.traveledTotal - a.traveledTotal
    );
    if (!q) return sorted;
    return sorted.filter((fg) =>
      [
        `${fg.airline}${fg.flightNumber}`,
        `KP${fg.flightNumber}`,
        fg.origins.join(" "),
        fg.destinations.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [analytics.flightNumberGroups, webCheckinSearch]);

  const filteredWbSegments = useMemo(() => {
    const q = webCheckinSearch.trim().toLowerCase();
    const sorted = [...analytics.segmentMetrics].sort(
      (a, b) => b.webCheckinCount - a.webCheckinCount || b.sortOrder - a.sortOrder
    );
    if (!q) return sorted;
    return sorted.filter((seg) =>
      [
        seg.dateKey,
        `${seg.flight.airline}${seg.cleanFlightNumber}`,
        seg.flight.origin,
        seg.physicalDestination || seg.flight.primaryDestination,
        seg.aircraftType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [analytics.segmentMetrics, webCheckinSearch]);

  const handleExportReport = (format: "CSV" | "PDF") => {
    const scopeParts: string[] = [
      sourceScope === "ALL_DATA"
        ? pick("Base + Actif", "DB + Active")
        : sourceScope === "LOCAL_DB"
        ? pick("Base Locale", "Local DB")
        : pick("Manifeste Actif", "Active Manifest"),
    ];
    if (dateFilter !== "ALL") scopeParts.push(dateFilter);
    else if (periodStart || periodEnd) {
      scopeParts.push(`${periodStart || "..."} → ${periodEnd || "..."}`);
    }
    if (flightFilter !== "ALL") scopeParts.push(`KP${flightFilter}`);
    if (originFilter !== "ALL") scopeParts.push(originFilter);
    if (aircraftFilter !== "ALL") scopeParts.push(aircraftFilter);

    const summary = {
      scopeLabel: scopeParts.join(" · "),
      totalDays: kpis.totalDays,
      totalSegments: kpis.totalSegments,
      assignedSegments: kpis.assignedSegments,
      traveledTotal: kpis.traveledTotal,
      traveledEco: kpis.traveledEco,
      traveledBiz: kpis.traveledBiz,
      offeredTotalCapacity: kpis.offeredTotalCapacity,
      globalLoadFactorPct: kpis.globalLoadFactorPct,
      ecoLoadFactorPct: kpis.ecoLoadFactorPct,
      bizLoadFactorPct: kpis.bizLoadFactorPct,
      noShowTotal: kpis.noShowTotal,
      noShowRatePct: kpis.noShowRatePct,
      totalBags: kpis.totalBags,
      totalWeight: kpis.totalWeight,
      avgWeightPerPax: kpis.avgWeightPerPax,
      uncoveredDeviations: kpis.uncoveredDeviations,
      emdCount: kpis.emdCount,
      webCheckinTotal: kpis.webCheckinTotal,
      webCheckinRatePct: kpis.webCheckinRatePct,
    };

    const rows = analytics.flightNumberGroups.map((fg) => ({
      flightLabel: `${fg.airline} ${fg.flightNumber}`,
      origins: fg.origins.join("/"),
      destinations: fg.destinations.slice(0, 4).join("/"),
      tailNbr: fg.registrations.join("/") || fg.primaryRegistration || "",
      equipmentType: fg.primaryAircraftType || fg.equipmentHints[0] || "",
      seatCapacity: fg.avgCapacity,
      segmentsCount: fg.segmentsCount,
      traveledTotal: fg.traveledTotal,
      traveledEco: fg.traveledEco,
      traveledBiz: fg.traveledBiz,
      avgTraveled: fg.avgTraveled,
      loadFactorPct: fg.loadFactorPct,
      ecoLfPct: fg.ecoLfPct,
      bizLfPct: fg.bizLfPct,
      noShowTotal: fg.noShowTotal,
      noShowRatePct: fg.noShowRatePct,
      totalWeight: fg.totalWeight,
      avgWeightPerPax: fg.avgWeightPerPax,
      uncoveredDeviations: fg.uncoveredDeviations,
      emdCount: fg.emdCount,
      webCheckinCount: fg.webCheckinCount,
      webCheckinRatePct: fg.webCheckinRatePct,
    }));

    if (format === "CSV") {
      exportFlightAnalyticsReportToCSV(summary, rows, language);
    } else {
      exportFlightAnalyticsReportToPDF(summary, rows, language);
    }
  };

  const buildScopeLabel = () => {
    const scopeParts: string[] = [
      sourceScope === "ALL_DATA"
        ? pick("Base + Actif", "DB + Active")
        : sourceScope === "LOCAL_DB"
        ? pick("Base Locale", "Local DB")
        : pick("Manifeste Actif", "Active Manifest"),
    ];
    if (dateFilter !== "ALL") scopeParts.push(dateFilter);
    else if (periodStart || periodEnd) {
      scopeParts.push(`${periodStart || "..."} → ${periodEnd || "..."}`);
    }
    if (flightFilter !== "ALL") scopeParts.push(`KP${flightFilter}`);
    if (originFilter !== "ALL") scopeParts.push(originFilter);
    if (aircraftFilter !== "ALL") scopeParts.push(aircraftFilter);
    return scopeParts.join(" · ");
  };

  const filteredNoShowFlights = useMemo(() => {
    const q = noShowSearch.trim().toLowerCase();
    if (!q) return analytics.noShowReport.byFlight;
    return analytics.noShowReport.byFlight.filter((row) =>
      [row.dateKey, row.flightLabel, row.origin, row.destination, row.registration, row.aircraftType]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [analytics.noShowReport.byFlight, noShowSearch]);

  const filteredNoShowPassengers = useMemo(() => {
    const q = noShowSearch.trim().toLowerCase();
    if (!q) return analytics.noShowReport.passengers;
    return analytics.noShowReport.passengers.filter((row) =>
      [
        row.dateKey,
        row.flightLabel,
        row.origin,
        row.destination,
        row.fullNameDisplay,
        row.ticketNumber,
        row.bookingClass,
        row.editCodes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [analytics.noShowReport.passengers, noShowSearch]);

  const handleExportNoShow = (format: "CSV" | "EXCEL" | "PDF") => {
    const summaryPayload = {
      scopeLabel: buildScopeLabel(),
      ...analytics.noShowReport.summary,
    };
    if (format === "CSV") {
      exportNoShowReportToCSV(
        summaryPayload,
        filteredNoShowFlights,
        filteredNoShowPassengers,
        language
      );
    } else if (format === "EXCEL") {
      exportNoShowReportToExcel(
        summaryPayload,
        filteredNoShowFlights,
        filteredNoShowPassengers,
        language
      );
    } else {
      exportNoShowReportToPDF(
        summaryPayload,
        filteredNoShowFlights,
        filteredNoShowPassengers,
        language
      );
    }
  };

  if (baseFlights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {pick("Aucune donnée disponible", "No manifest data available")}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {pick(
              "Importez un manifeste dans l'onglet Manifestes.",
              "Import a manifest file in the Manifests tab."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToManifestUpload}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition"
        >
          <Layers className="w-4 h-4" />
          {pick("Aller aux Manifestes", "Go to Manifests")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Compact Analytics Filter & Export Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {pick("Statistiques & Prévisions", "Analytics & Forecast")}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400 mt-0.5">
                <span>
                  {kpis.totalDays} {pick("j", "d")} · {kpis.totalSegments}{" "}
                  {pick("vol(s)", "flight(s)")} ·{" "}
                  <strong className="text-slate-900 dark:text-slate-200">
                    {kpis.traveledTotal.toLocaleString(locale)}
                  </strong>{" "}
                  pax
                </span>
                {kpis.assignedSegments > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    · {kpis.assignedSegments}/{kpis.totalSegments} PTRG*
                    {kpis.globalLoadFactorPct !== null
                      ? ` (LF ${kpis.globalLoadFactorPct}%)`
                      : ""}
                  </span>
                ) : (
                  onGoToSchedule && (
                    <button
                      type="button"
                      onClick={onGoToSchedule}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-sans font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plane className="w-3 h-3" />
                      {pick("Importer PTRG*", "Import PTRG*")}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Data Source Toggle */}
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSourceScope("ALL_DATA")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  sourceScope === "ALL_DATA"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {pick("Tout", "All")}
              </button>
              <button
                type="button"
                onClick={() => setSourceScope("LOCAL_DB")}
                disabled={savedRecords.length === 0}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer disabled:opacity-40 ${
                  sourceScope === "LOCAL_DB"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {pick(`Sauvegardes (${savedRecords.length})`, `Saved (${savedRecords.length})`)}
              </button>
              <button
                type="button"
                onClick={() => setSourceScope("ACTIVE_ONLY")}
                disabled={!activeManifest}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer disabled:opacity-40 ${
                  sourceScope === "ACTIVE_ONLY"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {pick("Actif", "Active")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleExportReport("PDF")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportReport("CSV")}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Rich Multi-Axis Filter Row: Period, Date, Flight #, Origin, Registration/Aircraft */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
          {/* Interactive Date Range Picker */}
          <DateRangePicker
            id="flight-analytics-date-range"
            startDate={periodStart}
            endDate={periodEnd}
            availableIsoDates={availableIsoDates}
            placeholder={pick("Plage de dates : Toutes", "Date range: All period")}
            onChange={({ startDate, endDate }) => {
              setPeriodStart(startDate);
              setPeriodEnd(endDate);
              if (startDate || endDate) setDateFilter("ALL");
            }}
            className="min-w-[230px]"
          />

          {/* Specific Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              if (e.target.value !== "ALL") {
                setPeriodStart("");
                setPeriodEnd("");
              }
            }}
            className="min-h-[40px] px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              {pick(
                `Date précise : Toutes (${filterMeta.datesDesc.length})`,
                `Exact date: All (${filterMeta.datesDesc.length})`
              )}
            </option>
            {filterMeta.datesDesc.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Flight Number Filter */}
          <select
            value={flightFilter}
            onChange={(e) => setFlightFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              {pick(
                `N° Vol : Tous (${filterMeta.flightNumbers.length})`,
                `Flight #: All (${filterMeta.flightNumbers.length})`
              )}
            </option>
            {filterMeta.flightNumbers.map((fn) => (
              <option key={fn} value={fn}>
                KP{fn}
              </option>
            ))}
          </select>

          {/* Origin Station Filter */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">
              {pick(
                `Origine : Toutes (${filterMeta.origins.length})`,
                `Origin: All (${filterMeta.origins.length})`
              )}
            </option>
            {filterMeta.origins.map((orig) => (
              <option key={orig} value={orig}>
                {orig}
              </option>
            ))}
          </select>

          {/* Registration / Aircraft Filter */}
          {filterMeta.aircraftOptions.length > 0 && (
            <select
              value={aircraftFilter}
              onChange={(e) => setAircraftFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">
                {pick("Appareil / Immat. : Tous", "Aircraft / Reg: All")}
              </option>
              {filterMeta.aircraftOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {pick("Réinitialiser", "Reset")}
            </button>
          )}
        </div>

        {/* BI Lens Switcher (Vue Globale Graphs-Only first, then Detailed Modules) */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setBiLens("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {pick("Vue Globale", "Global View")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("TRAFFIC")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "TRAFFIC"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {pick("Trafic & O&D", "Traffic & O&D")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("MAP")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "MAP"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {pick("Réseau & Carte", "Network Map")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("FLEET")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "FLEET"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              {pick("Flotte & Vols", "Fleet & Flights")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("CABIN_SEATS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "CABIN_SEATS"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              {pick("Cabines & Sièges", "Cabins & Seats")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("WEB_CHECKIN")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "WEB_CHECKIN"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <WebCheckinBadge size="xs" />
              {pick("Check-in Web (WB)", "Web Check-in (WB)")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("BAGGAGE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "BAGGAGE"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              {pick("Bagages", "Baggage")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("EMD")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "EMD"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              {pick("EMDs & Excédents", "EMDs & Excess")}
            </button>
            <button
              type="button"
              onClick={() => setBiLens("NOSHOW")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                biLens === "NOSHOW"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              No-Show
            </button>
          </div>
        </div>
      </div>

      {scopedFlights.length === 0 && biLens !== "EMD" ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {pick(
              "Aucun vol ne correspond aux filtres sélectionnés.",
              "No flights match the selected filters."
            )}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
          >
            {pick("Réinitialiser les filtres", "Reset filters")}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Executive BI KPI Command Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Pax Transportés", "Traveled Pax")}</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {kpis.traveledTotal.toLocaleString(locale)}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {kpis.ecoSharePct}% Y · {kpis.bizSharePct}% C ·{" "}
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {kpis.webCheckinTotal} WB ({kpis.webCheckinRatePct}%)
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Load Factor Global", "Global Load Factor")}</span>
                <Gauge className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {kpis.globalLoadFactorPct !== null ? `${kpis.globalLoadFactorPct}%` : "—"}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Y {kpis.ecoLoadFactorPct ?? "—"}% · C {kpis.bizLoadFactorPct ?? "—"}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Flotte & Capacité", "Fleet & Capacity")}</span>
                <Plane className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {analytics.tailUtilization.length}{" "}
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {pick("avions", "acft")}
                </span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {kpis.offeredTotalCapacity.toLocaleString(locale)} {pick("sièges", "seats")} · {kpis.assignmentCoveragePct}% PTRG
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Heures Bloc & Vol", "Block & Flight Time")}</span>
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {fleetHoursSummary.totalFlightMin > 0
                  ? formatMinutesAsDuration(fleetHoursSummary.totalFlightMin)
                  : "—"}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {pick("Sol", "Gnd")}: {formatMinutesAsDuration(fleetHoursSummary.totalGroundMin)} · {fleetHoursSummary.totalLegs} {pick("étapes", "legs")}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("No-Show Global", "Global No-Show")}</span>
                <UserX className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {kpis.noShowTotal.toLocaleString(locale)}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {kpis.noShowRatePct}% · {analytics.noShowReport.summary.noShowEco}Y / {analytics.noShowReport.summary.noShowBiz}C
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{pick("Bagages & EMD", "Baggage & EMD")}</span>
                <Briefcase className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {Math.round(kpis.totalWeight).toLocaleString(locale)}{" "}
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">kg</span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {kpis.avgWeightPerPax} kg/pax · {kpis.emdCount} EMD · {kpis.uncoveredDeviations} {pick("écarts", "dev.")}
              </div>
            </div>
          </div>

          {(biLens === "ALL" || biLens === "TRAFFIC") && (
            <>
          {/* Chart 1: Daily Traffic, Offered Capacity & Load Factor % */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {pick(
                    "Trafic Quotidien, Capacité & Load Factor (%)",
                    "Daily Traffic, Capacity & Load Factor (%)"
                  )}
                </h4>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={analytics.dailySeries}
                  barSize={36}
                  barGap={0}
                  margin={{ top: 14, right: 16, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="grad3dEco" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#3730A3" />
                    </linearGradient>
                    <linearGradient id="grad3dBiz" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#6D28D9" />
                    </linearGradient>
                    <linearGradient id="grad3dCap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="#0284C7" stopOpacity={0.14} />
                    </linearGradient>
                  </defs>
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
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="pax"
                    tick={{
                      fill: axisTickColor,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="lf"
                    orientation="right"
                    domain={[0, 110]}
                    unit="%"
                    tick={{
                      fill: CHART_COLORS.loadFactor,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar
                    yAxisId="pax"
                    dataKey="traveledEco"
                    stackId="pax"
                    name={pick("Éco (Y)", "Economy (Y)")}
                    fill={CHART_COLORS.eco}
                    shape={(props: unknown) => (
                      <IsometricBar3DShape
                        {...(props as Bar3DProps)}
                        gradId="grad3dEco"
                        sideColor="#312E81"
                        topColor="#818CF8"
                        showShadow
                      />
                    )}
                  />
                  <Bar
                    yAxisId="pax"
                    dataKey="traveledBiz"
                    stackId="pax"
                    name={pick("Business (C)", "Business (C)")}
                    fill={CHART_COLORS.biz}
                    shape={(props: unknown) => (
                      <IsometricBar3DShape
                        {...(props as Bar3DProps)}
                        gradId="grad3dBiz"
                        sideColor="#5B21B6"
                        topColor="#C4B5FD"
                      />
                    )}
                  />
                  <Bar
                    yAxisId="pax"
                    dataKey="offeredCapacity"
                    name={pick("Capacité Offerte", "Offered Capacity")}
                    fill={CHART_COLORS.capacity}
                    shape={(props: unknown) => (
                      <IsometricBar3DShape
                        {...(props as Bar3DProps)}
                        gradId="grad3dCap"
                        sideColor="rgba(2, 132, 199, 0.25)"
                        topColor="rgba(125, 211, 252, 0.45)"
                      />
                    )}
                  />
                  <Line
                    yAxisId="lf"
                    type="monotone"
                    dataKey="loadFactorPct"
                    name="Load Factor (%)"
                    stroke={CHART_COLORS.loadFactor}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: CHART_COLORS.loadFactor }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Traffic Forecasting */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  {pick(
                    `Prévision de la Demande (+${forecastHorizon} jours)`,
                    `Demand & Capacity Forecast (+${forecastHorizon} days)`
                  )}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {pick("Moy. hist.", "Hist. avg")}:{" "}
                  <strong>{forecast.avgDailyHistoricalPax}</strong> pax/j ·{" "}
                  {pick("Moy. prévue", "Proj. avg")}:{" "}
                  <strong>{forecast.avgDailyForecastPax}</strong> pax/j ·{" "}
                  {pick("Pente", "Slope")}:{" "}
                  <strong>
                    {forecast.slopePerDay >= 0 ? "+" : ""}
                    {forecast.slopePerDay}
                  </strong>{" "}
                  pax/j (R² {forecast.rSquared})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setForecastMethod("LINEAR")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      forecastMethod === "LINEAR"
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("Régression Linéaire", "Linear OLS")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForecastMethod("WMA")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      forecastMethod === "WMA"
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("Moy. Mobile Pondérée", "Weighted MA")}
                  </button>
                </div>

                <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {([7, 14, 30] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setForecastHorizon(h)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                        forecastHorizon === h
                          ? "bg-indigo-600 text-white"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      +{h}j
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={forecast.points}
                  margin={{ top: 10, right: 16, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridStroke}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fill: axisTickColor,
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fill: axisTickColor,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Area
                    type="monotone"
                    dataKey="forecastHigh"
                    name={pick("Borne haute", "Upper band")}
                    fill={CHART_COLORS.forecastBand}
                    fillOpacity={isDark ? 0.14 : 0.35}
                    stroke="none"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="historicalPax"
                    name={pick("Historique Réel", "Historical Pax")}
                    stroke={CHART_COLORS.eco}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: CHART_COLORS.eco }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="forecastPax"
                    name={pick("Prévision Pax", "Forecast Pax")}
                    stroke={CHART_COLORS.forecast}
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{ r: 3.5, fill: CHART_COLORS.forecast }}
                    connectNulls
                  />
                  {forecast.avgDailyCapacityRef !== null && (
                    <ReferenceLine
                      y={forecast.avgDailyCapacityRef}
                      stroke={CHART_COLORS.capacity}
                      strokeDasharray="4 4"
                      label={{
                        value: `${pick("Cap. Moy/j", "Avg Cap/d")}: ${forecast.avgDailyCapacityRef}`,
                        fill: CHART_COLORS.capacity,
                        fontSize: 11,
                        position: "insideTopRight",
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          </>
          )}

          {(biLens === "ALL" || biLens === "FLEET") && (
            <>
          {/* Flight Number Performance (Full Width) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {pick(
                    "Performance par N° de Vol (Pax, Capacité & LF%)",
                    "Flight # Performance (Pax, Capacity & LF%)"
                  )}
                </h4>
              </div>
              {flightFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setFlightFilter("ALL")}
                  className="text-xs font-semibold text-indigo-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {pick(`Filtre actif : KP${flightFilter} (Effacer)`, `Active filter: KP${flightFilter} (Clear)`)}
                </button>
              )}
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={analytics.flightNumberGroups.map((fg) => ({
                    name: `KP${fg.flightNumber}`,
                    rawFlightNumber: fg.flightNumber,
                    avgTraveled: fg.avgTraveled,
                    capacity: fg.avgCapacity,
                    loadFactorPct: fg.loadFactorPct,
                  }))}
                  barGap={0}
                  margin={{ top: 10, right: 16, left: -10, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="grad3dPerfPax" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#3730A3" />
                    </linearGradient>
                    <linearGradient id="grad3dPerfCap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#0284C7" stopOpacity={0.18} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridStroke}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={analytics.flightNumberGroups.length > 12 ? -25 : 0}
                    textAnchor={analytics.flightNumberGroups.length > 12 ? "end" : "middle"}
                    height={analytics.flightNumberGroups.length > 12 ? 48 : 30}
                    tick={{
                      fill: axisTickColor,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="pax"
                    tick={{
                      fill: axisTickColor,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="lf"
                    orientation="right"
                    domain={[0, 110]}
                    unit="%"
                    tick={{
                      fill: CHART_COLORS.loadFactor,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar
                    yAxisId="pax"
                    dataKey="avgTraveled"
                    name={pick("Moy. Pax Transportés", "Avg Traveled Pax")}
                    fill={CHART_COLORS.eco}
                    maxBarSize={32}
                    className="cursor-pointer"
                    onClick={(data) => {
                      const fn = (data as unknown as { rawFlightNumber?: string })?.rawFlightNumber;
                      if (fn) setFlightFilter((curr) => (curr === fn ? "ALL" : fn));
                    }}
                    shape={(props: unknown) => (
                      <IsometricBar3DShape
                        {...(props as Bar3DProps)}
                        gradId="grad3dPerfPax"
                        sideColor="#312E81"
                        topColor="#818CF8"
                        showShadow
                      />
                    )}
                  />
                  <Bar
                    yAxisId="pax"
                    dataKey="capacity"
                    name={pick("Capacité Moy.", "Avg Capacity")}
                    fill={CHART_COLORS.capacity}
                    maxBarSize={32}
                    className="cursor-pointer"
                    onClick={(data) => {
                      const fn = (data as unknown as { rawFlightNumber?: string })?.rawFlightNumber;
                      if (fn) setFlightFilter((curr) => (curr === fn ? "ALL" : fn));
                    }}
                    shape={(props: unknown) => (
                      <IsometricBar3DShape
                        {...(props as Bar3DProps)}
                        gradId="grad3dPerfCap"
                        sideColor="rgba(2, 132, 199, 0.25)"
                        topColor="rgba(125, 211, 252, 0.45)"
                      />
                    )}
                  />
                  <Line
                    yAxisId="lf"
                    type="monotone"
                    dataKey="loadFactorPct"
                    name="Load Factor (%)"
                    stroke={CHART_COLORS.loadFactor}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: CHART_COLORS.loadFactor }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aircraft / Registration Utilization (Full Width below Flight Performance — sized for 16+ aircraft) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {pick(
                    "Utilisation par Immatriculation (Sièges & LF%)",
                    "Aircraft Utilization by Registration (Seats & LF%)"
                  )}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {sortedTailUtilization.length} {pick("appareil(s)", "aircraft")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {aircraftFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setAircraftFilter("ALL")}
                    className="text-xs font-semibold text-indigo-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    {pick(
                      `Filtre : ${aircraftFilter.replace("REG:", "")} (Effacer)`,
                      `Filter: ${aircraftFilter.replace("REG:", "")} (Clear)`
                    )}
                  </button>
                )}
                <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setTailSortMode("PAX")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      tailSortMode === "PAX"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("Tri : Sièges", "Sort: Seats")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTailSortMode("LF")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      tailSortMode === "LF"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("Tri : LF%", "Sort: LF%")}
                  </button>
                </div>
              </div>
            </div>

            <div className="h-[380px] w-full">
              {sortedTailUtilization.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={sortedTailUtilization.map((t) => ({
                      name: `${t.tailNbr} (${t.equipmentType})`,
                      regValue: `REG:${t.tailNbr}`,
                      traveledTotal: t.traveledTotal,
                      emptySeats: t.emptySeats,
                      loadFactorPct: t.loadFactorPct,
                    }))}
                    margin={{ top: 14, right: 16, left: -10, bottom: 16 }}
                  >
                    <defs>
                      <linearGradient id="grad3dOcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#312E81" />
                      </linearGradient>
                      <linearGradient id="grad3dAvail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isDark ? "#475569" : "#CBD5E1"} />
                        <stop offset="100%" stopColor={isDark ? "#334155" : "#94A3B8"} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStroke}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={sortedTailUtilization.length > 8 ? -25 : 0}
                      textAnchor={sortedTailUtilization.length > 8 ? "end" : "middle"}
                      height={sortedTailUtilization.length > 8 ? 64 : 32}
                      tick={{
                        fill: axisTickColor,
                        fontSize: 10,
                        fontFamily: "monospace",
                      }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="seats"
                      tick={{
                        fill: axisTickColor,
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="lf"
                      orientation="right"
                      domain={[0, 110]}
                      unit="%"
                      tick={{
                        fill: CHART_COLORS.loadFactor,
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar
                      yAxisId="seats"
                      dataKey="traveledTotal"
                      stackId="cap"
                      name={pick("Sièges Occupés", "Occupied Seats")}
                      fill={CHART_COLORS.eco}
                      maxBarSize={36}
                      className="cursor-pointer"
                      onClick={(data) => {
                        const rv = (data as unknown as { regValue?: string })?.regValue;
                        if (rv) setAircraftFilter((curr) => (curr === rv ? "ALL" : rv));
                      }}
                      shape={(props: unknown) => (
                        <IsometricBar3DShape
                          {...(props as Bar3DProps)}
                          gradId="grad3dOcc"
                          sideColor="#1E1B4B"
                          topColor="#818CF8"
                          showShadow
                        />
                      )}
                    />
                    <Bar
                      yAxisId="seats"
                      dataKey="emptySeats"
                      stackId="cap"
                      name={pick("Sièges Disponibles", "Available Seats")}
                      fill={CHART_COLORS.emptySeats}
                      maxBarSize={36}
                      className="cursor-pointer"
                      onClick={(data) => {
                        const rv = (data as unknown as { regValue?: string })?.regValue;
                        if (rv) setAircraftFilter((curr) => (curr === rv ? "ALL" : rv));
                      }}
                      shape={(props: unknown) => (
                        <IsometricBar3DShape
                          {...(props as Bar3DProps)}
                          gradId="grad3dAvail"
                          sideColor={isDark ? "#1E293B" : "#64748B"}
                          topColor={isDark ? "#64748B" : "#E2E8F0"}
                          opacity={isDark ? 0.55 : 0.8}
                        />
                      )}
                    />
                    <Line
                      yAxisId="lf"
                      type="monotone"
                      dataKey="loadFactorPct"
                      name="Load Factor (%)"
                      stroke={CHART_COLORS.loadFactor}
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: CHART_COLORS.loadFactor }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col items-center justify-center p-6 text-center gap-3">
                  <Plane className="w-7 h-7 text-amber-500" />
                  <div className="space-y-1 max-w-sm">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {pick(
                        "Détails PTRG* non importés (Vol + Date + Origine)",
                        "PTRG* details not imported (Flight + Date + Origin)"
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {pick(
                        "Importez-les dans « 1. Programme des Vols ».",
                        "Import them in \"1. Flight Schedule\"."
                      )}
                    </p>
                  </div>
                  {onGoToSchedule && (
                    <button
                      type="button"
                      onClick={onGoToSchedule}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition"
                    >
                      {pick("Programme des Vols", "Flight Schedule")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* NEW Showpiece Section: Aircraft Utilization Time (3D Isometric & 24h Rotation Timeline) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {pick(
                      "Temps d'Utilisation des Avions (Vol & Escales — Vue 3D)",
                      "Aircraft Utilization Time (Block & Turnaround — 3D View)"
                    )}
                  </h4>
                </div>
              </div>

              {analytics.aircraftTimeUtilization.length > 0 && (
                <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setAircraftTimeMode("CUMUL")}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      aircraftTimeMode === "CUMUL"
                        ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("3D Cumul (h)", "3D Total (h)")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAircraftTimeMode("DAILY")}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      aircraftTimeMode === "DAILY"
                        ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("3D Moy. / Jour", "3D Avg / Day")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAircraftTimeMode("GANTT")}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      aircraftTimeMode === "GANTT"
                        ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {pick("Rotations 24h", "24h Timeline")}
                  </button>
                </div>
              )}
            </div>

            {analytics.aircraftTimeUtilization.length === 0 ? (
              <div className="h-56 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col items-center justify-center p-6 text-center gap-3">
                <Clock className="w-7 h-7 text-sky-500" />
                <div className="space-y-1 max-w-md">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {pick(
                      "Aucune durée calculée sans fiches PTRG*",
                      "No utilization computed without PTRG* details"
                    )}
                  </p>
                </div>
                {onGoToSchedule && (
                  <button
                    type="button"
                    onClick={onGoToSchedule}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer transition"
                  >
                    {pick("Aller au Programme des Vols", "Go to Flight Schedule")}
                  </button>
                )}
              </div>
            ) : aircraftTimeMode === "GANTT" ? (
              <div className="space-y-3">
                {/* 24h Timeline Header Scale */}
                <div className="flex items-center text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2">
                  <div className="w-36 sm:w-44 shrink-0 font-bold uppercase tracking-wider">
                    {pick("Appareil / Date", "Aircraft / Date")}
                  </div>
                  <div className="flex-1 grid grid-cols-6 border-b border-slate-200 dark:border-slate-700 pb-1">
                    {["00h", "04h", "08h", "12h", "16h", "20h"].map((hr) => (
                      <span key={hr} className="text-left">
                        {hr}
                      </span>
                    ))}
                  </div>
                  <div className="w-24 text-right shrink-0 font-bold uppercase tracking-wider">
                    {pick("Vol / Sol", "Flt / Gnd")}
                  </div>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {analytics.aircraftTimeUtilization.flatMap((ac) => {
                    const byDate = new Map<string, typeof ac.timelineSegments>();
                    for (const seg of ac.timelineSegments) {
                      const list = byDate.get(seg.dateKey) || [];
                      list.push(seg);
                      byDate.set(seg.dateKey, list);
                    }
                    return Array.from(byDate.entries()).map(([dk, segs]) => {
                      const fltMin = segs
                        .filter((s) => s.kind === "FLIGHT")
                        .reduce((a, b) => a + b.durationMin, 0);
                      const gndMin = segs
                        .filter((s) => s.kind === "GROUND")
                        .reduce((a, b) => a + b.durationMin, 0);
                      return (
                        <div
                          key={`${ac.tailNbr}-${dk}`}
                          className="flex items-center gap-2 px-2 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70"
                        >
                          <div className="w-36 sm:w-44 shrink-0">
                            <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100">
                              {ac.tailNbr}{" "}
                              <span className="text-sky-600 dark:text-sky-400">
                                ({ac.equipmentType})
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {dk} · {segs.filter((s) => s.kind === "FLIGHT").length}{" "}
                              {pick("étape(s)", "leg(s)")}
                            </div>
                          </div>

                          <div className="flex-1 relative h-8 rounded-lg bg-slate-200/70 dark:bg-slate-900/80 overflow-hidden shadow-inner">
                            {/* Vertical 4h tick guides */}
                            {[16.66, 33.33, 50, 66.66, 83.33].map((pct) => (
                              <div
                                key={pct}
                                style={{ left: `${pct}%` }}
                                className="absolute top-0 bottom-0 w-px bg-slate-300/60 dark:bg-slate-700/60"
                              />
                            ))}

                            {segs.map((seg) => {
                              const leftPct = Math.max(0, Math.min(98, (seg.startMin / 1440) * 100));
                              const rightMin = Math.min(1440, seg.endMin);
                              const widthPct = Math.max(
                                1.4,
                                ((rightMin - seg.startMin) / 1440) * 100
                              );
                              const isFlight = seg.kind === "FLIGHT";
                              return (
                                <div
                                  key={seg.id}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                  }}
                                  title={`${seg.flightLabel} · ${seg.route} · ${seg.startLabel}–${seg.endLabel} (${formatMinutesAsDuration(seg.durationMin)})`}
                                  className={`absolute top-1 bottom-1 rounded-md px-1.5 flex items-center justify-center overflow-hidden text-[9px] font-mono font-bold text-white shadow-md transition-transform hover:scale-[1.03] cursor-default ${
                                    isFlight
                                      ? "bg-gradient-to-b from-sky-400 via-sky-500 to-indigo-700 border-t border-white/50 shadow-sky-600/30"
                                      : "bg-gradient-to-b from-amber-400 to-amber-600 border-t border-white/40 shadow-amber-500/25"
                                  }`}
                                >
                                  <span className="truncate">
                                    {isFlight
                                      ? `${seg.fromStation}→${seg.toStation}`
                                      : formatMinutesAsDuration(seg.durationMin)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="w-24 text-right shrink-0 font-mono text-[11px] tabular-nums">
                            <div className="font-bold text-sky-600 dark:text-sky-400">
                              {formatMinutesAsDuration(fltMin)}
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              {gndMin > 0 ? `+${formatMinutesAsDuration(gndMin)}` : "—"}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={analytics.aircraftTimeUtilization.map((a) => ({
                      name: `${a.tailNbr} (${a.equipmentType})`,
                      flightHours:
                        aircraftTimeMode === "CUMUL"
                          ? a.totalFlightHours
                          : a.avgDailyFlightHours,
                      turnaroundHours:
                        aircraftTimeMode === "CUMUL"
                          ? a.totalTurnaroundHours
                          : Number(
                              (a.totalTurnaroundHours / a.activeDaysCount).toFixed(2)
                            ),
                      utilizationRatePct: a.utilizationRatePct,
                      raw: a,
                    }))}
                    margin={{ top: 18, right: 20, left: -6, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="grad3dFlightTime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="55%" stopColor="#0284C7" />
                        <stop offset="100%" stopColor="#1E3A8A" />
                      </linearGradient>
                      <linearGradient id="grad3dGroundTime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FCD34D" />
                        <stop offset="60%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#B45309" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStroke}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{
                        fill: axisTickColor,
                        fontSize: 11,
                        fontFamily: "monospace",
                        fontWeight: 700,
                      }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="hrs"
                      unit="h"
                      tick={{
                        fill: axisTickColor,
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      domain={[0, 110]}
                      unit="%"
                      tick={{
                        fill: CHART_COLORS.loadFactor,
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row = payload[0]?.payload?.raw;
                        if (!row) return null;
                        return (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-1.5 min-w-[210px]">
                            <div className="font-mono font-extrabold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-1">
                              {row.tailNbr} · {row.equipmentType} ({row.aircraftConfig})
                            </div>
                            <div className="flex justify-between gap-4 font-mono tabular-nums">
                              <span className="text-sky-600 dark:text-sky-400">
                                {pick("Temps de vol", "Flight time")}:
                              </span>
                              <strong className="text-slate-900 dark:text-slate-100">
                                {formatMinutesAsDuration(row.totalFlightMinutes)}
                              </strong>
                            </div>
                            <div className="flex justify-between gap-4 font-mono tabular-nums">
                              <span className="text-amber-600 dark:text-amber-400">
                                {pick("Temps d'escale", "Turnaround")}:
                              </span>
                              <strong className="text-slate-900 dark:text-slate-100">
                                {formatMinutesAsDuration(row.totalTurnaroundMinutes)}
                              </strong>
                            </div>
                            <div className="flex justify-between gap-4 font-mono tabular-nums">
                              <span className="text-slate-500 dark:text-slate-400">
                                {pick("Moy. / jour", "Avg / day")}:
                              </span>
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {row.avgDailyFlightHours}h / j ({row.utilizationRatePct}% · 12h)
                              </strong>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                              {row.legsCount} {pick("étapes", "legs")} · {row.activeDaysCount}{" "}
                              {pick("jour(s)", "day(s)")} · {row.flightNumbers.join(", ")}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    {aircraftTimeMode === "DAILY" && (
                      <ReferenceLine
                        yAxisId="hrs"
                        y={12}
                        stroke="#10B981"
                        strokeDasharray="4 4"
                        label={{
                          value: pick("Cible 12h/j", "Target 12h/d"),
                          fill: "#10B981",
                          fontSize: 10,
                          position: "insideTopRight",
                        }}
                      />
                    )}
                    <Bar
                      yAxisId="hrs"
                      dataKey="flightHours"
                      stackId="time"
                      name={
                        aircraftTimeMode === "CUMUL"
                          ? pick("Heures de Vol (Bloc)", "Flight Hours (Block)")
                          : pick("Moy. Heures de Vol / j", "Avg Flight Hours / d")
                      }
                      fill="#0284C7"
                      maxBarSize={42}
                      shape={(props: unknown) => (
                        <IsometricBar3DShape
                          {...(props as Bar3DProps)}
                          gradId="grad3dFlightTime"
                          sideColor="#1E3A8A"
                          topColor="#7DD3FC"
                          showShadow
                        />
                      )}
                    />
                    <Bar
                      yAxisId="hrs"
                      dataKey="turnaroundHours"
                      stackId="time"
                      name={
                        aircraftTimeMode === "CUMUL"
                          ? pick("Temps d'Escale / Sol", "Ground Turnaround")
                          : pick("Moy. Escales / j", "Avg Ground / d")
                      }
                      fill="#F59E0B"
                      maxBarSize={42}
                      shape={(props: unknown) => (
                        <IsometricBar3DShape
                          {...(props as Bar3DProps)}
                          gradId="grad3dGroundTime"
                          sideColor="#92400E"
                          topColor="#FDE68A"
                        />
                      )}
                    />
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="utilizationRatePct"
                      name={pick("Taux d'Utilisation (vs 12h/j)", "Utilization % (vs 12h/d)")}
                      stroke={CHART_COLORS.loadFactor}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: CHART_COLORS.loadFactor }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          </>
          )}

          {/* Equipment Type 3D Donut inside FLEET module */}
          {(biLens === "ALL" || biLens === "FLEET") && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                {pick("Répartition par Type Appareil", "Fleet Equipment Split")}
              </h4>
              <Donut3DChart
                data={equipmentPieData}
                centerValue={String(analytics.equipmentSummary.length)}
                centerLabel={pick("Types", "Types")}
                heightClass="min-h-[240px]"
              />
            </div>
          )}

          {/* Dedicated Network Map Module (ONLY Map & Route Flows) */}
          {(biLens === "ALL" || biLens === "MAP") && (
            <FlightRouteMapModule
              flightRouteFlows={analytics.flightRouteFlows}
              sectorPerformance={analytics.sectorPerformance}
              routeOndBreakdown={analytics.routeOndBreakdown}
              isDark={isDark}
              originFilter={originFilter}
              onSelectOriginStation={(code) =>
                setOriginFilter((curr) => (curr === code ? "ALL" : code))
              }
              totalManifestFlights={kpis.totalSegments}
              unmappedMapFlights={analytics.unmappedMapFlights}
            />
          )}

          {/* Traffic & O&D Network Module */}
          {(biLens === "ALL" || biLens === "TRAFFIC") && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                  {pick("Top Destinations Finales (O&D)", "Top Final Destinations (O&D)")}
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.destinationBreakdown.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 4, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="grad3dDest" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#1D4ED8" />
                          <stop offset="100%" stopColor="#38BDF8" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStroke}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: axisTickColor,
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="code"
                        width={44}
                        tick={{
                          fill: axisTickColor,
                          fontSize: 11,
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="passengers"
                        name={pick("Passagers", "Passengers")}
                        fill={CHART_COLORS.blue}
                        maxBarSize={20}
                        shape={(props: unknown) => (
                          <HorizontalBar3DShape
                            {...(props as Bar3DProps)}
                            gradId="grad3dDest"
                            sideColor="#1E3A8A"
                            topColor="#7DD3FC"
                          />
                        )}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {pick("Meilleures Stations de Départ", "Top Origin Stations")}
                  </h4>
                  {originFilter !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setOriginFilter("ALL")}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {originFilter} ✕
                    </button>
                  )}
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.originBreakdown.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 4, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="grad3dOrigin" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#059669" />
                          <stop offset="100%" stopColor="#34D399" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStroke}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: axisTickColor,
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="code"
                        width={44}
                        tick={{
                          fill: axisTickColor,
                          fontSize: 11,
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="passengers"
                        name={pick("Passagers Origine", "Origin Passengers")}
                        fill={CHART_COLORS.teal}
                        maxBarSize={20}
                        className="cursor-pointer"
                        onClick={(data) => {
                          const code = (data as unknown as { code?: string })?.code;
                          if (code) setOriginFilter((curr) => (curr === code ? "ALL" : code));
                        }}
                        shape={(props: unknown) => (
                          <HorizontalBar3DShape
                            {...(props as Bar3DProps)}
                            gradId="grad3dOrigin"
                            sideColor="#064E3B"
                            topColor="#6EE7B7"
                          />
                        )}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                  {pick("Top Paires O&D (Origine → Finale)", "Top O&D City Pairs")}
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.routeOndBreakdown.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 4, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="grad3dRouteOnd" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#D97706" />
                          <stop offset="100%" stopColor="#FBBF24" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStroke}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: axisTickColor,
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="route"
                        width={78}
                        tick={{
                          fill: axisTickColor,
                          fontSize: 10,
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="passengers"
                        name={pick("Passagers O&D", "O&D Passengers")}
                        fill={CHART_COLORS.forecast}
                        maxBarSize={20}
                        shape={(props: unknown) => (
                          <HorizontalBar3DShape
                            {...(props as Bar3DProps)}
                            gradId="grad3dRouteOnd"
                            sideColor="#78350F"
                            topColor="#FDE68A"
                          />
                        )}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated Cabins & Seat Occupancy Module */}
          {(biLens === "ALL" || biLens === "CABIN_SEATS") && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "Répartition Cabines (Éco Y vs Business C)",
                      "Cabin Split (Economy Y vs Business C)"
                    )}
                  </h4>
                  <Donut3DChart
                    data={cabinPieData}
                    centerValue={kpis.traveledTotal.toLocaleString(locale)}
                    centerLabel={pick("Pax Total", "Total Pax")}
                    heightClass="min-h-[240px]"
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "Mix Classes Tarifaires (Booking Class Yield)",
                      "Booking Class Yield Mix"
                    )}
                  </h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.bookingClassBreakdown.slice(0, 14)}
                        margin={{ top: 14, right: 12, left: -12, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="grad3dBcEco" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366F1" />
                            <stop offset="100%" stopColor="#312E81" />
                          </linearGradient>
                          <linearGradient id="grad3dBcBiz" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#A78BFA" />
                            <stop offset="100%" stopColor="#5B21B6" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis
                          dataKey="bookingClass"
                          tick={{
                            fill: axisTickColor,
                            fontSize: 11,
                            fontFamily: "monospace",
                            fontWeight: 700,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: axisTickColor, fontSize: 11, fontFamily: "monospace" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="passengers"
                          name={pick("Passagers", "Passengers")}
                          maxBarSize={32}
                          shape={(props: unknown) => {
                            const p = props as Bar3DProps & { payload?: { cabin?: string } };
                            const isBiz = p.payload?.cabin === "C";
                            return (
                              <IsometricBar3DShape
                                {...p}
                                gradId={isBiz ? "grad3dBcBiz" : "grad3dBcEco"}
                                sideColor={isBiz ? "#4C1D95" : "#1E1B4B"}
                                topColor={isBiz ? "#DDD6FE" : "#818CF8"}
                                showShadow
                              />
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "Profil Démographique (Transportés)",
                      "Passenger Demographics (Traveled)"
                    )}
                  </h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={demographicsBarData}
                        margin={{ top: 14, right: 12, left: -12, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="grad3dDemo0" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#60A5FA" />
                            <stop offset="100%" stopColor="#1D4ED8" />
                          </linearGradient>
                          <linearGradient id="grad3dDemo1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#A78BFA" />
                            <stop offset="100%" stopColor="#6D28D9" />
                          </linearGradient>
                          <linearGradient id="grad3dDemo2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" />
                            <stop offset="100%" stopColor="#047857" />
                          </linearGradient>
                          <linearGradient id="grad3dDemo3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FBBF24" />
                            <stop offset="100%" stopColor="#B45309" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: axisTickColor, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fill: axisTickColor,
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="count"
                          maxBarSize={44}
                          shape={(props: unknown) => {
                            const p = props as Bar3DProps & { index?: number };
                            const idx = p.index ?? 0;
                            const palettes = [
                              { gradId: "grad3dDemo0", side: "#1E3A8A", top: "#93C5FD" },
                              { gradId: "grad3dDemo1", side: "#4C1D95", top: "#DDD6FE" },
                              { gradId: "grad3dDemo2", side: "#064E3B", top: "#6EE7B7" },
                              { gradId: "grad3dDemo3", side: "#78350F", top: "#FDE68A" },
                            ];
                            const pal = palettes[idx % palettes.length];
                            return (
                              <IsometricBar3DShape
                                {...p}
                                gradId={pal.gradId}
                                sideColor={pal.side}
                                topColor={pal.top}
                                showShadow
                              />
                            );
                          }}
                        >
                          {demographicsBarData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Seat Occupancy Analysis inside Cabins & Seats Module */}
              <FlightSeatOccupancyModule seatOccupancy={analytics.seatOccupancy} />
            </>
          )}

          {/* Dedicated Web Check-in (WB) Analytics Module */}
          {(biLens === "ALL" || biLens === "WEB_CHECKIN") && (
            <div className="space-y-4">
              {/* Module Header & KPI Summary (when in WEB_CHECKIN detail lens) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <WebCheckinBadge size="md" />
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        {pick(
                          "Analyse Approfondie du Check-in En Ligne (Code WB)",
                          "In-Depth Online Check-in Analytics (Edit Code WB)"
                        )}
                      </h4>
                      <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {kpis.webCheckinTotal.toLocaleString(locale)} {pick("check-in web", "web check-ins")} ({kpis.webCheckinRatePct}%) ·{" "}
                        {pick("Éco Y", "Eco Y")}: {kpis.webCheckinEcoRatePct}% ·{" "}
                        {pick("Business C", "Business C")}: {kpis.webCheckinBizRatePct}% ·{" "}
                        {pick("Comptoir", "Counter")}: {kpis.airportCheckinTotal.toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                </div>

                {biLens === "WEB_CHECKIN" && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-3 space-y-0.5">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {pick("Total Check-in Web (WB)", "Total Web Check-in (WB)")}
                      </div>
                      <div className="text-xl font-extrabold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        {kpis.webCheckinTotal.toLocaleString(locale)}{" "}
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          ({kpis.webCheckinRatePct}%)
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-3 space-y-0.5">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {pick("Adoption par Cabine", "Adoption by Cabin")}
                      </div>
                      <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100 pt-1">
                        Y {kpis.webCheckinEcoRatePct}% ({kpis.webCheckinEco}) · C{" "}
                        {kpis.webCheckinBizRatePct}% ({kpis.webCheckinBiz})
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-3 space-y-0.5">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {pick("Comptoir Aéroport", "Airport Counter")}
                      </div>
                      <div className="text-xl font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {kpis.airportCheckinTotal.toLocaleString(locale)}{" "}
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          ({(100 - kpis.webCheckinRatePct).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-3 space-y-0.5">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {pick("WB avec Bagages / No-Show", "WB w/ Bags / No-Show")}
                      </div>
                      <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100 pt-1">
                        {kpis.webCheckinWithBagsCount} {pick("bag.", "bags")} ({kpis.webCheckinBagsRatePct}%) ·{" "}
                        <span className="text-rose-600 dark:text-rose-400">
                          {kpis.webCheckinNoShow} NS
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Graphs Row 1: Daily WB Trend + 3D Channel Pie */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                      {pick(
                        "Évolution Quotidienne : Check-in En Ligne (WB) vs Comptoir & Taux d'Adoption (%)",
                        "Daily Trend: Web Check-in (WB) vs Airport Counter & Adoption Rate (%)"
                      )}
                    </h5>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={analytics.dailySeries}
                          margin={{ top: 14, right: 16, left: -10, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="grad3dWbDaily" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" />
                              <stop offset="100%" stopColor="#1E40AF" />
                            </linearGradient>
                            <linearGradient id="grad3dCtrDaily" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isDark ? "#64748B" : "#CBD5E1"} />
                              <stop offset="100%" stopColor={isDark ? "#334155" : "#94A3B8"} />
                            </linearGradient>
                          </defs>
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
                            yAxisId="pax"
                            tick={{
                              fill: axisTickColor,
                              fontSize: 11,
                              fontFamily: "monospace",
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="rate"
                            orientation="right"
                            domain={[0, 100]}
                            unit="%"
                            tick={{
                              fill: CHART_COLORS.loadFactor,
                              fontSize: 10,
                              fontFamily: "monospace",
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar
                            yAxisId="pax"
                            dataKey="webCheckinCount"
                            stackId="wbChannel"
                            name={pick("Check-in En Ligne (WB)", "Web Check-in (WB)")}
                            fill="#2563EB"
                            maxBarSize={36}
                            shape={(props: unknown) => (
                              <IsometricBar3DShape
                                {...(props as Bar3DProps)}
                                gradId="grad3dWbDaily"
                                sideColor="#1E3A8A"
                                topColor="#93C5FD"
                                showShadow
                              />
                            )}
                          />
                          <Bar
                            yAxisId="pax"
                            dataKey="airportCheckinCount"
                            stackId="wbChannel"
                            name={pick("Comptoir Aéroport", "Airport Counter")}
                            fill="#94A3B8"
                            maxBarSize={36}
                            shape={(props: unknown) => (
                              <IsometricBar3DShape
                                {...(props as Bar3DProps)}
                                gradId="grad3dCtrDaily"
                                sideColor={isDark ? "#1E293B" : "#64748B"}
                                topColor={isDark ? "#94A3B8" : "#E2E8F0"}
                                opacity={isDark ? 0.65 : 0.8}
                              />
                            )}
                          />
                          <Line
                            yAxisId="rate"
                            type="monotone"
                            dataKey="webCheckinRatePct"
                            name={pick("Taux WB (%)", "WB Rate (%)")}
                            stroke={CHART_COLORS.loadFactor}
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: CHART_COLORS.loadFactor }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                      {pick(
                        "Part Check-in Web (WB) vs Comptoir",
                        "Web Check-in (WB) vs Counter Split"
                      )}
                    </h5>
                    <Donut3DChart
                      variant="pie"
                      data={webCheckinChannelPieData}
                      centerValue={`${kpis.webCheckinRatePct}%`}
                      centerLabel="Web WB"
                      heightClass="min-h-[240px]"
                    />
                  </div>
                </div>

                {/* Graphs Row 2: Cabin Adoption, Origin Station Rate & Flight # Ranking */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                      {pick(
                        "Adoption WB par Cabine (Éco Y vs Business C)",
                        "WB Adoption by Cabin (Eco Y vs Business C)"
                      )}
                    </h5>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={webCheckinCabinBarData}
                          margin={{ top: 14, right: 16, left: -12, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient id="grad3dWbCab" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" />
                              <stop offset="100%" stopColor="#1D4ED8" />
                            </linearGradient>
                            <linearGradient id="grad3dCtrCab" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isDark ? "#64748B" : "#CBD5E1"} />
                              <stop offset="100%" stopColor={isDark ? "#334155" : "#94A3B8"} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: axisTickColor, fontSize: 11, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="pax"
                            tick={{ fill: axisTickColor, fontSize: 10, fontFamily: "monospace" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="rate"
                            orientation="right"
                            domain={[0, 100]}
                            unit="%"
                            tick={{ fill: CHART_COLORS.loadFactor, fontSize: 10, fontFamily: "monospace" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar
                            yAxisId="pax"
                            dataKey="wbCount"
                            stackId="cab"
                            name={pick("Web Check-in (WB)", "Web Check-in (WB)")}
                            maxBarSize={44}
                            shape={(props: unknown) => (
                              <IsometricBar3DShape
                                {...(props as Bar3DProps)}
                                gradId="grad3dWbCab"
                                sideColor="#1E3A8A"
                                topColor="#93C5FD"
                                showShadow
                              />
                            )}
                          />
                          <Bar
                            yAxisId="pax"
                            dataKey="counterCount"
                            stackId="cab"
                            name={pick("Comptoir", "Counter")}
                            maxBarSize={44}
                            shape={(props: unknown) => (
                              <IsometricBar3DShape
                                {...(props as Bar3DProps)}
                                gradId="grad3dCtrCab"
                                sideColor={isDark ? "#1E293B" : "#64748B"}
                                topColor={isDark ? "#94A3B8" : "#E2E8F0"}
                                opacity={isDark ? 0.65 : 0.8}
                              />
                            )}
                          />
                          <Line
                            yAxisId="rate"
                            type="monotone"
                            dataKey="ratePct"
                            name={pick("Taux WB (%)", "WB Rate (%)")}
                            stroke={CHART_COLORS.loadFactor}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: CHART_COLORS.loadFactor }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                      {pick(
                        "Check-in Web (WB) par Escale de Départ",
                        "Web Check-in (WB) by Origin Station"
                      )}
                    </h5>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.webCheckinStationBreakdown.slice(0, 8)}
                          layout="vertical"
                          margin={{ top: 6, right: 24, left: 4, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient id="grad3dWbStation" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#1D4ED8" />
                              <stop offset="100%" stopColor="#38BDF8" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fill: axisTickColor, fontSize: 10, fontFamily: "monospace" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="origin"
                            width={42}
                            tick={{
                              fill: axisTickColor,
                              fontSize: 11,
                              fontFamily: "monospace",
                              fontWeight: 700,
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar
                            dataKey="webCheckinCount"
                            name={pick("Passagers WB", "WB Passengers")}
                            maxBarSize={18}
                            className="cursor-pointer"
                            onClick={(data) => {
                              const orig = (data as unknown as { origin?: string })?.origin;
                              if (orig) setOriginFilter((curr) => (curr === orig ? "ALL" : orig));
                            }}
                            shape={(props: unknown) => (
                              <HorizontalBar3DShape
                                {...(props as Bar3DProps)}
                                gradId="grad3dWbStation"
                                sideColor="#1E3A8A"
                                topColor="#93C5FD"
                              />
                            )}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                      {pick(
                        "Top Vols KP par Volume & Taux WB (%)",
                        "Top KP Flights by WB Volume & Rate (%)"
                      )}
                    </h5>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={webCheckinTopFlightsData}
                          margin={{ top: 14, right: 14, left: -12, bottom: 8 }}
                        >
                          <defs>
                            <linearGradient id="grad3dWbFlt" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366F1" />
                              <stop offset="100%" stopColor="#1D4ED8" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis
                            dataKey="name"
                            interval={0}
                            angle={webCheckinTopFlightsData.length > 7 ? -25 : 0}
                            textAnchor={webCheckinTopFlightsData.length > 7 ? "end" : "middle"}
                            height={webCheckinTopFlightsData.length > 7 ? 42 : 28}
                            tick={{ fill: axisTickColor, fontSize: 10, fontFamily: "monospace" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="pax"
                            tick={{ fill: axisTickColor, fontSize: 10, fontFamily: "monospace" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="rate"
                            orientation="right"
                            domain={[0, 100]}
                            unit="%"
                            tick={{ fill: CHART_COLORS.loadFactor, fontSize: 10, fontFamily: "monospace" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar
                            yAxisId="pax"
                            dataKey="webCheckinCount"
                            name={pick("Check-in WB", "WB Check-in")}
                            maxBarSize={28}
                            shape={(props: unknown) => (
                              <IsometricBar3DShape
                                {...(props as Bar3DProps)}
                                gradId="grad3dWbFlt"
                                sideColor="#1E1B4B"
                                topColor="#93C5FD"
                                showShadow
                              />
                            )}
                          />
                          <Line
                            yAxisId="rate"
                            type="monotone"
                            dataKey="webCheckinRatePct"
                            name={pick("Taux WB (%)", "WB Rate (%)")}
                            stroke={CHART_COLORS.loadFactor}
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: CHART_COLORS.loadFactor }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Table: ONLY in WEB_CHECKIN detail lens (never in Global View) */}
              {biLens === "WEB_CHECKIN" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <WebCheckinBadge size="md" />
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          {pick(
                            `Détail des Enregistrements En Ligne (${kpis.webCheckinTotal.toLocaleString(locale)} WB · ${kpis.webCheckinRatePct}%)`,
                            `Online Check-in Breakdown (${kpis.webCheckinTotal.toLocaleString(locale)} WB · ${kpis.webCheckinRatePct}%)`
                          )}
                        </h4>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setWebCheckinTableMode("BY_ORIGIN")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            webCheckinTableMode === "BY_ORIGIN"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {pick(`Escales (${filteredWbStations.length})`, `Stations (${filteredWbStations.length})`)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebCheckinTableMode("BY_FLIGHT")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            webCheckinTableMode === "BY_FLIGHT"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {pick(`N° Vol (${filteredWbFlights.length})`, `Flights (${filteredWbFlights.length})`)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebCheckinTableMode("BY_SEGMENT")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            webCheckinTableMode === "BY_SEGMENT"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {pick(`Tronçons (${filteredWbSegments.length})`, `Segments (${filteredWbSegments.length})`)}
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={webCheckinSearch}
                          onChange={(e) => setWebCheckinSearch(e.target.value)}
                          placeholder={pick("Escale, vol, date...", "Station, flight, date...")}
                          className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-52"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    {webCheckinTableMode === "BY_ORIGIN" ? (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">{pick("Escale", "Station")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Vols", "Flights")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Pax Transportés", "Traveled Pax")}</th>
                            <th className="py-2.5 px-3 text-right">
                              {pick("Check-in Web (WB)", "Web Check-in (WB)")} ·{" "}
                              {kpis.webCheckinTotal} WB
                            </th>
                            <th className="py-2.5 px-3 text-right">{pick("Comptoir", "Counter")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Taux WB (%)", "WB Rate (%)")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Éco Y WB", "Eco Y WB")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Biz C WB", "Biz C WB")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Avec Bag.", "w/ Bags")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                          {filteredWbStations.map((st) => (
                            <tr
                              key={st.origin}
                              className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                            >
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                                {st.origin}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {st.segmentsCount}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-200">
                                {st.traveledTotal.toLocaleString(locale)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                <span className="inline-flex items-center gap-1.5">
                                  <WebCheckinBadge size="xs" />
                                  {st.webCheckinCount.toLocaleString(locale)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {st.airportCount.toLocaleString(locale)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {st.webCheckinRatePct}%
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                {st.ecoWb} ({st.ecoRatePct}%)
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                {st.bizWb} ({st.bizRatePct}%)
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {st.withBagsCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : webCheckinTableMode === "BY_FLIGHT" ? (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">{pick("Vol", "Flight")}</th>
                            <th className="py-2.5 px-3">{pick("Origines", "Origins")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Vols", "Segs")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Pax Transportés", "Traveled Pax")}</th>
                            <th className="py-2.5 px-3 text-right">
                              {pick("Check-in Web (WB)", "Web Check-in (WB)")} ·{" "}
                              {kpis.webCheckinTotal} WB
                            </th>
                            <th className="py-2.5 px-3 text-right">{pick("Comptoir", "Counter")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Taux WB (%)", "WB Rate (%)")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                          {filteredWbFlights.map((fg) => (
                            <tr
                              key={fg.flightNumber}
                              className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                            >
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                                {fg.airline}
                                {fg.flightNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                {fg.origins.join(", ")}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {fg.segmentsCount}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-200">
                                {fg.traveledTotal.toLocaleString(locale)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                <span className="inline-flex items-center gap-1.5">
                                  <WebCheckinBadge size="xs" />
                                  {fg.webCheckinCount.toLocaleString(locale)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {fg.airportCheckinCount.toLocaleString(locale)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {fg.webCheckinRatePct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">{pick("Date", "Date")}</th>
                            <th className="py-2.5 px-3">{pick("Vol", "Flight")}</th>
                            <th className="py-2.5 px-3">{pick("Tronçon", "Sector")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Pax", "Pax")}</th>
                            <th className="py-2.5 px-3 text-right">
                              {pick("Check-in Web (WB)", "Web Check-in (WB)")} ·{" "}
                              {kpis.webCheckinTotal} WB
                            </th>
                            <th className="py-2.5 px-3 text-right">{pick("Comptoir", "Counter")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Taux WB (%)", "WB Rate (%)")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Y / C WB", "Y / C WB")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Bag. WB", "WB Bags")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                          {filteredWbSegments.map((seg) => (
                            <tr
                              key={seg.flight.id}
                              className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                            >
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                {seg.dateKey}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                                {seg.flight.airline}
                                {seg.cleanFlightNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                {seg.flight.origin} → {seg.physicalDestination || seg.flight.primaryDestination}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-200">
                                {seg.traveledTotal}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                <span className="inline-flex items-center gap-1.5">
                                  <WebCheckinBadge size="xs" />
                                  {seg.webCheckinCount}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {seg.airportCheckinCount}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {seg.webCheckinRatePct}%
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {seg.webCheckinEco}Y / {seg.webCheckinBiz}C
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {seg.webCheckinWithBagsCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dedicated Baggage & Compliance Module */}
          {(biLens === "ALL" || biLens === "BAGGAGE") && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "Charge Bagages Quotidienne (kg) & Poids Moyen / Passager",
                      "Daily Baggage Payload (kg) & Avg Weight / Passenger"
                    )}
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={analytics.dailySeries}
                        margin={{ top: 14, right: 16, left: -6, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="grad3dTeal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2DD4BF" />
                            <stop offset="100%" stopColor="#0F766E" />
                          </linearGradient>
                        </defs>
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
                          yAxisId="kg"
                          tick={{
                            fill: axisTickColor,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="avg"
                          orientation="right"
                          unit="kg"
                          tick={{
                            fill: CHART_COLORS.forecast,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar
                          yAxisId="kg"
                          dataKey="totalWeight"
                          name={pick("Poids Total (kg)", "Total Weight (kg)")}
                          fill={CHART_COLORS.teal}
                          maxBarSize={34}
                          shape={(props: unknown) => (
                            <IsometricBar3DShape
                              {...(props as Bar3DProps)}
                              gradId="grad3dTeal"
                              sideColor="#115E59"
                              topColor="#5EEAD4"
                              showShadow
                            />
                          )}
                        />
                        <Line
                          yAxisId="avg"
                          type="monotone"
                          dataKey="avgWeightPerPax"
                          name={pick("Moy. kg/pax", "Avg kg/pax")}
                          stroke={CHART_COLORS.forecast}
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: CHART_COLORS.forecast }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "Conformité Bagages, EMD & Poids Manquants",
                      "Baggage Compliance, EMD Coverage & Missing Weights"
                    )}
                  </h4>
                  <Donut3DChart
                    data={baggageCompliancePieData}
                    centerValue={`${kpis.deviationRatePct}%`}
                    centerLabel={pick("Taux écart", "Deviation")}
                    heightClass="min-h-[256px]"
                  />
                </div>
              </div>

              {/* Dedicated Baggage Audit Table (Detail Lens Only — hidden in Global View) */}
              {biLens === "BAGGAGE" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {pick("Audit Bagages par Vol", "Baggage Audit by Flight")}
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setBaggageOnlyIssues(false)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          !baggageOnlyIssues
                            ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {pick("Tous les vols", "All flights")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBaggageOnlyIssues(true)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          baggageOnlyIssues
                            ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {pick("Écarts / Poids manq.", "Deviations / Missing")}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={baggageSearch}
                        onChange={(e) => setBaggageSearch(e.target.value)}
                        placeholder={pick("Vol, escale, immat...", "Flight, station, reg...")}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 w-44 sm:w-52"
                      />
                    </div>
                  </div>
                </div>

                {filteredBaggageSegments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {pick(
                      "Aucun vol correspondant à ce filtre bagages.",
                      "No flights match this baggage filter."
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">{pick("Date", "Date")}</th>
                          <th className="py-2.5 px-3">{pick("Vol", "Flight")}</th>
                          <th className="py-2.5 px-3">{pick("Tronçon", "Sector")}</th>
                          <th className="py-2.5 px-3 text-right">{pick("Pax", "Pax")}</th>
                          <th className="py-2.5 px-3 text-right">{pick("Bagages", "Bags")}</th>
                          <th className="py-2.5 px-3 text-right">{pick("Poids (kg)", "Weight (kg)")}</th>
                          <th className="py-2.5 px-3 text-right">{pick("Moy. kg/pax", "Avg kg/pax")}</th>
                          <th className="py-2.5 px-3 text-right">EMD</th>
                          <th className="py-2.5 px-3 text-right">{pick("Écarts Non Couv.", "Uncov. Dev.")}</th>
                          <th className="py-2.5 px-3 text-right">{pick("Poids Manq.", "Missing Wt")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                        {filteredBaggageSegments.map((seg) => {
                          const avgKg =
                            seg.traveledTotal > 0
                              ? (seg.totalWeight / seg.traveledTotal).toFixed(1)
                              : "0.0";
                          return (
                            <tr
                              key={seg.flight.id}
                              className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors"
                            >
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                {seg.dateKey}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                                {seg.flight.airline}
                                {seg.cleanFlightNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                {seg.flight.origin} → {seg.flight.primaryDestination}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                {seg.traveledTotal}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                {seg.bagsCount}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-teal-600 dark:text-teal-400">
                                {Math.round(seg.totalWeight).toLocaleString(locale)}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                {avgKg}
                              </td>
                              <td className="py-2 px-3 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                                {seg.flight.emdCount}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {seg.flight.baggageUncoveredDeviationsCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                                    {seg.flight.baggageUncoveredDeviationsCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {(seg.flight.baggageMissingWeightCount || 0) > 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                                    {seg.flight.baggageMissingWeightCount || 0}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                </div>
              )}
            </>
          )}

          {/* Dedicated No-Show & Integrity Module */}
          {(biLens === "ALL" || biLens === "NOSHOW") && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "Transportés vs No-Show / Sans Siège",
                      "Traveled vs No-Show / Unseated"
                    )}
                  </h4>
                  <Donut3DChart
                    data={seatStatusPieData}
                    centerValue={`${kpis.noShowRatePct}%`}
                    centerLabel="No-Show"
                    heightClass="min-h-[240px]"
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-rose-500" />
                    {pick(
                      "Évolution Quotidienne des No-Show & Taux (%)",
                      "Daily No-Show Trend & Rate (%)"
                    )}
                  </h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={analytics.dailySeries}
                        margin={{ top: 14, right: 16, left: -10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="grad3dNoShow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FB7185" />
                            <stop offset="100%" stopColor="#BE123C" />
                          </linearGradient>
                        </defs>
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
                          yAxisId="count"
                          tick={{
                            fill: axisTickColor,
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="rate"
                          orientation="right"
                          unit="%"
                          tick={{
                            fill: CHART_COLORS.forecast,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar
                          yAxisId="count"
                          dataKey="noShowCount"
                          name={pick("Passagers No-Show", "No-Show Pax")}
                          fill={CHART_COLORS.noShow}
                          maxBarSize={34}
                          shape={(props: unknown) => (
                            <IsometricBar3DShape
                              {...(props as Bar3DProps)}
                              gradId="grad3dNoShow"
                              sideColor="#881337"
                              topColor="#FDA4AF"
                              showShadow
                            />
                          )}
                        />
                        <Line
                          yAxisId="rate"
                          type="monotone"
                          dataKey="noShowRatePct"
                          name={pick("Taux No-Show (%)", "No-Show Rate (%)")}
                          stroke={CHART_COLORS.forecast}
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: CHART_COLORS.forecast }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {pick(
                      "No-Show par N° de Vol (Volume & Taux %)",
                      "No-Show by Flight # (Volume & Rate %)"
                    )}
                  </h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={analytics.flightNumberGroups
                          .filter((fg) => fg.noShowTotal > 0)
                          .sort((a, b) => b.noShowTotal - a.noShowTotal)
                          .slice(0, 10)
                          .map((fg) => ({
                            name: `KP${fg.flightNumber}`,
                            noShowTotal: fg.noShowTotal,
                            noShowRatePct: fg.noShowRatePct,
                          }))}
                        margin={{ top: 14, right: 16, left: -10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="grad3dNoShowFlight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FB7185" />
                            <stop offset="100%" stopColor="#BE123C" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: axisTickColor,
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="count"
                          tick={{
                            fill: axisTickColor,
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="rate"
                          orientation="right"
                          unit="%"
                          tick={{
                            fill: CHART_COLORS.forecast,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar
                          yAxisId="count"
                          dataKey="noShowTotal"
                          name="No-Show"
                          fill={CHART_COLORS.noShow}
                          maxBarSize={32}
                          shape={(props: unknown) => (
                            <IsometricBar3DShape
                              {...(props as Bar3DProps)}
                              gradId="grad3dNoShowFlight"
                              sideColor="#881337"
                              topColor="#FDA4AF"
                              showShadow
                            />
                          )}
                        />
                        <Line
                          yAxisId="rate"
                          type="monotone"
                          dataKey="noShowRatePct"
                          name={pick("Taux (%)", "Rate (%)")}
                          stroke={CHART_COLORS.forecast}
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: CHART_COLORS.forecast }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Dedicated Rapport No-Show Section (Detail Lens Only — hidden in Global View) */}
              {biLens === "NOSHOW" && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
                      <UserX className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {pick("Rapport No-Show", "No-Show Report")}
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setNoShowViewMode("FLIGHTS")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          noShowViewMode === "FLIGHTS"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {pick(
                          `Par Vol (${filteredNoShowFlights.length})`,
                          `By Flight (${filteredNoShowFlights.length})`
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoShowViewMode("PASSENGERS")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          noShowViewMode === "PASSENGERS"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {pick(
                          `Passagers (${filteredNoShowPassengers.length})`,
                          `Passengers (${filteredNoShowPassengers.length})`
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={noShowSearch}
                        onChange={(e) => setNoShowSearch(e.target.value)}
                        placeholder={pick("Nom, vol, billet...", "Name, flight, ticket...")}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 w-44 sm:w-52"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExportNoShow("PDF")}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportNoShow("EXCEL")}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportNoShow("CSV")}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {noShowViewMode === "FLIGHTS" ? (
                  filteredNoShowFlights.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      {pick("Aucun No-Show détecté pour ce périmètre.", "No No-Show detected in this scope.")}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">{pick("Date", "Date")}</th>
                            <th className="py-2.5 px-3">{pick("Vol", "Flight")}</th>
                            <th className="py-2.5 px-3">{pick("Tronçon", "Sector")}</th>
                            <th className="py-2.5 px-3">{pick("Appareil", "Aircraft")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Voyagés", "Traveled")}</th>
                            <th className="py-2.5 px-3 text-right">No-Show</th>
                            <th className="py-2.5 px-3 text-right">{pick("Éco / Biz", "Y / C")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("En liste", "Listed")}</th>
                            <th className="py-2.5 px-3 text-right">{pick("Taux %", "Rate %")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                          {filteredNoShowFlights.map((row) => (
                            <tr
                              key={row.flightId}
                              className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors"
                            >
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.dateKey}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                                {row.flightLabel}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                {row.origin} → {row.destination}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                {row.registration
                                  ? `${row.aircraftType}/${row.registration}`
                                  : row.aircraftType || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                                {row.traveledTotal}
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-rose-600 dark:text-rose-400">
                                {row.noShowTotal}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                {row.noShowEco}Y / {row.noShowBiz}C
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                {row.listedTotal}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                                  {row.noShowRatePct}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : filteredNoShowPassengers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {pick("Aucun passager No-Show trouvé.", "No No-Show passenger found.")}
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">{pick("Date", "Date")}</th>
                          <th className="py-2.5 px-3">{pick("Vol", "Flight")}</th>
                          <th className="py-2.5 px-3">{pick("Tronçon", "Sector")}</th>
                          <th className="py-2.5 px-3">{pick("Ordre", "Seq")}</th>
                          <th className="py-2.5 px-3">{pick("Passager", "Passenger")}</th>
                          <th className="py-2.5 px-3">{pick("Cabine", "Cabin")}</th>
                          <th className="py-2.5 px-3">{pick("Type", "Type")}</th>
                          <th className="py-2.5 px-3">{pick("N° Billet", "Ticket No.")}</th>
                          <th className="py-2.5 px-3">{pick("Codes", "Codes")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                        {filteredNoShowPassengers.map((p) => (
                          <tr
                            key={`${p.flightId}-${p.paxId}`}
                            className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors"
                          >
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{p.dateKey}</td>
                            <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                              {p.flightLabel}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              {p.origin} → {p.destination}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400">#{p.seqLabel}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">
                              {p.fullNameDisplay}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              {p.cabinClass} ({p.bookingClass})
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                              {p.genderOrType}
                              {p.hasInfant ? "+INF" : ""}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              {p.ticketNumber || "—"}
                              {p.ticketStatus ? ` (${p.ticketStatus})` : ""}
                            </td>
                            <td className="py-2 px-3 text-amber-700 dark:text-amber-400">
                              {p.editCodes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </div>
              )}
            </>
          )}

          {(biLens === "FLEET" || biLens === "TRAFFIC") && (
            <FlightBiMatrices
              flightNumberGroups={analytics.flightNumberGroups}
              tailUtilization={analytics.tailUtilization}
              aircraftTimeUtilization={analytics.aircraftTimeUtilization}
              sectorPerformance={analytics.sectorPerformance}
              visibleTab={
                biLens === "FLEET"
                  ? "FLEET"
                  : biLens === "TRAFFIC"
                  ? "SECTORS"
                  : undefined
              }
              activeFlightFilter={flightFilter}
              activeAircraftFilter={aircraftFilter}
              onSelectFlight={setFlightFilter}
              onSelectAircraft={setAircraftFilter}
            />
          )}

          {biLens === "ALL" && Object.keys(emdDetailsMap).length > 0 && (
            <EmdAnalyticsModule
              flights={scopedFlights}
              emdDetailsMap={emdDetailsMap}
              onImportEmdDetails={handleImportEmdDetails}
              onClearEmdDetails={handleClearEmdDetails}
              scopeLabel={dateFilter !== "ALL" ? dateFilter : periodStart || "Global"}
              chartsOnly
            />
          )}

          {biLens === "EMD" && (
            <EmdAnalyticsModule
              flights={scopedFlights}
              emdDetailsMap={emdDetailsMap}
              onImportEmdDetails={handleImportEmdDetails}
              onClearEmdDetails={handleClearEmdDetails}
              scopeLabel={dateFilter !== "ALL" ? dateFilter : periodStart || "Global"}
            />
          )}
        </div>
      )}
    </div>
  );
};
