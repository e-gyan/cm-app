import React from "react";
import { Shield } from "lucide-react";

interface AppLogoSlotProps {
  size?: number;
  className?: string;
  logoUrl?: string;
  alt?: string;
}

/**
 * AppLogoSlot Component
 * Replaces generic sparkles across the app with an extensible brand mark.
 * Supports custom uploaded logo URLs (via church organization settings or local storage),
 * and defaults to an elegant Children's Ministry insignia.
 */
export const AppLogoSlot: React.FC<AppLogoSlotProps> = ({
  size = 24,
  className = "",
  logoUrl,
  alt = "Ministry Logo",
}) => {
  // Check prop or cached uploaded brand logo
  const activeLogo = logoUrl || (typeof window !== "undefined" ? localStorage.getItem("cm_app_custom_logo") : null);

  if (activeLogo) {
    return (
      <img
        src={activeLogo}
        alt={alt}
        className={`object-contain rounded-lg ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Refined modern CM emblem insignia
  return (
    <div
      className={`inline-flex items-center justify-center relative ${className}`}
      style={{ width: size, height: size }}
      aria-label={alt}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id="cmLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path
          d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z"
          fill="url(#cmLogoGrad)"
        />
        <path
          d="M12 7V17M8 11H16"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default AppLogoSlot;
