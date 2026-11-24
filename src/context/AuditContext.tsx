/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from "react";
import { parseRawReports, computeAuditSummary, STATION_DB } from "../parser";
import { StationReport, AuditSummary } from "../types";
import { FilterState } from "../components/InteractiveFilters";

interface AuditContextType {
  rawText: string;
  reports: StationReport[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  filteredReports: StationReport[];
  filteredSummary: AuditSummary;
  setRawText: (text: string) => void;
  filterReports: (reports: StationReport[], f: FilterState) => StationReport[];
  isProcessing: boolean;
  availableDates: string[];
  availableStations: { number: string; name: string }[];
  availableCities: string[];
  availableCurrencies: string[];
  clearLogs: () => void;
}

const STORAGE_KEYS = {
  RAW_TEXT: "audit_system_raw_text",
  FILTERS: "audit_system_filters",
};

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage
  const getInitialRawText = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RAW_TEXT);
      return saved !== null ? saved : "";
    } catch {
      return "";
    }
  };

  const getInitialFilters = (): FilterState => {
    const defaultFilters: FilterState = {
      dateStr: "ALL",
      startDate: "",
      endDate: "",
      stationNumber: "ALL",
      cityName: "ALL",
      currency: "ALL",
      stationType: "ALL",
      hasErrorsOnly: false
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FILTERS);
      if (!saved) return defaultFilters;
      return { ...defaultFilters, ...JSON.parse(saved) };
    } catch {
      return defaultFilters;
    }
  };

  const [rawText, setRawTextState] = useState<string>(getInitialRawText);
  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [isProcessing, setIsProcessing] = useState(false);

  // Custom setRawText with simulation delay
  const setRawText = (text: string) => {
    setIsProcessing(true);
    // Simulate a reasonable processing time to show off skeletons
    setTimeout(() => {
      setRawTextState(text);
      setIsProcessing(false);
    }, 1200);
  };

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RAW_TEXT, rawText);
  }, [rawText]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
  }, [filters]);

  const reports = useMemo(() => {
    return parseRawReports(rawText);
  }, [rawText]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    reports.forEach(r => {
      if (!r.isEmpty && r.dateStr) dates.add(r.dateStr);
    });
    const ordered = ["01JUN", "02JUN", "03JUN", "04JUN", "05JUN", "06JUN", "07JUN", "08JUN"];
    return ordered.filter(d => dates.has(d));
  }, [reports]);

  const availableStations = useMemo(() => {
    const stations: { number: string; name: string }[] = [];
    const seen = new Set<string>();
    reports.forEach(r => {
      if (!seen.has(r.stationNumber)) {
        seen.add(r.stationNumber);
        stations.push({ number: r.stationNumber, name: r.stationName });
      }
    });
    return stations.sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    reports.forEach(r => {
      if (r.cityCode) {
        cities.add(r.cityCode.toUpperCase());
      }
    });
    return Array.from(cities).sort();
  }, [reports]);

  const availableCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    reports.forEach(r => {
      r.currencyBlocks.forEach(b => {
        if (b.currency && b.currency !== "***") currencies.add(b.currency);
      });
    });
    return Array.from(currencies).sort();
  }, [reports]);

  const filterReports = (reportsToFilter: StationReport[], f: FilterState) => {
    return reportsToFilter.filter(rep => {
      if (f.dateStr !== "ALL" && rep.dateStr !== f.dateStr) return false;
      if (rep.fullDate) {
        const repTime = new Date(rep.fullDate.getFullYear(), rep.fullDate.getMonth(), rep.fullDate.getDate()).getTime();
        const parseFilterTime = (iso: string): number | null => {
          const parts = iso.split("-");
          if (parts.length !== 3) return null;
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (!y || !m || !d) return null;
          return new Date(y, m - 1, d).getTime();
        };
        const tStart = f.startDate ? parseFilterTime(f.startDate) : null;
        const tEnd = f.endDate ? parseFilterTime(f.endDate) : null;
        const minTime = tStart !== null && tEnd !== null ? Math.min(tStart, tEnd) : tStart;
        const maxTime = tStart !== null && tEnd !== null ? Math.max(tStart, tEnd) : tEnd;
        if (minTime !== null && repTime < minTime) return false;
        if (maxTime !== null && repTime > maxTime) return false;
      }
      if (f.stationNumber !== "ALL" && rep.stationNumber !== f.stationNumber) return false;
      if (f.cityName !== "ALL" && rep.cityCode !== f.cityName) return false;
      if (f.stationType !== "ALL" && rep.stationType !== f.stationType) return false;
      if (f.currency !== "ALL") {
        if (!rep.currencyBlocks.some(b => b.currency === f.currency)) return false;
      }
      if (f.hasErrorsOnly && !rep.hasErrors) return false;
      return true;
    });
  };

  const filteredReports = useMemo(() => {
    return filterReports(reports, filters);
  }, [reports, filters]);

  const filteredSummary = useMemo(() => {
    return computeAuditSummary(filteredReports);
  }, [filteredReports]);

  const clearLogs = () => {
    setRawText("");
  };

  return (
    <AuditContext.Provider value={{
      rawText, reports, filters, setFilters, filteredReports, filteredSummary,
      setRawText, isProcessing, availableDates, availableStations, availableCities, availableCurrencies, clearLogs,
      filterReports
    }}>
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) throw new Error("useAudit must be used within an AuditProvider");
  return context;
};
