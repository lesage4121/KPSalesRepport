/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

export interface Donut3DSlice {
  name: string;
  value: number;
  color: string;
}

interface Donut3DChartProps {
  data: Donut3DSlice[];
  variant?: "donut" | "pie";
  valueFormatter?: (value: number) => string;
  centerLabel?: string;
  centerValue?: string;
  emptyText?: string;
  heightClass?: string;
  legendLayout?: "bottom" | "right";
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [99, 102, 241];
}

function adjustColor(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  if (amount >= 0) {
    return `rgb(${clampByte(r + (255 - r) * amount)}, ${clampByte(
      g + (255 - g) * amount
    )}, ${clampByte(b + (255 - b) * amount)})`;
  }
  const factor = 1 + amount;
  return `rgb(${clampByte(r * factor)}, ${clampByte(g * factor)}, ${clampByte(
    b * factor
  )})`;
}

function clipAngleIntervals(
  a0: number,
  a1: number,
  wantPositiveSin: boolean
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let k = -2; k <= 3; k++) {
    const winStart = wantPositiveSin ? 2 * k * Math.PI : (2 * k - 1) * Math.PI;
    const winEnd = wantPositiveSin ? (2 * k + 1) * Math.PI : 2 * k * Math.PI;
    const s = Math.max(a0, winStart);
    const e = Math.min(a1, winEnd);
    if (e - s > 0.002) {
      out.push([s, e]);
    }
  }
  return out;
}

