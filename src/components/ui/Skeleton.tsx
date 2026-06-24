import React from "react";
import { motion } from "motion/react";

interface SkeletonProps {
  className?: string;
  variant?: "pulse" | "shimmer";
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", variant = "pulse" }) => {
  return (
    <motion.div
      initial={variant === "pulse" ? { opacity: 0.5 } : { backgroundPosition: "-200px 0" }}
      animate={
        variant === "pulse"
          ? { opacity: [0.3, 0.6, 0.3] }
          : { backgroundPosition: ["-200px 0", "600px 0"] }
      }
      transition={{
        duration: variant === "pulse" ? 1.5 : 2,
        repeat: Infinity,
        ease: "linear",
      }}
      className={`bg-slate-200 rounded-lg ${className} ${
        variant === "shimmer" ? "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:800px_100%]" : ""
      }`}
    />
  );
};
