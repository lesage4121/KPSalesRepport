/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useLanguage } from "../../context/LanguageContext";

interface WebCheckinBadgeProps {
  showLabel?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

/**
 * Miniature refined emblem with crisp monogram "W" displayed immediately in front
 * of a passenger's seat to denote Online / Web Check-in (edit code WB).
 */
export const WebCheckinBadge: React.FC<WebCheckinBadgeProps> = ({
  showLabel = false,
  size = "sm",
  className = "",
}) => {
  const { pick } = useLanguage();
  const titleText = pick(
    "Enregistrement en ligne (Edit code WB)",
    "Online Web Check-in (Edit code WB)"
  );
  const iconSize = size === "md" ? 19 : size === "xs" ? 13 : 16;

  return (
    <span
      title={titleText}
      aria-label={titleText}
      className={`inline-flex items-center gap-1 shrink-0 select-none align-middle ${className}`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_1px_1px_rgba(37,99,235,0.28)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wbBadgeGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="52%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
        </defs>
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="21"
          rx="6"
          fill="url(#wbBadgeGrad)"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="1.2"
        />
        <path
          d="M5.7 8.1L8.15 16.2L10.35 16.2L12 10.65L13.65 16.2L15.85 16.2L18.3 8.1L16.15 8.1L14.7 13.6L13.05 8.1L10.95 8.1L9.3 13.6L7.85 8.1Z"
          fill="#FFFFFF"
        />
        <circle cx="19.2" cy="4.8" r="2.2" fill="#10B981" stroke="#FFFFFF" strokeWidth="0.9" />
      </svg>
      {showLabel && (
        <span className="text-[10px] font-mono font-bold tracking-tight text-sky-700 dark:text-sky-300 leading-none">
          WB
        </span>
      )}
    </span>
  );
};
