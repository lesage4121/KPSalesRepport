/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { 
  Filter, 
  MapPin, 
  Banknote, 
  Binoculars, 
  ShieldAlert,
  CalendarDays,
} from "lucide-react";
import { DateRangePicker, dcsDateToIso } from "./ui/DateRangePicker";
import { useLanguage } from "../context/LanguageContext";

export interface FilterState {
  dateStr: string; // "ALL" or specific date string "01JUN"
  startDate: string; // "YYYY-MM-DD" or ""
  endDate: string; // "YYYY-MM-DD" or ""
  stationNumber: string; // "ALL" or specific number "03222811"
  cityName: string; // "ALL" or specific city
  currency: string; // "ALL" or specific currency
  stationType: string; // "ALL", "CT" (Ville), "AP" (Aéroport), "CC" (Call Center)
  hasErrorsOnly: boolean; // boolean
}

interface InteractiveFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableDates: string[];
  availableStations: { number: string; name: string }[];
  availableCities: string[];
  availableCurrencies: string[];
}

export const InteractiveFilters: React.FC<InteractiveFiltersProps> = ({
  filters,
  onFilterChange,
  availableDates,
  availableStations,
  availableCities,
  availableCurrencies
}) => {
  const { pick } = useLanguage();

  const availableIsoDates = useMemo(
    () => availableDates.map((d) => dcsDateToIso(d, "26")).filter(Boolean),
    [availableDates]
  );

  const handleChange = (field: keyof FilterState, value: unknown) => {
    if (field === "dateStr") {
      onFilterChange({
        ...filters,
        dateStr: (value as string) || "ALL",
        ...(value && value !== "ALL" ? { startDate: "", endDate: "" } : {}),
      });
      return;
    }
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  const handleReset = () => {
    onFilterChange({
      dateStr: "ALL",
      startDate: "",
      endDate: "",
      stationNumber: "ALL",
      cityName: "ALL",
      currency: "ALL",
      stationType: "ALL",
      hasErrorsOnly: false
    });
  };

  return (
    <div className="bg-white dark:bg-[#1F1209] p-5 rounded-2xl border border-slate-200 dark:border-[#4C2812] shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#4C2812]">
        <div id="filter-header" className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-[#FAF7F2] text-sm">
            {pick("Filtres & Paramètres d'Audit", "Filters & Audit Settings")}
          </h3>
        </div>
        <button
          id="btn-reset-filters"
          type="button"
          onClick={handleReset}
          className="text-xs text-indigo-600 dark:text-[#F7BA42] hover:text-indigo-800 dark:hover:underline font-medium transition cursor-pointer"
        >
          {pick("Réinitialiser les filtres", "Reset all filters")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-4">
        {/* Date Range Picker */}
        <div id="filter-date-range-container" className="sm:col-span-2">
          <DateRangePicker
            id="input-filter-date-range"
            label={pick("Plage de dates", "Date Range")}
            startDate={filters.startDate}
            endDate={filters.endDate}
            availableIsoDates={availableIsoDates}
            onChange={({ startDate, endDate }) => {
              onFilterChange({
                ...filters,
                dateStr: startDate || endDate ? "ALL" : filters.dateStr,
                startDate,
                endDate,
              });
            }}
          />
        </div>

        {/* Specific Date Selector */}
        <div id="filter-date-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 dark:text-[#DECAB1] mb-1.5 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            {pick("Date précise", "Specific Date")}
          </label>
          <input
            id="input-filter-date"
            list="dates-list"
            value={filters.dateStr === "ALL" ? "" : filters.dateStr}
            onChange={(e) => handleChange("dateStr", e.target.value || "ALL")}
            placeholder={pick("Toutes dates", "All dates")}
            className="min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          <datalist id="dates-list">
            <option value="ALL">{pick("Toutes dates", "All dates")}</option>
            {availableDates.map(date => (
              <option key={date} value={date}>{date} (2026)</option>
            ))}
          </datalist>
        </div>

        {/* Station Name/Num Selector */}
        <div id="filter-station-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 dark:text-[#DECAB1] mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {pick("Code Station", "Station Code")}
          </label>
          <input
            id="input-filter-station"
            list="stations-list"
            value={filters.stationNumber === "ALL" ? "" : filters.stationNumber}
            onChange={(e) => handleChange("stationNumber", e.target.value || "ALL")}
            placeholder={pick("Toutes stations", "All stations")}
            className="min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="stations-list">
            <option value="ALL">{pick("Toutes stations", "All stations")}</option>
            {availableStations.map(station => (
              <option key={station.number} value={station.number}>
                {station.name} ({station.number})
              </option>
            ))}
          </datalist>
        </div>

        {/* City Selector */}
        <div id="filter-city-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 dark:text-[#DECAB1] mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {pick("Ville (ABJ, LFW...)", "City (ABJ, LFW...)")}
          </label>
          <input
            id="input-filter-city"
            list="cities-list"
            value={filters.cityName === "ALL" ? "" : filters.cityName}
            onChange={(e) => handleChange("cityName", (e.target.value || "ALL").toUpperCase())}
            placeholder={pick("Toutes villes", "All cities")}
            className="min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
          />
          <datalist id="cities-list">
            <option value="ALL">{pick("Toutes villes", "All cities")}</option>
            {availableCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </datalist>
        </div>

        {/* Office Type Selector */}
        <div id="filter-type-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 dark:text-[#DECAB1] mb-1.5 flex items-center gap-1">
            <Binoculars className="w-3.5 h-3.5 text-slate-400" />
            {pick("Type Station", "Station Type")}
          </label>
          <select
            id="select-filter-type"
            value={filters.stationType}
            onChange={(e) => handleChange("stationType", e.target.value)}
            className="min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">{pick("Tous types", "All types")}</option>
            <option value="CT">CT - City Office</option>
            <option value="AP">AP - Airport</option>
            <option value="CC">CC - Call Center</option>
          </select>
        </div>

        {/* Currency Selector */}
        <div id="filter-currency-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 dark:text-[#DECAB1] mb-1.5 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-slate-400" />
            {pick("Devise", "Audit Currency")}
          </label>
          <input
            id="input-filter-currency"
            list="currencies-list"
            value={filters.currency === "ALL" ? "" : filters.currency}
            onChange={(e) => handleChange("currency", e.target.value || "ALL")}
            placeholder={pick("Toutes devises", "All currencies")}
            className="min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="currencies-list">
            <option value="ALL">{pick("Toutes devises", "All currencies")}</option>
            {availableCurrencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </datalist>
        </div>

        {/* Audit Filter (Errors / Anomaly Only) */}
        <div id="filter-anomaly-container" className="sm:col-span-2 md:col-span-4 xl:col-span-2 flex flex-col justify-end">
          <button
            id="toggle-filter-errors"
            type="button"
            onClick={() => handleChange("hasErrorsOnly", !filters.hasErrorsOnly)}
            className={`w-full min-h-[40px] text-xs font-semibold rounded-xl px-3 py-2 flex items-center justify-center gap-2 transition-all border cursor-pointer whitespace-nowrap ${
              filters.hasErrorsOnly
                ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-200 font-bold shadow-sm"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <ShieldAlert className={`w-4 h-4 shrink-0 ${filters.hasErrorsOnly ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`} />
            <span>{pick("Anomalies uniquement", "Anomalies Only")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

