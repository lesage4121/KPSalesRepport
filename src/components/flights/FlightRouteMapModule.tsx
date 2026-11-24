/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import {
  ArrowRight,
  Compass,
  Filter,
  Globe,
  Maximize2,
  Minimize2,
  Navigation,
  Plane,
  RotateCcw,
  Search,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  FlightRouteFlowRow,
  RouteOndAnalyticsRow,
  SectorPerformanceRow,
  UnmappedMapFlightItem,
} from "../../utils/flightAnalytics";
import { getAirportGeoInfo } from "../../utils/airportCoordinates";
import { useLanguage } from "../../context/LanguageContext";

interface FlightRouteMapModuleProps {
  flightRouteFlows: FlightRouteFlowRow[];
  sectorPerformance: SectorPerformanceRow[];
  routeOndBreakdown: RouteOndAnalyticsRow[];
  isDark: boolean;
  originFilter?: string;
  onSelectOriginStation?: (code: string) => void;
  totalManifestFlights?: number;
  unmappedMapFlights?: UnmappedMapFlightItem[];
}

type MapLayerMode = "FLOWS" | "SECTORS" | "OND";
type WeightMetric = "PAX" | "FREQUENCY";
type MapPresetKey = "WEST_CENTRAL" | "AFRICA" | "GLOBAL";

interface NormalizedRouteItem {
  id: string;
  route: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  flightsCount: number | null;
  passengers: number;
  passengersEco?: number;
  passengersBiz?: number;
  avgPaxPerFlight?: number;
  loadFactorPct?: number | null;
  sharePct?: number;
  flightNumbers: {
    airline: string;
    flightNumber: string;
    frequency: number;
    passengers: number;
    loadFactorPct?: number | null;
  }[];
}

interface AirportNodeItem {
  code: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  isHub: boolean;
  inboundPax: number;
  outboundPax: number;
  inboundFlights: number;
  outboundFlights: number;
  totalVolume: number;
}

const VIEW_W = 920;
const VIEW_H = 540;

const MAP_PRESETS: Record<
  MapPresetKey,
  { center: [number, number]; scale: number; labelFr: string; labelEn: string }
> = {
  WEST_CENTRAL: {
    center: [3.2, 6.2],
    scale: 1080,
    labelFr: "Afrique Ouest & Centrale",
    labelEn: "West & Central Africa",
  },
  AFRICA: {
    center: [16.5, 2.0],
    scale: 430,
    labelFr: "Afrique Complète",
    labelEn: "All Africa",
  },
  GLOBAL: {
    center: [6.0, 18.0],
    scale: 215,
    labelFr: "Réseau Global",
    labelEn: "Global Network",
  },
};

