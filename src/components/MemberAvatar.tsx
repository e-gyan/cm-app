import React, { useState } from "react";
import { Member } from "../types";

export interface MemberAvatarProps {
  member?: Partial<Member> | null;
  name?: string;
  photoUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showBorder?: boolean;
}

const SIZE_CLASSES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-24 h-24 text-2xl",
};

// Distinct pastel-vibrant color pairs for deterministic avatar fallback
const AVATAR_PALETTES = [
  "from-indigo-500 to-indigo-700 text-white",
  "from-blue-500 to-cyan-600 text-white",
  "from-emerald-500 to-teal-700 text-white",
  "from-purple-500 to-fuchsia-700 text-white",
  "from-rose-500 to-pink-700 text-white",
  "from-amber-500 to-orange-600 text-white",
  "from-teal-500 to-emerald-700 text-white",
  "from-violet-600 to-purple-800 text-white",
];

const getInitials = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getPaletteForString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
};

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  member,
  name: propName,
  photoUrl: propPhotoUrl,
  size = "md",
  className = "",
  showBorder = true,
}) => {
  const name = propName || member?.name || "Member";
  const photoUrl = propPhotoUrl || member?.photoUrl;
  const [imageError, setImageError] = useState(false);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const initials = getInitials(name);
  const palette = getPaletteForString(name + (member?.id || ""));
  const borderClass = showBorder ? "ring-2 ring-white/80 shadow-sm" : "";

  if (photoUrl && !imageError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-slate-100 ${sizeClass} ${borderClass} ${className}`}
        title={name}
      >
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover rounded-full"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full font-bold select-none bg-gradient-to-br ${palette} ${sizeClass} ${borderClass} ${className}`}
      title={name}
    >
      <span>{initials}</span>
    </div>
  );
};
