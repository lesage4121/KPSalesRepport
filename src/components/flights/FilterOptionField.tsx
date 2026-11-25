/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

export interface FilterOptionItem {
  value: string;
  label: string;
  count?: number | string;
  keywords?: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

function computeDropdownRect(triggerEl: HTMLElement | null): DropdownRect | null {
  if (!triggerEl) return null;
  const r = triggerEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(r.width, 220), vw - 16);
  const left = Math.max(8, Math.min(r.left, vw - width - 8));
  const spaceBelow = vh - r.bottom - 10;
  const spaceAbove = r.top - 10;
  const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, Math.min(260, openUp ? spaceAbove : spaceBelow));
  const top = openUp ? r.top - 4 : r.bottom + 4;
  return { top, left, width, maxHeight, openUp };
}

interface FilterOptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOptionItem[];
  allValue?: string;
  allLabel: string;
  prefixLabel?: string;
  placeholder?: string;
  title?: string;
  className?: string;
}

export const FilterOptionField: React.FC<FilterOptionFieldProps> = ({
  value,
  onChange,
  options,
  allValue = "ALL",
  allLabel,
  prefixLabel,
  placeholder,
  title,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [rect, setRect] = useState<DropdownRect | null>(null);

  const isFiltered = value !== allValue;

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const displaySummary = useMemo(() => {
    const valLabel = isFiltered ? selectedOption?.label || value : allLabel;
    return prefixLabel ? `${prefixLabel} : ${valLabel}` : valLabel;
  }, [isFiltered, selectedOption, value, allLabel, prefixLabel]);

  const allEntries = useMemo<FilterOptionItem[]>(
    () => [{ value: allValue, label: allLabel }, ...options],
    [allValue, allLabel, options]
  );

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter((opt) => {
      const hay = `${opt.value} ${opt.label} ${opt.keywords || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allEntries, query]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setRect(computeDropdownRect(containerRef.current));
  }, [isOpen, query, visibleEntries.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => {
      setRect(computeDropdownRect(containerRef.current));
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      setQuery("");
    };
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, isOpen]);

  const selectValue = (nextVal: string) => {
    onChange(nextVal);
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div
      ref={containerRef}
      title={title}
      className={`relative flex items-center rounded-lg border transition ${
        isFiltered
          ? "bg-[#4C2812] dark:bg-[#E89C1D] border-[#4C2812] dark:border-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
          : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#5C351B] text-[#321B0A] dark:text-[#FAF7F2] hover:border-[#E89C1D]/70"
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? query : displaySummary}
        placeholder={placeholder || displaySummary}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            setQuery("");
          }
        }}
        onChange={(e) => {
          if (!isOpen) setIsOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            else {
              setHighlightIdx((i) =>
                visibleEntries.length > 0 ? (i + 1) % visibleEntries.length : 0
              );
            }
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (isOpen && visibleEntries.length > 0) {
              setHighlightIdx(
                (i) => (i - 1 + visibleEntries.length) % visibleEntries.length
              );
            }
          } else if (e.key === "Enter") {
            if (isOpen && visibleEntries.length > 0) {
              e.preventDefault();
              const chosen = visibleEntries[highlightIdx] || visibleEntries[0];
              if (chosen) selectValue(chosen.value);
            }
          } else if (e.key === "Escape" || e.key === "Tab") {
            setIsOpen(false);
            setQuery("");
          }
        }}
        className={`w-full min-w-0 bg-transparent pl-2.5 pr-1 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer focus:cursor-text truncate ${
          isFiltered
            ? "placeholder:text-[#F7BA42]/80 dark:placeholder:text-[#1F1209]/70"
            : "placeholder:text-[#6E472B] dark:placeholder:text-[#DECAB1]"
        }`}
      />

      {isFiltered && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            selectValue(allValue);
          }}
          className="p-1 mr-0.5 rounded hover:bg-black/15 dark:hover:bg-white/20 cursor-pointer shrink-0"
          title="Réinitialiser"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            setQuery("");
          } else {
            setIsOpen(true);
            setQuery("");
            inputRef.current?.focus();
          }
        }}
        className="pr-2 pl-0.5 py-1.5 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: rect.openUp ? undefined : rect.top,
              bottom: rect.openUp ? window.innerHeight - rect.top : undefined,
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
            }}
            className="z-50 overflow-y-auto rounded-xl border border-[#D4BC9E] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] shadow-xl py-1 text-xs"
          >
            {visibleEntries.length === 0 ? (
              <div className="px-3 py-2 text-[#6E472B] dark:text-[#DECAB1] italic">
                —
              </div>
            ) : (
              visibleEntries.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightIdx;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => selectValue(opt.value)}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold"
                        : isHighlighted
                        ? "bg-[#FDF4E3] dark:bg-[#351F11] text-[#321B0A] dark:text-[#FAF7F2]"
                        : "text-[#321B0A] dark:text-[#FAF7F2] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.count !== undefined && (
                      <span
                        className={`font-mono text-[10px] tabular-nums shrink-0 ${
                          isSelected
                            ? "opacity-90"
                            : "text-[#6E472B] dark:text-[#DECAB1]"
                        }`}
                      >
                        {opt.count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

interface MultiFilterOptionFieldProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: FilterOptionItem[];
  allLabel: string;
  prefixLabel?: string;
  placeholder?: string;
  title?: string;
  className?: string;
}

export const MultiFilterOptionField: React.FC<MultiFilterOptionFieldProps> = ({
  values,
  onChange,
  options,
  allLabel,
  prefixLabel,
  placeholder,
  title,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [rect, setRect] = useState<DropdownRect | null>(null);

  const isFiltered = values.length > 0;

  const displaySummary = useMemo(() => {
    let valText = allLabel;
    if (values.length > 0) {
      if (values.length <= 2) {
        valText = values
          .map((v) => options.find((o) => o.value === v)?.label || v)
          .join(", ");
      } else {
        valText = `${values.length} sélect.`;
      }
    }
    return prefixLabel ? `${prefixLabel} : ${valText}` : valText;
  }, [values, options, allLabel, prefixLabel]);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.value} ${opt.label} ${opt.keywords || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setRect(computeDropdownRect(containerRef.current));
  }, [isOpen, query, visibleOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => {
      setRect(computeDropdownRect(containerRef.current));
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      setQuery("");
    };
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, isOpen]);

  const toggleVal = (val: string) => {
    onChange(
      values.includes(val) ? values.filter((v) => v !== val) : [...values, val]
    );
  };

  return (
    <div
      ref={containerRef}
      title={title}
      className={`relative flex items-center rounded-lg border transition ${
        isFiltered
          ? "bg-[#4C2812] dark:bg-[#E89C1D] border-[#4C2812] dark:border-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
          : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#5C351B] text-[#321B0A] dark:text-[#FAF7F2] hover:border-[#E89C1D]/70"
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? query : displaySummary}
        placeholder={placeholder || displaySummary}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            setQuery("");
          }
        }}
        onChange={(e) => {
          if (!isOpen) setIsOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            else if (visibleOptions.length > 0) {
              setHighlightIdx((i) => (i + 1) % visibleOptions.length);
            }
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (isOpen && visibleOptions.length > 0) {
              setHighlightIdx(
                (i) => (i - 1 + visibleOptions.length) % visibleOptions.length
              );
            }
          } else if (e.key === "Enter") {
            if (isOpen && visibleOptions.length > 0) {
              e.preventDefault();
              const chosen = visibleOptions[highlightIdx] || visibleOptions[0];
              if (chosen) toggleVal(chosen.value);
            }
          } else if (e.key === "Escape" || e.key === "Tab") {
            setIsOpen(false);
            setQuery("");
          }
        }}
        className={`w-full min-w-0 bg-transparent pl-2.5 pr-1 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer focus:cursor-text truncate ${
          isFiltered
            ? "placeholder:text-[#F7BA42]/80 dark:placeholder:text-[#1F1209]/70"
            : "placeholder:text-[#6E472B] dark:placeholder:text-[#DECAB1]"
        }`}
      />

      {isFiltered && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onChange([]);
          }}
          className="p-1 mr-0.5 rounded hover:bg-black/15 dark:hover:bg-white/20 cursor-pointer shrink-0"
          title="Tout effacer"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            setQuery("");
          } else {
            setIsOpen(true);
            setQuery("");
            inputRef.current?.focus();
          }
        }}
        className="pr-2 pl-0.5 py-1.5 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: rect.openUp ? undefined : rect.top,
              bottom: rect.openUp ? window.innerHeight - rect.top : undefined,
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
            }}
            className="z-50 overflow-y-auto rounded-xl border border-[#D4BC9E] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] shadow-xl py-1 text-xs"
          >
            {isFiltered && !query.trim() && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([]);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-b border-[#E6D7C3]/60 dark:border-[#4C2812]/60 cursor-pointer"
              >
                {allLabel}
              </button>
            )}
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-2 text-[#6E472B] dark:text-[#DECAB1] italic">
                —
              </div>
            ) : (
              visibleOptions.map((opt, idx) => {
                const checked = values.includes(opt.value);
                const isHighlighted = idx === highlightIdx;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => toggleVal(opt.value)}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      checked
                        ? "bg-[#FDF4E3] dark:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] font-bold"
                        : isHighlighted
                        ? "bg-[#FAF7F2] dark:bg-[#28170C] text-[#321B0A] dark:text-[#FAF7F2]"
                        : "text-[#321B0A] dark:text-[#FAF7F2] hover:bg-[#FAF7F2] dark:hover:bg-[#28170C]"
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded border inline-flex items-center justify-center shrink-0 ${
                          checked
                            ? "bg-[#4C2812] dark:bg-[#E89C1D] border-[#4C2812] dark:border-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]"
                            : "border-[#D4BC9E] dark:border-[#5C351B]"
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5" />}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.count !== undefined && (
                      <span className="font-mono text-[10px] tabular-nums shrink-0 text-[#6E472B] dark:text-[#DECAB1]">
                        {opt.count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