export const FlightRouteMapModule: React.FC<FlightRouteMapModuleProps> = ({
  flightRouteFlows,
  sectorPerformance,
  routeOndBreakdown,
  isDark,
  originFilter = "ALL",
  onSelectOriginStation,
  totalManifestFlights,
  unmappedMapFlights = [],
}) => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const pick = (fr: string, en: string) => (isFr ? fr : en);
  const locale = isFr ? "fr-FR" : "en-US";

  const [layerMode, setLayerMode] = useState<MapLayerMode>("FLOWS");
  const [weightMetric, setWeightMetric] = useState<WeightMetric>("PAX");
  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [pinnedRouteId, setPinnedRouteId] = useState<string | null>(null);
  const [hoveredStationCode, setHoveredStationCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFlowBadges, setShowFlowBadges] = useState<boolean>(true);
  const [showAllRoutesOnMap, setShowAllRoutesOnMap] = useState<boolean>(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFullscreen = searchParams.get("mapfs") === "1";
  const pushedFullscreenRef = useRef(false);

  const toggleFullscreen = () => {
    if (isFullscreen) {
      if (pushedFullscreenRef.current) {
        pushedFullscreenRef.current = false;
        navigate(-1);
      } else {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("mapfs");
            return next;
          },
          { replace: true }
        );
      }
    } else {
      pushedFullscreenRef.current = true;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("mapfs", "1");
        return next;
      });
    }
  };

  useEffect(() => {
    if (!isFullscreen) {
      pushedFullscreenRef.current = false;
    }
  }, [isFullscreen]);

  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  });

  // Pan & zoom state
  const [presetOverride, setPresetOverride] = useState<MapPresetKey | null>(null);
  const [zoomFactor, setZoomFactor] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Lock background scroll, sync viewport size & support Escape key when map is in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const syncSize = () => {
      setViewportSize({
        w: Math.max(640, window.innerWidth),
        h: Math.max(420, window.innerHeight),
      });
    };
    syncSize();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pushedFullscreenRef.current) {
          pushedFullscreenRef.current = false;
          navigate(-1);
        } else {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("mapfs");
              return next;
            },
            { replace: true }
          );
        }
      }
    };
    window.addEventListener("resize", syncSize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", syncSize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, navigate, setSearchParams]);

  const svgW = isFullscreen ? viewportSize.w : VIEW_W;
  const svgH = isFullscreen ? viewportSize.h : VIEW_H;

  // Build normalized items from the selected analytical layer
  const { mappedRoutes, unmappedCodes, geoExcludedRoutes } = useMemo(() => {
    const missing = new Set<string>();
    const geoExcluded: { route: string; flightsCount: number; missingCodes: string[] }[] = [];
    const items: NormalizedRouteItem[] = [];

    const pushIfMapped = (
      id: string,
      route: string,
      originRaw: string,
      destRaw: string,
      payload: Omit<
        NormalizedRouteItem,
        | "id"
        | "route"
        | "origin"
        | "destination"
        | "originCity"
        | "destinationCity"
        | "originLat"
        | "originLng"
        | "destLat"
        | "destLng"
      >
    ) => {
      const origin = originRaw.trim().toUpperCase();
      const destination = destRaw.trim().toUpperCase();
      if (!origin || !destination || origin === destination) return;
      const oGeo = getAirportGeoInfo(origin);
      const dGeo = getAirportGeoInfo(destination);
      if (!oGeo) missing.add(origin);
      if (!dGeo) missing.add(destination);
      if (!oGeo || !dGeo) {
        const missingForRoute: string[] = [];
        if (!oGeo) missingForRoute.push(origin);
        if (!dGeo) missingForRoute.push(destination);
        geoExcluded.push({
          route: `${origin} → ${destination}`,
          flightsCount: payload.flightsCount ?? 1,
          missingCodes: missingForRoute,
        });
        return;
      }

      items.push({
        id,
        route,
        origin,
        destination,
        originCity: oGeo.city,
        destinationCity: dGeo.city,
        originLat: oGeo.lat,
        originLng: oGeo.lng,
        destLat: dGeo.lat,
        destLng: dGeo.lng,
        ...payload,
      });
    };

    if (layerMode === "FLOWS") {
      for (const row of flightRouteFlows) {
        pushIfMapped(row.id, row.route, row.origin, row.destination, {
          flightsCount: row.flightsCount,
          passengers: row.passengers,
          passengersEco: row.passengersEco,
          passengersBiz: row.passengersBiz,
          avgPaxPerFlight: row.avgPaxPerFlight,
          loadFactorPct: row.loadFactorPct,
          flightNumbers: row.flightNumbers,
        });
      }
    } else if (layerMode === "SECTORS") {
      for (const row of sectorPerformance) {
        pushIfMapped(
          `${row.origin}-${row.destination}`,
          row.sector,
          row.origin,
          row.destination,
          {
            flightsCount: row.segmentsCount,
            passengers: row.traveledTotal,
            passengersEco: row.traveledEco,
            passengersBiz: row.traveledBiz,
            avgPaxPerFlight: row.avgTraveled,
            loadFactorPct: row.loadFactorPct,
            flightNumbers: [],
          }
        );
      }
    } else {
      for (const row of routeOndBreakdown) {
        pushIfMapped(
          `${row.origin}-${row.destination}`,
          row.route,
          row.origin,
          row.destination,
          {
            flightsCount: null,
            passengers: row.passengers,
            sharePct: row.sharePct,
            flightNumbers: [],
          }
        );
      }
    }

    return {
      mappedRoutes: items,
      unmappedCodes: Array.from(missing).sort(),
      geoExcludedRoutes: geoExcluded,
    };
  }, [layerMode, flightRouteFlows, sectorPerformance, routeOndBreakdown]);

  // Auto-determine best initial preset based on mapped coordinates
  const autoPreset: MapPresetKey = useMemo(() => {
    if (mappedRoutes.length === 0) return "WEST_CENTRAL";
    let hasOutsideWestCentral = false;
    let hasOutsideAfrica = false;
    for (const r of mappedRoutes) {
      for (const [lat, lng] of [
        [r.originLat, r.originLng],
        [r.destLat, r.destLng],
      ]) {
        if (lng < -25 || lng > 22 || lat < -13 || lat > 20) {
          hasOutsideWestCentral = true;
        }
        if (lng < -26 || lng > 52 || lat < -36 || lat > 38) {
          hasOutsideAfrica = true;
        }
      }
    }
    if (hasOutsideAfrica) return "GLOBAL";
    if (hasOutsideWestCentral) return "AFRICA";
    return "WEST_CENTRAL";
  }, [mappedRoutes]);

  const activePresetKey = presetOverride ?? autoPreset;

  // All stations present in the active layer (for station selector)
  const stationOptions = useMemo(() => {
    const map = new Map<string, { code: string; city: string; volume: number }>();
    for (const r of mappedRoutes) {
      const o = map.get(r.origin) || { code: r.origin, city: r.originCity, volume: 0 };
      o.volume += r.passengers;
      map.set(r.origin, o);

      const d = map.get(r.destination) || {
        code: r.destination,
        city: r.destinationCity,
        volume: 0,
      };
      d.volume += r.passengers;
      map.set(r.destination, d);
    }
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
  }, [mappedRoutes]);

  // Filter routes by selected station & search query
  const visibleRoutes = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return mappedRoutes.filter((r) => {
      if (
        selectedStation !== "ALL" &&
        r.origin !== selectedStation &&
        r.destination !== selectedStation
      ) {
        return false;
      }
      if (q) {
        const matchesRoute = r.route.toUpperCase().includes(q);
        const matchesCity =
          r.originCity.toUpperCase().includes(q) ||
          r.destinationCity.toUpperCase().includes(q);
        const matchesFn = r.flightNumbers.some((fn) =>
          `${fn.airline}${fn.flightNumber}`.toUpperCase().includes(q)
        );
        if (!matchesRoute && !matchesCity && !matchesFn) return false;
      }
      return true;
    });
  }, [mappedRoutes, selectedStation, searchQuery]);

  // Limit map clutter when >35 routes unless "showAllRoutesOnMap" is checked
  const routesForMap = useMemo(() => {
    if (showAllRoutesOnMap || visibleRoutes.length <= 35) return visibleRoutes;
    return visibleRoutes.slice(0, 35);
  }, [visibleRoutes, showAllRoutesOnMap]);

  // Aggregate airport nodes from visibleRoutes
  const airportNodes: AirportNodeItem[] = useMemo(() => {
    const nodeMap = new Map<string, AirportNodeItem>();
    for (const r of routesForMap) {
      const oGeo = getAirportGeoInfo(r.origin);
      const dGeo = getAirportGeoInfo(r.destination);
      if (oGeo) {
        const curr = nodeMap.get(r.origin) || {
          code: r.origin,
          city: oGeo.city,
          country: oGeo.country,
          lat: oGeo.lat,
          lng: oGeo.lng,
          isHub: Boolean(oGeo.isHub),
          inboundPax: 0,
          outboundPax: 0,
          inboundFlights: 0,
          outboundFlights: 0,
          totalVolume: 0,
        };
        curr.outboundPax += r.passengers;
        curr.outboundFlights += r.flightsCount ?? 0;
        curr.totalVolume += r.passengers;
        nodeMap.set(r.origin, curr);
      }
      if (dGeo) {
        const curr = nodeMap.get(r.destination) || {
          code: r.destination,
          city: dGeo.city,
          country: dGeo.country,
          lat: dGeo.lat,
          lng: dGeo.lng,
          isHub: Boolean(dGeo.isHub),
          inboundPax: 0,
          outboundPax: 0,
          inboundFlights: 0,
          outboundFlights: 0,
          totalVolume: 0,
        };
        curr.inboundPax += r.passengers;
        curr.inboundFlights += r.flightsCount ?? 0;
        curr.totalVolume += r.passengers;
        nodeMap.set(r.destination, curr);
      }
    }
    return Array.from(nodeMap.values()).sort((a, b) => a.totalVolume - b.totalVolume);
  }, [routesForMap]);

  // World TopoJSON features decoded once
  const { landFeatures, graticuleGeo } = useMemo(() => {
    const topology = countriesAtlas as unknown as Parameters<typeof feature>[0] & {
      objects: { countries: Parameters<typeof feature>[1] };
    };
    const geo = feature(topology, topology.objects.countries);
    return {
      landFeatures: geo,
      graticuleGeo: geoGraticule10(),
    };
  }, []);

  // Build active D3 projection
  const { projection, landPathD, graticulePathD } = useMemo(() => {
    const preset = MAP_PRESETS[activePresetKey];
    const baseRatio = Math.min(svgW / VIEW_W, svgH / VIEW_H);
    const proj = geoMercator()
      .center(preset.center)
      .scale(preset.scale * baseRatio * zoomFactor)
      .translate([svgW / 2 + panOffset.x, svgH / 2 + panOffset.y]);

    const pathGen = geoPath(proj);
    return {
      projection: proj,
      landPathD: pathGen(landFeatures as unknown as Parameters<typeof pathGen>[0]) || "",
      graticulePathD: pathGen(graticuleGeo) || "",
    };
  }, [activePresetKey, zoomFactor, panOffset, landFeatures, graticuleGeo, svgW, svgH]);

  // Effective weight normalization
  const useFrequency = weightMetric === "FREQUENCY" && layerMode !== "OND";
  const maxWeight = useMemo(() => {
    let m = 1;
    for (const r of routesForMap) {
      const val = useFrequency ? r.flightsCount ?? 0 : r.passengers;
      if (val > m) m = val;
    }
    return m;
  }, [routesForMap, useFrequency]);

  const maxNodeVolume = useMemo(() => {
    let m = 1;
    for (const n of airportNodes) {
      if (n.totalVolume > m) m = n.totalVolume;
    }
    return m;
  }, [airportNodes]);

  // Project curved arrow geometries
  const projectedFlows = useMemo(() => {
    return routesForMap
      .map((r) => {
        const p1 = projection([r.originLng, r.originLat]);
        const p2 = projection([r.destLng, r.destLat]);
        if (!p1 || !p2) return null;

        const [x1, y1] = p1;
        const [x2, y2] = p2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) return null;

        // Opposite curvature per direction so A->B and B->A never collide
        const nx = -dy / dist;
        const ny = dx / dist;
        const curveOffset = Math.min(54, Math.max(12, dist * 0.17));
        const cx = (x1 + x2) / 2 + nx * curveOffset;
        const cy = (y1 + y2) / 2 + ny * curveOffset;

        // Shorten start & end along tangents so arrowhead touches destination circle cleanly
        const startDx = cx - x1;
        const startDy = cy - y1;
        const startLen = Math.hypot(startDx, startDy) || 1;
        const trimStart = Math.min(dist * 0.2, 8);
        const sx = x1 + (startDx / startLen) * trimStart;
        const sy = y1 + (startDy / startLen) * trimStart;

        const endDx = x2 - cx;
        const endDy = y2 - cy;
        const endLen = Math.hypot(endDx, endDy) || 1;
        const destNode = airportNodes.find((n) => n.code === r.destination);
        const destRadius = destNode
          ? (destNode.isHub ? 9 : 4.5 + (destNode.totalVolume / maxNodeVolume) * 5.5)
          : 6;
        const trimEnd = Math.min(dist * 0.35, destRadius + 6);
        const ex = x2 - (endDx / endLen) * trimEnd;
        const ey = y2 - (endDy / endLen) * trimEnd;

        const pathD = `M ${sx.toFixed(1)},${sy.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(
          1
        )} ${ex.toFixed(1)},${ey.toFixed(1)}`;

        // Midpoint of quadratic curve t = 0.5
        const midX = 0.25 * sx + 0.5 * cx + 0.25 * ex;
        const midY = 0.25 * sy + 0.5 * cy + 0.25 * ey;

        const metricVal = useFrequency ? r.flightsCount ?? 0 : r.passengers;
        const ratio = maxWeight > 0 ? metricVal / maxWeight : 0;
        const tier: "HIGH" | "MID" | "LOW" =
          ratio >= 0.55 ? "HIGH" : ratio >= 0.22 ? "MID" : "LOW";
        const strokeWidth = 1.7 + ratio * 3.1;

        return {
          route: r,
          pathD,
          midX,
          midY,
          dist,
          tier,
          strokeWidth,
          ratio,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      // Draw lower-volume lines first so high-volume & active arrows render on top
      .sort((a, b) => a.ratio - b.ratio);
  }, [routesForMap, projection, airportNodes, maxNodeVolume, useFrequency, maxWeight]);

  const activeRouteId = hoveredRouteId || pinnedRouteId;
  const activeRouteObj = useMemo(
    () => mappedRoutes.find((r) => r.id === activeRouteId) || null,
    [mappedRoutes, activeRouteId]
  );

  // Totals across currently visible routes
  const summaryStats = useMemo(() => {
    const totalPax = visibleRoutes.reduce((s, r) => s + r.passengers, 0);
    const totalFlights = visibleRoutes.reduce((s, r) => s + (r.flightsCount ?? 0), 0);
    return {
      routesCount: visibleRoutes.length,
      stationsCount: stationOptions.length,
      totalPax,
      totalFlights,
    };
  }, [visibleRoutes, stationOptions]);

  const selectPreset = (preset: MapPresetKey) => {
    setPresetOverride(preset);
    setZoomFactor(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const resetMapView = () => {
    setPresetOverride(null);
    setZoomFactor(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setPointerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    if (!isDragging || !dragStartRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = rect.width > 0 ? svgW / rect.width : 1;
    const scaleY = rect.height > 0 ? svgH / rect.height : 1;
    const dx = (e.clientX - dragStartRef.current.x) * scaleX;
    const dy = (e.clientY - dragStartRef.current.y) * scaleY;
    setPanOffset({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Palette tuned for both Light & ASKY Dark theme
  const mapBgClass = isDark
    ? "bg-slate-950 border-slate-800"
    : "bg-sky-50/70 border-slate-200";
  const landFill = isDark ? "#1e293b" : "#e2e8f0";
  const landStroke = isDark ? "#334155" : "#cbd5e1";
  const graticuleStroke = isDark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.16)";

  type LfBand = "LF_85" | "LF_65" | "LF_45" | "LF_LOW" | "LF_NA";

  const getLfBand = (lf: number | null | undefined): LfBand => {
    if (lf === null || lf === undefined || !Number.isFinite(lf)) return "LF_NA";
    if (lf >= 85) return "LF_85";
    if (lf >= 65) return "LF_65";
    if (lf >= 45) return "LF_45";
    return "LF_LOW";
  };

  const getLfStrokeColor = (band: LfBand): string => {
    switch (band) {
      case "LF_85":
        return isDark ? "#34D399" : "#059669";
      case "LF_65":
        return isDark ? "#38BDF8" : "#0284C7";
      case "LF_45":
        return isDark ? "#FBBF24" : "#D97706";
      case "LF_LOW":
        return isDark ? "#FB7185" : "#E11D48";
      default:
        return isDark ? "#94A3B8" : "#64748B";
    }
  };

  const getLfDotClass = (lf: number | null | undefined): string => {
    if (lf === null || lf === undefined || !Number.isFinite(lf)) {
      return "bg-slate-400 dark:bg-slate-500";
    }
    if (lf >= 85) return "bg-emerald-500";
    if (lf >= 65) return "bg-sky-500";
    if (lf >= 45) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getLfTextClass = (lf: number | null | undefined): string => {
    if (lf === null || lf === undefined || !Number.isFinite(lf)) {
      return "text-slate-500 dark:text-slate-400";
    }
    if (lf >= 85) return "text-emerald-700 dark:text-emerald-400";
    if (lf >= 65) return "text-sky-700 dark:text-sky-400";
    if (lf >= 45) return "text-amber-700 dark:text-amber-400";
    return "text-rose-700 dark:text-rose-400";
  };

  const getTierColor = (tier: "HIGH" | "MID" | "LOW", isActive: boolean, isDimmed: boolean) => {
    if (isActive) return "#F59E0B";
    if (isDimmed) return isDark ? "rgba(100, 116, 139, 0.25)" : "rgba(148, 163, 184, 0.35)";
    if (tier === "HIGH") return isDark ? "#34D399" : "#059669";
    if (tier === "MID") return isDark ? "#38BDF8" : "#0284C7";
    return isDark ? "#818CF8" : "#4F46E5";
  };

  return (
    <div
      className={
        isFullscreen
          ? `fixed inset-0 z-50 w-screen h-screen overflow-hidden ${
              isDark ? "bg-slate-950" : "bg-sky-50"
            }`
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs"
      }
    >
      {/* Header & Layer Controls (hidden in Fullscreen so ONLY the map occupies 100% of screen) */}
      {!isFullscreen && (
        <>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                <span>
                  {pick(
                    "Carte Interactive des Routes, Fréquences & Trafic Passagers",
                    "Interactive Route Map: Frequencies & Passenger Flows"
                  )}
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {layerMode !== "OND" ? (
                  <>
                    <span>
                      {summaryStats.routesCount} {pick("tronçons fléchés", "arrowed legs")} ·{" "}
                      {totalManifestFlights !== undefined &&
                      selectedStation === "ALL" &&
                      !searchQuery.trim() &&
                      summaryStats.totalFlights !== totalManifestFlights
                        ? `${summaryStats.totalFlights} / ${totalManifestFlights}`
                        : summaryStats.totalFlights}{" "}
                      {pick("vol(s)", "flight(s)")} · {summaryStats.stationsCount}{" "}
                      {pick("escales", "stations")}
                    </span>
                    {totalManifestFlights !== undefined &&
                      selectedStation === "ALL" &&
                      !searchQuery.trim() &&
                      summaryStats.totalFlights < totalManifestFlights && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          {totalManifestFlights - summaryStats.totalFlights}{" "}
                          {pick("non tracé(s) — voir détail ci-dessous", "unplotted — see details below")}
                        </span>
                      )}
                  </>
                ) : (
                  <span>
                    {summaryStats.routesCount} {pick("paires O&D fléchées", "arrowed O&D pairs")} ·{" "}
                    {summaryStats.stationsCount} {pick("escales", "stations")}
                  </span>
                )}
              </p>
            </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layer Mode Switch */}
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setLayerMode("FLOWS");
                setPinnedRouteId(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                layerMode === "FLOWS"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {pick("Flux de Vols (Trajets)", "Flight Flows (Legs)")}
            </button>
            <button
              type="button"
              onClick={() => {
                setLayerMode("SECTORS");
                setPinnedRouteId(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                layerMode === "SECTORS"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {pick("Tronçons Principaux", "Primary Sectors")}
            </button>
            <button
              type="button"
              onClick={() => {
                setLayerMode("OND");
                setPinnedRouteId(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                layerMode === "OND"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {pick("Paires O&D", "O&D Pairs")}
            </button>
          </div>

          {/* Arrow Weight Encoding */}
          {layerMode !== "OND" && (
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setWeightMetric("PAX")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                  weightMetric === "PAX"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Users className="w-3 h-3" />
                {pick("Épaisseur: Pax", "Scale: Pax")}
              </button>
              <button
                type="button"
                onClick={() => setWeightMetric("FREQUENCY")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                  weightMetric === "FREQUENCY"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Plane className="w-3 h-3" />
                {pick("Épaisseur: Fréq.", "Scale: Freq.")}
              </button>
            </div>
          )}

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={
              isFullscreen
                ? pick("Quitter le plein écran (Échap)", "Exit fullscreen (Esc)")
                : pick("Afficher la carte en plein écran", "View map in fullscreen")
            }
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
              isFullscreen
                ? "bg-rose-600 hover:bg-rose-700 border-rose-600 text-white shadow-xs"
                : "bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 border-slate-900 dark:border-sky-600 text-white shadow-xs"
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{pick("Quitter plein écran", "Exit fullscreen")}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{pick("Plein écran", "Fullscreen")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-toolbar: Geographic Presets + Station Filter + Display Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["WEST_CENTRAL", "AFRICA", "GLOBAL"] as MapPresetKey[]).map((key) => {
            const p = MAP_PRESETS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activePresetKey === key
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {isFr ? p.labelFr : p.labelEn}
              </button>
            );
          })}

          <select
            value={selectedStation}
            onChange={(e) => {
              setSelectedStation(e.target.value);
              setPinnedRouteId(null);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="ALL">
              {pick(
                `Escale sur carte : Toutes (${stationOptions.length})`,
                `Map station: All (${stationOptions.length})`
              )}
            </option>
            {stationOptions.map((st) => (
              <option key={st.code} value={st.code}>
                {st.code} — {st.city} ({st.volume.toLocaleString(locale)} pax)
              </option>
            ))}
          </select>

          {selectedStation !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedStation("ALL")}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3 h-3" />
              {selectedStation}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFlowBadges((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
              showFlowBadges
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            {pick("Étiquettes sur flèches", "Arrow labels")}
          </button>

          {visibleRoutes.length > 35 && (
            <button
              type="button"
              onClick={() => setShowAllRoutesOnMap((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                showAllRoutesOnMap
                  ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              {showAllRoutesOnMap
                ? pick(`Tous (${visibleRoutes.length})`, `All (${visibleRoutes.length})`)
                : pick("Top 35 sur carte", "Top 35 on map")}
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {/* Main Split: Map Canvas (+ Inspector only when NOT fullscreen) */}
      {mappedRoutes.length === 0 ? (
        <div className="h-72 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-6 text-center gap-2 bg-slate-50/70 dark:bg-slate-800/30">
          <Compass className="w-8 h-8 text-sky-500" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {pick(
              "Aucun trajet géolocalisable trouvé pour les filtres actuels",
              "No geolocated routes found for the current filters"
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            {pick(
              "Essayez de changer de couche (Flux de Vols / Paires O&D) ou de réinitialiser les filtres ci-dessus.",
              "Try switching layers (Flight Flows / O&D Pairs) or resetting the filters above."
            )}
          </p>
        </div>
      ) : (
        <div
          className={
            isFullscreen
              ? "w-full h-full"
              : "grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
          }
        >
          {/* Interactive Map Canvas */}
          <div
            ref={mapContainerRef}
            className={`${
              isFullscreen
                ? "w-full h-full relative overflow-hidden select-none"
                : `lg:col-span-8 relative rounded-xl border overflow-hidden select-none ${mapBgClass}`
            }`}
          >
            {/* Fullscreen Floating Top-Left Quick Filter Strip */}
            {isFullscreen && (
              <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100vw-260px)]">
                <div className="inline-flex items-center p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm">
                  {(
                    [
                      { id: "FLOWS", label: pick("Flux de Vols", "Flight Flows") },
                      { id: "SECTORS", label: pick("Tronçons", "Sectors") },
                      { id: "OND", label: "O&D" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setLayerMode(m.id);
                        setPinnedRouteId(null);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        layerMode === m.id
                          ? "bg-sky-600 text-white"
                          : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm gap-1">
                  {(["WEST_CENTRAL", "AFRICA", "GLOBAL"] as MapPresetKey[]).map((key) => {
                    const p = MAP_PRESETS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectPreset(key)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                          activePresetKey === key
                            ? "bg-amber-500 text-slate-950 font-bold"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {isFr ? p.labelFr : p.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Floating Zoom & Fullscreen Toolbar */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                type="button"
                title={pick("Zoomer", "Zoom in")}
                onClick={() => setZoomFactor((z) => Math.min(6, Number((z * 1.35).toFixed(2))))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title={pick("Dézoomer", "Zoom out")}
                onClick={() => setZoomFactor((z) => Math.max(0.65, Number((z / 1.35).toFixed(2))))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title={pick("Recentrer la carte", "Reset map view")}
                onClick={resetMapView}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                title={
                  isFullscreen
                    ? pick("Quitter le plein écran (Échap)", "Exit fullscreen (Esc)")
                    : pick("Plein écran", "Fullscreen")
                }
                onClick={toggleFullscreen}
                className={`px-2 py-1 rounded-lg cursor-pointer transition inline-flex items-center gap-1 text-[11px] font-semibold ${
                  isFullscreen
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400"
                }`}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>{pick("Quitter", "Exit")}</span>
                  </>
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-10 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm text-[10px] font-mono space-y-1">
              {layerMode !== "OND" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-emerald-600 dark:bg-emerald-400 inline-block" />
                    LF ≥ 85%
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-sky-600 dark:bg-sky-400 inline-block" />
                    65–84%
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-amber-600 dark:bg-amber-400 inline-block" />
                    45–64%
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-rose-600 dark:bg-rose-400 inline-block" />
                    &lt; 45%
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-slate-500 dark:bg-slate-400 inline-block" />
                    {pick("N/D (PTRG*)", "N/A (PTRG*)")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white inline-block" />
                    {pick("Hub / Escale", "Hub / Station")}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-emerald-600 dark:bg-emerald-400 inline-block" />
                    {pick("Trafic fort", "High flow")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-sky-600 dark:bg-sky-400 inline-block" />
                    {pick("Moyen", "Medium")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-4 h-0.5 bg-indigo-600 dark:bg-indigo-400 inline-block" />
                    {pick("Secondaire", "Secondary")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white inline-block" />
                    {pick("Hub / Sélection", "Hub / Active")}
                  </span>
                </div>
              )}
              <div className="text-slate-500 dark:text-slate-400 font-sans">
                {pick(
                  "Glisser pour déplacer · Cliquer sur une flèche ou une escale pour inspecter",
                  "Drag to pan · Click any arrow or station to inspect"
                )}
              </div>
            </div>

            {/* Floating Route Hover Tooltip */}
            {activeRouteObj && pointerPos && hoveredRouteId && (
              <div
                style={{
                  left: Math.min(
                    Math.max(12, pointerPos.x + 14),
                    Math.max(180, (mapContainerRef.current?.clientWidth || 680) - 250)
                  ),
                  top: Math.min(
                    Math.max(12, pointerPos.y - 16),
                    Math.max(100, (mapContainerRef.current?.clientHeight || 480) - 180)
                  ),
                }}
                className="pointer-events-none absolute z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-1.5 min-w-[225px]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                  <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {activeRouteObj.origin}
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    {activeRouteObj.destination}
                  </span>
                  <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                    {activeRouteObj.originCity} → {activeRouteObj.destinationCity}
                  </span>
                </div>
                {activeRouteObj.flightsCount !== null && (
                  <div className="flex justify-between gap-4 font-mono tabular-nums">
                    <span className="text-sky-600 dark:text-sky-400">
                      {pick("Fréquence vols", "Flight freq.")}:
                    </span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {activeRouteObj.flightsCount} {pick("vol(s)", "flight(s)")}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between gap-4 font-mono tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {pick("Pax transportés", "Passengers")}:
                  </span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {activeRouteObj.passengers.toLocaleString(locale)} pax
                  </strong>
                </div>
                {activeRouteObj.passengersEco !== undefined &&
                  activeRouteObj.passengersBiz !== undefined && (
                    <div className="flex justify-between gap-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{pick("Répartition cabines", "Cabin split")}:</span>
                      <span>
                        {activeRouteObj.passengersEco} Y · {activeRouteObj.passengersBiz} C
                      </span>
                    </div>
                  )}
                {activeRouteObj.avgPaxPerFlight !== undefined && (
                  <div className="flex justify-between gap-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{pick("Moyenne / vol", "Avg / flight")}:</span>
                    <span>{activeRouteObj.avgPaxPerFlight} pax/vol</span>
                  </div>
                )}
                {activeRouteObj.loadFactorPct !== undefined &&
                  activeRouteObj.loadFactorPct !== null && (
                    <div
                      className={`flex justify-between gap-4 font-mono tabular-nums text-[11px] ${getLfTextClass(
                        activeRouteObj.loadFactorPct
                      )}`}
                    >
                      <span>Load Factor:</span>
                      <strong>{activeRouteObj.loadFactorPct}%</strong>
                    </div>
                  )}
                {activeRouteObj.sharePct !== undefined && (
                  <div className="flex justify-between gap-4 font-mono tabular-nums text-[11px] text-amber-600 dark:text-amber-400">
                    <span>{pick("Part du trafic O&D", "O&D Share")}:</span>
                    <strong>{activeRouteObj.sharePct}%</strong>
                  </div>
                )}
                {activeRouteObj.flightNumbers.length > 0 && (
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                    {activeRouteObj.flightNumbers
                      .slice(0, 5)
                      .map((fn) =>
                        fn.loadFactorPct !== null && fn.loadFactorPct !== undefined
                          ? `${fn.airline}${fn.flightNumber} (${fn.frequency}v · ${fn.passengers}p · ${fn.loadFactorPct}%)`
                          : `${fn.airline}${fn.flightNumber} (${fn.frequency}v · ${fn.passengers}p)`
                      )
                      .join(" · ")}
                  </div>
                )}
              </div>
            )}

            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => {
                handlePointerUp();
                setPointerPos(null);
              }}
              className={`w-full block ${
                isFullscreen ? "h-full" : "h-[380px] sm:h-[460px] lg:h-[510px]"
              } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <defs>
                <filter id="routeGlow" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Directional Arrowhead Markers */}
                {(
                  [
                    { id: "arrowLf85", color: isDark ? "#34D399" : "#059669", size: 10 },
                    { id: "arrowLf65", color: isDark ? "#38BDF8" : "#0284C7", size: 9.5 },
                    { id: "arrowLf45", color: isDark ? "#FBBF24" : "#D97706", size: 9 },
                    { id: "arrowLfLow", color: isDark ? "#FB7185" : "#E11D48", size: 9 },
                    { id: "arrowLfNa", color: isDark ? "#94A3B8" : "#64748B", size: 8.5 },
                    { id: "arrowHigh", color: isDark ? "#34D399" : "#059669", size: 10 },
                    { id: "arrowMid", color: isDark ? "#38BDF8" : "#0284C7", size: 9 },
                    { id: "arrowLow", color: isDark ? "#818CF8" : "#4F46E5", size: 8 },
                    { id: "arrowActive", color: "#F59E0B", size: 12 },
                    {
                      id: "arrowDim",
                      color: isDark
                        ? "rgba(100, 116, 139, 0.25)"
                        : "rgba(148, 163, 184, 0.35)",
                      size: 7,
                    },
                  ] as const
                ).map((m) => (
                  <marker
                    key={m.id}
                    id={m.id}
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth={m.size}
                    markerHeight={m.size}
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 1.2 L 9.5 5 L 0 8.8 L 2.3 5 Z" fill={m.color} />
                  </marker>
                ))}
              </defs>

              {/* Graticule grid lines */}
              <path
                d={graticulePathD}
                fill="none"
                stroke={graticuleStroke}
                strokeWidth={0.75}
                strokeDasharray="3 4"
              />

              {/* Countries landmass */}
              <path
                d={landPathD}
                fill={landFill}
                stroke={landStroke}
                strokeWidth={0.7}
              />

              {/* Curved Arrowed Trajectories (Lignes Fléchées) */}
              <g>
                {projectedFlows.map((item) => {
                  const isRouteActive = activeRouteId === item.route.id;
                  const isStationMatch =
                    hoveredStationCode !== null &&
                    (item.route.origin === hoveredStationCode ||
                      item.route.destination === hoveredStationCode);
                  const isHighlighted = isRouteActive || isStationMatch;
                  const isDimmed =
                    (activeRouteId !== null && !isRouteActive) ||
                    (hoveredStationCode !== null && !isStationMatch);

                  const useLfColors = layerMode !== "OND";
                  const lfBand = getLfBand(item.route.loadFactorPct);
                  const lfMarkerMap: Record<LfBand, string> = {
                    LF_85: "arrowLf85",
                    LF_65: "arrowLf65",
                    LF_45: "arrowLf45",
                    LF_LOW: "arrowLfLow",
                    LF_NA: "arrowLfNa",
                  };

                  const strokeColor = useLfColors
                    ? isDimmed
                      ? isDark
                        ? "rgba(100, 116, 139, 0.25)"
                        : "rgba(148, 163, 184, 0.35)"
                      : getLfStrokeColor(lfBand)
                    : getTierColor(item.tier, isHighlighted, isDimmed);

                  const markerId = isDimmed
                    ? "arrowDim"
                    : useLfColors
                      ? lfMarkerMap[lfBand]
                      : isHighlighted
                        ? "arrowActive"
                        : item.tier === "HIGH"
                          ? "arrowHigh"
                          : item.tier === "MID"
                            ? "arrowMid"
                            : "arrowLow";

                  const shouldShowBadge =
                    showFlowBadges &&
                    !isDimmed &&
                    (isHighlighted ||
                      projectedFlows.length <= 12 ||
                      item.tier === "HIGH");

                  const hasLf =
                    useLfColors &&
                    item.route.loadFactorPct !== undefined &&
                    item.route.loadFactorPct !== null;
                  const badgeW = hasLf ? 92 : 66;

                  return (
                    <g
                      key={item.route.id}
                      onMouseEnter={() => setHoveredRouteId(item.route.id)}
                      onMouseLeave={() => setHoveredRouteId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinnedRouteId((curr) =>
                          curr === item.route.id ? null : item.route.id
                        );
                      }}
                      className="cursor-pointer"
                    >
                      {/* Invisible wide hit target for easy hover/click */}
                      <path
                        d={item.pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                      />

                      {/* Outer selection halo in LF mode so highlight never obscures LF color */}
                      {isHighlighted && useLfColors && (
                        <path
                          d={item.pathD}
                          fill="none"
                          stroke={isDark ? "#F8FAFC" : "#0F172A"}
                          strokeWidth={item.strokeWidth + 4.2}
                          strokeLinecap="round"
                          strokeOpacity={0.28}
                        />
                      )}

                      {/* Visible directional arrowed curve */}
                      <path
                        d={item.pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isHighlighted ? item.strokeWidth + 1.4 : item.strokeWidth}
                        strokeLinecap="round"
                        strokeOpacity={isHighlighted ? 0.98 : isDimmed ? 0.35 : 0.88}
                        markerEnd={`url(#${markerId})`}
                        filter={isHighlighted ? "url(#routeGlow)" : undefined}
                      />

                      {/* Subtle mid-curve flow badge (Frequency + Pax + LF%) */}
                      {shouldShowBadge && (
                        <g
                          transform={`translate(${item.midX.toFixed(1)}, ${item.midY.toFixed(
                            1
                          )})`}
                          className="pointer-events-none"
                        >
                          <rect
                            x={-badgeW / 2}
                            y={-9}
                            width={badgeW}
                            height={18}
                            rx={5}
                            fill={
                              isHighlighted && !useLfColors
                                ? "#F59E0B"
                                : isDark
                                  ? "rgba(15, 23, 42, 0.9)"
                                  : "rgba(255, 255, 255, 0.94)"
                            }
                            stroke={
                              isHighlighted
                                ? useLfColors
                                  ? strokeColor
                                  : "#B45309"
                                : useLfColors
                                  ? strokeColor
                                  : isDark
                                    ? "rgba(71, 85, 105, 0.75)"
                                    : "rgba(203, 213, 225, 0.9)"
                            }
                            strokeWidth={isHighlighted ? 1.4 : 0.9}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={8.5}
                            fontFamily="monospace"
                            fontWeight={700}
                            fill={
                              isHighlighted && !useLfColors
                                ? "#0F172A"
                                : isDark
                                  ? "#E2E8F0"
                                  : "#0F172A"
                            }
                          >
                            {item.route.flightsCount !== null
                              ? hasLf
                                ? `${item.route.flightsCount}v · ${item.route.passengers}p · ${Math.round(
                                    item.route.loadFactorPct as number
                                  )}%`
                                : `${item.route.flightsCount}v · ${item.route.passengers}p`
                              : `${item.route.passengers} pax`}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Airport Station Nodes */}
              <g>
                {airportNodes.map((node) => {
                  const pt = projection([node.lng, node.lat]);
                  if (!pt) return null;
                  const [x, y] = pt;
                  const r = node.isHub
                    ? 8.5
                    : 4.5 + (node.totalVolume / maxNodeVolume) * 5;
                  const isSelected =
                    selectedStation === node.code || hoveredStationCode === node.code;

                  return (
                    <g
                      key={node.code}
                      transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}
                      onMouseEnter={() => setHoveredStationCode(node.code)}
                      onMouseLeave={() => setHoveredStationCode(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStation((curr) =>
                          curr === node.code ? "ALL" : node.code
                        );
                        setPinnedRouteId(null);
                      }}
                      className="cursor-pointer"
                    >
                      {(node.isHub || isSelected) && (
                        <circle
                          r={r + 4.5}
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth={1.5}
                          strokeOpacity={0.65}
                        />
                      )}
                      <circle
                        r={r}
                        fill={
                          isSelected
                            ? "#F59E0B"
                            : node.isHub
                              ? "#F59E0B"
                              : isDark
                                ? "#38BDF8"
                                : "#0284C7"
                        }
                        stroke={isDark ? "#0F172A" : "#FFFFFF"}
                        strokeWidth={1.6}
                      />
                      <text
                        y={-(r + 5)}
                        textAnchor="middle"
                        fontSize={node.isHub || isSelected ? 10.5 : 9.5}
                        fontFamily="monospace"
                        fontWeight={800}
                        fill={isDark ? "#F8FAFC" : "#0F172A"}
                        stroke={isDark ? "#020617" : "#FFFFFF"}
                        strokeWidth={2.8}
                        paintOrder="stroke"
                      >
                        {node.code}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Right Inspector: Searchable & Interactive Ranked Route List (hidden in Fullscreen) */}
          {!isFullscreen && (
            <div className="lg:col-span-4 max-h-[512px] flex flex-col bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={pick(
                      "Filtrer trajet, ville ou vol (KP10)...",
                      "Filter route, city or flight (KP10)..."
                    )}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {pinnedRouteId && activeRouteObj && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/40 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        {activeRouteObj.route}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPinnedRouteId(null)}
                        className="text-[10px] text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                      >
                        {pick("Détacher", "Unpin")}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      {activeRouteObj.originCity} → {activeRouteObj.destinationCity}
                    </div>
                    {onSelectOriginStation && (
                      <button
                        type="button"
                        onClick={() => onSelectOriginStation(activeRouteObj.origin)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        <Filter className="w-3 h-3" />
                        {originFilter === activeRouteObj.origin
                          ? pick(
                              `Origine ${activeRouteObj.origin} active`,
                              `Origin ${activeRouteObj.origin} active`
                            )
                          : pick(
                              `Filtrer le dashboard sur départ ${activeRouteObj.origin}`,
                              `Filter dashboard by origin ${activeRouteObj.origin}`
                            )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-700/60">
                {visibleRoutes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    {pick("Aucun trajet correspondant.", "No matching routes.")}
                  </div>
                ) : (
                  visibleRoutes.map((r, idx) => {
                    const isActive = activeRouteId === r.id;
                    return (
                      <div
                        key={r.id}
                        onMouseEnter={() => setHoveredRouteId(r.id)}
                        onMouseLeave={() => setHoveredRouteId(null)}
                        onClick={() =>
                          setPinnedRouteId((curr) => (curr === r.id ? null : r.id))
                        }
                        className={`p-3 cursor-pointer transition space-y-1.5 ${
                          isActive
                            ? "bg-amber-50 dark:bg-amber-500/10"
                            : "hover:bg-white dark:hover:bg-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-mono text-slate-400 w-5 shrink-0">
                              #{idx + 1}
                            </span>
                            {layerMode !== "OND" && (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${getLfDotClass(
                                  r.loadFactorPct
                                )}`}
                                title={
                                  r.loadFactorPct !== null && r.loadFactorPct !== undefined
                                    ? `Load Factor: ${r.loadFactorPct}%`
                                    : pick("Load Factor N/D", "Load Factor N/A")
                                }
                              />
                            )}
                            <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                              {r.origin} → {r.destination}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                            {r.flightsCount !== null && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                                {r.flightsCount} {pick("vol", "flt")}
                                {r.flightsCount > 1 ? "s" : ""}
                              </span>
                            )}
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                              {r.passengers.toLocaleString(locale)} pax
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 pl-6">
                          <span className="truncate">
                            {r.originCity} → {r.destinationCity}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {r.avgPaxPerFlight !== undefined
                              ? `~${r.avgPaxPerFlight} pax/v`
                              : r.sharePct !== undefined
                                ? `${r.sharePct}% O&D`
                                : ""}
                            {r.loadFactorPct !== undefined && r.loadFactorPct !== null && (
                              <span className={`font-bold ${getLfTextClass(r.loadFactorPct)}`}>
                                {` · LF ${r.loadFactorPct}%`}
                              </span>
                            )}
                          </span>
                        </div>

                        {r.flightNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-1 pl-6">
                            {r.flightNumbers.slice(0, 4).map((fn) => (
                              <span
                                key={`${fn.airline}${fn.flightNumber}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 font-mono text-[10px]"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${getLfDotClass(
                                    fn.loadFactorPct
                                  )}`}
                                />
                                <span>
                                  {fn.airline}
                                  {fn.flightNumber}: {fn.frequency}v ({fn.passengers}p
                                  {fn.loadFactorPct !== null && fn.loadFactorPct !== undefined
                                    ? ` · ${fn.loadFactorPct}%`
                                    : ""}
                                  )
                                </span>
                              </span>
                            ))}
                            {r.flightNumbers.length > 4 && (
                              <span className="text-[10px] font-mono text-slate-400">
                                +{r.flightNumbers.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isFullscreen &&
        (unmappedCodes.length > 0 ||
          geoExcludedRoutes.length > 0 ||
          (layerMode !== "OND" && unmappedMapFlights.length > 0)) && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-2.5 text-[11px] font-mono text-amber-900 dark:text-amber-200 space-y-1.5">
            {geoExcludedRoutes.length > 0 && (
              <div>
                <span className="font-bold">
                  {pick(
                    "Trajets sans coordonnées IATA :",
                    "Routes missing IATA coordinates:"
                  )}
                </span>{" "}
                {geoExcludedRoutes
                  .map(
                    (g) =>
                      `${g.route} (${g.flightsCount}v · ${pick("manquant", "missing")}: ${g.missingCodes.join("/")})`
                  )
                  .join(" · ")}
              </div>
            )}
            {layerMode !== "OND" && unmappedMapFlights.length > 0 && (
              <div>
                <span className="font-bold">
                  {pick(
                    "Vol(s) du manifeste sans destination physique distincte :",
                    "Manifest flight(s) without distinct physical destination:"
                  )}
                </span>{" "}
                {unmappedMapFlights
                  .map(
                    (u) =>
                      `${u.airline}${u.flightNumber} (${u.dateKey}, ${u.origin}→${u.destination}, ${u.passengers} pax — ${
                        u.reason === "SAME_ORIGIN_DEST"
                          ? pick("origine = destination", "origin = destination")
                          : pick("destination non résolue (0 pax / programme absent)", "unresolved destination (0 pax / no schedule)")
                      })`
                  )
                  .join(" · ")}
              </div>
            )}
            {geoExcludedRoutes.length === 0 && unmappedCodes.length > 0 && (
              <div>
                {pick("Codes escales sans coordonnées:", "Unmapped station codes:")}{" "}
                {unmappedCodes.join(", ")}
              </div>
            )}
          </div>
        )}
    </div>
  );
};
