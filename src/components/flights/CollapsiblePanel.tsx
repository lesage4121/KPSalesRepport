import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  rightContent?: React.ReactNode;
  defaultOpen?: boolean;
  accent?: "asky" | "slate" | "cyan" | "indigo" | "emerald" | "rose" | "amber";
  className?: string;
  children: React.ReactNode;
}

const ACCENT_STYLES: Record<
  NonNullable<CollapsiblePanelProps["accent"]>,
  { border: string; headerBg: string; badgeBg: string }
> = {
  asky: {
    border: "border-[#E6D7C3] dark:border-[#4C2812]",
    headerBg: "bg-[#FAF7F2] hover:bg-[#F5EFE6] dark:bg-[#28170C] dark:hover:bg-[#351F11]",
    badgeBg: "bg-[#4C2812] text-[#F7BA42] dark:bg-[#E89C1D] dark:text-[#1F1209]",
  },
  slate: {
    border: "border-[#E6D7C3] dark:border-[#4C2812]",
    headerBg: "bg-[#FAF7F2] hover:bg-[#F5EFE6] dark:bg-[#28170C] dark:hover:bg-[#351F11]",
    badgeBg: "bg-[#F3E9D8] text-[#4C2812] dark:bg-[#321B0A] dark:text-[#F7BA42]",
  },
  cyan: {
    border: "border-[#E6D7C3] dark:border-[#4C2812]",
    headerBg: "bg-[#FAF7F2] hover:bg-[#F5EFE6] dark:bg-[#28170C] dark:hover:bg-[#351F11]",
    badgeBg: "bg-[#F3E9D8] text-[#4C2812] dark:bg-[#321B0A] dark:text-[#F7BA42]",
  },
  indigo: {
    border: "border-[#E6D7C3] dark:border-[#4C2812]",
    headerBg: "bg-[#FAF7F2] hover:bg-[#F5EFE6] dark:bg-[#28170C] dark:hover:bg-[#351F11]",
    badgeBg: "bg-[#4C2812] text-[#F7BA42] dark:bg-[#E89C1D] dark:text-[#1F1209]",
  },
  emerald: {
    border: "border-emerald-200/80 dark:border-emerald-800/70",
    headerBg: "bg-emerald-50/50 hover:bg-emerald-50/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70",
    badgeBg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-200",
  },
  rose: {
    border: "border-rose-200/80 dark:border-rose-800/70",
    headerBg: "bg-rose-50/50 hover:bg-rose-50/90 dark:bg-rose-950/40 dark:hover:bg-rose-950/70",
    badgeBg: "bg-rose-100 text-rose-900 dark:bg-rose-900/70 dark:text-rose-200",
  },
  amber: {
    border: "border-amber-200/80 dark:border-amber-700/60",
    headerBg: "bg-amber-50/60 hover:bg-amber-50 dark:bg-[#321B0A] dark:hover:bg-[#3D220D]",
    badgeBg: "bg-amber-100 text-[#4C2812] dark:bg-[#E89C1D] dark:text-[#1F1209]",
  },
};

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  subtitle,
  icon,
  badge,
  rightContent,
  defaultOpen = false,
  accent = "asky",
  className = "",
  children,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const { pick } = useLanguage();
  const style = ACCENT_STYLES[accent];

  return (
    <div
      className={`bg-white dark:bg-[#1F1209] rounded-2xl border ${style.border} overflow-hidden shadow-xs ${className}`}
    >
      <div
        className={`w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${style.headerBg}`}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
        >
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#321B0A] dark:text-[#FAF7F2]">{title}</span>
              {badge && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${style.badgeBg}`}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] font-mono text-[#6E472B] dark:text-[#DECAB1] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {rightContent}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1F1209] border border-[#E6D7C3] dark:border-[#5C351B] text-[11px] font-semibold text-[#4C2812] dark:text-[#F7BA42] shrink-0 cursor-pointer"
          >
            {isOpen ? (
              <>
                <span>{pick("Plier", "Collapse")}</span>
                <ChevronUp className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" />
              </>
            ) : (
              <>
                <span>{pick("Déplier", "Expand")}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#F7BA42]" />
              </>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-[#E6D7C3]/80 dark:border-[#4C2812] bg-white dark:bg-[#1F1209]">
          {children}
        </div>
      )}
    </div>
  );
};
