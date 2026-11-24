/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Layers,
  Terminal,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PageWrapper } from "../components/layout/PageWrapper";
import { ScheduledFlightsViewer } from "../components/flights/ScheduledFlightsViewer";
import {
  FlightManifestUploader,
  ManifestFileMeta,
  ManifestPageTab,
} from "../components/flights/FlightManifestUploader";
import {
  BiLens,
  FlightAnalyticsDashboardView,
} from "../components/flights/FlightAnalyticsDashboardView";
import {
  FlightScheduleParseResult,
  FlightSegment,
  FlightStatusDetail,
  ManifestParseResult,
} from "../types";
import {
  loadStoredScheduleData,
  loadStoredScheduleSegments,
  saveStoredScheduleData,
} from "../utils/flightParser";
import {
  enrichScheduleResultWithStatusDetails,
  enrichScheduleSegmentsWithStatusDetails,
  loadStoredFlightStatusDetails,
  removeFlightStatusDetailById,
  saveStoredFlightStatusDetails,
  upsertFlightStatusDetail,
} from "../utils/flightStatusParser";
import {
  StoredManifestDayRecord,
  getAllSavedManifestRecords,
} from "../utils/manifestDb";
import { LanguageToggleButton, useLanguage } from "../context/LanguageContext";
import { ThemeToggleButton } from "../context/ThemeContext";

type OpsTab = "schedule" | "manifest" | "analytics";

const VALID_MANIFEST_SUBS: ManifestPageTab[] = [
  "OVERVIEW",
  "FLIGHT_DETAIL",
  "ALL_PASSENGERS",
  "AUDIT",
  "RECONCILIATION",
];

const VALID_BI_LENSES: BiLens[] = [
  "ALL",
  "TRAFFIC",
  "MAP",
  "FLEET",
  "CABIN_SEATS",
  "WEB_CHECKIN",
  "BAGGAGE",
  "EMD",
  "NOSHOW",
];

