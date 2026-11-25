/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Luggage,
  Receipt,
  Award,
  Plane,
  Ticket,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  MessageSquareText,
  FileText,
} from "lucide-react";
import {
  EmdDocumentDetail,
  ManifestFlight,
  ManifestPassenger,
} from "../../types";
import {
  extractInfantFromRawLines,
  formatDcsBirthDate,
  getEditCodeLabel,
  isPassengerWebCheckin,
  translateBaggageDeviation,
  translateMissingBaggageDetail,
} from "../../utils/manifestParser";
import {
  classifyEmdBaggagePieces,
  computeEmdTotalInCurrency,
  convertEmdDetailToCurrency,
  formatCurrencyAmount,
  formatEmdMonetaryValue,
  formatEmdRoute,
  formatFopMethodLabel,
  formatIssuingPointLabel,
  getEmdIssuanceInfo,
  loadDisplayCurrency,
  loadXofRates,
  normalizeEmdNumber,
} from "../../utils/emdAudit";
import { exportPassengerEmdAuditToPDF } from "../../utils/emdPdfExport";
import { useLanguage } from "../../context/LanguageContext";
import { BabyBottleIcon } from "./BabyBottleIcon";
import { WebCheckinBadge } from "../ui/WebCheckinBadge";

interface PassengerDossierDrawerProps {
  passenger: ManifestPassenger | null;
  flight: ManifestFlight | null;
  emdDetailsMap?: Record<string, EmdDocumentDetail>;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const PassengerDossierDrawer: React.FC<PassengerDossierDrawerProps> = ({
  passenger,
  flight,
  emdDetailsMap = {},
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  const [showRaw, setShowRaw] = useState(false);
  const [xofRates, setXofRates] = useState<Record<string, number>>(() => loadXofRates());
  const [displayCurrency, setDisplayCurrency] = useState<string>(() =>
    loadDisplayCurrency()
  );
  const { language, pick } = useLanguage();

  useEffect(() => {
    const syncRates = () => setXofRates(loadXofRates());
    const syncCur = () => setDisplayCurrency(loadDisplayCurrency());
    window.addEventListener("kp-xof-rates-updated", syncRates);
    window.addEventListener("kp-display-currency-updated", syncCur);
    return () => {
      window.removeEventListener("kp-xof-rates-updated", syncRates);
      window.removeEventListener("kp-display-currency-updated", syncCur);
    };
  }, []);

  if (!passenger || !flight) return null;

  const uniqueEmdNumbers = Array.from(
    new Set(
      [
        ...(passenger.emdNumbers || []),
        ...(passenger.ancillaries || [])
          .map((a) => a.emdNumber)
          .filter((v): v is string => Boolean(v)),
      ]
        .map((n) => normalizeEmdNumber(n))
        .filter(Boolean)
    )
  );
  const auditedEmdDetails = uniqueEmdNumbers
    .map((num) => emdDetailsMap[num])
    .filter((d): d is EmdDocumentDetail => Boolean(d));
  const unauditedAncillaries = passenger.ancillaries.filter(
    (anc) => !anc.emdNumber || !emdDetailsMap[normalizeEmdNumber(anc.emdNumber)]
  );
  const unauditedEmdNumbers = uniqueEmdNumbers.filter(
    (num) =>
      !emdDetailsMap[num] &&
      !passenger.ancillaries.some(
        (a) => a.emdNumber && normalizeEmdNumber(a.emdNumber) === num
      )
  );

  const resolvedInfant =
    passenger.infant ||
    extractInfantFromRawLines(passenger.rawLines, {
      date: flight.date,
      bookingClass: passenger.bookingClass,
      route: `${flight.origin}${passenger.destination}`,
    });
  const hasInfant = passenger.hasInfant || Boolean(resolvedInfant);

  const actualBags = Math.max(
    passenger.bags.length,
    passenger.bagsDeclaredCount || 0,
    passenger.bagsTotalDeclaredLine?.count || 0
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#321B0A]/50 dark:bg-black/70 backdrop-blur-xs flex justify-end">
      <div className="bg-white dark:bg-[#1F1209] w-full max-w-xl h-full border-l border-[#E6D7C3] dark:border-[#4C2812] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-[#6E472B] dark:text-[#DECAB1]">
              <span className="font-bold text-[#4C2812] dark:text-[#F7BA42]">
                {flight.airline} {flight.flightNumber} · {flight.origin} → {passenger.destination}
              </span>
              <span>·</span>
              <span>
                {pick("Cabine", "Cabin")} {passenger.cabinClass} · {pick("Ordre", "Seq")} #{String(passenger.classSeq || passenger.seq).padStart(3, "0")}
                {passenger.isTransitMarker ? " (Transit #)" : ""}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#321B0A] dark:text-[#FAF7F2] truncate mt-0.5 flex items-center gap-2">
              {hasInfant && (
                <BabyBottleIcon
                  className="w-5 h-5"
                  title={pick("Passager accompagné d'un bébé (INF)", "Passenger traveling with an infant (INF)")}
                />
              )}
              <span className="truncate">
                {passenger.lastName} {passenger.firstName}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-2 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 text-[#4C2812] dark:text-[#F7BA42] cursor-pointer disabled:cursor-default"
              title={pick("Passager précédent", "Previous passenger")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="p-2 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] disabled:opacity-40 text-[#4C2812] dark:text-[#F7BA42] cursor-pointer disabled:cursor-default"
              title={pick("Passager suivant", "Next passenger")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] ml-1 cursor-pointer"
              aria-label={pick("Fermer", "Close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Identity & Cabin Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl p-3.5 font-mono tabular-nums">
            <div>
              <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                {pick("Cabine / Résa", "Cabin / Class")}
              </div>
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5">
                {passenger.cabinClass === "C" ? "Business (C)" : pick("Éco (Y)", "Eco (Y)")} · {passenger.bookingClass}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                {pick("Siège / Tarif", "Seat / Fare")}
              </div>
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5 flex flex-wrap items-center gap-1.5">
                {isPassengerWebCheckin(passenger) && <WebCheckinBadge />}
                <span>
                  {passenger.seat || pick("Sans siège", "No seat")}{" "}
                  {passenger.fareCode ? `(${passenger.fareCode})` : ""}
                </span>
                {(!passenger.seat || !passenger.seat.trim()) && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold text-[10px] uppercase">
                    No-Show
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                {pick("Sexe / Type", "Gender / Type")}
              </div>
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5">
                {passenger.isChild ? pick("Enfant (CHD)", "Child (CHD)") : passenger.gender || pick("N/D", "N/A")}
                {hasInfant ? " + INF" : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                {pick("Groupe / Statut", "Party / Status")}
              </div>
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5">
                {passenger.partyCode || "—"}
                {passenger.isCodeshare ? " · CS" : ""}
                {isPassengerWebCheckin(passenger) ? " · WB" : ""}
              </div>
            </div>
          </div>

          {/* Section Bébé Accompagné (INF / IFET) */}
          {hasInfant && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                  <BabyBottleIcon className="w-4 h-4" title={pick("Bébé (INF / IFET)", "Infant (INF / IFET)")} />
                  {pick("Bébé Accompagné (INF / IFET)", "Accompanying Infant (INF / IFET)")}
                </div>
                {resolvedInfant?.ticket && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209]">
                    IFET
                  </span>
                )}
              </div>

              {resolvedInfant ? (
                <div className="bg-[#FDF4E3] dark:bg-[#2E1A0D] border border-[#E89C1D]/60 dark:border-[#E89C1D]/50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                    <div>
                      <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                        {pick("Nom du bébé", "Infant Last Name")}
                      </div>
                      <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5">
                        {resolvedInfant.lastName || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                        {pick("Prénom du bébé", "Infant First Name")}
                      </div>
                      <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5">
                        {resolvedInfant.firstName || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                        {pick("Date de naissance", "Date of Birth")}
                      </div>
                      <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] mt-0.5">
                        {resolvedInfant.birthDate
                          ? formatDcsBirthDate(resolvedInfant.birthDate, language)
                          : pick("Non renseignée", "Not provided")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8C5214] dark:text-[#F7BA42] font-sans uppercase font-semibold">
                        {pick("N° Billet Bébé (IFET)", "Infant Ticket No. (IFET)")}
                      </div>
                      <div className="font-bold text-[#4C2812] dark:text-[#F7BA42] mt-0.5 break-all">
                        {resolvedInfant.ticket?.ticketNumber || pick("Non renseigné", "Not provided")}
                      </div>
                    </div>
                  </div>

                  {resolvedInfant.ticket && (
                    <div className="pt-2.5 border-t border-[#E6D7C3] dark:border-[#4C2812] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                      <div>
                        {resolvedInfant.ticket.couponNumber
                          ? `${pick("Coupon", "Coupon")} ${resolvedInfant.ticket.couponNumber}`
                          : pick("Coupon IFET", "IFET Coupon")}{" "}
                        · {resolvedInfant.ticket.date} · {pick("Classe", "Class")}{" "}
                        {resolvedInfant.ticket.bookingClass} · {pick("Parcours", "Route")}{" "}
                        {resolvedInfant.ticket.route}
                      </div>
                      <span
                        className={`font-bold px-2 py-0.5 rounded ${
                          resolvedInfant.ticket.status === "USED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                            : "bg-white dark:bg-[#1F1209] text-[#4C2812] dark:text-[#F7BA42] border border-[#E6D7C3] dark:border-[#5C351B]"
                        }`}
                      >
                        {resolvedInfant.ticket.status}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#FDF4E3] dark:bg-[#2E1A0D] border border-[#E89C1D]/50 rounded-xl p-3 text-[#6E472B] dark:text-[#DECAB1]">
                  {pick(
                    "Code INF présent (détails IFET non inclus dans l'extrait DCS).",
                    "INF code present (IFET details not included in DCS extract)."
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Bagages & Franchise */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                <Luggage className="w-3.5 h-3.5 text-[#4C2812] dark:text-[#F7BA42]" />
                {pick("Bagages Enregistrés", "Checked Baggage")} ({actualBags} pcs ·{" "}
                {passenger.hasMissingBaggageWeight && passenger.totalBagWeight === 0
                  ? pick("Poids manquant", "Weight missing")
                  : `${passenger.totalBagWeight} kg`}
                )
              </div>
              <span className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1]">
                {pick("Franchise", "Allowance")} : {passenger.allowedBagsCount} pcs max · {passenger.allowedTotalWeight} kg {pick("cumulés", "total")}
                {isPassengerWebCheckin(passenger) ? " (+5 kg WB)" : ""}
              </span>
            </div>

            {passenger.hasMissingBaggageWeight && (
              <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-700/70 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-xs">
                    {pick(
                      "Poids bagage(s) non spécifié(s) dans le manifeste",
                      "Baggage weight(s) not specified in manifest"
                    )}
                  </div>
                  {(passenger.missingBaggageWeightDetails || []).map((detail, idx) => (
                    <div key={idx} className="text-[11px]">
                      · {translateMissingBaggageDetail(detail, language)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                passenger.baggageCompliance === "CONFORME"
                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200"
                  : passenger.baggageCompliance === "COUVERT_EMD"
                  ? "bg-[#FDF4E3] dark:bg-[#2E1A0D] border-[#E89C1D]/60 text-[#321B0A] dark:text-[#FAF7F2]"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200"
              }`}
            >
              {passenger.baggageCompliance === "CONFORME" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : passenger.baggageCompliance === "COUVERT_EMD" ? (
                <CreditCard className="w-4 h-4 text-[#8C5214] dark:text-[#F7BA42] shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold">
                  {passenger.baggageCompliance === "CONFORME"
                    ? pick("Conforme à la franchise KP", "Compliant with KP allowance")
                    : passenger.baggageCompliance === "COUVERT_EMD"
                    ? pick("Couvert par EMD / AE", "Covered by EMD / AE")
                    : pick("Écart franchise sans EMD", "Allowance excess without EMD")}
                </div>
                {passenger.baggageDeviations.map((dev, i) => (
                  <div key={i} className="text-[11px]">
                    · {translateBaggageDeviation(dev, language)}
                  </div>
                ))}
              </div>
            </div>

            {passenger.bags.length > 0 ? (
              <div className="border border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#28170C] rounded-xl divide-y divide-[#E6D7C3]/60 dark:divide-[#4C2812]/70">
                {passenger.bags.map((bag, i) => {
                  const isBagMissingWeight = bag.hasMissingWeight || bag.weight <= 0;
                  return (
                    <div
                      key={`${bag.tag}-${i}`}
                      className="px-3.5 py-2 flex items-center justify-between font-mono tabular-nums"
                    >
                      <div>
                        <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{bag.tag}</span>
                        {bag.marker && (
                          <span className="ml-1.5 text-[10px] font-bold text-[#8C5214] dark:text-[#F7BA42]">
                            [{bag.marker}]
                          </span>
                        )}
                        <span className="ml-2 text-[#6E472B] dark:text-[#DECAB1]">
                          → {bag.carrier} {bag.destination}
                        </span>
                      </div>
                      {isBagMissingWeight ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/70 text-[11px] font-sans font-bold">
                          {pick("Poids non spécifié", "Weight missing")}
                        </span>
                      ) : (
                        <span className="font-bold text-[#4C2812] dark:text-[#F7BA42]">
                          {bag.weight} kg
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : actualBags > 0 ? (
              <div className="text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3.5 py-2 text-xs font-medium">
                {pick(
                  `${actualBags} bagage(s) déclaré(s) sans numéro de talon détaillé ni poids spécifié.`,
                  `${actualBags} bag(s) declared without detailed tag number or specified weight.`
                )}
              </div>
            ) : (
              <div className="text-[#6E472B] dark:text-[#DECAB1] italic px-1">
                {pick("Aucun bagage enregistré en soute (NB / 0).", "No checked baggage (NB / 0).")}
              </div>
            )}
          </div>

          {/* Section 2: Ancillaries AE & EMD */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px] flex-wrap">
                <Receipt className="w-3.5 h-3.5 text-[#E89C1D]" />
                <span>
                  {pick("Services (AE) & EMD", "Services (AE) & EMD")} ({uniqueEmdNumbers.length})
                </span>
                {auditedEmdDetails.length > 0 && (
                  <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 normal-case">
                    · {auditedEmdDetails.length}/{uniqueEmdNumbers.length} ·{" "}
                    {formatCurrencyAmount(
                      computeEmdTotalInCurrency(
                        auditedEmdDetails,
                        displayCurrency,
                        xofRates,
                        "totalValue"
                      ).total,
                      displayCurrency,
                      language === "fr" ? "fr-FR" : "en-US"
                    )}
                  </span>
                )}
              </div>

              {uniqueEmdNumbers.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    exportPassengerEmdAuditToPDF({
                      passenger,
                      flight,
                      emdDetailsMap,
                      xofRates,
                      targetCurrency: displayCurrency,
                      language,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                  title={pick(
                    "Exporter l'audit EMD en PDF",
                    "Export EMD audit to PDF"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{pick("PDF Audit EMD", "EMD Audit PDF")}</span>
                </button>
              )}
            </div>

            {passenger.ancillaries.length > 0 || uniqueEmdNumbers.length > 0 ? (
              <div className="space-y-2.5">
                {(unauditedAncillaries.length > 0 || unauditedEmdNumbers.length > 0) && (
                  <div className="border border-[#E6D7C3] dark:border-[#4C2812] rounded-xl divide-y divide-[#E6D7C3]/60 dark:divide-[#4C2812]/70 bg-white dark:bg-[#28170C]">
                    {unauditedAncillaries.map((anc, idx) => (
                      <div key={idx} className="px-3.5 py-2.5 space-y-0.5">
                        <div className="font-mono font-semibold text-[#321B0A] dark:text-[#FAF7F2]">
                          {anc.rawHeader}
                          {anc.emdNumber ? (
                            <span className="ml-2 font-bold text-[#8C5214] dark:text-[#F7BA42]">
                              · EMD {anc.emdNumber}
                              {anc.emdCoupon ? ` (${anc.emdCoupon})` : ""}
                            </span>
                          ) : null}
                        </div>
                        {anc.description && (
                          <div className="text-[#6E472B] dark:text-[#DECAB1]">
                            {anc.description}
                          </div>
                        )}
                      </div>
                    ))}
                    {unauditedEmdNumbers.length > 0 && (
                      <div className="px-3.5 py-2.5 font-mono font-bold text-[#8C5214] dark:text-[#F7BA42]">
                        EMD : {unauditedEmdNumbers.join(" · ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Audited WEMD* Cards (single flat elevation, zero duplicate EMD labels) */}
                {auditedEmdDetails.map((detail) => {
                  const iss = getEmdIssuanceInfo(detail);
                  const ptLabel = formatIssuingPointLabel(iss.issuingPointCode, language);
                  const cls = classifyEmdBaggagePieces(detail);
                  const pieceParts = [
                    cls.pieces32kg > 0 ? `${cls.pieces32kg}×32kg` : "",
                    cls.pieces23kg > 0 ? `${cls.pieces23kg}×23kg` : "",
                    cls.specialBagPieces > 0 ? `${cls.specialBagPieces}×Spéc.` : "",
                    cls.inFlightUpgradeCount > 0 ? `${cls.inFlightUpgradeCount}×Upgrade` : "",
                  ].filter(Boolean);
                  const isOriginStation =
                    iss.issuingStation && iss.issuingStation === flight.origin;
                  const linkedAeDesc = passenger.ancillaries
                    .filter(
                      (a) =>
                        a.emdNumber &&
                        normalizeEmdNumber(a.emdNumber) === detail.emdNumber &&
                        a.description
                    )
                    .map((a) => a.description)
                    .join(" · ");

                  return (
                    <div
                      key={detail.emdNumber}
                      className="border border-[#E89C1D]/60 dark:border-[#E89C1D]/50 rounded-xl bg-white dark:bg-[#28170C] divide-y divide-[#E6D7C3]/70 dark:divide-[#4C2812]"
                    >
                      {/* Header + Station/Agent/STA */}
                      <div className="px-3.5 py-2.5 flex flex-wrap items-start justify-between gap-2 bg-[#FDF4E3]/60 dark:bg-[#2E1A0D]">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-mono font-bold text-[#4C2812] dark:text-[#F7BA42] flex flex-wrap items-center gap-1.5">
                            <span>EMD {detail.emdNumber}</span>
                            {detail.pnr && (
                              <span className="text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]">
                                · PNR {detail.pnr}
                              </span>
                            )}
                            {detail.dateOfIssue && (
                              <span className="text-[11px] font-normal text-[#6E472B] dark:text-[#DECAB1]">
                                · {detail.dateOfIssue}
                              </span>
                            )}
                          </div>
                          {(iss.issuingStation || iss.issuingAgent || iss.issuingStationNumber) && (
                            <div className="font-mono text-[11px] text-[#321B0A] dark:text-[#FAF7F2]">
                              {iss.issuingStation ? (
                                <span>
                                  {pick("Station", "Station")} <strong>{iss.issuingStation}</strong>
                                  {iss.issuingPointCode
                                    ? ` (${iss.issuingPointCode}${ptLabel ? ` - ${ptLabel}` : ""})`
                                    : ""}
                                </span>
                              ) : null}
                              {iss.issuingAgent ? (
                                <span> · Agent <strong>{iss.issuingAgent}</strong></span>
                              ) : null}
                              {iss.issuingStationNumber ? (
                                <span> · STA-<strong>{iss.issuingStationNumber}</strong></span>
                              ) : null}
                              {iss.issuingStation && (
                                <span
                                  className={`ml-1.5 font-sans font-semibold ${
                                    isOriginStation
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-amber-700 dark:text-amber-400"
                                  }`}
                                >
                                  ·{" "}
                                  {isOriginStation
                                    ? pick(`Station départ (${flight.origin})`, `Dep. station (${flight.origin})`)
                                    : pick(`Émis hors ${flight.origin}`, `Issued outside ${flight.origin}`)}
                                </span>
                              )}
                            </div>
                          )}
                          {(detail.issuedInConnectionWith || linkedAeDesc) && (
                            <div className="font-mono text-[10px] text-[#6E472B] dark:text-[#DECAB1] truncate">
                              {detail.issuedInConnectionWith
                                ? `${pick("Billet", "Ticket")} ${detail.issuedInConnectionWith}`
                                : ""}
                              {detail.issuedInConnectionWith && linkedAeDesc ? " · " : ""}
                              {linkedAeDesc}
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                            {detail.reasonForIssuance || "—"}
                          </div>
                          {pieceParts.length > 0 && (
                            <div className="font-mono text-[10px] font-semibold text-[#8C5214] dark:text-[#F7BA42]">
                              {pieceParts.join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parcours & Reason par parcours (sans prix par parcours) */}
                      {detail.coupons.length > 0 && (
                        <div className="divide-y divide-[#F0E6D6] dark:divide-[#3A2212]">
                          {detail.coupons.map((cpn) => (
                            <div
                              key={cpn.couponNumber}
                              className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-[#8C5214] dark:text-[#F7BA42]">
                                  CPN {cpn.couponNumber}
                                </span>
                                <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                                  {formatEmdRoute(cpn.route)}
                                </span>
                                <span className="text-[#6E472B] dark:text-[#DECAB1]">
                                  · {cpn.airline} · {cpn.rfisc}
                                  {cpn.quantity !== undefined ? ` · Qté ${cpn.quantity}` : ""}
                                </span>
                                {cpn.reasonForIssuanceSubCode && (
                                  <span className="text-[#4C2812] dark:text-[#FAF7F2]">
                                    · {cpn.reasonForIssuanceSubCode}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`font-bold text-[10px] ${
                                  cpn.status === "USED"
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-[#6E472B] dark:text-[#DECAB1]"
                                }`}
                              >
                                {cpn.status || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Values + FOP */}
                      <div className="px-3.5 py-2.5 grid grid-cols-3 gap-3 font-mono tabular-nums">
                        <div>
                          <div className="text-[9px] font-sans uppercase font-bold text-[#8C5214] dark:text-[#F7BA42]">
                            BASE
                          </div>
                          <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                            {formatEmdMonetaryValue(
                              detail.baseValue,
                              language === "fr" ? "fr-FR" : "en-US"
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-sans uppercase font-bold text-[#8C5214] dark:text-[#F7BA42]">
                            EQUIV
                          </div>
                          <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                            {detail.equivValue
                              ? formatEmdMonetaryValue(
                                  detail.equivValue,
                                  language === "fr" ? "fr-FR" : "en-US"
                                )
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-sans uppercase font-bold text-[#8C5214] dark:text-[#F7BA42]">
                            TOTAL
                          </div>
                          <div className="font-bold text-[#4C2812] dark:text-[#F7BA42]">
                            {formatEmdMonetaryValue(
                              detail.totalValue,
                              language === "fr" ? "fr-FR" : "en-US"
                            )}
                          </div>
                          {detail.totalValue &&
                            detail.totalValue.currency.trim().toUpperCase() !==
                              displayCurrency && (
                              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                ≈{" "}
                                {formatCurrencyAmount(
                                  convertEmdDetailToCurrency(
                                    detail,
                                    displayCurrency,
                                    xofRates,
                                    "totalValue"
                                  ),
                                  displayCurrency,
                                  language === "fr" ? "fr-FR" : "en-US"
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="px-3.5 py-2 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px]">
                        <div>
                          <span className="font-sans text-[9px] uppercase font-bold text-[#8C5214] dark:text-[#F7BA42] mr-1.5">
                            FOP
                          </span>
                          <span className="font-semibold text-[#321B0A] dark:text-[#FAF7F2] break-all">
                            {detail.fopEntries.length > 0
                              ? detail.fopEntries
                                  .map(
                                    (f) =>
                                      `${formatFopMethodLabel(f.methodCode, language)}${
                                        f.methodDetails !== f.methodCode ? ` (${f.methodDetails})` : ""
                                      }${f.amount ? ` · ${f.amount}` : ""}${
                                        f.approvalCode ? ` · APP ${f.approvalCode}` : ""
                                      }`
                                  )
                                  .join(" / ")
                              : detail.fopSummary || "—"}
                          </span>
                        </div>
                      </div>

                      {detail.endorsementsRestrictions && (
                        <div className="px-3.5 py-2 flex items-start gap-1.5 text-[11px] bg-amber-50/50 dark:bg-amber-950/20">
                          <MessageSquareText className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42] shrink-0 mt-0.5" />
                          <div className="font-mono text-[#321B0A] dark:text-[#FAF7F2]">
                            <span className="font-sans text-[9px] uppercase font-bold text-[#8C5214] dark:text-[#F7BA42] mr-1.5">
                              ENDORSEMENTS
                            </span>
                            {detail.endorsementsRestrictions}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[#6E472B] dark:text-[#DECAB1] px-1">
                {pick("Aucun service AE ou EMD rattaché.", "No AE service or EMD attached.")}
              </div>
            )}
          </div>

          {/* Section 3: Billet, Fidélité & Correspondances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                <Ticket className="w-3.5 h-3.5 text-[#4C2812] dark:text-[#F7BA42]" />
                {pick("Titre de Transport", "Travel Document / Ticket")}
              </div>
              <div className="border border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#28170C] rounded-xl p-3 font-mono space-y-1">
                {passenger.ticket ? (
                  <>
                    <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                      {passenger.ticket.isPaperTicket
                        ? `${pick("Billet Papier", "Paper Ticket")} : ${passenger.ticket.ticketNumber}`
                        : passenger.ticket.ticketNumber}
                    </div>
                    <div className="text-[#6E472B] dark:text-[#DECAB1]">
                      Coupon {passenger.ticket.couponNumber} · {passenger.ticket.date} · {pick("Classe", "Class")}{" "}
                      {passenger.ticket.bookingClass}
                    </div>
                    <div className="text-[#6E472B] dark:text-[#DECAB1]">
                      {pick("Parcours", "Route")} {passenger.ticket.route} ·{" "}
                      <span
                        className={`font-bold ${
                          passenger.editCodes.includes("ETO")
                            ? "text-rose-700 dark:text-rose-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {passenger.ticket.status}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-[#8C5214]/70 dark:text-[#DECAB1]/70 font-sans">
                    {pick("Aucun billet électronique", "No electronic ticket")}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                <Award className="w-3.5 h-3.5 text-[#E89C1D]" />
                {pick("Programme Fidélité", "Loyalty Program")}
              </div>
              <div className="border border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#28170C] rounded-xl p-3 font-mono space-y-1">
                {passenger.kpFrequentFlyer && (
                  <div className="text-[#4C2812] dark:text-[#F7BA42] font-semibold">
                    FF ASKY : {passenger.kpFrequentFlyer.number}
                    {passenger.kpFrequentFlyer.tier
                      ? ` (${passenger.kpFrequentFlyer.tier})`
                      : ""}
                  </div>
                )}
                {passenger.partnerFrequentFlyer && (
                  <div className="text-[#8C5214] dark:text-[#E89C1D] font-semibold">
                    FQTV {passenger.partnerFrequentFlyer.carrier} :{" "}
                    {passenger.partnerFrequentFlyer.number}
                  </div>
                )}
                {!passenger.kpFrequentFlyer && !passenger.partnerFrequentFlyer && (
                  <div className="text-[#8C5214]/70 dark:text-[#DECAB1]/70 font-sans">
                    {pick("Aucun numéro FF / FQTV", "No FF / FQTV number")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Correspondances */}
          {(passenger.inboundFlight || passenger.outboundFlight) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                <Plane className="w-3.5 h-3.5 text-[#4C2812] dark:text-[#F7BA42]" />
                {pick("Correspondances Aériennes", "Flight Connections")}
              </div>
              <div className="border border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#28170C] rounded-xl p-3 space-y-1.5 font-mono">
                {passenger.inboundFlight && (
                  <div className="text-[#6E472B] dark:text-[#DECAB1]">
                    <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{pick("Entrant", "Inbound")} :</span>{" "}
                    {passenger.inboundFlight.rawLine}
                  </div>
                )}
                {passenger.outboundFlight && (
                  <div className="text-[#6E472B] dark:text-[#DECAB1]">
                    <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2]">{pick("Sortant", "Outbound")} :</span>{" "}
                    {passenger.outboundFlight.rawLine}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarques OTHS / CM */}
          {(passenger.othsRemarks.length > 0 || passenger.cmRemarks.length > 0) && (
            <div className="space-y-2">
              <div className="font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                {pick("Remarques Comptoir & SSR", "Counter Remarks & SSR")}
              </div>
              <div className="border border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#28170C] rounded-xl p-3 font-mono text-[#6E472B] dark:text-[#DECAB1] space-y-1">
                {passenger.othsRemarks.map((r, i) => (
                  <div key={`o-${i}`}>{r}</div>
                ))}
                {passenger.cmRemarks.map((r, i) => (
                  <div key={`c-${i}`}>CM · {r}</div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Codes décodés */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase tracking-wider text-[11px]">
                {pick("Edit Codes Décodés", "Decoded Edit Codes")} ({passenger.editCodes.length})
              </span>
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-[11px] font-semibold text-[#4C2812] dark:text-[#F7BA42] hover:text-[#E89C1D] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Terminal className="w-3 h-3" />
                {showRaw
                  ? pick("Masquer source DCS", "Hide DCS raw block")
                  : pick("Voir bloc brut DCS", "View DCS raw block")}
              </button>
            </div>

            <div className="border border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#28170C] rounded-xl p-3 space-y-1.5">
              {passenger.editCodes.map((code) => (
                <div key={code} className="flex items-start gap-2.5 text-[11px]">
                  <span className="font-mono font-bold text-[#4C2812] dark:text-[#F7BA42] w-10 shrink-0">
                    {code}
                  </span>
                  <span className="text-[#6E472B] dark:text-[#DECAB1]">
                    {getEditCodeLabel(code, language)}
                  </span>
                </div>
              ))}
            </div>

            {showRaw && (
              <pre className="bg-[#231206] border border-transparent dark:border-[#4C2812] text-[#FAF7F2] font-mono text-[10px] p-3.5 rounded-xl overflow-x-auto leading-relaxed">
                {passenger.rawLines.join("\n")}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
