/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export interface FilterComboboxOption {
  value: string;
  label: string;
  searchText?: string;
}

interface FilterComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterComboboxOption[];
  placeholder: string;
  allLabel?: string;
  theme?: "warm" | "slate";
  widthClass?: string;
  title?: string;
}

export const FilterCombobox: React.FC<FilterComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder,
  allLabel = "Tous",
  theme = "warm",
  widthClass = "w-36",
  title,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  // Sync display text when external value resets to ALL or changes via click
  useEffect(() => {
    if (!isTyping) {
      if (!value || value === "ALL") {
        setDraft("");
      } else if (selectedOption) {
        setDraft(selectedOption.label);
      } else {
        setDraft(value);
      }
    }
  }, [value, selectedOption, isTyping]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsTyping(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    // If the displayed draft exactly equals the currently selected option's label, show full list so user can pick another easily
    if (!q || (selectedOption && draft === selectedOption.label && !isTyping)) {
      return options;
    }
    return options.filter((o) => {
      const hay = `${o.value} ${o.label} ${o.searchText || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, draft, selectedOption, isTyping]);

  const isActive = Boolean(value && value !== "ALL");

  const themeClasses =
    theme === "warm"
      ? {
          wrapper: isActive
            ? "bg-[#FDF4E3] dark:bg-[#351F11] border-[#E89C1D] text-[#321B0A] dark:text-[#FAF7F2]"
            : "bg-[#FAF7F2] dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#5C351B] text-[#321B0A] dark:text-[#FAF7F2]",
          input:
            "placeholder-[#6E472B]/75 dark:placeholder-[#DECAB1]/60 text-[#321B0A] dark:text-[#FAF7F2]",
          icon: "text-[#8C5214] dark:text-[#F7BA42]",
          dropdown:
            "bg-white dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#5C351B] shadow-xl",
          item: "text-[#321B0A] dark:text-[#FAF7F2] hover:bg-[#FDF4E3] dark:hover:bg-[#3A2212]",
          itemSelected:
            "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold",
        }
      : {
          wrapper: isActive
            ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 text-slate-900 dark:text-slate-100"
            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200",
          input:
            "placeholder-slate-500 dark:placeholder-slate-400 text-slate-800 dark:text-slate-100",
          icon: "text-slate-500 dark:text-slate-400",
          dropdown:
            "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl",
          item: "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
          itemSelected:
            "bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold",
        };

  return (
    <div ref={containerRef} className={`relative ${widthClass}`} title={title}>
      <div
        className={`flex items-center min-h-[34px] border rounded-xl px-2 transition focus-within:ring-2 focus-within:ring-[#E89C1D] ${themeClasses.wrapper}`}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onFocus={() => {
            setIsOpen(true);
          }}
          onChange={(e) => {
            const txt = e.target.value;
            setIsTyping(true);
            setDraft(txt);
            setIsOpen(true);
            onChange(txt.trim() === "" ? "ALL" : txt);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              setIsTyping(false);
              inputRef.current?.blur();
            } else if (e.key === "Enter" && isOpen && filteredOptions.length === 1) {
              e.preventDefault();
              const only = filteredOptions[0];
              setIsTyping(false);
              setDraft(only.label);
              onChange(only.value);
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          className={`w-full min-w-0 bg-transparent text-xs font-mono font-semibold focus:outline-none py-1 pr-1 ${themeClasses.input}`}
        />

        {isActive && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsTyping(false);
              setDraft("");
              onChange("ALL");
              setIsOpen(false);
            }}
            className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0 ${themeClasses.icon}`}
            aria-label="Clear filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen((prev) => !prev);
            if (!isOpen) inputRef.current?.focus();
          }}
          className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0 ${themeClasses.icon}`}
          aria-label="Toggle options"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-1 z-50 border rounded-xl max-h-60 overflow-y-auto py-1 text-xs font-mono ${themeClasses.dropdown}`}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsTyping(false);
              setDraft("");
              onChange("ALL");
              setIsOpen(false);
            }}
            className={`w-full text-left px-2.5 py-1.5 cursor-pointer transition-colors ${
              !isActive ? themeClasses.itemSelected : themeClasses.item
            }`}
          >
            {allLabel}
          </button>

          {filteredOptions.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] font-sans opacity-70 italic">
              Filtre texte actif ({draft})
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsTyping(false);
                    setDraft(opt.label);
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 cursor-pointer transition-colors truncate ${
                    selected ? themeClasses.itemSelected : themeClasses.item
                  }`}
                  title={opt.label}
                >
                  {opt.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