export const FlightOperationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pick } = useLanguage();

  const rawTab = searchParams.get("tab");
  const activeTab: OpsTab =
    rawTab === "manifest" || rawTab === "analytics" ? rawTab : "schedule";

  const rawSub = searchParams.get("sub") as ManifestPageTab | null;
  const manifestSubPage: ManifestPageTab =
    rawSub && VALID_MANIFEST_SUBS.includes(rawSub) ? rawSub : "OVERVIEW";

  const manifestFlightId = searchParams.get("flight") || "";

  const rawLens = searchParams.get("lens") as BiLens | null;
  const analyticsLens: BiLens =
    rawLens && VALID_BI_LENSES.includes(rawLens) ? rawLens : "ALL";

  const updateNavParams = useCallback(
    (mutator: (next: URLSearchParams) => void, replace = false) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      if (next.toString() === searchParams.toString()) return;
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  const setActiveTab = useCallback(
    (nextTab: OpsTab) => {
      updateNavParams((next) => {
        if (nextTab === "schedule") {
          next.delete("tab");
          next.delete("sub");
          next.delete("flight");
          next.delete("lens");
          next.delete("mapfs");
        } else if (nextTab === "manifest") {
          next.set("tab", "manifest");
          next.delete("lens");
          next.delete("mapfs");
          if (!next.get("sub")) next.set("sub", "OVERVIEW");
        } else {
          next.set("tab", "analytics");
          next.delete("sub");
          next.delete("flight");
          next.delete("mapfs");
          if (!next.get("lens")) next.set("lens", "ALL");
        }
      });
    },
    [updateNavParams]
  );

  const handleChangeManifestSubPage = useCallback(
    (
      sub: ManifestPageTab,
      options?: { flightId?: string; replace?: boolean }
    ) => {
      updateNavParams((next) => {
        next.set("tab", "manifest");
        next.delete("lens");
        next.delete("mapfs");
        next.set("sub", sub);
        if (options?.flightId !== undefined) {
          if (options.flightId) next.set("flight", options.flightId);
          else next.delete("flight");
        } else if (sub !== "FLIGHT_DETAIL") {
          next.delete("flight");
        }
      }, Boolean(options?.replace));
    },
    [updateNavParams]
  );

  const handleChangeManifestFlightId = useCallback(
    (flightId: string, options?: { replace?: boolean }) => {
      updateNavParams((next) => {
        next.set("tab", "manifest");
        if (flightId) next.set("flight", flightId);
        else next.delete("flight");
      }, Boolean(options?.replace));
    },
    [updateNavParams]
  );

  const handleChangeAnalyticsLens = useCallback(
    (lens: BiLens) => {
      updateNavParams((next) => {
        next.set("tab", "analytics");
        next.delete("mapfs");
        next.set("lens", lens);
      });
    },
    [updateNavParams]
  );
  const [scheduleData, setScheduleData] =
    useState<FlightScheduleParseResult | null>(() => loadStoredScheduleData());
  const [storedScheduleSegments, setStoredScheduleSegments] = useState<
    FlightSegment[]
  >(() => loadStoredScheduleSegments());
  const [flightStatusDetails, setFlightStatusDetails] = useState<
    FlightStatusDetail[]
  >(() => loadStoredFlightStatusDetails());

  const enrichedScheduleData = useMemo(
    () => enrichScheduleResultWithStatusDetails(scheduleData, flightStatusDetails),
    [scheduleData, flightStatusDetails]
  );

  const enrichedStoredSegments = useMemo(
    () => enrichScheduleSegmentsWithStatusDetails(storedScheduleSegments, flightStatusDetails),
    [storedScheduleSegments, flightStatusDetails]
  );

  const handleScheduleLoaded = useCallback(
    (data: FlightScheduleParseResult | null) => {
      setScheduleData(data);
      const nextAll = saveStoredScheduleData(data);
      setStoredScheduleSegments(nextAll);
    },
    []
  );
  const [manifestData, setManifestData] =
    useState<ManifestParseResult | null>(null);
  const [manifestFileMeta, setManifestFileMeta] =
    useState<ManifestFileMeta | null>(null);

  const [requestedManifestFlightId, setRequestedManifestFlightId] = useState<
    string | null
  >(null);
  const [analyticsFlightNumber, setAnalyticsFlightNumber] = useState<string>("");
  const [archiveRefreshNonce, setArchiveRefreshNonce] = useState<number>(0);
  const [savedRecords, setSavedRecords] = useState<StoredManifestDayRecord[]>([]);
  const savedDaysCount = savedRecords.length;

  const refreshArchiveCount = useCallback(() => {
    void getAllSavedManifestRecords()
      .then((records) => setSavedRecords(records))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshArchiveCount();
  }, [refreshArchiveCount, archiveRefreshNonce, activeTab]);

  const handleSavedToDb = useCallback(() => {
    setArchiveRefreshNonce((n) => n + 1);
  }, []);

  const handleUpsertFlightStatusDetail = useCallback(
    (updated: FlightStatusDetail) => {
      setFlightStatusDetails((prev) => {
        const next = upsertFlightStatusDetail(prev, updated);
        saveStoredFlightStatusDetails(next);
        return next;
      });
    },
    []
  );

  const handleRemoveManualFlightStatusDetail = useCallback((id: string) => {
    setFlightStatusDetails((prev) => {
      const next = removeFlightStatusDetailById(prev, id);
      saveStoredFlightStatusDetails(next);
      return next;
    });
  }, []);

  const handleOpenAnalytics = useCallback(
    (flightNumber?: string) => {
      setAnalyticsFlightNumber(flightNumber || "");
      setActiveTab("analytics");
    },
    [setActiveTab]
  );

  return (
    <PageWrapper className="w-full px-1 sm:px-2 space-y-4 pb-16">
      {/* Compact Top Bar + 1-Line Navigation */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs font-bold text-[#6E472B] dark:text-[#DECAB1] hover:text-[#4C2812] dark:hover:text-[#F7BA42] transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {pick("Menu Principal", "Main Menu")}
          </button>
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#E6D7C3] dark:border-[#4C2812]">
            <img src="/assets/aistudio/image_logo_4528d090.png" alt="ASKY Logo" className="h-6 w-auto object-contain bg-white rounded-md p-0.5" />
            <span className="font-extrabold text-[#4C2812] dark:text-[#F7BA42] text-xs">
              {pick("ASKY Vols & Manifestes", "ASKY Flights & Manifests")}
            </span>
          </div>
        </div>

        {/* Compact 3-Menu Switcher + Theme + Language Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("schedule")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "schedule"
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-sm font-bold"
                  : "bg-[#FAF7F2] dark:bg-[#2A180D] text-[#4C2812] dark:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] border border-[#E6D7C3] dark:border-[#4C2812]"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{pick("1. Programme des Vols", "1. Flight Schedule")}</span>
              {scheduleData && (
                <span className="font-mono text-[10px] opacity-85">
                  ({scheduleData.date})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("manifest")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "manifest"
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-sm font-bold"
                  : "bg-[#FAF7F2] dark:bg-[#2A180D] text-[#4C2812] dark:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] border border-[#E6D7C3] dark:border-[#4C2812]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{pick("2. Manifeste de Tous les Vols", "2. All Flights Manifest")}</span>
              {(manifestData || savedDaysCount > 0) && (
                <span className="font-mono text-[10px] opacity-85">
                  ({manifestData ? manifestData.totalFlights : `${savedDaysCount}j`})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("analytics")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-sm font-bold"
                  : "bg-[#FAF7F2] dark:bg-[#2A180D] text-[#4C2812] dark:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] border border-[#E6D7C3] dark:border-[#4C2812]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{pick("3. Statistique et Analyse", "3. Statistics & Analytics")}</span>
            </button>
          </div>

          <ThemeToggleButton />
          <LanguageToggleButton />
        </div>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "schedule" ? (
            <ScheduledFlightsViewer
              scheduleData={enrichedScheduleData}
              onScheduleLoaded={handleScheduleLoaded}
              flightStatusDetails={flightStatusDetails}
              onFlightStatusLoaded={setFlightStatusDetails}
              onUpsertFlightStatusDetail={handleUpsertFlightStatusDetail}
              onRemoveManualFlightStatusDetail={handleRemoveManualFlightStatusDetail}
            />
          ) : activeTab === "manifest" ? (
            <FlightManifestUploader
              scheduleData={enrichedScheduleData}
              storedScheduleSegments={enrichedStoredSegments}
              onScheduleLoaded={handleScheduleLoaded}
              flightStatusDetails={flightStatusDetails}
              onUpsertFlightStatusDetail={handleUpsertFlightStatusDetail}
              onRemoveManualFlightStatusDetail={handleRemoveManualFlightStatusDetail}
              manifestData={manifestData}
              manifestFileMeta={manifestFileMeta}
              onManifestLoaded={(data, meta) => {
                setManifestData(data);
                setManifestFileMeta(meta);
              }}
              requestedFlightId={requestedManifestFlightId}
              onRequestedFlightConsumed={() =>
                setRequestedManifestFlightId(null)
              }
              onOpenAnalytics={handleOpenAnalytics}
              onSavedToDb={handleSavedToDb}
              activeSubPage={manifestSubPage}
              onChangeSubPage={handleChangeManifestSubPage}
              selectedFlightId={manifestFlightId}
              onChangeSelectedFlightId={handleChangeManifestFlightId}
            />
          ) : (
            <FlightAnalyticsDashboardView
              savedRecords={savedRecords}
              activeManifest={manifestData}
              flightStatusDetails={flightStatusDetails}
              scheduleData={enrichedScheduleData}
              storedScheduleSegments={enrichedStoredSegments}
              focusedFlightNumber={analyticsFlightNumber}
              onGoToManifestUpload={() => setActiveTab("manifest")}
              onGoToSchedule={() => setActiveTab("schedule")}
              activeLens={analyticsLens}
              onChangeLens={handleChangeAnalyticsLens}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageWrapper>
  );
};
