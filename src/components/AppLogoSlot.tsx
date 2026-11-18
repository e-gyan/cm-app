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

  // Default to the new CM Ministry logo
  return (
    <div
      className={`inline-flex items-center justify-center relative ${className}`}
      style={{ width: size, height: size }}
      aria-label={alt}
    >
      <img
        src="/icon-192.svg"
        alt={alt}
        className="w-full h-full object-contain rounded-xl drop-shadow-sm"
      />
    </div>
  );
};

export default AppLogoSlot;
