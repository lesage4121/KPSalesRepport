/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, RotateCcw, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import {
  DEFAULT_XOF_RATES,
  loadDisplayCurrency,
  loadXofRates,
  resetXofRates,
  saveDisplayCurrency,
  saveXofRates,
} from "../../utils/emdAudit";

interface XofRatesPopoverProps {
  currenciesInUse?: string[];
  theme?: "warm" | "slate";
}

const CORE_CURRENCIES = ["XOF", "EUR", "USD", "XAF", "NGN", "ZAR", "GHS", "MRU"];

export const XofRatesPopover: React.FC<XofRatesPopoverProps> = ({
  currenciesInUse = [],
  theme = "warm",
}) => {
  const { pick } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>(() => loadXofRates());
  const [displayCurrency, setDisplayCurrency] = useState<string>(() =>
    loadDisplayCurrency()
  );
  const [newCode, setNewCode] = useState("");
  const [newRate, setNewRate] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 80,
    left: 20,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncRates = () => setRates(loadXofRates());
    const syncCur = () => setDisplayCurrency(loadDisplayCurrency());
    window.addEventListener("kp-xof-rates-updated", syncRates);
    window.addEventListener("kp-display-currency-updated", syncCur);
    return () => {
      window.removeEventListener("kp-xof-rates-updated", syncRates);
      window.removeEventListener("kp-display-currency-updated", syncCur);
    };
  }, []);

  const updatePosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn || typeof window === "undefined") return;
    const rect = btn.getBoundingClientRect();
    const panelWidth = 288; // w-72
    const estHeight = 400;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(12, Math.min(rect.right - panelWidth, vw - panelWidth - 12));
    const top =
      rect.bottom + 6 + estHeight > vh
        ? Math.max(12, rect.top - estHeight - 6)
        : rect.bottom + 6;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onResizeOrScroll = () => updatePosition();
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [isOpen, updatePosition]);

  const selectableDisplayCurrencies = Array.from(
    new Set([
      "XOF",
      "EUR",
      "USD",
      ...currenciesInUse.map((c) => c.trim().toUpperCase()),
      ...CORE_CURRENCIES,
      ...Object.keys(rates),
    ])
  ).filter((c) => /^[A-Z]{3}$/.test(c));

  const displayedCurrencies = Array.from(
    new Set([
      ...currenciesInUse.map((c) => c.trim().toUpperCase()),
      ...CORE_CURRENCIES,
      ...Object.keys(rates),
    ])
  )
    .filter((c) => c && c !== "XOF")
    .sort((a, b) => {
      const aActive = currenciesInUse.includes(a) ? 0 : 1;
      const bActive = currenciesInUse.includes(b) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const aCore = CORE_CURRENCIES.includes(a) ? 0 : 1;
      const bCore = CORE_CURRENCIES.includes(b) ? 0 : 1;
      if (aCore !== bCore) return aCore - bCore;
      return a.localeCompare(b);
    });

  const handleRateChange = (cur: string, val: string) => {
    const num = parseFloat(val);
    if (!Number.isFinite(num) || num <= 0) return;
    const next = { ...rates, [cur]: num };
    setRates(next);
    saveXofRates(next);
  };

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    const num = parseFloat(newRate);
    if (code.length !== 3 || !Number.isFinite(num) || num <= 0) return;
    const next = { ...rates, [code]: num };
    setRates(next);
    saveXofRates(next);
    setNewCode("");
    setNewRate("");
  };

  const btnClass =
    theme === "warm"
      ? "min-h-[34px] px-2.5 py-1 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
      : "px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap";

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <select
        value={displayCurrency}
        onChange={(e) => {
          const cur = e.target.value;
          setDisplayCurrency(cur);
          saveDisplayCurrency(cur);
        }}
        aria-label={pick("Monnaie d'affichage", "Display currency")}
        title={pick("Monnaie d'affichage des totaux", "Total display currency")}
        className={
          theme === "warm"
            ? "min-h-[34px] px-2 py-1 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#F7BA42] text-xs font-mono font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
            : "px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
        }
      >
        {selectableDisplayCurrencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={btnClass}
        title={pick("Configurer les taux de change", "Configure exchange rates")}
      >
        <ArrowRightLeft className="w-3.5 h-3.5 text-[#E89C1D]" />
        <span>{pick("Taux", "Rates")}</span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[80] w-72 rounded-2xl border border-[#E6D7C3] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3.5 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#321B0A] dark:text-slate-100">
              {pick("Taux de conversion (base XOF)", "Conversion rates (XOF base)")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRates(resetXofRates())}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
                title={pick("Réinitialiser", "Reset")}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {displayedCurrencies.map((cur) => {
              const rateVal = rates[cur] ?? DEFAULT_XOF_RATES[cur] ?? 1;
              const isUsed = currenciesInUse.includes(cur);
              return (
                <div
                  key={cur}
                  className="flex items-center justify-between gap-2 font-mono text-[11px]"
                >
                  <span
                    className={`font-bold ${
                      isUsed
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    1 {cur} =
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      defaultValue={rateVal}
                      key={`${cur}-${rateVal}`}
                      onBlur={(e) => handleRateChange(cur, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRateChange(cur, (e.target as HTMLInputElement).value);
                        }
                      }}
                      disabled={cur === "XAF"}
                      className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold disabled:opacity-60"
                    />
                    <span className="text-slate-500 dark:text-slate-400">XOF</span>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleAddCurrency}
            className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="DEV"
              maxLength={3}
              className="w-14 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px] uppercase text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              step="any"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder={pick("Taux XOF", "XOF rate")}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px] text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] font-bold text-[11px] cursor-pointer"
            >
              +
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
