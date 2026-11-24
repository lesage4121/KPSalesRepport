/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export interface DateRangeValue {
  startDate: string; // "YYYY-MM-DD" or ""
  endDate: string; // "YYYY-MM-DD" or ""
}

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: DateRangeValue) => void;
  availableIsoDates?: string[];
  minDate?: string;
  maxDate?: string;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  accentVariant?: "indigo" | "warm";
  align?: "left" | "right";
}

const DCS_MONTH_INDEX: Record<string, number> = {
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

const MONTH_ABBR_EN = [
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
];

/**
 * Converts a DCS date token (e.g. "01JUN", "18NOV") + optional 2/4-digit year to ISO "YYYY-MM-DD".
 */
export function dcsDateToIso(dcsDate: string, extractedYear = "26"): string {
  const clean = (dcsDate || "").trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})([A-Z]{3})(?:\d{2,4})?$/);
  if (!match) return "";
  const day = parseInt(match[1], 10);
  const month = DCS_MONTH_INDEX[match[2]];
  if (!month || !day) return "";
  const yrNum = parseInt(extractedYear, 10);
  const year = Number.isFinite(yrNum)
    ? yrNum < 100
      ? 2000 + yrNum
      : yrNum
    : 2026;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Converts an ISO date "YYYY-MM-DD" back to DCS label "01JUN".
 */
export function isoToDcsDate(isoDate: string): string {
  const parsed = parseIsoParts(isoDate);
  if (!parsed) return "";
  const abbr = MONTH_ABBR_EN[parsed.month - 1] || "JAN";
  return `${String(parsed.day).padStart(2, "0")}${abbr}`;
}

function parseIsoParts(
  iso: string
): { year: number; month: number; day: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yStr, mStr, dStr] = iso.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function partsToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysIso(iso: string, deltaDays: number): string {
  const parts = parseIsoParts(iso);
  if (!parts) return "";
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays));
  return partsToIso(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate()
  );
}

function diffDaysInclusive(startIso: string, endIso: string): number {
  const a = parseIsoParts(startIso);
  const b = parseIsoParts(endIso);
  if (!a || !b) return 0;
  const t1 = Date.UTC(a.year, a.month - 1, a.day);
  const t2 = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round(Math.abs(t2 - t1) / 86400000) + 1;
}

