import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Plane,
  RotateCcw,
  Trash2,
  Check,
  AlertTriangle,
  Users,
} from "lucide-react";
import { FlightStatusDetail } from "../../types";
import {
  FleetEquipmentProfile,
  buildManualFlightStatusDetail,
  extractKnownFleetProfiles,
  normalizeStatusDate,
  normalizeStatusFlightNumber,
  restoreOriginalFlightEquipment,
} from "../../utils/flightStatusParser";
import { useLanguage } from "../../context/LanguageContext";

export interface FlightEquipmentContext {
  airline?: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination?: string;
  defaultAircraftType?: string;
  etdHeader?: string;
  gate?: string;
  boardedPaxCount?: number;
}

interface FlightEquipmentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  flightContext: FlightEquipmentContext | null;
  existingDetail: FlightStatusDetail | null;
  allStatusDetails: FlightStatusDetail[];
  onSave: (updatedDetail: FlightStatusDetail) => void;
  onRemoveManual?: (id: string) => void;
}

const COMMON_AIRCRAFT_TYPES = ["737", "738", "7M8", "73G", "73W", "E90", "DH8"];

const COMMON_CAPACITY_PRESETS = [
  { label: "16C / 144Y (160)", biz: 16, eco: 144, cfg: "4" },
  { label: "16C / 152Y (168)", biz: 16, eco: 152, cfg: "7" },
  { label: "12C / 142Y (154)", biz: 12, eco: 142, cfg: "12" },
  { label: "0C / 183Y (183)", biz: 0, eco: 183, cfg: "" },
];