export const Donut3DChart: React.FC<Donut3DChartProps> = ({
  data,
  variant = "donut",
  valueFormatter,
  centerLabel,
  centerValue,
  emptyText,
  heightClass = "h-60",
  legendLayout = "bottom",
}) => {
  const uid = useId().replace(/:/g, "");
  const { locale, pick } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const isPie = variant === "pie";

  const activeData = useMemo(
    () => data.filter((d) => Number.isFinite(d.value) && d.value > 0),
    [data]
  );

  const total = useMemo(
    () => activeData.reduce((sum, d) => sum + d.value, 0),
    [activeData]
  );

  const fmtVal = (v: number) =>
    valueFormatter ? valueFormatter(v) : v.toLocaleString(locale);

  const cx = 160;
  const cy = 92;
  const rx = 114;
  const ry = 66;
  const irx = isPie ? 0 : 58;
  const iry = isPie ? 0 : 33.5;
  const depth = isPie ? 22 : 20;

  const slices = useMemo(() => {
    if (total <= 0 || activeData.length === 0) return [];
    const count = activeData.length;
    const padAngle = count > 1 ? (isPie ? 0.022 : 0.032) : 0;
    const totalPad = padAngle * count;
    const availableAngle = Math.PI * 2 - totalPad;

    let cursor = -Math.PI / 2 + padAngle / 2;
    return activeData.map((item, idx) => {
      const rawSweep = (item.value / total) * availableAngle;
      const sweep = Math.max(0.015, rawSweep);
      const startAngle = cursor;
      const endAngle = cursor + sweep;
      cursor = endAngle + padAngle;

      const midAngle = (startAngle + endAngle) / 2;
      const pct = Number(((item.value / total) * 100).toFixed(1));
      const isFullRing = count === 1 || sweep >= Math.PI * 2 - 0.005;

      return {
        ...item,
        idx,
        sweep,
        pct,
        startAngle,
        endAngle,
        midAngle,
        isFullRing,
        outerFrontArcs: clipAngleIntervals(startAngle, endAngle, true),
        innerBackArcs: isPie ? [] : clipAngleIntervals(startAngle, endAngle, false),
      };
    });
  }, [activeData, total, isPie]);

  const ptOut = (theta: number, yOffset = 0) => ({
    x: cx + rx * Math.cos(theta),
    y: cy + ry * Math.sin(theta) + yOffset,
  });

  const ptIn = (theta: number, yOffset = 0) => ({
    x: isPie ? cx : cx + irx * Math.cos(theta),
    y: isPie ? cy + yOffset : cy + iry * Math.sin(theta) + yOffset,
  });

  const buildTopFacePath = (
    startAngle: number,
    endAngle: number,
    isFullRing: boolean,
    liftY: number
  ): string => {
    if (isFullRing) {
      const oR = `${cx + rx},${cy + liftY}`;
      const oL = `${cx - rx},${cy + liftY}`;
      if (isPie) {
        return [
          `M ${oR}`,
          `A ${rx},${ry} 0 1 1 ${oL}`,
          `A ${rx},${ry} 0 1 1 ${oR} Z`,
        ].join(" ");
      }
      const iR = `${cx + irx},${cy + liftY}`;
      const iL = `${cx - irx},${cy + liftY}`;
      return [
        `M ${oR}`,
        `A ${rx},${ry} 0 1 1 ${oL}`,
        `A ${rx},${ry} 0 1 1 ${oR} Z`,
        `M ${iR}`,
        `A ${irx},${iry} 0 1 0 ${iL}`,
        `A ${irx},${iry} 0 1 0 ${iR} Z`,
      ].join(" ");
    }

    const p0 = ptOut(startAngle, liftY);
    const p1 = ptOut(endAngle, liftY);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    if (isPie) {
      return [
        `M ${cx.toFixed(2)},${(cy + liftY).toFixed(2)}`,
        `L ${p0.x.toFixed(2)},${p0.y.toFixed(2)}`,
        `A ${rx},${ry} 0 ${largeArc} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
        "Z",
      ].join(" ");
    }

    const q1 = ptIn(endAngle, liftY);
    const q0 = ptIn(startAngle, liftY);

    return [
      `M ${p0.x.toFixed(2)},${p0.y.toFixed(2)}`,
      `A ${rx},${ry} 0 ${largeArc} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
      `L ${q1.x.toFixed(2)},${q1.y.toFixed(2)}`,
      `A ${irx},${iry} 0 ${largeArc} 0 ${q0.x.toFixed(2)},${q0.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  };

  const buildArcWallPath = (
    s: number,
    e: number,
    isOuter: boolean,
    liftY: number
  ): string => {
    const rX = isOuter ? rx : irx;
    const rY = isOuter ? ry : iry;
    const pFn = isOuter ? ptOut : ptIn;
    const t0 = pFn(s, liftY);
    const t1 = pFn(e, liftY);
    const b1 = pFn(e, liftY + depth);
    const b0 = pFn(s, liftY + depth);
    const largeArc = e - s > Math.PI ? 1 : 0;

    return [
      `M ${t0.x.toFixed(2)},${t0.y.toFixed(2)}`,
      `A ${rX},${rY} 0 ${largeArc} 1 ${t1.x.toFixed(2)},${t1.y.toFixed(2)}`,
      `L ${b1.x.toFixed(2)},${b1.y.toFixed(2)}`,
      `A ${rX},${rY} 0 ${largeArc} 0 ${b0.x.toFixed(2)},${b0.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  };

  const buildRadialCutPath = (theta: number, liftY: number): string => {
    const tOut = ptOut(theta, liftY);
    const tIn = ptIn(theta, liftY);
    const bIn = ptIn(theta, liftY + depth);
    const bOut = ptOut(theta, liftY + depth);
    return [
      `M ${tOut.x.toFixed(2)},${tOut.y.toFixed(2)}`,
      `L ${tIn.x.toFixed(2)},${tIn.y.toFixed(2)}`,
      `L ${bIn.x.toFixed(2)},${bIn.y.toFixed(2)}`,
      `L ${bOut.x.toFixed(2)},${bOut.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  };

  if (activeData.length === 0 || total <= 0) {
    return (
      <div
        className={`${heightClass} flex items-center justify-center text-xs text-slate-400 dark:text-slate-500`}
      >
        {emptyText || pick("Aucune donnée disponible", "No data available")}
      </div>
    );
  }

  const activeSlice =
    hoveredIdx !== null ? slices.find((s) => s.idx === hoveredIdx) : null;

  const cutWalls =
    slices.length > 1
      ? slices
          .flatMap((sl) => {
            const liftY = hoveredIdx === sl.idx ? -6 : 0;
            return [
              {
                key: `cut-s-${sl.idx}`,
                angle: sl.startAngle,
                depthScore: Math.sin(sl.startAngle),
                color: adjustColor(sl.color, -0.34),
                path: buildRadialCutPath(sl.startAngle, liftY),
              },
              {
                key: `cut-e-${sl.idx}`,
                angle: sl.endAngle,
                depthScore: Math.sin(sl.endAngle),
                color: adjustColor(sl.color, -0.38),
                path: buildRadialCutPath(sl.endAngle, liftY),
              },
            ];
          })
          .sort((a, b) => a.depthScore - b.depthScore)
      : [];

  return (
    <div
      className={`w-full ${
        legendLayout === "right"
          ? "grid grid-cols-1 md:grid-cols-12 items-center gap-3"
          : "flex flex-col justify-between gap-2"
      }`}
    >
      {/* 3D Isometric SVG Stage */}
      <div
        className={`relative ${
          legendLayout === "right" ? "md:col-span-7 h-56 sm:h-60" : "h-48 sm:h-52"
        } w-full flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 320 206"
          className="w-full h-full max-h-full overflow-visible select-none"
          role="img"
          aria-label={
            isPie
              ? pick("Diagramme circulaire 3D", "3D Pie Chart")
              : pick("Diagramme en anneau 3D", "3D Donut Chart")
          }
        >
          <defs>
            <radialGradient id={`shadow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(15, 23, 42, 0.34)" />
              <stop offset="65%" stopColor="rgba(15, 23, 42, 0.14)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
            </radialGradient>

            {slices.map((sl) => (
              <React.Fragment key={`defs-${sl.idx}`}>
                <linearGradient
                  id={`top-${uid}-${sl.idx}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={adjustColor(sl.color, 0.24)} />
                  <stop offset="55%" stopColor={sl.color} />
                  <stop offset="100%" stopColor={adjustColor(sl.color, -0.14)} />
                </linearGradient>

                <linearGradient
                  id={`outer-${uid}-${sl.idx}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={adjustColor(sl.color, -0.22)} />
                  <stop offset="55%" stopColor={adjustColor(sl.color, -0.36)} />
                  <stop offset="100%" stopColor={adjustColor(sl.color, -0.52)} />
                </linearGradient>

                <linearGradient
                  id={`inner-${uid}-${sl.idx}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={adjustColor(sl.color, -0.46)} />
                  <stop offset="100%" stopColor={adjustColor(sl.color, -0.3)} />
                </linearGradient>
              </React.Fragment>
            ))}
          </defs>

          {/* Ambient 3D Floor Shadow */}
          <ellipse
            cx={cx}
            cy={cy + depth + 10}
            rx={rx + 12}
            ry={ry + 6}
            fill={`url(#shadow-${uid})`}
          />

          {/* 1. Back-half Inner Cylinder Walls (visible inside the donut hole) */}
          {slices.map((sl) => {
            const liftY = hoveredIdx === sl.idx ? -6 : 0;
            return sl.innerBackArcs.map(([s, e], arcIdx) => (
              <path
                key={`in-${sl.idx}-${arcIdx}`}
                d={buildArcWallPath(s, e, false, liftY)}
                fill={`url(#inner-${uid}-${sl.idx})`}
                className="transition-all duration-150"
              />
            ));
          })}

          {/* 2. Radial Cut Walls sorted back-to-front */}
          {cutWalls.map((cw) => (
            <path
              key={cw.key}
              d={cw.path}
              fill={cw.color}
              className="transition-all duration-150"
            />
          ))}

          {/* 3. Front-half Outer Extruded Skirt */}
          {slices.map((sl) => {
            const liftY = hoveredIdx === sl.idx ? -6 : 0;
            return sl.outerFrontArcs.map(([s, e], arcIdx) => (
              <path
                key={`out-${sl.idx}-${arcIdx}`}
                d={buildArcWallPath(s, e, true, liftY)}
                fill={`url(#outer-${uid}-${sl.idx})`}
                onMouseEnter={() => setHoveredIdx(sl.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-all duration-150"
              />
            ));
          })}

          {/* 4. Top Glossy Beveled Faces */}
          {slices.map((sl) => {
            const isHovered = hoveredIdx === sl.idx;
            const liftY = isHovered ? -6 : 0;
            const dimmed = hoveredIdx !== null && !isHovered;
            const lx = cx + rx * 0.62 * Math.cos(sl.midAngle);
            const ly = cy + liftY + ry * 0.62 * Math.sin(sl.midAngle);
            return (
              <g
                key={`top-${sl.idx}`}
                onMouseEnter={() => setHoveredIdx(sl.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() =>
                  setHoveredIdx((prev) => (prev === sl.idx ? null : sl.idx))
                }
                className="cursor-pointer"
                style={{
                  opacity: dimmed ? 0.65 : 1,
                  transition: "opacity 150ms ease",
                }}
              >
                <path
                  d={buildTopFacePath(
                    sl.startAngle,
                    sl.endAngle,
                    sl.isFullRing,
                    liftY
                  )}
                  fill={`url(#top-${uid}-${sl.idx})`}
                  fillRule={isPie ? "nonzero" : "evenodd"}
                  stroke="rgba(255,255,255,0.48)"
                  strokeWidth={isHovered ? 1.5 : 0.9}
                />
                {isPie && sl.sweep >= 0.32 && (
                  <text
                    x={sl.isFullRing ? cx : lx}
                    y={(sl.isFullRing ? cy + liftY : ly) + 3}
                    textAnchor="middle"
                    pointerEvents="none"
                    className="fill-white font-mono font-black drop-shadow-[0_1px_2px_rgba(15,23,42,0.7)]"
                    style={{ fontSize: "10.5px", fontVariantNumeric: "tabular-nums" }}
                  >
                    {sl.pct}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Center Hole Live Readout (only in Donut mode) */}
          {!isPie && (
            <g pointerEvents="none">
              <text
                x={cx}
                y={cy - 2}
                textAnchor="middle"
                className="fill-slate-900 dark:fill-slate-100 font-mono font-black"
                style={{ fontSize: "15px", fontVariantNumeric: "tabular-nums" }}
              >
                {activeSlice ? `${activeSlice.pct}%` : centerValue || fmtVal(total)}
              </text>
              <text
                x={cx}
                y={cy + 13}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 font-sans font-semibold"
                style={{ fontSize: "9.5px" }}
              >
                {activeSlice
                  ? activeSlice.name.length > 16
                    ? `${activeSlice.name.slice(0, 15)}…`
                    : activeSlice.name
                  : centerLabel || pick("Total", "Total")}
              </text>
            </g>
          )}
        </svg>

        {/* Floating Frosted Tooltip on Hover */}
        {activeSlice && (
          <div className="pointer-events-none absolute top-1 right-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 shadow-lg text-xs z-20">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeSlice.color }}
              />
              <span>{activeSlice.name}</span>
            </div>
            <div className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              <strong>{fmtVal(activeSlice.value)}</strong> · {activeSlice.pct}%
            </div>
          </div>
        )}
      </div>

      {/* Interactive Legend */}
      <div
        className={
          legendLayout === "right"
            ? "md:col-span-5 space-y-2 max-h-56 overflow-y-auto pr-1"
            : "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-1"
        }
      >
        {slices.map((sl) => {
          const isHovered = hoveredIdx === sl.idx;
          return (
            <button
              key={`leg-${sl.idx}`}
              type="button"
              onMouseEnter={() => setHoveredIdx(sl.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() =>
                setHoveredIdx((prev) => (prev === sl.idx ? null : sl.idx))
              }
              className={`flex items-center gap-2 rounded-lg px-2 py-1 text-left transition cursor-pointer ${
                isHovered
                  ? "bg-slate-100 dark:bg-slate-800"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-xs"
                style={{
                  background: `linear-gradient(135deg, ${adjustColor(
                    sl.color,
                    0.2
                  )}, ${adjustColor(sl.color, -0.25)})`,
                }}
              />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                {sl.name}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {fmtVal(sl.value)} ({sl.pct}%)
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