function addMonthsYM(
  ym: { year: number; month: number },
  delta: number
): { year: number; month: number } {
  const total = ym.year * 12 + (ym.month - 1) + delta;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Monday = 0 ... Sunday = 6
 */
function getMondayFirstOffset(year: number, month: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

function formatIsoDisplay(
  iso: string,
  locale: "fr-FR" | "en-US",
  shortMonth = true
): string {
  const parts = parseIsoParts(iso);
  if (!parts) return iso;
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: shortMonth ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

function formatMonthTitle(
  year: number,
  month: number,
  locale: "fr-FR" | "en-US"
): string {
  const dt = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

function getTodayIso(): string {
  const now = new Date();
  return partsToIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  availableIsoDates = [],
  minDate,
  maxDate,
  label,
  placeholder,
  id,
  className = "",
  accentVariant = "indigo",
  align = "left",
}) => {
  const { language, locale, pick } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUpward: boolean;
  }>({ top: 0, left: 0, openUpward: false });

  const sortedAvailable = useMemo(
    () =>
      Array.from(new Set(availableIsoDates.filter((d) => Boolean(parseIsoParts(d))))).sort(),
    [availableIsoDates]
  );

  const availableSet = useMemo(() => new Set(sortedAvailable), [sortedAvailable]);

  const initialAnchorIso = useMemo(() => {
    if (startDate && parseIsoParts(startDate)) return startDate;
    if (endDate && parseIsoParts(endDate)) return endDate;
    if (sortedAvailable.length > 0) return sortedAvailable[0];
    return getTodayIso();
  }, [startDate, endDate, sortedAvailable]);

  const [viewYM, setViewYM] = useState<{ year: number; month: number }>(() => {
    const p = parseIsoParts(initialAnchorIso) || {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: 1,
    };
    return { year: p.year, month: p.month };
  });

  // Sync displayed calendar month when opening
  useEffect(() => {
    if (isOpen) {
      const p = parseIsoParts(initialAnchorIso);
      if (p) setViewYM({ year: p.year, month: p.month });
      setPendingStart(null);
      setHoverDate(null);
    }
  }, [isOpen, initialAnchorIso]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popWidth = vw >= 768 ? 660 : Math.min(350, vw - 24);
    const popHeight = 420;

    let left = align === "right" ? rect.right - popWidth : rect.left;
    if (left + popWidth > vw - 12) {
      left = Math.max(12, vw - popWidth - 12);
    }
    if (left < 12) left = 12;

    const spaceBelow = vh - rect.bottom;
    const openUpward = spaceBelow < popHeight && rect.top > popHeight;
    const top = openUpward
      ? Math.max(12, rect.top - popHeight - 8)
      : Math.min(vh - 60, rect.bottom + 8);

    setCoords({ top, left, openUpward });
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const normalizedRange = useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return { start: endDate, end: startDate };
    }
    return { start: startDate, end: endDate };
  }, [startDate, endDate]);

  const effectivePreviewRange = useMemo(() => {
    if (pendingStart) {
      const candidateEnd = hoverDate || pendingStart;
      return pendingStart <= candidateEnd
        ? { start: pendingStart, end: candidateEnd }
        : { start: candidateEnd, end: pendingStart };
    }
    return normalizedRange;
  }, [pendingStart, hoverDate, normalizedRange]);

  const handleDayClick = (iso: string) => {
    if (minDate && iso < minDate) return;
    if (maxDate && iso > maxDate) return;

    if (!pendingStart) {
      setPendingStart(iso);
      setHoverDate(iso);
      return;
    }

    const [s, e] = pendingStart <= iso ? [pendingStart, iso] : [iso, pendingStart];
    setPendingStart(null);
    setHoverDate(null);
    onChange({ startDate: s, endDate: e });
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPendingStart(null);
    setHoverDate(null);
    onChange({ startDate: "", endDate: "" });
  };

  const applyPreset = (s: string, e: string) => {
    setPendingStart(null);
    setHoverDate(null);
    onChange({ startDate: s, endDate: e });
    if (s) {
      const p = parseIsoParts(s);
      if (p) setViewYM({ year: p.year, month: p.month });
    }
  };

  const referenceMaxIso =
    sortedAvailable.length > 0
      ? sortedAvailable[sortedAvailable.length - 1]
      : getTodayIso();
  const referenceMinIso =
    sortedAvailable.length > 0 ? sortedAvailable[0] : "";

  const presets = useMemo(() => {
    const items: {
      key: string;
      label: string;
      start: string;
      end: string;
    }[] = [
      {
        key: "all",
        label: pick("Toutes les dates", "All Dates"),
        start: "",
        end: "",
      },
    ];

    if (sortedAvailable.length > 0) {
      items.push({
        key: "full",
        label: pick(
          `Toute la période (${sortedAvailable.length}j)`,
          `Full Dataset (${sortedAvailable.length}d)`
        ),
        start: referenceMinIso,
        end: referenceMaxIso,
      });
    }

    items.push(
      {
        key: "latest",
        label:
          sortedAvailable.length > 0
            ? pick("Dernier jour", "Latest Day")
            : pick("Aujourd'hui", "Today"),
        start: referenceMaxIso,
        end: referenceMaxIso,
      },
      {
        key: "3d",
        label: pick("3 derniers jours", "Last 3 Days"),
        start: addDaysIso(referenceMaxIso, -2),
        end: referenceMaxIso,
      },
      {
        key: "7d",
        label: pick("7 derniers jours", "Last 7 Days"),
        start: addDaysIso(referenceMaxIso, -6),
        end: referenceMaxIso,
      },
      {
        key: "14d",
        label: pick("14 derniers jours", "Last 14 Days"),
        start: addDaysIso(referenceMaxIso, -13),
        end: referenceMaxIso,
      },
      {
        key: "30d",
        label: pick("30 derniers jours", "Last 30 Days"),
        start: addDaysIso(referenceMaxIso, -29),
        end: referenceMaxIso,
      }
    );

    const refParts = parseIsoParts(referenceMaxIso);
    if (refParts) {
      const monthStart = partsToIso(refParts.year, refParts.month, 1);
      const monthEnd = partsToIso(
        refParts.year,
        refParts.month,
        getDaysInMonth(refParts.year, refParts.month)
      );
      items.push({
        key: "month",
        label: pick("Mois complet", "Full Month"),
        start: monthStart,
        end: monthEnd,
      });
    }

    return items;
  }, [pick, sortedAvailable, referenceMinIso, referenceMaxIso]);

  const weekdays = useMemo(
    () =>
      language === "en"
        ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        : ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"],
    [language]
  );

  const secondMonthYM = useMemo(() => addMonthsYM(viewYM, 1), [viewYM]);

  const displaySummary = useMemo(() => {
    const { start, end } = normalizedRange;
    if (start && end) {
      if (start === end) return formatIsoDisplay(start, locale);
      return `${formatIsoDisplay(start, locale)} – ${formatIsoDisplay(end, locale)}`;
    }
    if (start) return `${pick("Depuis", "From")} ${formatIsoDisplay(start, locale)}`;
    if (end) return `${pick("Jusqu'au", "Until")} ${formatIsoDisplay(end, locale)}`;
    return placeholder || pick("Toutes les périodes · Sélectionner", "All dates · Select range");
  }, [normalizedRange, locale, pick, placeholder]);

  const hasValue = Boolean(normalizedRange.start || normalizedRange.end);

  const selectedDaysCount =
    normalizedRange.start && normalizedRange.end
      ? diffDaysInclusive(normalizedRange.start, normalizedRange.end)
      : 0;

  const isWarm = accentVariant === "warm";

  const renderMonthGrid = (ym: { year: number; month: number }) => {
    const daysCount = getDaysInMonth(ym.year, ym.month);
    const offset = getMondayFirstOffset(ym.year, ym.month);
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysCount; d++) cells.push(d);

    return (
      <div className="w-full min-w-[238px]">
        <div className="text-center text-xs font-bold text-slate-800 dark:text-slate-100 capitalize mb-2">
          {formatMonthTitle(ym.year, ym.month, locale)}
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekdays.map((wd) => (
            <div
              key={wd}
              className="h-7 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-500"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-9" />;
            }
            const iso = partsToIso(ym.year, ym.month, day);
            const isDisabled =
              (minDate && iso < minDate) || (maxDate && iso > maxDate);
            const isStart = effectivePreviewRange.start === iso;
            const isEnd = effectivePreviewRange.end === iso;
            const isEndpoint = isStart || isEnd;
            const isInRange =
              Boolean(effectivePreviewRange.start && effectivePreviewRange.end) &&
              iso > effectivePreviewRange.start &&
              iso < effectivePreviewRange.end;
            const hasData = availableSet.has(iso);
            const isToday = iso === getTodayIso();

            return (
              <button
                key={iso}
                type="button"
                disabled={Boolean(isDisabled)}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => {
                  if (pendingStart) setHoverDate(iso);
                }}
                aria-label={formatIsoDisplay(iso, locale, false)}
                aria-pressed={isEndpoint}
                className={`relative h-9 w-full flex flex-col items-center justify-center text-xs font-mono tabular-nums transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isEndpoint
                    ? isWarm
                      ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold rounded-lg shadow-xs z-10"
                      : "bg-indigo-600 text-white font-bold rounded-lg shadow-xs z-10"
                    : isInRange
                    ? isWarm
                      ? "bg-[#FDF4E3] dark:bg-[#3A2112] text-[#4C2812] dark:text-[#F7BA42] font-semibold"
                      : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-semibold"
                    : hasData
                    ? "text-slate-900 dark:text-slate-100 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                } ${
                  isToday && !isEndpoint
                    ? "ring-1 ring-inset ring-slate-300 dark:ring-slate-600"
                    : ""
                }`}
              >
                <span>{day}</span>
                {hasData && (
                  <span
                    className={`w-1 h-1 rounded-full mt-0.5 ${
                      isEndpoint
                        ? isWarm
                          ? "bg-[#F7BA42] dark:bg-[#1F1209]"
                          : "bg-white"
                        : "bg-emerald-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-500 dark:text-[#DECAB1] mb-1.5 flex items-center gap-1"
        >
          <CalendarRange
            className={`w-3.5 h-3.5 ${
              isWarm ? "text-[#E89C1D]" : "text-indigo-500 dark:text-indigo-400"
            }`}
          />
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={`w-full min-h-[40px] px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${
            hasValue
              ? isWarm
                ? "bg-[#FDF4E3] dark:bg-[#351F11] border-[#E89C1D] text-[#321B0A] dark:text-[#F7BA42] font-semibold focus-visible:ring-[#E89C1D]"
                : "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100 font-semibold focus-visible:ring-indigo-500"
              : isWarm
              ? "bg-white dark:bg-[#1F1209] border-[#E6D7C3] dark:border-[#5C351B] text-[#321B0A] dark:text-[#FAF7F2] hover:border-[#E89C1D] focus-visible:ring-[#E89C1D]"
              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-indigo-500"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <CalendarRange
              className={`w-4 h-4 shrink-0 ${
                hasValue
                  ? isWarm
                    ? "text-[#8C5214] dark:text-[#F7BA42]"
                    : "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            />
            <span className="truncate font-mono tabular-nums whitespace-nowrap">
              {displaySummary}
            </span>
          </span>

          <span className="flex items-center gap-1 shrink-0">
            {hasValue && (
              <span
                role="button"
                tabIndex={0}
                aria-label={pick("Effacer la période", "Clear date range")}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClear();
                  }
                }}
                className="p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
          </span>
        </button>
      </div>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={pick("Sélecteur de plage de dates", "Date range picker")}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            className="w-[calc(100vw-24px)] max-w-[350px] md:max-w-[660px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col md:flex-row">
              {/* Quick Presets Sidebar */}
              <div className="md:w-44 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 p-3 flex md:flex-col gap-1.5 overflow-x-auto">
                <div className="hidden md:block text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 pb-1">
                  {pick("Raccourcis", "Quick Ranges")}
                </div>
                {presets.map((p) => {
                  const isActive =
                    normalizedRange.start === p.start &&
                    normalizedRange.end === p.end;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.start, p.end)}
                      className={`px-2.5 py-2 rounded-lg text-left text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                        isActive
                          ? isWarm
                            ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                            : "bg-indigo-600 text-white font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Dual-Month Calendar */}
              <div className="flex-1 p-4 space-y-3">
                {/* Month Navigation Header */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewYM((prev) => addMonthsYM(prev, -1))}
                    aria-label={pick("Mois précédent", "Previous month")}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {pendingStart ? (
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                        {pick("Début:", "Start:")}{" "}
                        {formatIsoDisplay(pendingStart, locale)} →{" "}
                        {pick("Choisir fin", "Select end")}
                      </span>
                    ) : sortedAvailable.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const p = parseIsoParts(sortedAvailable[0]);
                          if (p) setViewYM({ year: p.year, month: p.month });
                        }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {pick("Aller aux données", "Jump to Data")}
                      </button>
                    ) : (
                      <span>
                        {pick("Cliquez début puis fin", "Click start then end date")}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewYM((prev) => addMonthsYM(prev, 1))}
                    aria-label={pick("Mois suivant", "Next month")}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 1-month mobile / 2-month desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderMonthGrid(viewYM)}
                  <div className="hidden md:block">
                    {renderMonthGrid(secondMonthYM)}
                  </div>
                </div>

                {/* Direct Date Inputs + Footer Actions */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label={pick("Date de début", "Start date")}
                      value={normalizedRange.start}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPendingStart(null);
                        onChange({
                          startDate: val,
                          endDate:
                            normalizedRange.end && val && val > normalizedRange.end
                              ? val
                              : normalizedRange.end,
                        });
                      }}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-400">→</span>
                    <input
                      type="date"
                      aria-label={pick("Date de fin", "End date")}
                      value={normalizedRange.end}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPendingStart(null);
                        onChange({
                          startDate:
                            normalizedRange.start &&
                            val &&
                            val < normalizedRange.start
                              ? val
                              : normalizedRange.start,
                          endDate: val,
                        });
                      }}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    {selectedDaysCount > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {selectedDaysCount}{" "}
                        {pick(
                          selectedDaysCount > 1 ? "jours" : "jour",
                          selectedDaysCount > 1 ? "days" : "day"
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleClear()}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {pick("Réinitialiser", "Reset")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingStart) {
                          onChange({
                            startDate: pendingStart,
                            endDate: pendingStart,
                          });
                          setPendingStart(null);
                        }
                        setIsOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                        isWarm
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {pick("Valider", "Apply")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
