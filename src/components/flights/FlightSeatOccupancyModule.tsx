/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Armchair, Layers, MoveHorizontal, MoveVertical, Plane } from "lucide-react";
import { SeatOccupancyAnalytics } from "../../utils/flightAnalytics";
import { useLanguage } from "../../context/LanguageContext";
import { Donut3DChart, Donut3DSlice } from "../ui/Donut3DChart";

interface FlightSeatOccupancyModuleProps {
  seatOccupancy: SeatOccupancyAnalytics;
}

type SeatCabinFilter = "ALL" | "Y" | "C";
type CabinOrientation = "HORIZONTAL" | "VERTICAL";

const POSITION_COLORS: Record<string, string> = {
  WINDOW: "#0EA5E9",
  AISLE: "#6366F1",
  MIDDLE: "#F59E0B",
  OTHER: "#94A3B8",
};

const ZONE_COLORS: Record<string, string> = {
  ZONE_A: "#8B5CF6",
  ZONE_B: "#4F46E5",
  ZONE_C: "#10B981",
};

type OccupancyLevel = 1 | 2 | 3 | 4;

/**
 * 4-color occupancy scale ordered strictly from least occupied to most occupied:
 * 1 = Rouge (0-25%), 2 = Jaune (26-50%), 3 = Orange (51-75%), 4 = Vert (76-100%)
 */
