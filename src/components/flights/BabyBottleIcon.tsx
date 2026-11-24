/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useLanguage } from "../../context/LanguageContext";

interface BabyBottleIconProps {
  className?: string;
  title?: string;
}

/**
 * Custom illustrated baby bottle ("biberon") SVG icon for INF passengers.
 */
export const BabyBottleIcon: React.FC<BabyBottleIconProps> = ({
  className = "w-4 h-4",
  title,
}) => {
  const { pick } = useLanguage();
  const resolvedTitle = title ?? pick("Passager avec bébé (INF)", "Passenger traveling with an infant (INF)");

  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      title={resolvedTitle}
      aria-label={resolvedTitle}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Tétine (nipple) */}
        <path
          d="M10.3 2.5C10.3 1.95 10.75 1.5 11.3 1.5H12.7C13.25 1.5 13.7 1.95 13.7 2.5V4.3C14.3 4.65 14.7 5.2 14.8 5.9H9.2C9.3 5.2 9.7 4.65 10.3 4.3V2.5Z"
          fill="#F7BA42"
          className="stroke-[#4C2812] dark:stroke-[#D99B26]"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Bague du biberon (collar) */}
        <rect
          x="7.5"
          y="5.9"
          width="9"
          height="2.6"
          rx="1.1"
          className="fill-[#4C2812] dark:fill-[#8C5214] stroke-[#321B0A] dark:stroke-[#F7BA42]"
          strokeWidth="1.2"
        />
        {/* Corps du biberon (bottle body) */}
        <path
          d="M8.2 8.5H15.8L16.5 10.6C16.7 11.2 16.8 11.8 16.8 12.5V19.6C16.8 21.15 15.55 22.4 14 22.4H10C8.45 22.4 7.2 21.15 7.2 19.6V12.5C7.2 11.8 7.3 11.2 7.5 10.6L8.2 8.5Z"
          fill="#FDF4E3"
          className="stroke-[#4C2812] dark:stroke-[#E89C1D]"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Lait à l'intérieur (milk fill) */}
        <path
          d="M7.9 14.5H16.1V19.4C16.1 20.6 15.15 21.6 13.95 21.6H10.05C8.85 21.6 7.9 20.6 7.9 19.4V14.5Z"
          fill="#FFFBEB"
        />
        {/* Graduations */}
        <path
          d="M9.2 11.5H11.5M9.2 14.3H12.2M9.2 17.1H11.5"
          stroke="#8C5214"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
};
