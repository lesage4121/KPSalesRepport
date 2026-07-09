
import React from "react";
import { 
  Filter, 
  CalendarRange, 
  MapPin, 
  Banknote, 
  Binoculars, 
  ShieldAlert,
  CalendarDays,
  Target
} from "lucide-react";

export interface FilterState {
  dateStr: string; 
  startDate: string;
  endDate: string; 
  stationNumber: string;
  cityName: string; 
  currency: string;
  stationType: string; 
  hasErrorsOnly: boolean; 
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
  const handleChange = (field: keyof FilterState, value: any) => {
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
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
        <div id="filter-header" className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Filters & Audit Settings</h3>
        </div>
        <button
          id="btn-reset-filters"
          onClick={handleReset}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition cursor-pointer"
        >
          Reset all filters
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {/* Date Selector */}
        <div id="filter-date-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            Specific Date
          </label>
          <input
            id="input-filter-date"
            list="dates-list"
            value={filters.dateStr === "ALL" ? "" : filters.dateStr}
            onChange={(e) => handleChange("dateStr", e.target.value || "ALL")}
            placeholder="All dates"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="dates-list">
            <option value="ALL">All dates</option>
            {availableDates.map(date => (
              <option key={date} value={date}>{date} (2026)</option>
            ))}
          </datalist>
        </div>

        {/* Start Date Picker */}
        <div id="filter-start-date-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5 text-indigo-500" />
            Start Date
          </label>
          <input
            id="input-filter-start-date"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleChange("startDate", e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-sans"
          />
        </div>

        {/* End Date Picker */}
        <div id="filter-end-date-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5 text-indigo-500" />
            End Date
          </label>
          <input
            id="input-filter-end-date"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleChange("endDate", e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-sans"
          />
        </div>

        {/* Station Name/Num Selector */}
        <div id="filter-station-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            Station Code
          </label>
          <input
            id="input-filter-station"
            list="stations-list"
            value={filters.stationNumber === "ALL" ? "" : filters.stationNumber}
            onChange={(e) => handleChange("stationNumber", e.target.value || "ALL")}
            placeholder="All stations"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="stations-list">
            <option value="ALL">All stations</option>
            {availableStations.map(station => (
              <option key={station.number} value={station.number}>
                {station.name} ({station.number})
              </option>
            ))}
          </datalist>
        </div>

        {/* City Selector */}
        <div id="filter-city-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            City
          </label>
          <input
            id="input-filter-city"
            list="cities-list"
            value={filters.cityName === "ALL" ? "" : filters.cityName}
             onChange={(e) => handleChange("cityName", (e.target.value || "ALL").toUpperCase())}
            placeholder="All cities"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"          />
          <datalist id="cities-list">
            <option value="ALL">All cities</option>
            {availableCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </datalist>
        </div>

        {/* Office Type Selector */}
        <div id="filter-type-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <Binoculars className="w-3.5 h-3.5 text-slate-400" />
            Station Type
          </label>
          <select
            id="select-filter-type"
            value={filters.stationType}
            onChange={(e) => handleChange("stationType", e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All types</option>
            <option value="CT">CT - City Office</option>
            <option value="AP">AP - Airport</option>
            <option value="CC">CC - Call Center</option>
          </select>
        </div>

        {/* Currency Selector */}
        <div id="filter-currency-container" className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-slate-400" />
            Audit Currency
          </label>
          <input
            id="input-filter-currency"
            list="currencies-list"
            value={filters.currency === "ALL" ? "" : filters.currency}
            onChange={(e) => handleChange("currency", e.target.value || "ALL")}
            placeholder="All currencies"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="currencies-list">
            <option value="ALL">All currencies</option>
            {availableCurrencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </datalist>
        </div>

        {/* Audit Filter (Errors / Anomaly Only) */}
        <div id="filter-anomaly-container" className="flex flex-col justify-end">
          <button
            id="toggle-filter-errors"
            onClick={() => handleChange("hasErrorsOnly", !filters.hasErrorsOnly)}
            className={`w-full text-xs font-semibold rounded-xl p-2.5 flex items-center justify-center gap-2 transition-all border ${
              filters.hasErrorsOnly
                ? "bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-sm"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${filters.hasErrorsOnly ? "text-rose-600" : "text-slate-400"}`} />
            Anomalies Only
            {filters.hasErrorsOnly && (
              <span className="bg-rose-500 text-white rounded-full w-2 h-2 bloock"></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