function getOccupancyLevel(count: number, maxCount: number): OccupancyLevel {
  if (count <= 0 || maxCount <= 0) return 1;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function getSeatColorStyle(count: number, maxCount: number) {
  const level = getOccupancyLevel(count, maxCount);
  if (level === 1) {
    if (count === 0) {
      return {
        level,
        seatClass:
          "bg-red-100/95 dark:bg-red-950/70 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300",
        dotClass: "bg-red-500",
      };
    }
    return {
      level,
      seatClass:
        "bg-gradient-to-b from-red-500 to-red-600 border-red-700 dark:border-red-400 text-white shadow-xs shadow-red-500/25",
      dotClass: "bg-red-500",
    };
  }
  if (level === 2) {
    return {
      level,
      seatClass:
        "bg-gradient-to-b from-yellow-300 to-yellow-400 border-yellow-500 dark:border-yellow-300 text-slate-950 shadow-xs shadow-yellow-400/25",
      dotClass: "bg-yellow-400",
    };
  }
  if (level === 3) {
    return {
      level,
      seatClass:
        "bg-gradient-to-b from-orange-400 to-orange-500 border-orange-600 dark:border-orange-300 text-white shadow-xs shadow-orange-500/25",
      dotClass: "bg-orange-500",
    };
  }
  return {
    level,
    seatClass:
      "bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-700 dark:border-emerald-400 text-white shadow-xs shadow-emerald-500/30",
    dotClass: "bg-emerald-500",
  };
}

export const FlightSeatOccupancyModule: React.FC<FlightSeatOccupancyModuleProps> = ({
  seatOccupancy,
}) => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const pick = (fr: string, en: string) => (isFr ? fr : en);
  const locale = isFr ? "fr-FR" : "en-US";

  const [cabinFilter, setCabinFilter] = useState<SeatCabinFilter>("ALL");
  const [orientation, setOrientation] = useState<CabinOrientation>("HORIZONTAL");
  const [hoveredSeat, setHoveredSeat] = useState<{
    seat: string;
    total: number;
    eco: number;
    biz: number;
  } | null>(null);
  const [pinnedSeat, setPinnedSeat] = useState<{
    seat: string;
    total: number;
    eco: number;
    biz: number;
  } | null>(null);

  const activeTotal = useMemo(() => {
    if (cabinFilter === "Y") return seatOccupancy.totalEcoSeated;
    if (cabinFilter === "C") return seatOccupancy.totalBizSeated;
    return seatOccupancy.totalSeatedPax;
  }, [cabinFilter, seatOccupancy]);

  const positionPieData = useMemo<Donut3DSlice[]>(() => {
    return seatOccupancy.positionBreakdown
      .map((p) => ({
        name: isFr ? p.labelFr : p.labelEn,
        value: cabinFilter === "Y" ? p.eco : cabinFilter === "C" ? p.biz : p.total,
        color: POSITION_COLORS[p.position] || "#64748B",
      }))
      .filter((s) => s.value > 0);
  }, [seatOccupancy.positionBreakdown, cabinFilter, isFr]);

  const zonePieData = useMemo<Donut3DSlice[]>(() => {
    return seatOccupancy.zoneBreakdown
      .map((z) => ({
        name: isFr ? z.labelFr : z.labelEn,
        value: cabinFilter === "Y" ? z.eco : cabinFilter === "C" ? z.biz : z.total,
        color: ZONE_COLORS[z.zone] || "#6366F1",
      }))
      .filter((s) => s.value > 0);
  }, [seatOccupancy.zoneBreakdown, cabinFilter, isFr]);

  // Build actual aircraft seat columns: A B C | Couloir | J K L (or D E F only if actually present in data)
  const cabinColumns = useMemo(() => {
    const present = new Set(seatOccupancy.columns);
    const hasDEF = present.has("D") || present.has("E") || present.has("F");
    const hasJKL = present.has("J") || present.has("K") || present.has("L");

    const leftCols = ["A", "B", "C"];
    let rightCols: string[];

    if (hasDEF && !hasJKL) {
      rightCols = ["D", "E", "F"];
    } else if (hasDEF && hasJKL) {
      rightCols = ["D", "E", "F", "G", "H", "J", "K", "L"].filter((c) => present.has(c));
    } else {
      rightCols = ["J", "K", "L"];
    }

    // Add any unexpected extra columns observed in data
    for (const c of seatOccupancy.columns) {
      if (!leftCols.includes(c) && !rightCols.includes(c)) {
        rightCols.push(c);
      }
    }

    return {
      leftCols,
      rightCols,
      allCols: [...leftCols, ...rightCols],
    };
  }, [seatOccupancy.columns]);

  // Lookup rowNum -> HeatmapRow
  const rowMap = useMemo(() => {
    const map = new Map<number, (typeof seatOccupancy.rowHeatmap)[number]>();
    for (const r of seatOccupancy.rowHeatmap) {
      map.set(r.row, r);
    }
    return map;
  }, [seatOccupancy.rowHeatmap]);

  // Aircraft rows: Business 1..4 (no rows 5..10 unless present in data), Economy 11..maxRow
  const { bizRows, ecoRows } = useMemo(() => {
    const maxRow = Math.max(seatOccupancy.maxRowOccupied || 36, 12);
    const biz: number[] = [];
    const eco: number[] = [];
    for (let r = 1; r <= 4; r++) {
      biz.push(r);
    }
    // Include rows 5..10 ONLY if actual manifest data contains them
    for (let r = 5; r <= 10; r++) {
      if (rowMap.has(r)) biz.push(r);
    }
    for (let r = 11; r <= maxRow; r++) {
      eco.push(r);
    }
    return {
      bizRows: cabinFilter === "Y" ? [] : biz,
      ecoRows: cabinFilter === "C" ? [] : eco,
    };
  }, [seatOccupancy.maxRowOccupied, cabinFilter, rowMap]);

  const maxCellCount = useMemo(() => {
    let max = 1;
    for (const r of seatOccupancy.rowHeatmap) {
      for (const col of cabinColumns.allCols) {
        const cell = r.cols[col];
        if (!cell) continue;
        const val =
          cabinFilter === "Y" ? cell.eco : cabinFilter === "C" ? cell.biz : cell.total;
        if (val > max) max = val;
      }
    }
    return max;
  }, [seatOccupancy.rowHeatmap, cabinColumns.allCols, cabinFilter]);

  const levelThresholds = useMemo(() => {
    const t1 = Math.floor(maxCellCount * 0.25);
    const t2 = Math.floor(maxCellCount * 0.5);
    const t3 = Math.floor(maxCellCount * 0.75);
    return { t1, t2, t3, max: maxCellCount };
  }, [maxCellCount]);

  const topSeatsFiltered = useMemo(() => {
    const items: Array<{ seat: string; total: number; eco: number; biz: number; count: number }> = [];
    for (const r of seatOccupancy.rowHeatmap) {
      for (const col of seatOccupancy.columns) {
        const cell = r.cols[col];
        if (!cell) continue;
        const count =
          cabinFilter === "Y" ? cell.eco : cabinFilter === "C" ? cell.biz : cell.total;
        if (count > 0) {
          items.push({
            seat: `${r.row}${col}`,
            total: cell.total,
            eco: cell.eco,
            biz: cell.biz,
            count,
          });
        }
      }
    }
    return items.sort((a, b) => b.count - a.count).slice(0, 14);
  }, [seatOccupancy.rowHeatmap, seatOccupancy.columns, cabinFilter]);

  const activeSeatInfo = hoveredSeat || pinnedSeat;

  const renderSeatButton = (rowNum: number, col: string, compact = true) => {
    const rowData = rowMap.get(rowNum);
    const cell = rowData?.cols[col];
    const count = cell
      ? cabinFilter === "Y"
        ? cell.eco
        : cabinFilter === "C"
          ? cell.biz
          : cell.total
      : 0;
    const seatCode = `${rowNum}${col}`;
    const isPinned = pinnedSeat?.seat === seatCode;
    const { seatClass } = getSeatColorStyle(count, maxCellCount);

    const payload = cell
      ? { seat: seatCode, total: cell.total, eco: cell.eco, biz: cell.biz }
      : { seat: seatCode, total: 0, eco: 0, biz: 0 };

    return (
      <button
        key={seatCode}
        type="button"
        onMouseEnter={() => setHoveredSeat(payload)}
        onMouseLeave={() => setHoveredSeat(null)}
        onClick={() =>
          setPinnedSeat((curr) => (curr?.seat === seatCode ? null : payload))
        }
        title={`${pick("Siège", "Seat")} ${seatCode} · ${count} pax`}
        className={`relative flex items-center justify-center rounded border font-mono font-extrabold leading-none transition-transform cursor-pointer select-none tabular-nums ${
          compact ? "w-6 h-6 text-[9px]" : "w-8 h-7 sm:w-9 sm:h-7 text-[10px]"
        } ${seatClass} ${
          isPinned
            ? "ring-2 ring-slate-900 dark:ring-white scale-110 z-10"
            : "hover:scale-110 hover:z-10"
        }`}
      >
        {count}
      </button>
    );
  };

  if (seatOccupancy.totalSeatedPax === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
        <Armchair className="w-7 h-7 text-slate-400 mx-auto" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {pick(
            "Aucun numéro de siège attribué dans le périmètre filtré",
            "No assigned seat numbers found in the current filter"
          )}
        </p>
      </div>
    );
  }

  // Starboard top rows (L -> K -> J) and Port bottom rows (C -> B -> A) for horizontal view
  const topStarboardCols = [...cabinColumns.rightCols].reverse();
  const bottomPortCols = [...cabinColumns.leftCols].reverse();
  const bizMaxDisplay = bizRows.length > 0 ? bizRows[bizRows.length - 1] : 4;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5">
      {/* Header + Cabin Filter + Orientation Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
            <Armchair className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {pick(
                "Analyse de l'Occupation des Sièges & Plan Cabine Avion",
                "Seat Occupancy & Aircraft Cabin Map"
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {pick("Rangée moy.", "Avg row")}: {seatOccupancy.avgRowOccupied} ·{" "}
              Business 1–{bizMaxDisplay} · Éco 11–{Math.max(seatOccupancy.maxRowOccupied, 12)} ·{" "}
              {cabinColumns.leftCols.join("")} | {cabinColumns.rightCols.join("")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Local Cabin Filter */}
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            {(
              [
                { id: "ALL", label: pick("Avion Complet", "Full Aircraft") },
                { id: "C", label: `Business (1–${bizMaxDisplay})` },
                { id: "Y", label: pick("Éco (11+)", "Eco (11+)") },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCabinFilter(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  cabinFilter === opt.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Aircraft Orientation Switcher */}
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setOrientation("HORIZONTAL")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                orientation === "HORIZONTAL"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title={pick("Tout afficher en largeur", "Full horizontal cabin view")}
            >
              <MoveHorizontal className="w-3.5 h-3.5" />
              {pick("Plan Écran", "Full Screen")}
            </button>
            <button
              type="button"
              onClick={() => setOrientation("VERTICAL")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                orientation === "VERTICAL"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
              title={pick("Vue verticale complète", "Full vertical cabin view")}
            >
              <MoveVertical className="w-3.5 h-3.5" />
              {pick("Verticale", "Vertical")}
            </button>
          </div>
        </div>
      </div>

      {/* 3D Solid Pie Charts: Positions (Window / Aisle / Middle) & Zones (Zone A / Zone B / Zone C) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {pick("Position sur Rangée", "Seat Position Mix")}
            </h5>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {activeTotal.toLocaleString(locale)} {pick("sièges", "seats")}
            </span>
          </div>
          <Donut3DChart
            variant="pie"
            data={positionPieData}
            legendLayout="right"
            heightClass="min-h-[220px]"
          />
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              {pick("Répartition par Zone Cabine", "Cabin Zone Distribution")}
            </h5>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {seatOccupancy.rowHeatmap.length} {pick("rangées actives", "active rows")}
            </span>
          </div>
          <Donut3DChart
            variant="pie"
            data={zonePieData}
            legendLayout="right"
            heightClass="min-h-[220px]"
          />
        </div>
      </div>

      {/* FULL-WIDTH AIRCRAFT CABIN PLAN (ZERO CLIPPING / ALL ROWS ON SCREEN) */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-sky-500" />
            {pick(
              "Plan Cabine Complet — Densité d'Occupation par Rangée & Siège",
              "Full Aircraft Cabin Plan — Row & Seat Occupancy Density"
            )}
          </h5>
          {activeSeatInfo ? (
            <div className="text-xs font-mono font-bold text-indigo-600 dark:text-amber-400 tabular-nums">
              {pick("Siège", "Seat")} {activeSeatInfo.seat} : {activeSeatInfo.total} pax ({activeSeatInfo.eco}Y /{" "}
              {activeSeatInfo.biz}C)
            </div>
          ) : (
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {pick(
                `${cabinColumns.leftCols.join(" ")} | Couloir | ${cabinColumns.rightCols.join(" ")} · Survoler ou cliquer un siège`,
                `${cabinColumns.leftCols.join(" ")} | Aisle | ${cabinColumns.rightCols.join(" ")} · Hover or click any seat`
              )}
            </div>
          )}
        </div>

        {/* 4-Color Occupancy Legend: Rouge -> Jaune -> Orange -> Vert */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-mono">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[10px]">
              {pick("Niveau d'occupation :", "Occupancy level:")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="w-3.5 h-3.5 rounded bg-red-500 border border-red-700 inline-block" />
              <strong>{pick("Rouge", "Red")}</strong>
              <span className="text-slate-500 dark:text-slate-400">
                ({pick("Moins occupé", "Lowest")} · 0–{levelThresholds.t1} pax)
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="w-3.5 h-3.5 rounded bg-yellow-400 border border-yellow-600 inline-block" />
              <strong>{pick("Jaune", "Yellow")}</strong>
              <span className="text-slate-500 dark:text-slate-400">
                ({levelThresholds.t1 + 1}–{Math.max(levelThresholds.t1 + 1, levelThresholds.t2)} pax)
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="w-3.5 h-3.5 rounded bg-orange-500 border border-orange-700 inline-block" />
              <strong>{pick("Orange", "Orange")}</strong>
              <span className="text-slate-500 dark:text-slate-400">
                ({levelThresholds.t2 + 1}–{Math.max(levelThresholds.t2 + 1, levelThresholds.t3)} pax)
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-800 inline-block" />
              <strong>{pick("Vert", "Green")}</strong>
              <span className="text-slate-500 dark:text-slate-400">
                ({pick("Plus occupé", "Highest")} · {Math.max(levelThresholds.t3 + 1, 1)}–{levelThresholds.max} pax)
              </span>
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {pick("Max :", "Peak:")} {maxCellCount} pax/{pick("siège", "seat")}
          </span>
        </div>

        {/* HORIZONTAL FULL-SCREEN AIRCRAFT FUSELAGE (Default) */}
        {orientation === "HORIZONTAL" ? (
          <div className="w-full overflow-x-auto pb-1">
            <div className="min-w-max mx-auto flex items-center justify-center py-6 px-2">
              {/* Left Aircraft Nose Cone SVG */}
              <div className="shrink-0 flex items-center">
                <svg
                  viewBox="0 0 88 228"
                  className="w-[74px] h-[228px] overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="horizNoseGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(148,163,184,0.28)" />
                      <stop offset="100%" stopColor="rgba(148,163,184,0.10)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 88,4 C 42,4 6,62 6,114 C 6,166 42,224 88,224 Z"
                    fill="url(#horizNoseGrad)"
                    stroke="rgba(100,116,139,0.55)"
                    strokeWidth="2"
                  />
                  {/* Cockpit Windshields */}
                  <path
                    d="M 46,70 L 30,111 L 52,111 L 58,68 Z"
                    fill="#1E293B"
                    stroke="#38BDF8"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M 46,158 L 30,117 L 52,117 L 58,160 Z"
                    fill="#1E293B"
                    stroke="#38BDF8"
                    strokeWidth="1.2"
                  />
                  {/* Front Exit Doors */}
                  <rect x="68" y="8" width="14" height="9" rx="2" fill="#F59E0B" opacity="0.85" />
                  <rect x="68" y="211" width="14" height="9" rx="2" fill="#F59E0B" opacity="0.85" />
                  <text
                    x="62"
                    y="114"
                    textAnchor="middle"
                    transform="rotate(-90 62 114)"
                    className="fill-slate-600 dark:fill-slate-300 font-mono font-bold"
                    style={{ fontSize: "8px", letterSpacing: "0.14em" }}
                  >
                    COCKPIT
                  </text>
                </svg>
              </div>

              {/* Cylindrical Main Horizontal Fuselage */}
              <div className="relative border-y-2 border-slate-400/60 dark:border-slate-600/75 bg-white dark:bg-slate-900 px-2.5 py-2.5 flex items-stretch gap-2 shadow-inner">
                {/* Subtle Top & Bottom Swept Wings aligned under mid-fuselage */}
                <div
                  className="hidden md:block absolute left-[42%] -top-7 w-40 h-7 border-t border-x border-slate-400/45 dark:border-slate-600/60 bg-slate-200/45 dark:bg-slate-800/50 skew-x-12 rounded-t-md pointer-events-none"
                  aria-hidden="true"
                />
                <div
                  className="hidden md:block absolute left-[42%] -bottom-7 w-40 h-7 border-b border-x border-slate-400/45 dark:border-slate-600/60 bg-slate-200/45 dark:bg-slate-800/50 -skew-x-12 rounded-b-md pointer-events-none"
                  aria-hidden="true"
                />

                {/* Fixed Left Column Letters Guide */}
                <div className="flex flex-col justify-between py-4 pr-1 border-r border-slate-200 dark:border-slate-700 font-mono text-[10px] font-extrabold text-slate-600 dark:text-slate-300 select-none">
                  <div className="flex flex-col gap-1">
                    {topStarboardCols.map((c) => (
                      <div key={`lbl-top-${c}`} className="h-6 w-4 flex items-center justify-center">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="h-5 flex items-center justify-center text-[8px] text-slate-400">
                    ══
                  </div>
                  <div className="flex flex-col gap-1">
                    {bottomPortCols.map((c) => (
                      <div key={`lbl-bot-${c}`} className="h-6 w-4 flex items-center justify-center">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                {/* BUSINESS SECTION: Rows 1..4 */}
                {bizRows.length > 0 && (
                  <div className="flex flex-col justify-between bg-violet-50/55 dark:bg-violet-950/25 border border-violet-200/80 dark:border-violet-800/60 rounded-lg px-2 py-1">
                    <div className="text-[9px] font-mono font-bold text-violet-800 dark:text-violet-300 text-center tracking-wider">
                      ZONE A · BUSINESS (1–{bizMaxDisplay})
                    </div>
                    <div className="flex items-stretch gap-1 my-1">
                      {bizRows.map((rowNum) => {
                        const rowData = rowMap.get(rowNum);
                        const rowTotal = rowData
                          ? cabinFilter === "C"
                            ? rowData.biz
                            : rowData.total
                          : 0;
                        return (
                          <div
                            key={`h-biz-${rowNum}`}
                            className="flex flex-col items-center gap-1"
                          >
                            {/* Top Side (L, K, J) */}
                            <div className="flex flex-col gap-1">
                              {topStarboardCols.map((col) => renderSeatButton(rowNum, col, true))}
                            </div>
                            {/* Horizontal Aisle with Row Number */}
                            <div className="h-5 w-6 flex items-center justify-center font-mono text-[9px] font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">
                              {String(rowNum).padStart(2, "0")}
                            </div>
                            {/* Bottom Side (C, B, A) */}
                            <div className="flex flex-col gap-1">
                              {bottomPortCols.map((col) => renderSeatButton(rowNum, col, true))}
                            </div>
                            <span className="text-[8px] font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                              {rowTotal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CABIN BULKHEAD / GALLEY DIVIDER (between Row 4 and Row 11 — No Rows 5–10) */}
                {bizRows.length > 0 && ecoRows.length > 0 && (
                  <div className="flex flex-col items-center justify-between py-1 px-0.5 select-none">
                    <span className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-mono text-[8px] font-bold">
                      EXIT
                    </span>
                    <div className="flex-1 w-0.5 bg-slate-300 dark:bg-slate-700 my-1" />
                    <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                      {pick("SÉP.", "BLK")}
                    </span>
                    <div className="flex-1 w-0.5 bg-slate-300 dark:bg-slate-700 my-1" />
                    <span className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-mono text-[8px] font-bold">
                      EXIT
                    </span>
                  </div>
                )}

                {/* ECONOMY SECTION: Zone B (11–29) + Zone C (30+) */}
                {ecoRows.length > 0 && (() => {
                  const zoneBRows = ecoRows.filter((r) => r <= 29);
                  const zoneCRows = ecoRows.filter((r) => r >= 30);
                  const renderHorizEcoRow = (rowNum: number) => {
                    const rowData = rowMap.get(rowNum);
                    const rowTotal = rowData
                      ? cabinFilter === "Y"
                        ? rowData.eco
                        : rowData.total
                      : 0;
                    const isOverwingExit = rowNum === 15 || rowNum === 16;
                    const isZoneC = rowNum >= 30;
                    return (
                      <div
                        key={`h-eco-${rowNum}`}
                        className={`flex flex-col items-center gap-1 rounded ${
                          isOverwingExit
                            ? "bg-amber-100/50 dark:bg-amber-950/30 ring-1 ring-amber-300/60 dark:ring-amber-800/60"
                            : ""
                        }`}
                      >
                        {/* Top Side (L, K, J) */}
                        <div className="flex flex-col gap-1">
                          {topStarboardCols.map((col) => renderSeatButton(rowNum, col, true))}
                        </div>
                        {/* Horizontal Aisle with Row Number */}
                        <div
                          className={`h-5 w-6 flex items-center justify-center font-mono text-[9px] font-extrabold tabular-nums ${
                            isZoneC
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {rowNum}
                        </div>
                        {/* Bottom Side (C, B, A) */}
                        <div className="flex flex-col gap-1">
                          {bottomPortCols.map((col) => renderSeatButton(rowNum, col, true))}
                        </div>
                        <span className="text-[8px] font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {rowTotal}
                        </span>
                      </div>
                    );
                  };

                  return (
                    <div className="flex items-stretch gap-2">
                      {zoneBRows.length > 0 && (
                        <div className="flex flex-col justify-between bg-sky-50/45 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-800/60 rounded-lg px-2 py-1">
                          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-sky-800 dark:text-sky-300 tracking-wider px-1">
                            <span>ZONE B · {pick("ÉCONOMIE", "ECONOMY")} (11–{zoneBRows[zoneBRows.length - 1]})</span>
                          </div>
                          <div className="flex items-stretch gap-1 my-1">
                            {zoneBRows.map(renderHorizEcoRow)}
                          </div>
                        </div>
                      )}
                      {zoneCRows.length > 0 && (
                        <div className="flex flex-col justify-between bg-emerald-50/45 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg px-2 py-1">
                          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-emerald-800 dark:text-emerald-300 tracking-wider px-1">
                            <span>ZONE C · (30–{zoneCRows[zoneCRows.length - 1]})</span>
                          </div>
                          <div className="flex items-stretch gap-1 my-1">
                            {zoneCRows.map(renderHorizEcoRow)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Aircraft Tail Cone & Horizontal Stabilizers SVG */}
              <div className="shrink-0 flex items-center">
                <svg
                  viewBox="0 0 80 228"
                  className="w-[68px] h-[228px] overflow-visible"
                  aria-hidden="true"
                >
                  {/* Tailplane Stabilizers */}
                  <path
                    d="M 40,62 L 62,14 L 70,22 L 54,78 Z"
                    fill="rgba(148,163,184,0.22)"
                    stroke="rgba(100,116,139,0.45)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 40,166 L 62,214 L 70,206 L 54,150 Z"
                    fill="rgba(148,163,184,0.22)"
                    stroke="rgba(100,116,139,0.45)"
                    strokeWidth="1.5"
                  />
                  {/* Tapered Tail Cone */}
                  <path
                    d="M 0,4 C 36,4 70,62 74,114 C 70,166 36,224 0,224 Z"
                    fill="rgba(148,163,184,0.16)"
                    stroke="rgba(100,116,139,0.55)"
                    strokeWidth="2"
                  />
                  {/* Rear Exit Doors */}
                  <rect x="6" y="8" width="12" height="8" rx="2" fill="#F59E0B" opacity="0.8" />
                  <rect x="6" y="212" width="12" height="8" rx="2" fill="#F59E0B" opacity="0.8" />
                  {/* Vertical Fin */}
                  <line
                    x1="28"
                    y1="114"
                    x2="76"
                    y2="114"
                    stroke="rgba(100,116,139,0.65)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <text
                    x="18"
                    y="114"
                    textAnchor="middle"
                    transform="rotate(-90 18 114)"
                    className="fill-slate-500 dark:fill-slate-400 font-mono font-bold"
                    style={{ fontSize: "8px", letterSpacing: "0.14em" }}
                  >
                    TAIL
                  </text>
                </svg>
              </div>
            </div>
          </div>
        ) : (
          /* VERTICAL FULL-AIRCRAFT FUSELAGE (Unclipped — All Rows Shown) */
          <div className="flex justify-center">
            <div className="relative w-full max-w-[420px] flex flex-col items-center py-2">
              {/* Nose Cone & Cockpit */}
              <svg
                viewBox="0 0 360 88"
                className="w-full max-w-[380px] h-22 overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="vertNoseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(148,163,184,0.28)" />
                    <stop offset="100%" stopColor="rgba(148,163,184,0.10)" />
                  </linearGradient>
                </defs>
                <path
                  d="M 14,88 C 14,44 92,8 180,8 C 268,8 346,44 346,88 Z"
                  fill="url(#vertNoseGrad)"
                  stroke="rgba(100,116,139,0.55)"
                  strokeWidth="2"
                />
                <path
                  d="M 118,48 L 176,30 L 176,52 L 112,58 Z"
                  fill="#1E293B"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                />
                <path
                  d="M 242,48 L 184,30 L 184,52 L 248,58 Z"
                  fill="#1E293B"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                />
                <rect x="18" y="68" width="12" height="14" rx="2" fill="#F59E0B" opacity="0.8" />
                <rect x="330" y="68" width="12" height="14" rx="2" fill="#F59E0B" opacity="0.8" />
                <text
                  x="180"
                  y="76"
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-300 font-mono font-bold"
                  style={{ fontSize: "9px", letterSpacing: "0.14em" }}
                >
                  COCKPIT · GALLEY AVANT
                </text>
              </svg>

              {/* Main Fuselage Tube */}
              <div className="relative w-full max-w-[380px] border-x-2 border-slate-400/55 dark:border-slate-600/70 bg-white dark:bg-slate-900 px-3 py-3 shadow-inner space-y-2">
                {/* Column Letters */}
                <div className="flex items-center justify-center gap-1.5 py-1 border-y border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 -mx-3 px-3 font-mono text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                  <div className="w-7 text-center">{pick("Rg", "Rw")}</div>
                  <div className="flex items-center gap-1">
                    {cabinColumns.leftCols.map((c) => (
                      <div key={c} className="w-8 sm:w-9 text-center">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="w-6 text-center text-[9px] text-slate-400">║</div>
                  <div className="flex items-center gap-1">
                    {cabinColumns.rightCols.map((c) => (
                      <div key={c} className="w-8 sm:w-9 text-center">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="w-8 text-right">Tot</div>
                </div>

                {/* BUSINESS ROWS (1..4) */}
                {bizRows.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800/70 text-[10px] font-mono font-bold text-violet-800 dark:text-violet-300">
                      <span>{pick("ZONE A · BUSINESS (C)", "ZONE A · BUSINESS (C)")}</span>
                      <span>
                        {pick("Lignes", "Rows")} 1–{bizMaxDisplay}
                      </span>
                    </div>
                    {bizRows.map((rowNum) => {
                      const rowData = rowMap.get(rowNum);
                      const rowTotal = rowData
                        ? cabinFilter === "C"
                          ? rowData.biz
                          : rowData.total
                        : 0;
                      return (
                        <div key={`v-biz-${rowNum}`} className="flex items-center justify-center gap-1.5">
                          <div className="w-7 text-center font-mono text-[10px] font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                            {String(rowNum).padStart(2, "0")}
                          </div>
                          <div className="flex items-center gap-1">
                            {cabinColumns.leftCols.map((col) => renderSeatButton(rowNum, col, false))}
                          </div>
                          <div className="w-6 text-center text-[9px] font-mono text-slate-300 dark:text-slate-700">
                            │
                          </div>
                          <div className="flex items-center gap-1">
                            {cabinColumns.rightCols.map((col) => renderSeatButton(rowNum, col, false))}
                          </div>
                          <div className="w-8 text-right font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                            {rowTotal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bulkhead between 4 and 11 */}
                {bizRows.length > 0 && ecoRows.length > 0 && (
                  <div className="relative py-2 my-1">
                    <div className="hidden sm:block absolute -left-14 top-1/2 -translate-y-1/2 w-12 h-8 border-y border-l border-slate-400/50 dark:border-slate-600/60 bg-slate-200/40 dark:bg-slate-800/40 -skew-y-12 rounded-l-md pointer-events-none" />
                    <div className="hidden sm:block absolute -right-14 top-1/2 -translate-y-1/2 w-12 h-8 border-y border-r border-slate-400/50 dark:border-slate-600/60 bg-slate-200/40 dark:bg-slate-800/40 skew-y-12 rounded-r-md pointer-events-none" />
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono text-[9px] font-bold">
                        EXIT
                      </span>
                      <div className="flex-1 h-0.5 bg-slate-300 dark:bg-slate-700" />
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {pick("Séparation Cabine", "Cabin Bulkhead")}
                      </span>
                      <div className="flex-1 h-0.5 bg-slate-300 dark:bg-slate-700" />
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono text-[9px] font-bold">
                        EXIT
                      </span>
                    </div>
                  </div>
                )}

                {/* ECONOMY ROWS: Zone B (11–29) & Zone C (30+) */}
                {ecoRows.length > 0 && (() => {
                  const zoneBRows = ecoRows.filter((r) => r <= 29);
                  const zoneCRows = ecoRows.filter((r) => r >= 30);
                  const renderVertEcoRow = (rowNum: number) => {
                    const rowData = rowMap.get(rowNum);
                    const rowTotal = rowData
                      ? cabinFilter === "Y"
                        ? rowData.eco
                        : rowData.total
                      : 0;
                    const isOverwingExit = rowNum === 15 || rowNum === 16;
                    const isZoneC = rowNum >= 30;
                    return (
                      <div
                        key={`v-eco-${rowNum}`}
                        className={`flex items-center justify-center gap-1.5 ${
                          isOverwingExit
                            ? "py-0.5 rounded bg-amber-50/50 dark:bg-amber-950/20"
                            : ""
                        }`}
                      >
                        <div
                          className={`w-7 text-center font-mono text-[10px] font-bold tabular-nums ${
                            isZoneC
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {rowNum}
                        </div>
                        <div className="flex items-center gap-1">
                          {cabinColumns.leftCols.map((col) => renderSeatButton(rowNum, col, false))}
                        </div>
                        <div className="w-6 text-center text-[9px] font-mono text-slate-300 dark:text-slate-700">
                          │
                        </div>
                        <div className="flex items-center gap-1">
                          {cabinColumns.rightCols.map((col) => renderSeatButton(rowNum, col, false))}
                        </div>
                        <div className="w-8 text-right font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          {rowTotal}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-1.5">
                      {zoneBRows.length > 0 && (
                        <>
                          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/70 text-[10px] font-mono font-bold text-sky-800 dark:text-sky-300">
                            <span>ZONE B · {pick("ÉCONOMIE (Y)", "ECONOMY (Y)")}</span>
                            <span>
                              {pick("Lignes", "Rows")} 11–{zoneBRows[zoneBRows.length - 1]}
                            </span>
                          </div>
                          {zoneBRows.map(renderVertEcoRow)}
                        </>
                      )}
                      {zoneCRows.length > 0 && (
                        <>
                          <div className="flex items-center justify-between px-2 py-1 mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300">
                            <span>ZONE C · {pick("ARRIÈRE (Y)", "REAR (Y)")}</span>
                            <span>
                              {pick("Lignes", "Rows")} 30–{zoneCRows[zoneCRows.length - 1]}
                            </span>
                          </div>
                          {zoneCRows.map(renderVertEcoRow)}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Tail Cone & Stabilizers */}
              <svg
                viewBox="0 0 360 72"
                className="w-full max-w-[380px] h-18 overflow-visible"
                aria-hidden="true"
              >
                <path
                  d="M 102,38 L 28,60 L 42,66 L 128,52 Z"
                  fill="rgba(148,163,184,0.22)"
                  stroke="rgba(100,116,139,0.45)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 258,38 L 332,60 L 318,66 L 232,52 Z"
                  fill="rgba(148,163,184,0.22)"
                  stroke="rgba(100,116,139,0.45)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 14,0 C 14,34 94,64 180,68 C 266,64 346,34 346,0 Z"
                  fill="rgba(148,163,184,0.16)"
                  stroke="rgba(100,116,139,0.55)"
                  strokeWidth="2"
                />
                <rect x="22" y="4" width="10" height="14" rx="2" fill="#F59E0B" opacity="0.75" />
                <rect x="328" y="4" width="10" height="14" rx="2" fill="#F59E0B" opacity="0.75" />
                <line
                  x1="180"
                  y1="26"
                  x2="180"
                  y2="70"
                  stroke="rgba(100,116,139,0.65)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <text
                  x="180"
                  y="18"
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 font-mono font-bold"
                  style={{ fontSize: "9px", letterSpacing: "0.14em" }}
                >
                  GALLEY ARRIÈRE · TAIL
                </text>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Top Occupied Seats (Full-Width Compact Grid) */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {pick("Top Sièges les Plus Occupés", "Most Occupied Seats")}
          </h5>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {pick("Cliquer pour mettre en surbrillance sur l'avion", "Click to highlight on aircraft")}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {topSeatsFiltered.map((s, idx) => {
            const { dotClass } = getSeatColorStyle(s.count, maxCellCount);
            return (
              <button
                key={s.seat}
                type="button"
                onClick={() =>
                  setPinnedSeat((curr) =>
                    curr?.seat === s.seat
                      ? null
                      : { seat: s.seat, total: s.total, eco: s.eco, biz: s.biz }
                  )
                }
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border font-mono text-xs tabular-nums transition cursor-pointer ${
                  pinnedSeat?.seat === s.seat
                    ? "border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white"
                    : "border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                  <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {s.seat}
                  </span>
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
