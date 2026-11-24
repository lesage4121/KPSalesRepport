/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  X,
  Plane,
  Clock,
  DoorOpen,
  ShieldCheck,
  MapPin,
  Users,
  Terminal,
  AlertCircle,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { FlightSegment, FlightStatusDetail } from "../../types";
import { formatFlightTime } from "../../utils/flightParser";
import { FlightStatusMatchLevel } from "../../utils/flightStatusParser";
import { useLanguage } from "../../context/LanguageContext";

interface FlightStatusDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment: FlightSegment | null;
  statusDetail: FlightStatusDetail | null;
  resolvedStatus: string;
  matchLevel: FlightStatusMatchLevel;
  onEditEquipment?: (segment: FlightSegment) => void;
}

export const FlightStatusDetailModal: React.FC<FlightStatusDetailModalProps> = ({
  isOpen,
  onClose,
  segment,
  statusDetail,
  resolvedStatus,
  matchLevel,
  onEditEquipment,
}) => {
  const { pick } = useLanguage();

  if (!isOpen || !segment) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#321B0A]/65 dark:bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1F1209] w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E6D7C3] dark:border-[#4C2812] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] p-2.5 rounded-2xl shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-[#321B0A] dark:text-[#FAF7F2] font-mono">
                  KP {segment.flightNumber} · {segment.origin} → {segment.destination}
                </h3>
                {statusDetail && !statusDetail.isManualOnly && (
                  <span
                    className={`px-2 py-0.5 rounded-lg font-mono text-xs font-extrabold inline-flex items-center gap-1 border ${
                      (resolvedStatus || "").trim().toUpperCase() === "PDC"
                        ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                        : "bg-rose-600 text-white border-rose-700"
                    }`}
                  >
                    {(resolvedStatus || "").trim().toUpperCase() !== "PDC" && (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>{resolvedStatus || "NON-PDC"}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono mt-0.5 truncate">
                {pick("Programme", "Schedule")}: {segment.date} ·{" "}
                {segment.ptrgWincmd || `WINCMD("PTRG*/KP${segment.flightNumber}/${segment.date}${segment.origin}/D")`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEditEquipment && (
              <button
                type="button"
                onClick={() => onEditEquipment(segment)}
                className="px-3 py-1.5 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{pick("Modifier équipement", "Edit equipment")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {!statusDetail ? (
            <div className="rounded-2xl border border-dashed border-[#D4BC9E] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] p-6 text-center space-y-2.5">
              <AlertCircle className="w-8 h-8 text-[#E89C1D] mx-auto" />
              <h4 className="text-sm font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {pick(
                  `Aucun détail PTRG* importé pour KP ${segment.flightNumber} · ${segment.date} · ${segment.origin}`,
                  `No PTRG* flight details imported for KP ${segment.flightNumber} · ${segment.date} · ${segment.origin}`
                )}
              </h4>
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] max-w-md mx-auto leading-relaxed">
                {pick(
                  "Chaque détail correspond strictement au triplet (N° de vol + Date de départ + Origine). Exportez la commande WINCMD(\"PTRG*/...\") en ANSI, exécutez-la dans le DCS puis importez le fichier résultat pour ce vol précis, ou saisissez l'équipement manuellement.",
                  "Each detail strictly matches the (Flight # + Departure Date + Origin) key. Export WINCMD(\"PTRG*/...\") in ANSI, execute it in DCS, and import the output file, or assign equipment manually."
                )}
              </p>
              {onEditEquipment && (
                <button
                  type="button"
                  onClick={() => onEditEquipment(segment)}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{pick("Assigner équipement manuellement", "Assign equipment manually")}</span>
                </button>
              )}
            </div>
          ) : (
            <>

              {/* Primary Aircraft, Capacity, Boarding, Gate & Status Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812]">
                  <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-[#E89C1D]" />
                    {pick("Appareil & Immat.", "Aircraft & Reg.")}
                  </div>
                  <div className="text-base font-extrabold font-mono text-[#321B0A] dark:text-[#FAF7F2] mt-1">
                    {statusDetail.aircraftType || "—"} / {statusDetail.registration || "—"}
                  </div>
                  <div className="text-[11px] font-mono text-[#8C5214] dark:text-[#F7BA42] mt-0.5">
                    CFG-{statusDetail.cfg || "—"}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812]">
                  <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#E89C1D]" />
                    {pick("Capacité Sièges", "Seat Capacity")}
                  </div>
                  <div className="text-base font-extrabold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1">
                    {statusDetail.totalCapacity} {pick("sièges", "seats")}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-[#8C5214] dark:text-[#F7BA42] mt-0.5">
                    C{statusDetail.businessCapacity} / Y{statusDetail.economyCapacity}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812]">
                  <div className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#E89C1D]" />
                    {pick("Embarquement", "Boarding Time")}
                  </div>
                  <div className="text-base font-extrabold font-mono tabular-nums text-[#321B0A] dark:text-[#FAF7F2] mt-1">
                    {statusDetail.boardingTimeFormatted || "—"}
                  </div>
                  <div className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] mt-0.5">
                    ETD {formatFlightTime(statusDetail.etdHeader) || "—"}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#4C2812] dark:bg-[#321B0A] border border-[#321B0A] dark:border-[#E89C1D]/50 text-white">
                  <div className="text-[11px] font-semibold text-[#F7BA42] flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5" />
                    {pick(`Statut (${segment.origin}) & Porte`, `Status (${segment.origin}) & Gate`)}
                  </div>
                  <div className="text-base font-extrabold font-mono text-white mt-1">
                    {resolvedStatus || statusDetail.departureStatus || "—"}
                  </div>
                  <div className="text-[11px] font-mono text-[#F3E9D8] mt-0.5">
                    {pick("Porte", "Gate")}: {statusDetail.gate || "—"}
                  </div>
                </div>
              </div>

              {/* Operational Parameters Row */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] space-y-2">
                <div className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#E89C1D]" />
                  {pick("Paramètres DCS d'Exploitation", "DCS Operational Rules")}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs">
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B]">
                    <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">AUTO-ON</div>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{statusDetail.autoOn || "—"}</div>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B]">
                    <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">CK-IN RULE</div>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{statusDetail.ckInRule || "—"}</div>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B]">
                    <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">BAG</div>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{statusDetail.bagPw || "—"}</div>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B]">
                    <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">HELDST</div>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{statusDetail.heldst || "—"}</div>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B]">
                    <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">SOM</div>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{statusDetail.som || "—"}</div>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B]">
                    <div className="text-[10px] text-[#6E472B] dark:text-[#DECAB1]">APP</div>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{statusDetail.app || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Itinerary Legs Table */}
              {statusDetail.legs.length > 0 && (
                <div className="rounded-2xl border border-[#E6D7C3] dark:border-[#4C2812] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#FAF7F2] dark:bg-[#28170C] border-b border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#E89C1D]" />
                      {pick("Itinéraire & Statuts par Escale", "Itinerary & Station Statuses")}
                    </span>
                    <span className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                      {statusDetail.legs.length} {pick("escales", "stations")}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="bg-[#4C2812] dark:bg-[#2E180A] text-[#F7BA42] text-[11px]">
                          <th className="py-2 px-3">{pick("Escale", "Station")}</th>
                          <th className="py-2 px-3">{pick("Statut", "Status")}</th>
                          <th className="py-2 px-3">ETA</th>
                          <th className="py-2 px-3">ETD</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3 text-right">D / T / A</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]/70">
                        {statusDetail.legs.map((leg, i) => {
                          const isDepartureRow = leg.station === segment.origin;
                          return (
                            <tr
                              key={`${leg.station}-${i}`}
                              className={
                                isDepartureRow
                                  ? "bg-amber-50/90 dark:bg-[#321B0A] font-bold text-[#321B0A] dark:text-[#FAF7F2]"
                                  : "bg-white dark:bg-[#1F1209] text-[#4C2812] dark:text-[#DECAB1]"
                              }
                            >
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center gap-1.5">
                                  <span>{leg.station}</span>
                                  {isDepartureRow && (
                                    <span className="text-[10px] font-sans font-bold text-[#8C5214] dark:text-[#F7BA42]">
                                      ({pick("Départ", "Dep.")})
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td
                                className={`py-2 px-3 font-bold ${
                                  !leg.status
                                    ? "text-[#6E472B]/60 dark:text-[#DECAB1]/60"
                                    : leg.status.trim().toUpperCase() === "PDC"
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {leg.status || (isDepartureRow ? "NON-PDC" : "—")}
                              </td>
                              <td className="py-2 px-3">{formatFlightTime(leg.eta) || "—"}</td>
                              <td className="py-2 px-3">{formatFlightTime(leg.etd) || "—"}</td>
                              <td className="py-2 px-3">{leg.date || "—"}</td>
                              <td className="py-2 px-3 text-right">
                                {[
                                  leg.dFlag ? `D-${leg.dFlag}` : null,
                                  leg.tFlag ? `T-${leg.tFlag}` : null,
                                  leg.aFlag ? `A-${leg.aFlag}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw DCS Block */}
              <div className="rounded-2xl border border-[#E6D7C3] dark:border-[#4C2812] overflow-hidden">
                <div className="px-4 py-2 bg-[#231206] text-[#F7BA42] text-[11px] font-mono font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    {statusDetail.queryCommand}
                  </span>
                  {statusDetail.footerTimestamp && (
                    <span className="text-[#DECAB1] font-normal">
                      {statusDetail.footerTimestamp}
                    </span>
                  )}
                </div>
                <pre className="p-4 bg-[#190D04] text-[#FAF7F2] font-mono text-[11px] leading-relaxed overflow-x-auto select-all">
                  {statusDetail.rawBlock}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
