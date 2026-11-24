/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Award,
  Ticket,
  Search,
  Eye,
  Luggage,
} from "lucide-react";
import {
  EmdDocumentDetail,
  ManifestFlight,
  ManifestParseResult,
  ManifestPassenger,
} from "../../types";
import { PassengerDossierDrawer } from "./PassengerDossierDrawer";
import { BabyBottleIcon } from "./BabyBottleIcon";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { useLanguage } from "../../context/LanguageContext";
import {
  getDcsFlightDateSortOrder,
  isPassengerNoShow,
  isPassengerWebCheckin,
  isPassengerWithSeat,
  translateBaggageDeviation,
  translateMissingBaggageDetail,
} from "../../utils/manifestParser";
import {
  DateRangePicker,
  DateRangeValue,
  dcsDateToIso,
} from "../ui/DateRangePicker";
import { EmdAuditWincmdModal } from "./EmdAuditWincmdModal";
import {
  extractUniqueEmdsFromFlights,
  formatEmdMonetaryValue,
  normalizeEmdNumber,
} from "../../utils/emdAudit";

interface ManifestAuditViewProps {
  parsedResult: ManifestParseResult;
  emdDetailsMap?: Record<string, EmdDocumentDetail>;
  onImportEmdDetails?: (emds: EmdDocumentDetail[]) => void;
  onClearEmdDetails?: () => void;
}

type AuditCategory =
  | "UNCOVERED_BAG"
  | "MISSING_BAG_WEIGHT"
  | "COVERED_EMD"
  | "TICKET_SEAT"
  | "LOYALTY";

interface CrossFlightPax {
  flight: ManifestFlight;
  passenger: ManifestPassenger;
}

