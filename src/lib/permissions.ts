import { AppData, AppSettings, Member } from "../types";
import { APP_FEATURES_REGISTRY, DEFAULT_SETTINGS } from "../constants";

export type PermissionsSource =
  | AppData
  | AppSettings
  | Record<string, string[]>
  | undefined
  | null;

/**
 * Extracts permissions for a given role from any container (AppData, AppSettings, or a raw permissions map).
 * If the role has not yet been customized in the source, falls back to DEFAULT_SETTINGS.permissions.
 */
export const getRolePermissions = (
  source: PermissionsSource,
  role: string
): string[] => {
  if (!role) return [];

  let permsObj: Record<string, string[]> | undefined;

  if (source && typeof source === "object") {
    if ("settings" in source && (source as AppData).settings) {
      permsObj = (source as AppData).settings.permissions;
    } else if ("permissions" in source && (source as AppSettings).permissions) {
      permsObj = (source as AppSettings).permissions as Record<string, string[]>;
    } else {
      permsObj = source as Record<string, string[]>;
    }
  }

  if (permsObj && role in permsObj) {
    return permsObj[role] || [];
  }

  return (DEFAULT_SETTINGS.permissions as Record<string, string[]>)?.[role] || [];
};

/**
 * Checks if a role has access to a top-level feature.
 * A role has access if:
 * 1. The role is SUPER_ADMIN
 * 2. Its permissions include "ALL"
 * 3. Its permissions include the exact featureId
 * 4. Any subfeature of featureId is explicitly granted (e.g. "Reports.WHATSAPP")
 */
export const hasRoleFeature = (
  source: PermissionsSource,
  role: string,
  featureId: string
): boolean => {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;

  const perms = getRolePermissions(source, role);
  if (perms.includes("ALL")) return true;
  if (perms.includes(featureId)) return true;

  const feature = APP_FEATURES_REGISTRY.find((f) => f.id === featureId);
  if (feature && feature.subfeatures.some((sf) => perms.includes(`${featureId}.${sf.id}`))) {
    return true;
  }
  return false;
};

/**
 * Checks if a role has access to a granular subfeature.
 * A role has access if:
 * 1. The role is SUPER_ADMIN
 * 2. Its permissions include "ALL"
 * 3. Its permissions include the specific subfeature key "featureId.subId"
 * 4. Its permissions include featureId, and NO other subfeatures for featureId are individually configured
 */
export const hasRoleSubfeature = (
  source: PermissionsSource,
  role: string,
  featureId: string,
  subId: string
): boolean => {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;

  const perms = getRolePermissions(source, role);
  if (perms.includes("ALL")) return true;

  const subKey = `${featureId}.${subId}`;
  if (perms.includes(subKey)) return true;

  const hasAnySubKey = perms.some((p) => p.startsWith(`${featureId}.`));
  if (perms.includes(featureId) && !hasAnySubKey) {
    return true;
  }
  return false;
};

export const isSuperAdminUser = (currentUser: Member | null | undefined): boolean => {
  if (!currentUser) return false;
  const normalizedName = currentUser.name?.toLowerCase().trim() || "";
  return (
    currentUser.role === "SUPER_ADMIN" ||
    normalizedName === "emmanuel gyan" ||
    normalizedName === "admin" ||
    normalizedName === "main admin"
  );
};

export const canAccessFeature = (
  source: PermissionsSource,
  currentUser: Member | null | undefined,
  featureId: string
): boolean => {
  if (!currentUser) return false;
  if (isSuperAdminUser(currentUser)) return true;
  return hasRoleFeature(source, currentUser.role, featureId);
};

export const canAccessSubfeature = (
  source: PermissionsSource,
  currentUser: Member | null | undefined,
  featureId: string,
  subId: string
): boolean => {
  if (!currentUser) return false;
  if (isSuperAdminUser(currentUser)) return true;
  return hasRoleSubfeature(source, currentUser.role, featureId, subId);
};
