import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Layers,
  Plane,
} from "lucide-react";
import { ManifestFlight } from "../../types";
import {
  downloadTextFile,
  generateAllEnhancedManifestsText,
  generateEnhancedManifestText,
} from "../../utils/manifestParser";
import { useLanguage } from "../../context/LanguageContext";

interface EnhancedManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  flights: ManifestFlight[];
  selectedFlight: ManifestFlight | null;
  initialScope?: "SINGLE" | "ALL";
}

export const EnhancedManifestModal: React.FC<EnhancedManifestModalProps> = ({
  isOpen,
  onClose,
  flights,
  selectedFlight,
  initialScope = "SINGLE",
}) => {
  const { pick } = useLanguage();
  const [scope, setScope] = useState<"SINGLE" | "ALL">(initialScope);
  const [excludeUnboarded, setExcludeUnboarded] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScope(initialScope);
    }
  }, [isOpen, initialScope]);

  const activeFlight = selectedFlight || flights[0] || null;
  const effectiveScope = activeFlight ? scope : "ALL";

  const previewText = useMemo(() => {
    if (effectiveScope === "ALL" || !activeFlight) {
      return generateAllEnhancedManifestsText(flights, { excludeUnboarded });
    }
    return generateEnhancedManifestText(activeFlight, { excludeUnboarded });
  }, [effectiveScope, activeFlight, flights, excludeUnboarded]);

  if (!isOpen || flights.length === 0) return null;

  const lineCount = previewText.split(/\r?\n/).length;

  const defaultFilename =
    effectiveScope === "ALL" || !activeFlight
      ? `ENHANCED_MANIFEST_${pick("TOUS_VOLS", "ALL_FLIGHTS")}_${flights[0]?.date || "KP"}.txt`
      : `ENHANCED_MANIFEST_${activeFlight.airline}${activeFlight.flightNumber}_${activeFlight.origin}_${activeFlight.date}.txt`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback not required
    }
  };

  const handleDownload = () => {
    downloadTextFile(defaultFilename, previewText);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#321B0A]/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#4C2812] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6D7C3] dark:border-[#4C2812] flex items-center justify-between gap-4 bg-[#FAF7F2] dark:bg-[#28170C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#321B0A] dark:text-[#FAF7F2]">
                {pick("Export Enhanced Passenger Manifest", "Enhanced Passenger Manifest Export")}
              </h3>
              <p className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-medium">
                {pick(
                  "Format DCS structuré par classe (C CLASS / Y CLASS), talons bagages, billets et correspondances",
                  "Structured DCS format by class (C CLASS / Y CLASS), bag tags, tickets, and connections"
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#FAF7F2] hover:bg-[#F3E9D8] dark:hover:bg-[#3A2212] transition cursor-pointer"
            aria-label={pick("Fermer", "Close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3.5 border-b border-[#E6D7C3] dark:border-[#4C2812] bg-white dark:bg-[#1F1209] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {activeFlight && (
              <button
                type="button"
                onClick={() => setScope("SINGLE")}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
                  effectiveScope === "SINGLE"
                    ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                    : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
                }`}
              >
                <Plane className="w-3.5 h-3.5" />
                {pick("Vol", "Flight")} {activeFlight.airline} {activeFlight.flightNumber} ({activeFlight.origin})
              </button>
            )}

            <button
              type="button"
              onClick={() => setScope("ALL")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
                effectiveScope === "ALL"
                  ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] border-[#4C2812] dark:border-[#E89C1D]"
                  : "bg-[#FAF7F2] dark:bg-[#28170C] text-[#4C2812] dark:text-[#FAF7F2] border-[#E6D7C3] dark:border-[#5C351B] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {pick(
                `Tous les vols combinés (${flights.length} vols)`,
                `All combined flights (${flights.length} flights)`
              )}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#4C2812] dark:text-[#FAF7F2] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeUnboarded}
              onChange={(e) => setExcludeUnboarded(e.target.checked)}
              className="rounded border-[#D8C3A5] dark:border-[#5C351B] text-[#4C2812] focus:ring-[#E89C1D]"
            />
            {pick(
              "Exclure les passagers sans siège attribué / non embarqués",
              "Exclude unassigned seat / offloaded passengers"
            )}
          </label>
        </div>

        {/* Monospace Preview */}
        <div className="flex-1 overflow-auto bg-[#231206] p-5 border-y border-transparent dark:border-[#4C2812]">
          <pre className="font-mono text-[11px] leading-relaxed text-[#FAF7F2] whitespace-pre tabular-nums">
            {previewText}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#E6D7C3] dark:border-[#4C2812] bg-[#FAF7F2] dark:bg-[#28170C] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#6E472B] dark:text-[#DECAB1] font-medium font-mono tabular-nums">
            {defaultFilename} · {lineCount} {pick("lignes", "lines")}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg border border-[#E6D7C3] dark:border-[#5C351B] bg-white dark:bg-[#1F1209] hover:bg-[#FDF4E3] dark:hover:bg-[#351F11] text-[#4C2812] dark:text-[#FAF7F2] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {pick("Copié", "Copied")}
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  {pick("Copier le texte", "Copy text")}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-[#4C2812] dark:bg-[#5C3016] hover:bg-[#321B0A] dark:hover:bg-[#6E3B1D] text-[#F7BA42] border border-transparent dark:border-[#E89C1D]/45 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {pick("Télécharger (.txt)", "Download (.txt)")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
