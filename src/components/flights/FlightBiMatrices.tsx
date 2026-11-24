import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Plane,
  Route,
  Search,
  Table2,
} from "lucide-react";
import {
  AircraftTimeUtilizationRow,
  FlightNumberGroupAnalytics,
  SectorPerformanceRow,
  TailUtilizationRow,
  formatMinutesAsDuration,
} from "../../utils/flightAnalytics";
import { useLanguage } from "../../context/LanguageContext";

interface FlightBiMatricesProps {
  flightNumberGroups: FlightNumberGroupAnalytics[];
  tailUtilization: TailUtilizationRow[];
  aircraftTimeUtilization: AircraftTimeUtilizationRow[];
  sectorPerformance: SectorPerformanceRow[];
  activeFlightFilter: string;
  activeAircraftFilter: string;
  onSelectFlight: (flightNumber: string) => void;
  onSelectAircraft: (regValue: string) => void;
  visibleTab?: "FLIGHTS" | "FLEET" | "SECTORS";
}

type MatrixTab = "FLIGHTS" | "FLEET" | "SECTORS";
type SortDir = "asc" | "desc";

export const FlightBiMatrices: React.FC<FlightBiMatricesProps> = ({
  flightNumberGroups,
  tailUtilization,
  aircraftTimeUtilization,
  sectorPerformance,
  activeFlightFilter,
  activeAircraftFilter,
  onSelectFlight,
  onSelectAircraft,
  visibleTab,
}) => {
  const { locale, pick } = useLanguage();
  const [activeTab, setActiveTab] = useState<MatrixTab>(visibleTab || "FLIGHTS");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("traveledTotal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const effectiveTab = visibleTab || activeTab;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const renderSortIcon = (col: string) => {
    if (sortCol !== col) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />;
    }
    return sortDir === "desc" ? (
      <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-amber-400 shrink-0" />
    ) : (
      <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-amber-400 shrink-0" />
    );
  };

  const q = search.trim().toLowerCase();

  const sortedFlights = useMemo(() => {
    const filtered = flightNumberGroups.filter((fg) => {
      if (!q) return true;
      return [
        `kp${fg.flightNumber}`,
        fg.origins.join(" "),
        fg.destinations.join(" "),
        fg.registrations.join(" "),
        fg.primaryAircraftType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      switch (sortCol) {
        case "flightNumber":
          return (
            ((parseInt(a.flightNumber, 10) || 0) -
              (parseInt(b.flightNumber, 10) || 0)) *
            mul
          );
        case "segmentsCount":
          return (a.segmentsCount - b.segmentsCount) * mul;
        case "avgCapacity":
          return ((a.avgCapacity ?? -1) - (b.avgCapacity ?? -1)) * mul;
        case "avgTraveled":
          return (a.avgTraveled - b.avgTraveled) * mul;
        case "loadFactorPct":
          return ((a.loadFactorPct ?? -1) - (b.loadFactorPct ?? -1)) * mul;
        case "ecoLfPct":
          return ((a.ecoLfPct ?? -1) - (b.ecoLfPct ?? -1)) * mul;
        case "bizLfPct":
          return ((a.bizLfPct ?? -1) - (b.bizLfPct ?? -1)) * mul;
        case "noShowRatePct":
          return (a.noShowRatePct - b.noShowRatePct) * mul;
        case "avgWeightPerPax":
          return (a.avgWeightPerPax - b.avgWeightPerPax) * mul;
        case "emdCount":
          return (a.emdCount - b.emdCount) * mul;
        case "traveledTotal":
        default:
          return (a.traveledTotal - b.traveledTotal) * mul;
      }
    });
  }, [flightNumberGroups, q, sortCol, sortDir]);

  const fleetCombined = useMemo(() => {
    const timeMap = new Map<string, AircraftTimeUtilizationRow>();
    for (const row of aircraftTimeUtilization) {
      timeMap.set(row.tailNbr, row);
    }

    const merged = tailUtilization.map((t) => {
      const time = timeMap.get(t.tailNbr);
      return {
        ...t,
        totalFlightMinutes: time?.totalFlightMinutes ?? 0,
        totalTurnaroundMinutes: time?.totalTurnaroundMinutes ?? 0,
        avgDailyFlightHours: time?.avgDailyFlightHours ?? 0,
        utilizationRatePct: time?.utilizationRatePct ?? 0,
        activeDaysCount: time?.activeDaysCount ?? 0,
      };
    });

    const filtered = merged.filter((m) => {
      if (!q) return true;
      return [
        m.tailNbr,
        m.equipmentType,
        m.aircraftConfig,
        m.flightNumbers.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      switch (sortCol) {
        case "tailNbr":
          return a.tailNbr.localeCompare(b.tailNbr) * mul;
        case "segmentsCount":
          return (a.segmentsCount - b.segmentsCount) * mul;
        case "offeredSeats":
          return (a.offeredSeats - b.offeredSeats) * mul;
        case "emptySeats":
          return (a.emptySeats - b.emptySeats) * mul;
        case "loadFactorPct":
          return (a.loadFactorPct - b.loadFactorPct) * mul;
        case "totalFlightMinutes":
          return (a.totalFlightMinutes - b.totalFlightMinutes) * mul;
        case "utilizationRatePct":
          return (a.utilizationRatePct - b.utilizationRatePct) * mul;
        case "traveledTotal":
        default:
          return (a.traveledTotal - b.traveledTotal) * mul;
      }
    });
  }, [tailUtilization, aircraftTimeUtilization, q, sortCol, sortDir]);

  const sortedSectors = useMemo(() => {
    const filtered = sectorPerformance.filter((s) => {
      if (!q) return true;
      return s.sector.toLowerCase().includes(q);
    });

    return [...filtered].sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      switch (sortCol) {
        case "sector":
          return a.sector.localeCompare(b.sector) * mul;
        case "segmentsCount":
          return (a.segmentsCount - b.segmentsCount) * mul;
        case "avgTraveled":
          return (a.avgTraveled - b.avgTraveled) * mul;
        case "offeredSeats":
          return (a.offeredSeats - b.offeredSeats) * mul;
        case "loadFactorPct":
          return ((a.loadFactorPct ?? -1) - (b.loadFactorPct ?? -1)) * mul;
        case "noShowRatePct":
          return (a.noShowRatePct - b.noShowRatePct) * mul;
        case "totalWeight":
          return (a.totalWeight - b.totalWeight) * mul;
        case "traveledTotal":
        default:
          return (a.traveledTotal - b.traveledTotal) * mul;
      }
    });
  }, [sectorPerformance, q, sortCol, sortDir]);

  const getLfBarColor = (lf: number | null) => {
    if (lf === null) return "bg-slate-400";
    if (lf >= 80) return "bg-emerald-500";
    if (lf >= 60) return "bg-indigo-500";
    if (lf >= 40) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shrink-0">
            <Table2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              {pick(
                "Matrice BI Interactive & Pivot Décisionnel",
                "Interactive BI Pivot Matrix"
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {pick(
                "Cliquez sur une ligne pour filtrer tout le tableau de bord · Tri multi-colonnes",
                "Click any row to cross-filter the entire dashboard · Multi-column sorting"
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!visibleTab && (
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("FLIGHTS");
                  setSortCol("traveledTotal");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  effectiveTab === "FLIGHTS"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Plane className="w-3.5 h-3.5" />
                {pick(`Vols (${flightNumberGroups.length})`, `Flights (${flightNumberGroups.length})`)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("FLEET");
                  setSortCol("traveledTotal");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  effectiveTab === "FLEET"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {pick(`Flotte (${tailUtilization.length})`, `Fleet (${tailUtilization.length})`)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("SECTORS");
                  setSortCol("traveledTotal");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  effectiveTab === "SECTORS"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                {pick(`Tronçons (${sectorPerformance.length})`, `Sectors (${sectorPerformance.length})`)}
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={pick("Rechercher vol, immat, escale...", "Search flight, tail, sector...")}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {effectiveTab === "FLIGHTS" && (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
              <tr>
                <th className="py-2.5 px-3">
                  <button type="button" onClick={() => handleSort("flightNumber")} className="inline-flex items-center gap-1 cursor-pointer hover:text-indigo-600">
                    {pick("N° Vol", "Flight")} {renderSortIcon("flightNumber")}
                  </button>
                </th>
                <th className="py-2.5 px-3">{pick("Axes", "Origins / Dest.")}</th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("segmentsCount")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Vols", "Legs")} {renderSortIcon("segmentsCount")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("avgCapacity")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Cap. Moy.", "Avg Cap.")} {renderSortIcon("avgCapacity")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("avgTraveled")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Moy. Pax", "Avg Pax")} {renderSortIcon("avgTraveled")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("traveledTotal")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Total Pax", "Total Pax")} {renderSortIcon("traveledTotal")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right min-w-[130px]">
                  <button type="button" onClick={() => handleSort("loadFactorPct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    Load Factor {renderSortIcon("loadFactorPct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("ecoLfPct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    Éco LF {renderSortIcon("ecoLfPct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("bizLfPct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    Biz LF {renderSortIcon("bizLfPct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("noShowRatePct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    No-Show {renderSortIcon("noShowRatePct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("avgWeightPerPax")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    kg/pax {renderSortIcon("avgWeightPerPax")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("emdCount")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    EMD {renderSortIcon("emdCount")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
              {sortedFlights.map((fg) => {
                const isSelected = activeFlightFilter === fg.flightNumber;
                return (
                  <tr
                    key={fg.flightNumber}
                    onClick={() =>
                      onSelectFlight(isSelected ? "ALL" : fg.flightNumber)
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50/90 dark:bg-indigo-950/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        KP{fg.flightNumber}
                        {isSelected && <Filter className="w-3 h-3 text-indigo-600 dark:text-amber-400" />}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                      {fg.origins.join("/")} → {fg.destinations.slice(0, 3).join("/")}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {fg.segmentsCount}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {fg.avgCapacity ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {fg.avgTraveled}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                      {fg.traveledTotal.toLocaleString(locale)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {fg.loadFactorPct !== null ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getLfBarColor(fg.loadFactorPct)}`}
                              style={{ width: `${Math.min(100, fg.loadFactorPct)}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 w-11 text-right">
                            {fg.loadFactorPct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {fg.ecoLfPct !== null ? `${fg.ecoLfPct}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {fg.bizLfPct !== null ? `${fg.bizLfPct}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={
                          fg.noShowRatePct >= 10
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-slate-600 dark:text-slate-400"
                        }
                      >
                        {fg.noShowRatePct}% ({fg.noShowTotal})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {fg.avgWeightPerPax}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {fg.emdCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {effectiveTab === "FLEET" && (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
              <tr>
                <th className="py-2.5 px-3">
                  <button type="button" onClick={() => handleSort("tailNbr")} className="inline-flex items-center gap-1 cursor-pointer hover:text-indigo-600">
                    {pick("Immat.", "Tail No.")} {renderSortIcon("tailNbr")}
                  </button>
                </th>
                <th className="py-2.5 px-3">{pick("Type / Config", "Type / Cfg")}</th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("segmentsCount")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Vols", "Legs")} {renderSortIcon("segmentsCount")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("offeredSeats")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Offerts", "Offered")} {renderSortIcon("offeredSeats")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("traveledTotal")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Occupés", "Occupied")} {renderSortIcon("traveledTotal")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("emptySeats")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Vides", "Empty")} {renderSortIcon("emptySeats")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right min-w-[130px]">
                  <button type="button" onClick={() => handleSort("loadFactorPct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    Load Factor {renderSortIcon("loadFactorPct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("totalFlightMinutes")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Temps Vol", "Flight Time")} {renderSortIcon("totalFlightMinutes")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">{pick("Escales", "Ground")}</th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("utilizationRatePct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Util. /12h", "Util. /12h")} {renderSortIcon("utilizationRatePct")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
              {fleetCombined.map((t) => {
                const regVal = `REG:${t.tailNbr}`;
                const isSelected = activeAircraftFilter === regVal;
                return (
                  <tr
                    key={t.tailNbr}
                    onClick={() => onSelectAircraft(isSelected ? "ALL" : regVal)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50/90 dark:bg-indigo-950/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {t.tailNbr}
                        {isSelected && <Filter className="w-3 h-3 text-indigo-600 dark:text-amber-400" />}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {t.equipmentType} ({t.aircraftConfig})
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {t.segmentsCount}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {t.offeredSeats.toLocaleString(locale)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                      {t.traveledTotal.toLocaleString(locale)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400">
                      {t.emptySeats.toLocaleString(locale)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getLfBarColor(t.loadFactorPct)}`}
                            style={{ width: `${Math.min(100, t.loadFactorPct)}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 w-11 text-right">
                          {t.loadFactorPct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-sky-700 dark:text-sky-400">
                      {t.totalFlightMinutes > 0
                        ? formatMinutesAsDuration(t.totalFlightMinutes)
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                      {t.totalTurnaroundMinutes > 0
                        ? formatMinutesAsDuration(t.totalTurnaroundMinutes)
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                      {t.utilizationRatePct > 0 ? `${t.utilizationRatePct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
              {fleetCombined.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center font-sans text-slate-500">
                    {pick(
                      "Aucune immatriculation PTRG* associée aux vols filtrés.",
                      "No PTRG* registration matched to filtered flights."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {effectiveTab === "SECTORS" && (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
              <tr>
                <th className="py-2.5 px-3">
                  <button type="button" onClick={() => handleSort("sector")} className="inline-flex items-center gap-1 cursor-pointer hover:text-indigo-600">
                    {pick("Tronçon Physique", "Physical Sector")} {renderSortIcon("sector")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("segmentsCount")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Vols", "Flights")} {renderSortIcon("segmentsCount")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("traveledTotal")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Total Pax", "Total Pax")} {renderSortIcon("traveledTotal")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("avgTraveled")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Moy. Pax", "Avg Pax")} {renderSortIcon("avgTraveled")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("offeredSeats")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Sièges Offerts", "Offered Seats")} {renderSortIcon("offeredSeats")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right min-w-[130px]">
                  <button type="button" onClick={() => handleSort("loadFactorPct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    Load Factor {renderSortIcon("loadFactorPct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("noShowRatePct")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    No-Show {renderSortIcon("noShowRatePct")}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button type="button" onClick={() => handleSort("totalWeight")} className="inline-flex items-center gap-1 ml-auto cursor-pointer hover:text-indigo-600">
                    {pick("Bagages (kg)", "Bags (kg)")} {renderSortIcon("totalWeight")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
              {sortedSectors.map((s) => (
                <tr
                  key={s.sector}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {s.sector}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                    {s.segmentsCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                    {s.traveledTotal.toLocaleString(locale)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200">
                    {s.avgTraveled}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                    {s.offeredSeats > 0 ? s.offeredSeats.toLocaleString(locale) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {s.loadFactorPct !== null ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getLfBarColor(s.loadFactorPct)}`}
                            style={{ width: `${Math.min(100, s.loadFactorPct)}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 w-11 text-right">
                          {s.loadFactorPct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                    {s.noShowRatePct}% ({s.noShowTotal})
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                    {s.totalWeight.toLocaleString(locale)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