export const ManifestAuditView: React.FC<ManifestAuditViewProps> = ({
  parsedResult,
  emdDetailsMap = {},
  onImportEmdDetails,
  onClearEmdDetails,
}) => {
  const { language, pick } = useLanguage();
  const [category, setCategory] = useState<AuditCategory>("UNCOVERED_BAG");
  const [flightFilter, setFlightFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: "",
    endDate: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<CrossFlightPax | null>(null);
  const [isEmdAuditModalOpen, setIsEmdAuditModalOpen] = useState(false);

  const availableIsoDates = useMemo(() => {
    const out = new Set<string>();
    for (const f of parsedResult.flights) {
      const iso = dcsDateToIso(f.date, f.extractedYear);
      if (iso) out.add(iso);
    }
    return Array.from(out).sort();
  }, [parsedResult.flights]);

  const dateScopedFlights = useMemo(() => {
    if (!dateRange.startDate && !dateRange.endDate) {
      return parsedResult.flights;
    }
    const parseIsoOrder = (iso: string): number | null => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      const n = parseInt(iso.replace(/-/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };
    const s = dateRange.startDate ? parseIsoOrder(dateRange.startDate) : null;
    const e = dateRange.endDate ? parseIsoOrder(dateRange.endDate) : null;
    const minOrder = s !== null && e !== null ? Math.min(s, e) : (s ?? -Infinity);
    const maxOrder = s !== null && e !== null ? Math.max(s, e) : (e ?? Infinity);

    return parsedResult.flights.filter((f) => {
      const order = getDcsFlightDateSortOrder(f.date, f.extractedYear);
      return order >= minOrder && order <= maxOrder;
    });
  }, [parsedResult.flights, dateRange]);

  const allEntries = useMemo<CrossFlightPax[]>(() => {
    const out: CrossFlightPax[] = [];
    for (const f of dateScopedFlights) {
      if (flightFilter !== "ALL" && f.id !== flightFilter) continue;
      for (const p of f.passengers) {
        out.push({ flight: f, passenger: p });
      }
    }
    return out;
  }, [dateScopedFlights, flightFilter]);

  const counts = useMemo(() => {
    let uncovered = 0;
    let missingBagWeight = 0;
    let coveredEmd = 0;
    let ticketSeat = 0;
    let loyalty = 0;

    for (const { passenger: p } of allEntries) {
      if (isPassengerWithSeat(p)) {
        if (p.baggageCompliance === "ECART_NON_COUVERT") uncovered++;
        if (p.hasMissingBaggageWeight) missingBagWeight++;
        if (
          p.baggageCompliance === "COUVERT_EMD" ||
          p.emdNumbers.length > 0 ||
          p.ancillaries.length > 0
        ) {
          coveredEmd++;
        }
        if (p.kpFrequentFlyer || p.partnerFrequentFlyer) {
          loyalty++;
        }
      }
      if (
        p.editCodes.includes("ETO") ||
        p.ticket?.isPaperTicket ||
        !p.ticket ||
        p.isOffloadedOrNoSeat ||
        !isPassengerWithSeat(p)
      ) {
        ticketSeat++;
      }
    }
    return { uncovered, missingBagWeight, coveredEmd, ticketSeat, loyalty };
  }, [allEntries]);

  const scopedUniqueEmdCount = useMemo(() => {
    const scope =
      flightFilter === "ALL"
        ? dateScopedFlights
        : dateScopedFlights.filter((f) => f.id === flightFilter);
    return extractUniqueEmdsFromFlights(scope).length;
  }, [dateScopedFlights, flightFilter]);

  const filteredRows = useMemo(() => {
    const byCat = allEntries.filter(({ passenger: p }) => {
      if (category === "UNCOVERED_BAG") {
        return isPassengerWithSeat(p) && p.baggageCompliance === "ECART_NON_COUVERT";
      }
      if (category === "MISSING_BAG_WEIGHT") {
        return isPassengerWithSeat(p) && Boolean(p.hasMissingBaggageWeight);
      }
      if (category === "COVERED_EMD") {
        return (
          isPassengerWithSeat(p) &&
          (p.baggageCompliance === "COUVERT_EMD" ||
            p.emdNumbers.length > 0 ||
            p.ancillaries.length > 0)
        );
      }
      if (category === "TICKET_SEAT") {
        return (
          p.editCodes.includes("ETO") ||
          p.ticket?.isPaperTicket ||
          !p.ticket ||
          p.isOffloadedOrNoSeat ||
          !isPassengerWithSeat(p)
        );
      }
      return (
        isPassengerWithSeat(p) &&
        Boolean(p.kpFrequentFlyer || p.partnerFrequentFlyer)
      );
    });

    if (!searchTerm.trim()) return byCat;
    const q = searchTerm.toLowerCase().trim();
    return byCat.filter(({ flight, passenger }) =>
      [
        flight.flightNumber,
        flight.origin,
        passenger.fullNameDisplay,
        passenger.ticket?.ticketNumber || "",
        passenger.infant?.fullNameDisplay || "",
        passenger.infant?.birthDate || "",
        passenger.infant?.ticket?.ticketNumber || "",
        passenger.kpFrequentFlyer?.number || "",
        passenger.partnerFrequentFlyer?.number || "",
        ...passenger.emdNumbers,
        ...passenger.bags.map((b) => b.tag),
        ...(passenger.missingBaggageWeightDetails || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [allEntries, category, searchTerm]);

  const drawerIdx = selectedItem
    ? filteredRows.findIndex(
        (r) =>
          r.flight.id === selectedItem.flight.id &&
          r.passenger.id === selectedItem.passenger.id
      )
    : -1;

  const activeCategoryLabel =
    category === "UNCOVERED_BAG"
      ? pick(
          `Écarts Bagages sans EMD (${counts.uncovered})`,
          `Baggage Deviations without EMD (${counts.uncovered})`
        )
      : category === "MISSING_BAG_WEIGHT"
      ? pick(
          `Poids Bagages Manquants (${counts.missingBagWeight})`,
          `Missing Baggage Weights (${counts.missingBagWeight})`
        )
      : category === "COVERED_EMD"
      ? pick(
          `Excédents & Services EMD (${counts.coveredEmd})`,
          `Excess Baggage & EMD Services (${counts.coveredEmd})`
        )
      : category === "TICKET_SEAT"
      ? pick(
          `Anomalies Billet / Sans Siège (${counts.ticketSeat})`,
          `Ticket Issues / No Seat (${counts.ticketSeat})`
        )
      : pick(
          `Passagers Fidélité FF/FQTV (${counts.loyalty})`,
          `Loyalty Passengers FF/FQTV (${counts.loyalty})`
        );

  return (
    <div className="space-y-4">
      <CollapsiblePanel
        title={pick("Audit & Filtres", "Audit & Filters")}
        subtitle={`${activeCategoryLabel} · ${filteredRows.length} ${pick("dossiers", "records")}`}
        icon={<AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
        defaultOpen={false}
        rightContent={
          <button
            type="button"
            onClick={() => setIsEmdAuditModalOpen(true)}
            className="px-2.5 py-1 rounded-lg border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            title={pick(
              "Extraire les commandes WINCMD(\"PTRWEMD*...\") pour contrôler les montants des EMD",
              "Extract WINCMD(\"PTRWEMD*...\") commands to audit EMD amounts"
            )}
          >
            <CreditCard className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
            <span>Audit EMDs</span>
            <span className="font-mono tabular-nums opacity-85">
              ({scopedUniqueEmdCount})
            </span>
          </button>
        }
      >
        <div className="space-y-4">
          {/* Sub-Tabs for Audit Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setCategory("UNCOVERED_BAG")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            category === "UNCOVERED_BAG"
              ? "bg-rose-700 border-rose-700 text-white"
              : "bg-white dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] hover:border-rose-300 dark:hover:border-rose-700 text-[#321B0A] dark:text-[#FAF7F2]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{pick("Écarts Bagages sans EMD", "Baggage Deviations (No EMD)")}</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                category === "UNCOVERED_BAG" ? "text-rose-200" : "text-rose-600 dark:text-rose-400"
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1.5">
            {counts.uncovered}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCategory("MISSING_BAG_WEIGHT")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            category === "MISSING_BAG_WEIGHT"
              ? "bg-amber-600 border-amber-600 text-white"
              : "bg-white dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] hover:border-amber-400 dark:hover:border-amber-600 text-[#321B0A] dark:text-[#FAF7F2]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{pick("Poids Bagages Manquants", "Missing Bag Weights")}</span>
            <Luggage
              className={`w-4 h-4 ${
                category === "MISSING_BAG_WEIGHT" ? "text-amber-100" : "text-amber-600 dark:text-amber-400"
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1.5">
            {counts.missingBagWeight}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCategory("COVERED_EMD")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            category === "COVERED_EMD"
              ? "bg-[#E89C1D] border-[#E89C1D] text-[#321B0A]"
              : "bg-white dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] hover:border-[#E89C1D] text-[#321B0A] dark:text-[#FAF7F2]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{pick("Excédents & Services EMD", "Excess & EMD Services")}</span>
            <CreditCard
              className={`w-4 h-4 ${
                category === "COVERED_EMD" ? "text-[#4C2812]" : "text-[#8C5214] dark:text-[#F7BA42]"
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1.5">
            {counts.coveredEmd}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCategory("TICKET_SEAT")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            category === "TICKET_SEAT"
              ? "bg-[#6E472B] border-[#6E472B] text-white"
              : "bg-white dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] hover:border-[#6E472B] dark:hover:border-[#E89C1D] text-[#321B0A] dark:text-[#FAF7F2]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{pick("Anomalies Billet / Sans Siège", "Ticket Issues / No Seat")}</span>
            <Ticket
              className={`w-4 h-4 ${
                category === "TICKET_SEAT" ? "text-[#F7BA42]" : "text-[#6E472B] dark:text-[#DECAB1]"
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1.5">
            {counts.ticketSeat}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCategory("LOYALTY")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            category === "LOYALTY"
              ? "bg-[#4C2812] dark:bg-[#5C3016] border-[#321B0A] dark:border-[#E89C1D] text-[#F7BA42]"
              : "bg-white dark:bg-[#28170C] border-[#E6D7C3] dark:border-[#4C2812] hover:border-[#4C2812] dark:hover:border-[#E89C1D] text-[#321B0A] dark:text-[#FAF7F2]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{pick("Passagers Fidélité (FF/FQTV)", "Loyalty Passengers (FF/FQTV)")}</span>
            <Award
              className={`w-4 h-4 ${
                category === "LOYALTY" ? "text-[#E89C1D]" : "text-[#4C2812] dark:text-[#F7BA42]"
              }`}
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1.5">
            {counts.loyalty}
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangePicker
            id="manifest-audit-date-range"
            accentVariant="warm"
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            availableIsoDates={availableIsoDates}
            placeholder={pick("Toutes les dates", "All dates")}
            onChange={(nextRange) => {
              setDateRange(nextRange);
              setFlightFilter("ALL");
            }}
            className="min-w-[220px]"
          />

          <select
            value={flightFilter}
            onChange={(e) => setFlightFilter(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] rounded-xl text-xs font-semibold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
          >
            <option value="ALL">
              {pick(`Tous les vols (${dateScopedFlights.length})`, `All flights (${dateScopedFlights.length})`)}
            </option>
            {dateScopedFlights.map((f) => (
              <option key={f.id} value={f.id}>
                {f.date} · {f.airline} {f.flightNumber} · {pick("Départ", "Dep.")} {f.origin} ({f.grandTotals.passengersCount} pax)
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={pick("Nom, EMD, FF, N° bagage...", "Name, EMD, FF, bag tag...")}
              className="w-full min-h-[40px] pl-8 pr-3 py-1.5 bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] rounded-xl text-xs font-medium text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
            />
          </div>
        </div>

        <div className="text-xs font-mono text-[#6E472B] dark:text-[#DECAB1] tabular-nums flex flex-wrap items-center gap-3">
          <span>
            <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{filteredRows.length}</span>{" "}
            {pick("dossier(s)", "record(s)")}
          </span>
          <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 font-semibold">
            <WebCheckinBadge />
            {filteredRows.filter((r) => isPassengerWebCheckin(r.passenger)).length} WB
          </span>
          <button
            type="button"
            onClick={() => setIsEmdAuditModalOpen(true)}
            className="font-sans px-3 py-1.5 rounded-xl border border-[#E89C1D]/60 bg-[#FDF4E3] dark:bg-[#2E1A0D] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] text-[#4C2812] dark:text-[#F7BA42] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            title={pick(
              "Extraire les commandes WINCMD(\"PTRWEMD*...\") pour contrôler les montants des EMD",
              "Extract WINCMD(\"PTRWEMD*...\") commands to audit EMD amounts"
            )}
          >
            <CreditCard className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D]" />
            <span>Audit EMDs</span>
            <span className="font-mono tabular-nums opacity-85">
              ({scopedUniqueEmdCount})
            </span>
          </button>
        </div>
      </div>
        </div>
      </CollapsiblePanel>

      {/* Table */}
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6E472B] dark:text-[#DECAB1]">
            {pick("Aucun dossier détecté dans cette catégorie.", "No records found in this category.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] border-b border-[#321B0A] dark:border-[#5C351B] text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 pl-5 pr-3">{pick("Vol & Tronçon", "Flight & Sector")}</th>
                  <th className="py-3 px-3">{pick("Ordre (Classe) & Passager", "Seq (Class) & Passenger")}</th>
                  <th className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{pick("Cabine / Siège", "Cabin / Seat")}</span>
                      <span className="text-sky-300 font-mono text-[10px]">
                        · {filteredRows.filter((r) => isPassengerWebCheckin(r.passenger)).length} WB
                      </span>
                    </span>
                  </th>
                  <th className="py-3 px-3">{pick("Bagages", "Baggage")}</th>
                  <th className="py-3 px-3">{pick("Motif / Détail Contrôle", "Reason / Audit Detail")}</th>
                  <th className="py-3 pr-5 pl-3 text-right">{pick("Dossier", "Record")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                {filteredRows.map(({ flight, passenger }, rowIdx) => {
                  const actualBags = Math.max(
                    passenger.bags.length,
                    passenger.bagsDeclaredCount || 0,
                    passenger.bagsTotalDeclaredLine?.count || 0
                  );

                  return (
                    <tr
                      key={`${flight.id}-${passenger.id}`}
                      onClick={() => setSelectedItem({ flight, passenger })}
                      className={`cursor-pointer transition-colors ${
                        rowIdx % 2 === 0
                          ? "bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                          : "bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                      }`}
                    >
                      <td className="py-3 pl-5 pr-3 font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] whitespace-nowrap">
                        <span className="text-[#8C5214] dark:text-[#F7BA42] mr-1.5">{flight.date}</span>
                        · {flight.airline} {flight.flightNumber} · {flight.origin} →{" "}
                        {passenger.destination}
                      </td>
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-[#4C2812] dark:text-[#F7BA42] bg-[#F3E9D8] dark:bg-[#3A2212] px-1.5 py-0.5 rounded text-[11px] font-bold">
                            {passenger.cabinClass}#{String(passenger.classSeq || passenger.seq).padStart(3, "0")}
                            {passenger.isTransitMarker ? "#" : ""}
                          </span>
                          {passenger.hasInfant && (
                            <BabyBottleIcon
                              className="w-4 h-4"
                              title={pick("Passager accompagné d'un bébé (INF)", "Passenger traveling with an infant (INF)")}
                            />
                          )}
                          <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                            {passenger.fullNameDisplay}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[#6E472B] dark:text-[#DECAB1] whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{passenger.cabinClass} ({passenger.bookingClass}) ·</span>
                          {isPassengerWebCheckin(passenger) && <WebCheckinBadge />}
                          <span>{passenger.seat || pick("Sans siège", "No seat")}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap text-[#321B0A] dark:text-[#FAF7F2]">
                        <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{actualBags} pcs</span> ·{" "}
                        {passenger.hasMissingBaggageWeight ? (
                          <span className="text-amber-700 dark:text-amber-400 font-bold">
                            {passenger.totalBagWeight > 0
                              ? `${passenger.totalBagWeight} kg (${pick("incomplet", "partial")})`
                              : pick("Poids manquant", "Missing wt")}
                          </span>
                        ) : (
                          `${passenger.totalBagWeight} kg`
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {category === "UNCOVERED_BAG" && (
                          <span className="text-rose-700 dark:text-rose-400 font-medium">
                            {passenger.baggageDeviations
                              .map((d) => translateBaggageDeviation(d, language))
                              .join(" · ")}
                          </span>
                        )}
                        {category === "MISSING_BAG_WEIGHT" && (
                          <div className="space-y-0.5">
                            <div className="text-amber-800 dark:text-amber-300 font-semibold">
                              {(passenger.missingBaggageWeightDetails || [])
                                .map((d) => translateMissingBaggageDetail(d, language))
                                .join(" · ")}
                            </div>
                            {passenger.bags.length > 0 && (
                              <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                                {pick("Talon(s) :", "Tag(s):")}{" "}
                                {passenger.bags
                                  .map(
                                    (b) =>
                                      `${b.tag}${
                                        b.hasMissingWeight || b.weight <= 0
                                          ? ` (${pick("N/D", "N/A")})`
                                          : `.${b.weight}kg`
                                      }`
                                  )
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        )}
                        {category === "COVERED_EMD" && (
                          <div className="space-y-1">
                            {passenger.emdNumbers.length > 0 ? (
                              passenger.emdNumbers.map((rawNum) => {
                                const detail =
                                  emdDetailsMap[normalizeEmdNumber(rawNum)];
                                return (
                                  <div key={rawNum} className="space-y-0.5">
                                    <div className="font-mono font-bold text-[#8C5214] dark:text-[#F7BA42]">
                                      EMD {rawNum}
                                      {detail?.reasonForIssuance
                                        ? ` · ${detail.reasonForIssuance}`
                                        : ""}
                                    </div>
                                    {detail && (
                                      <div className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                        {formatEmdMonetaryValue(
                                          detail.totalValue,
                                          language === "fr" ? "fr-FR" : "en-US"
                                        )}
                                        {detail.fopSummary
                                          ? ` · ${detail.fopSummary}`
                                          : ""}
                                      </div>
                                    )}
                                    {detail?.endorsementsRestrictions && (
                                      <div className="text-[10px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                                        {detail.endorsementsRestrictions}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="font-mono font-bold text-[#8C5214] dark:text-[#F7BA42]">
                                EMD AE
                              </div>
                            )}
                            {passenger.ancillaries[0]?.description && (
                              <div className="text-[#6E472B] dark:text-[#DECAB1] text-[11px]">
                                {passenger.ancillaries[0].description}
                              </div>
                            )}
                          </div>
                        )}
                        {category === "TICKET_SEAT" && (
                          <div className="text-[#4C2812] dark:text-[#FAF7F2] flex flex-wrap items-center gap-1.5">
                            {isPassengerNoShow(passenger) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold text-[10px] uppercase">
                                No-Show ({pick("sans siège", "unseated")})
                              </span>
                            )}
                            <span>
                              {passenger.editCodes.includes("ETO") &&
                                "Coupon ETO (Out of Sync) · "}
                              {passenger.ticket?.isPaperTicket &&
                                pick(
                                  `Billet papier ${passenger.ticket.ticketNumber}`,
                                  `Paper ticket ${passenger.ticket.ticketNumber}`
                                )}
                              {!passenger.ticket &&
                                pick(
                                  "Aucun billet électronique",
                                  "No electronic ticket"
                                )}
                            </span>
                          </div>
                        )}
                        {category === "LOYALTY" && (
                          <div className="font-mono">
                            {passenger.kpFrequentFlyer && (
                              <span className="text-[#4C2812] dark:text-[#F7BA42] font-bold">
                                FF {passenger.kpFrequentFlyer.number}{" "}
                                {passenger.kpFrequentFlyer.tier || ""}
                              </span>
                            )}
                            {passenger.partnerFrequentFlyer && (
                              <span className="text-[#8C5214] dark:text-[#E89C1D] font-bold">
                                FQTV {passenger.partnerFrequentFlyer.number}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem({ flight, passenger });
                          }}
                          className="text-xs font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {pick("Ouvrir", "Open")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PassengerDossierDrawer
        passenger={selectedItem?.passenger || null}
        flight={selectedItem?.flight || null}
        emdDetailsMap={emdDetailsMap}
        onClose={() => setSelectedItem(null)}
        hasPrev={drawerIdx > 0}
        hasNext={drawerIdx >= 0 && drawerIdx < filteredRows.length - 1}
        onPrev={() => {
          if (drawerIdx > 0) setSelectedItem(filteredRows[drawerIdx - 1]);
        }}
        onNext={() => {
          if (drawerIdx >= 0 && drawerIdx < filteredRows.length - 1) {
            setSelectedItem(filteredRows[drawerIdx + 1]);
          }
        }}
      />

      <EmdAuditWincmdModal
        isOpen={isEmdAuditModalOpen}
        onClose={() => setIsEmdAuditModalOpen(false)}
        flights={dateScopedFlights}
        initialFlightId={flightFilter !== "ALL" ? flightFilter : undefined}
        dateLabel={parsedResult.manifestDate}
        emdDetailsMap={emdDetailsMap}
        onImportEmdDetails={onImportEmdDetails}
        onClearEmdDetails={onClearEmdDetails}
      />
    </div>
  );
};
