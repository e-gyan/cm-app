import { AppData } from "../types";
import { APP_FEATURES_REGISTRY } from "../constants";

export const getRolePermissions = (data: AppData, role: string): string[] => {
  return data.settings?.permissions?.[role] || [];
};

export const hasRoleFeature = (data: AppData, role: string, featureId: string): boolean => {
  if (!role) return false;
  const perms = getRolePermissions(data, role);
  if (perms.includes("ALL")) return true;
  if (perms.includes(featureId)) return true;
  
  const feature = APP_FEATURES_REGISTRY.find((f) => f.id === featureId);
  if (feature && feature.subfeatures.some((sf) => perms.includes(`${featureId}.${sf.id}`))) {
    return true;
  }
  return false;
};

export const hasRoleSubfeature = (data: AppData, role: string, featureId: string, subId: string): boolean => {
  if (!role) return false;
  const perms = getRolePermissions(data, role);
  if (perms.includes("ALL")) return true;
  
  const subKey = `${featureId}.${subId}`;
  if (perms.includes(subKey)) return true;
  
  const hasAnySubKey = perms.some((p) => p.startsWith(`${featureId}.`));
  if (perms.includes(featureId) && !hasAnySubKey) {
    return true;
  }
  return false;
};