export const FlightEquipmentEditModal: React.FC<FlightEquipmentEditModalProps> = ({
  isOpen,
  onClose,
  flightContext,
  existingDetail,
  allStatusDetails,
  onSave,
  onRemoveManual,
}) => {
  const { pick } = useLanguage();

  const [aircraftType, setAircraftType] = useState("");
  const [registration, setRegistration] = useState("");
  const [cfg, setCfg] = useState("");
  const [businessCapInput, setBusinessCapInput] = useState("0");
  const [economyCapInput, setEconomyCapInput] = useState("0");
  const [validationError, setValidationError] = useState<string | null>(null);

  const knownFleetProfiles = useMemo(
    () => extractKnownFleetProfiles(allStatusDetails),
    [allStatusDetails]
  );

  useEffect(() => {
    if (!isOpen || !flightContext) return;
    setValidationError(null);
    if (existingDetail) {
      setAircraftType(existingDetail.aircraftType || flightContext.defaultAircraftType || "");
      setRegistration(existingDetail.registration || "");
      setCfg(existingDetail.cfg || "");
      setBusinessCapInput(String(existingDetail.businessCapacity ?? 0));
      setEconomyCapInput(String(existingDetail.economyCapacity ?? 0));
    } else {
      setAircraftType((flightContext.defaultAircraftType || "737").toUpperCase());
      setRegistration("");
      setCfg("");
      setBusinessCapInput("16");
      setEconomyCapInput("144");
    }
  }, [isOpen, flightContext, existingDetail]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !flightContext) return null;

  const parsedBiz = Math.max(0, parseInt(businessCapInput, 10) || 0);
  const parsedEco = Math.max(0, parseInt(economyCapInput, 10) || 0);
  const totalCapacity = parsedBiz + parsedEco;

  const handleApplyFleetProfile = (profile: FleetEquipmentProfile) => {
    setRegistration(profile.registration);
    setAircraftType(profile.aircraftType || aircraftType);
    setBusinessCapInput(String(profile.businessCapacity));
    setEconomyCapInput(String(profile.economyCapacity));
    if (profile.cfg) setCfg(profile.cfg);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanType = aircraftType.trim().toUpperCase();
    const cleanReg = registration.trim().toUpperCase();
    const cleanCfg = cfg.trim().toUpperCase();

    if (!cleanType) {
      setValidationError(
        pick(
          "Veuillez renseigner le type d'appareil (ex. 737, 738, 7M8).",
          "Please enter the aircraft type (e.g. 737, 738, 7M8)."
        )
      );
      return;
    }

    if (totalCapacity <= 0) {
      setValidationError(
        pick(
          "La capacité totale (Business + Éco) doit être supérieure à 0.",
          "Total capacity (Business + Economy) must be greater than 0."
        )
      );
      return;
    }

    const updated = buildManualFlightStatusDetail({
      airline: flightContext.airline || "KP",
      flightNumber: flightContext.flightNumber,
      date: flightContext.date,
      origin: flightContext.origin,
      aircraftType: cleanType,
      registration: cleanReg,
      businessCapacity: parsedBiz,
      economyCapacity: parsedEco,
      cfg: cleanCfg,
      etdHeader: flightContext.etdHeader,
      gate: flightContext.gate,
      existingDetail,
    });

    onSave(updated);
    onClose();
  };

  const handleRestoreOriginal = () => {
    if (!existingDetail) return;
    const restored = restoreOriginalFlightEquipment(existingDetail);
    if (restored) {
      onSave(restored);
      onClose();
    }
  };

  const handleRemoveManual = () => {
    if (!existingDetail || !onRemoveManual) return;
    onRemoveManual(existingDetail.id);
    onClose();
  };

  const normFn = normalizeStatusFlightNumber(flightContext.flightNumber);
  const normDate = normalizeStatusDate(flightContext.date);
  const hasOverCapacityWarning =
    typeof flightContext.boardedPaxCount === "number" &&
    totalCapacity > 0 &&
    flightContext.boardedPaxCount > totalCapacity;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#321B0A]/65 dark:bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1F1209] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#E6D7C3] dark:border-[#4C2812] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] p-2.5 rounded-xl shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-[#321B0A] dark:text-[#FAF7F2]">
                {pick("Modifier l'équipement du vol", "Edit Flight Equipment")}
              </h3>
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-mono tabular-nums truncate mt-0.5">
                {flightContext.airline || "KP"}
                {normFn} · {flightContext.origin}
                {flightContext.destination ? ` → ${flightContext.destination}` : ""} · {normDate}
                {existingDetail?.isManualOverride
                  ? ` · ${pick("Équipement modifié", "Manual override")}`
                  : existingDetail
                  ? ` · PTRG*`
                  : ` · ${pick("Sans PTRG*", "No PTRG*")}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition-colors cursor-pointer shrink-0"
            aria-label={pick("Fermer", "Close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Quick-Select Known Fleet Aircraft */}
          {knownFleetProfiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                  {pick(
                    "Sélection rapide depuis la flotte connue",
                    "Quick-select from known fleet"
                  )}
                </label>
                <span className="text-[11px] text-[#6E472B] dark:text-[#DECAB1] font-mono">
                  {knownFleetProfiles.length} {pick("appareil(s)", "aircraft")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {knownFleetProfiles.map((prof) => {
                  const isActive =
                    registration.trim().toUpperCase() === prof.registration &&
                    aircraftType.trim().toUpperCase() === prof.aircraftType;
                  return (
                    <button
                      key={`${prof.registration}-${prof.aircraftType}`}
                      type="button"
                      onClick={() => handleApplyFleetProfile(prof)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                          : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#321B0A] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:border-[#E89C1D]"
                      }`}
                    >
                      {prof.registration || "—"} · {prof.aircraftType} ({prof.businessCapacity}C/
                      {prof.economyCapacity}Y)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aircraft Type + Registration + CFG */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="equip-aircraft-type"
                className="block text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]"
              >
                {pick("Type d'appareil", "Aircraft Type")} *
              </label>
              <input
                id="equip-aircraft-type"
                type="text"
                maxLength={8}
                value={aircraftType}
                onChange={(e) => {
                  setAircraftType(e.target.value.toUpperCase());
                  setValidationError(null);
                }}
                placeholder="737, 738, 7M8..."
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] text-sm font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {COMMON_AIRCRAFT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setAircraftType(t);
                      setValidationError(null);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition cursor-pointer ${
                      aircraftType.trim().toUpperCase() === t
                        ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                        : "bg-white dark:bg-[#1F1209] text-[#6E472B] dark:text-[#DECAB1] border-[#E6D7C3] dark:border-[#4C2812] hover:border-[#E89C1D]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="equip-registration"
                className="block text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]"
              >
                {pick("Immatriculation", "Registration")}
              </label>
              <input
                id="equip-registration"
                type="text"
                maxLength={12}
                value={registration}
                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                placeholder="ETBAR"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] text-sm font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
              />
              <p className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                {pick("Ex. ETBAR, ETBAQ, ETAVI", "e.g. ETBAR, ETBAQ, ETAVI")}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="equip-cfg"
                className="block text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]"
              >
                {pick("Code CFG (optionnel)", "CFG Code (optional)")}
              </label>
              <input
                id="equip-cfg"
                type="text"
                maxLength={8}
                value={cfg}
                onChange={(e) => setCfg(e.target.value.toUpperCase())}
                placeholder="4, 7, 12..."
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#5C351B] text-sm font-mono font-bold text-[#321B0A] dark:text-[#FAF7F2] uppercase focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
              />
              <p className="text-[11px] text-[#6E472B] dark:text-[#DECAB1]">
                {pick("Code version cabine DCS", "DCS cabin config code")}
              </p>
            </div>
          </div>

          {/* Seat Capacity (Business C + Economy Y + Total) */}
          <div className="p-4 rounded-xl bg-[#FAF7F2] dark:bg-[#28170C] border border-[#E6D7C3] dark:border-[#4C2812] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                <Users className="w-4 h-4 text-[#E89C1D]" />
                <span>{pick("Capacité en Sièges", "Seat Capacity")}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {COMMON_CAPACITY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setBusinessCapInput(String(preset.biz));
                      setEconomyCapInput(String(preset.eco));
                      if (preset.cfg) setCfg(preset.cfg);
                      setValidationError(null);
                    }}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] text-[#6E472B] dark:text-[#DECAB1] hover:border-[#E89C1D] hover:text-[#321B0A] dark:hover:text-[#F7BA42] cursor-pointer transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <label
                  htmlFor="equip-cap-biz"
                  className="block text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]"
                >
                  {pick("Sièges Business (C)", "Business Seats (C)")}
                </label>
                <input
                  id="equip-cap-biz"
                  type="number"
                  min={0}
                  max={200}
                  value={businessCapInput}
                  onChange={(e) => {
                    setBusinessCapInput(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] text-sm font-mono tabular-nums font-bold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="equip-cap-eco"
                  className="block text-[11px] font-semibold text-[#6E472B] dark:text-[#DECAB1]"
                >
                  {pick("Sièges Économique (Y)", "Economy Seats (Y)")}
                </label>
                <input
                  id="equip-cap-eco"
                  type="number"
                  min={0}
                  max={500}
                  value={economyCapInput}
                  onChange={(e) => {
                    setEconomyCapInput(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] text-sm font-mono tabular-nums font-bold text-[#321B0A] dark:text-[#FAF7F2] focus:outline-none focus:ring-2 focus:ring-[#E89C1D]"
                />
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-[#4C2812] dark:bg-[#321B0A] border border-[#321B0A] dark:border-[#E89C1D]/50 text-white flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#F3E9D8]">
                  {pick("Total Sièges", "Total Seats")}
                </span>
                <span className="text-base font-extrabold font-mono tabular-nums text-[#F7BA42]">
                  {totalCapacity}
                </span>
              </div>
            </div>
          </div>

          {hasOverCapacityWarning && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                {pick(
                  `Attention : ce vol compte ${flightContext.boardedPaxCount} passagers transportés, soit plus que la capacité saisie (${totalCapacity} sièges).`,
                  `Warning: this flight has ${flightContext.boardedPaxCount} traveled passengers, which exceeds the entered capacity (${totalCapacity} seats).`
                )}
              </span>
            </div>
          )}

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-semibold">
              {validationError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E6D7C3] dark:border-[#4C2812] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {existingDetail?.isManualOverride && existingDetail.originalEquipmentSnapshot && (
                <button
                  type="button"
                  onClick={handleRestoreOriginal}
                  className="px-3 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-[#FAF7F2] dark:bg-[#28170C] hover:bg-[#F3E9D8] dark:hover:bg-[#351F11] text-[#6E472B] dark:text-[#DECAB1] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{pick("Restaurer PTRG*", "Restore PTRG*")}</span>
                </button>
              )}
              {existingDetail?.isManualOnly && onRemoveManual && (
                <button
                  type="button"
                  onClick={handleRemoveManual}
                  className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{pick("Supprimer", "Delete")}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#28170C] hover:bg-[#FAF7F2] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold cursor-pointer transition whitespace-nowrap"
              >
                {pick("Annuler", "Cancel")}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] hover:bg-[#321B0A] dark:hover:bg-[#F7BA42] text-[#F7BA42] dark:text-[#1F1209] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition shadow-sm whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{pick("Enregistrer l'équipement", "Save Equipment")}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
