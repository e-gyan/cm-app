import React, { useState, useEffect, useMemo } from "react";
import { AppData, Member, AppSettings } from "../types";
import { updateSettings, renameBranchCascade } from "../services/storageService";
import { hasRoleSubfeature } from "../lib/permissions";
import { doc, getDoc } from "firebase/firestore";
import { db, loginWithGoogle } from "../services/firebase";
import { APP_VERSION, APP_RELEASE_NAME } from "../version";
import { ChangelogModal } from "./ChangelogModal";
import {
  Settings as SettingsIcon,
  Cloud,
  List,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Database,
  Activity,
  Terminal,
  Palette,
  Wrench,
  Trash2,
  Building2,
  MapPin,
  Layers,
  Plus,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Check,
  Search,
  Tag,
  RotateCcw,
  LayoutDashboard,
  Users,
  CalendarCheck,
  HeartHandshake,
  PieChart,
  Share2,
  Lock,
  Unlock,
  Edit2,
  X,
} from "lucide-react";
import { themeColorPalettes, applyTheme } from "../lib/theme";
import { APP_FEATURES_REGISTRY, DEFAULT_SETTINGS } from "../constants";

interface SettingsProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
  activeChurch: string;
  activeBranchId?: string;
}

const Settings: React.FC<SettingsProps> = ({
  data,
  onUpdate,
  currentUser,
  activeChurch,
  activeBranchId,
}) => {
  const isAdmin =
    currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
  const [activeTab, setActiveTab] = useState<
    "GENERAL" | "CHURCHES" | "ORGANIZATION" | "CLOUD" | "THEME" | "PERMISSIONS" | "MAINTENANCE"
  >(() => {
    return (
      (sessionStorage.getItem("settings_activeTab") as
        "GENERAL" | "CHURCHES" | "ORGANIZATION" | "CLOUD" | "THEME" | "PERMISSIONS" | "MAINTENANCE") ||
      "GENERAL"
    );
  });

  useEffect(() => {
    sessionStorage.setItem("settings_activeTab", activeTab);
  }, [activeTab]);

  // Local state for editing
  const [localSettings, setLocalSettings] = useState<AppSettings>(
    data.settings,
  );

  useEffect(() => {
    if (data.settings) {
      setLocalSettings(data.settings);
    }
  }, [data.settings]);

  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [permsSaveSuccess, setPermsSaveSuccess] = useState(false);

  const [newChurch, setNewChurch] = useState("");
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedConfigChurch, setSelectedConfigChurch] = useState(activeChurch);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const [duplicateRecords, setDuplicateRecords] = useState<{
    date: string;
    churchId: string;
    records: any[];
  }[]>([]);

  const scanForDuplicates = () => {
    const recordsByDateAndChurch = {};
    data.attendance.forEach(record => {
      const key = `${record.date}_${record.churchId}`;
      if (!recordsByDateAndChurch[key]) recordsByDateAndChurch[key] = [];
      recordsByDateAndChurch[key].push(record);
    });

    const duplicates = Object.keys(recordsByDateAndChurch)
      .filter(key => recordsByDateAndChurch[key].length > 1)
      .map(key => {
        const [date, churchId] = key.split('_');
        return { date, churchId, records: recordsByDateAndChurch[key] };
      });

    setDuplicateRecords(duplicates);
    
    if (duplicates.length === 0) {
      setStatusMsg({ type: "success", text: "No duplicates found!" });
    } else {
      setStatusMsg({ type: "error", text: `Found ${duplicates.length} duplicate groups.` });
    }
  };

  const deleteDuplicateRecord = async (recordToDelete) => {
    if (!window.confirm("Are you sure you want to delete this attendance record? This action cannot be undone.")) return;
    
    // Find index of the exact record
    const index = data.attendance.indexOf(recordToDelete);
    if (index > -1) {
      data.attendance.splice(index, 1);
      await (true);
      onUpdate();
      setStatusMsg({ type: "success", text: "Record deleted successfully." });
      scanForDuplicates(); // Rescan
    }
  };

  const [permTab, setPermTab] = useState<"MATRIX" | "INDIVIDUAL">("INDIVIDUAL");
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string>("TEACHER");
  const [permSearchQuery, setPermSearchQuery] = useState<string>("");
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(
    new Set(["Dashboard", "People Hub", "Attendance", "Outreach", "Analytics", "Finances", "Reports", "Settings"])
  );
  const [newZoneName, setNewZoneName] = useState<string>("");
  const [isAddingZone, setIsAddingZone] = useState<boolean>(false);
  const [branchInputByZone, setBranchInputByZone] = useState<Record<string, string>>({});
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState<string>("");
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudLastUpdated, setCloudLastUpdated] = useState<number | null>(null);

  const handleInspectCloud = async () => {
    try {
                  const docRef = doc(db, "appData", "main");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cloudD = docSnap.data();
        console.log("=== RAW FIRESTORE DOCUMENT ===");
        console.log(cloudD);
        console.log("===============================");
        setCloudLastUpdated(cloudD.lastUpdated || null);
        setStatusMsg({
          type: "success",
          text: "Printed raw document to console.",
        });
      } else {
        console.log("=== RAW FIRESTORE DOCUMENT: NOT FOUND ===");
        setStatusMsg({
          type: "error",
          text: "Document appData/main not found.",
        });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMsg({
        type: "error",
        text: "Failed to fetch raw document: " + e.message,
      });
    }
  };

  const saveConfig = async () => {
    setIsSavingPerms(true);
    try {
      await updateSettings(localSettings);
      setStatusMsg({ type: "success", text: "Settings saved successfully to database" });
      setPermsSaveSuccess(true);
      setTimeout(() => setPermsSaveSuccess(false), 3000);
      setTimeout(() => setStatusMsg(null), 3000);
      onUpdate();
    } catch (e: any) {
      console.error("Save settings error:", e);
      setStatusMsg({ type: "error", text: "Failed to save: " + (e.message || String(e)) });
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleAddChurch = () => {
    if (newChurch && !localSettings.churches.includes(newChurch)) {
      setLocalSettings({
        ...localSettings,
        churches: [...localSettings.churches, newChurch],
      });
      setNewChurch("");
    }
  };

  const handleRemoveChurch = (church: string) => {
    if (
      window.confirm(
        `Remove ${church} from active list? Historic data will remain.`,
      )
    ) {
      setLocalSettings({
        ...localSettings,
        churches: localSettings.churches.filter((c) => c !== church),
      });
    }
  };

  const handleManualSync = async () => {
    if (
      !window.confirm(
        "WARNING: This will overwrite any unsaved local changes with what is on the cloud. Proceed?",
      )
    )
      return;
    setIsSyncing(true);
    const res = { success: true, message: "" };
    if (res.success) {
      setStatusMsg({ type: "success", text: "Cloud pull successful" });
      onUpdate();
    } else {
      setStatusMsg({ type: "error", text: "Sync failed" });
    }
    setIsSyncing(false);
  };

  
  

  const handleForcePush = async () => {
    setIsSyncing(true);
    try {
      await (true);
      setStatusMsg({ type: "success", text: "Cloud push successful" });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Push failed" });
    }
    setIsSyncing(false);
  };

  const ROLES_LIST = [
    { id: "SUPER_ADMIN", label: "Super Admin", color: "purple", desc: "Full unrestricted platform control" },
    { id: "ADMIN", label: "Administrator", color: "indigo", desc: "Full administrative and settings control" },
    { id: "DIRECTORATE_HEAD", label: "Directorate Head", color: "blue", desc: "Directorate-wide oversight and reporting" },
    { id: "ZONAL_HEAD", label: "Zonal Head", color: "emerald", desc: "Zonal oversight and campus coordination" },
    { id: "BRANCH_COORDINATOR", label: "Branch Coordinator", color: "teal", desc: "Branch operations, attendance and roster" },
    { id: "TEACHER", label: "Teacher", color: "amber", desc: "Attendance taking, outreach and visits" },
    { id: "VOLUNTEER", label: "Volunteer / Helper", color: "slate", desc: "Basic attendance check-in assistance" },
  ];

  const getFeatureIconComponent = (iconName: string) => {
    switch (iconName) {
      case "LayoutDashboard": return LayoutDashboard;
      case "Users": return Users;
      case "CalendarCheck": return CalendarCheck;
      case "HeartHandshake": return HeartHandshake;
      case "PieChart": return PieChart;
      case "Database": return Database;
      case "Share2": return Share2;
      case "Settings": return SettingsIcon;
      default: return ShieldCheck;
    }
  };

  const getRolePermissions = (role: string): string[] => {
    if (localSettings.permissions && role in localSettings.permissions) {
      return localSettings.permissions[role] || [];
    }
    return (DEFAULT_SETTINGS.permissions as Record<string, string[]>)?.[role] || [];
  };

  const isRoleFullAdmin = (role: string): boolean => {
    const perms = getRolePermissions(role);
    return perms.includes("ALL") || role === "SUPER_ADMIN";
  };

  const hasRoleFeature = (role: string, featureId: string): boolean => {
    if (role === "SUPER_ADMIN") return true;
    const perms = getRolePermissions(role);
    if (perms.includes("ALL")) return true;
    if (perms.includes(featureId)) return true;
    const feature = APP_FEATURES_REGISTRY.find((f) => f.id === featureId);
    if (feature && feature.subfeatures.some((sf) => perms.includes(`${featureId}.${sf.id}`))) {
      return true;
    }
    return false;
  };

  const hasRoleSubfeature = (role: string, featureId: string, subId: string): boolean => {
    if (role === "SUPER_ADMIN") return true;
    const perms = getRolePermissions(role);
    if (perms.includes("ALL")) return true;
    const subKey = `${featureId}.${subId}`;
    if (perms.includes(subKey)) return true;
    const hasAnySubKey = perms.some((p) => p.startsWith(`${featureId}.`));
    if (perms.includes(featureId) && !hasAnySubKey) {
      return true;
    }
    return false;
  };

  const savePermissionsToDb = async (newPerms: Record<string, string[]>, successText?: string) => {
    setIsSavingPerms(true);
    setPermsSaveSuccess(false);

    // Merge with DEFAULT_SETTINGS to ensure all roles exist in the database document
    const fullPermissions: Record<string, string[]> = {
      ...DEFAULT_SETTINGS.permissions,
      ...(localSettings.permissions || {}),
      ...newPerms,
    };

    const updated = {
      ...localSettings,
      permissions: fullPermissions,
    };

    setLocalSettings(updated);

    try {
      await updateSettings(updated);
      onUpdate();
      setPermsSaveSuccess(true);
      if (successText) {
        setStatusMsg({ type: "success", text: successText });
        setTimeout(() => setStatusMsg(null), 3000);
      }
      setTimeout(() => setPermsSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error("Failed to save permissions to database:", err);
      setStatusMsg({ type: "error", text: "Failed to save permissions to database: " + (err.message || String(err)) });
      setTimeout(() => setStatusMsg(null), 5000);
    } finally {
      setIsSavingPerms(false);
    }
  };

  const toggleFeatureForRole = async (role: string, featureId: string) => {
    const currentPerms = getRolePermissions(role);
    let rolePerms = [...currentPerms];
    const feature = APP_FEATURES_REGISTRY.find((f) => f.id === featureId);
    if (!feature) return;

    const subKeys = feature.subfeatures.map((sf) => `${featureId}.${sf.id}`);
    const isCurrentlyActive = hasRoleFeature(role, featureId);

    if (rolePerms.includes("ALL")) {
      const allOtherPerms: string[] = [];
      APP_FEATURES_REGISTRY.forEach((f) => {
        if (f.id !== featureId) {
          allOtherPerms.push(f.id);
          f.subfeatures.forEach((sf) => allOtherPerms.push(`${f.id}.${sf.id}`));
        }
      });
      rolePerms = allOtherPerms;
    } else if (isCurrentlyActive) {
      rolePerms = rolePerms.filter((p) => p !== featureId && !subKeys.includes(p));
    } else {
      rolePerms.push(featureId);
      subKeys.forEach((k) => {
        if (!rolePerms.includes(k)) rolePerms.push(k);
      });
    }

    await savePermissionsToDb({ [role]: rolePerms });
  };

  const toggleSubfeatureForRole = async (role: string, featureId: string, subId: string) => {
    const currentPerms = getRolePermissions(role);
    let rolePerms = [...currentPerms];
    const feature = APP_FEATURES_REGISTRY.find((f) => f.id === featureId);
    if (!feature) return;

    const subKey = `${featureId}.${subId}`;
    const isAll = rolePerms.includes("ALL");

    if (isAll) {
      const allPerms: string[] = [];
      APP_FEATURES_REGISTRY.forEach((f) => {
        f.subfeatures.forEach((sf) => {
          const k = `${f.id}.${sf.id}`;
          if (k !== subKey) allPerms.push(k);
        });
        if (f.id !== featureId || f.subfeatures.length > 1) {
          allPerms.push(f.id);
        }
      });
      rolePerms = allPerms;
    } else {
      const hasAnySubKey = rolePerms.some((p) => p.startsWith(`${featureId}.`));
      if (rolePerms.includes(featureId) && !hasAnySubKey) {
        feature.subfeatures.forEach((sf) => {
          const k = `${featureId}.${sf.id}`;
          if (!rolePerms.includes(k)) rolePerms.push(k);
        });
      }

      if (rolePerms.includes(subKey)) {
        rolePerms = rolePerms.filter((p) => p !== subKey);
        const remainingSubs = feature.subfeatures.filter((sf) => rolePerms.includes(`${featureId}.${sf.id}`));
        if (remainingSubs.length === 0) {
          rolePerms = rolePerms.filter((p) => p !== featureId);
        }
      } else {
        rolePerms.push(subKey);
        if (!rolePerms.includes(featureId)) {
          rolePerms.push(featureId);
        }
      }
    }

    await savePermissionsToDb({ [role]: rolePerms });
  };

  const grantAllForRole = async (role: string) => {
    const allPerms = ["ALL"];
    APP_FEATURES_REGISTRY.forEach((f) => {
      allPerms.push(f.id);
      f.subfeatures.forEach((sf) => allPerms.push(`${f.id}.${sf.id}`));
    });

    await savePermissionsToDb({ [role]: allPerms }, `Granted all permissions to ${role}`);
  };

  const revokeAllForRole = async (role: string) => {
    await savePermissionsToDb({ [role]: [] }, `Revoked all permissions from ${role}`);
  };

  const resetRoleToDefaults = async (role: string) => {
    const defaultPerms = (DEFAULT_SETTINGS.permissions as any)?.[role] || [];
    await savePermissionsToDb({ [role]: defaultPerms }, `Reset ${role} permissions to defaults`);
  };

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN" || currentUser.name?.toLowerCase().trim() === "emmanuel gyan";

  const canAccessSettingsTab = (tabId: string) => {
    if (isSuperAdmin || currentUser.role === "ADMIN") return true;
    if (tabId === "MAINTENANCE") return false;
    return hasRoleSubfeature(currentUser.role || "", "Settings", tabId);
  };

  const visibleSettingsTabs = useMemo(() => {
    const tabs: { id: "GENERAL" | "CHURCHES" | "ORGANIZATION" | "THEME" | "PERMISSIONS" | "CLOUD" | "MAINTENANCE"; label: string; icon: any }[] = [
      { id: "GENERAL", label: "General", icon: SettingsIcon },
      { id: "CHURCHES", label: "Church Branches", icon: Database },
      { id: "ORGANIZATION", label: "Organization Structure", icon: List },
      { id: "THEME", label: "Theme Colors", icon: Palette },
      { id: "PERMISSIONS", label: "Role Permissions", icon: CheckCircle },
      { id: "CLOUD", label: "Cloud Sync", icon: Cloud },
      { id: "MAINTENANCE", label: "Maintenance", icon: Wrench },
    ];
    return tabs.filter((t) => canAccessSettingsTab(t.id));
  }, [currentUser.role, isSuperAdmin, localSettings.permissions]);

  useEffect(() => {
    if (visibleSettingsTabs.length > 0 && !visibleSettingsTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleSettingsTabs[0].id);
    }
  }, [visibleSettingsTabs, activeTab]);

  return (
    <div className="pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <SettingsIcon size={24} className="text-slate-400" /> Settings and
            Config
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Manage application preferences.
          </p>
        </div>
        {statusMsg && (
          <div
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${statusMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
            {statusMsg.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar */}
        <div className="md:col-span-1 space-y-2">
          {visibleSettingsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-md scale-[1.02]"
                    : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}

          {/* System Version & Release Notes Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2.5 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag size={13} className="text-indigo-600" /> Platform Version
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              {APP_RELEASE_NAME}
            </p>
            <button
              type="button"
              onClick={() => setIsChangelogOpen(true)}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all border border-slate-200/60 flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Tag size={12} className="text-indigo-500" />
              View Release Notes
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
          {/* GENERAL TAB */}
          {activeTab === "GENERAL"&& (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-slate-800">
                Feature Toggles
              </h3>
              
              {isAdmin && (
                <div className="flex flex-col gap-2 mb-4">
                  <label className="text-sm font-bold text-slate-700">
                    Select Church / Branch to Configure
                  </label>
                  <select
                    value={selectedConfigChurch}
                    onChange={(e) => setSelectedConfigChurch(e.target.value)}
                    className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {(localSettings.churches || ["UJ", "LJ", "K", "I", "N"]).map((church) => (
                      <option key={church} value={church}>
                        {church}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-4">
                {selectedConfigChurch === "UJ" && (
                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                    <span className="font-medium text-slate-700">
                      Enable Punctuality Tracking (UJ Church Only)
                    </span>
                    <input
                      type="checkbox"
                      checked={localSettings.features?.[selectedConfigChurch]?.punctuality ?? false}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          features: {
                            ...localSettings.features,
                            [selectedConfigChurch]: {
                              ...(localSettings.features?.[selectedConfigChurch] || { punctuality: false, outreach: false }),
                              punctuality: e.target.checked,
                            }
                          },
                        })
                      }
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                )}

                <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                  <span className="font-medium text-slate-700">
                    Enable Outreach Module
                  </span>
                  <input
                    type="checkbox"
                    checked={localSettings.features?.[selectedConfigChurch]?.outreach ?? false}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        features: {
                          ...localSettings.features,
                          [selectedConfigChurch]: {
                            ...(localSettings.features?.[selectedConfigChurch] || { punctuality: false, outreach: false }),
                            outreach: e.target.checked,
                          }
                        },
                      })
                    }
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* CHURCHES TAB */}
          {activeTab === "CHURCHES"&& (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800">
                  Manage Branches
                </h3>
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                  Drag & drop support coming soon
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Branch Name (e.g. North Legon)"
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newChurch}
                  onChange={(e) => setNewChurch(e.target.value)}
                />
                <button
                  onClick={handleAddChurch}
                  className="px-4 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  <Save size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {(localSettings.churches || ["UJ", "LJ", "K", "I", "N"]).map((church, idx) => (
                  <div
                    key={church}
                    className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <span className="font-bold text-slate-700">{church}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveChurch(church)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <AlertCircle size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ORGANIZATION TAB */}
          {activeTab === "ORGANIZATION" && (
            <div className="space-y-6">
              {(() => {
                const org = localSettings.organization || {
                  directorate: "Central Children's Ministry Directorate",
                  zones: [],
                };

                const updateOrg = (newOrg: any) => {
                  const updatedSettings = {
                    ...localSettings,
                    organization: newOrg,
                  };
                  setLocalSettings(updatedSettings);
                  updateSettings(updatedSettings);
                  onUpdate();
                };

                const totalBranches = (org.zones || []).reduce(
                  (acc: number, z: any) => acc + (z.branches?.length || 0),
                  0,
                );

                const handleCreateZone = () => {
                  if (!newZoneName.trim()) return;
                  const newZone = {
                    id: crypto.randomUUID(),
                    name: newZoneName.trim(),
                    branches: [
                      {
                        id: crypto.randomUUID(),
                        name: `${newZoneName.trim()} Campus`,
                        churches: ["I", "K", "LJ", "UJ"],
                      },
                    ],
                  };
                  updateOrg({
                    ...org,
                    zones: [...(org.zones || []), newZone],
                  });
                  setNewZoneName("");
                  setIsAddingZone(false);
                  setStatusMsg({ type: "success", text: `Zone "${newZone.name}" created successfully` });
                  setTimeout(() => setStatusMsg(null), 3000);
                };

                const handleRemoveZone = (zoneId: string, zoneName: string) => {
                  if (!window.confirm(`Are you sure you want to remove zone "${zoneName}" and all its branches?`)) return;
                  const updatedZones = (org.zones || []).filter((z: any) => z.id !== zoneId);
                  updateOrg({ ...org, zones: updatedZones });
                  setStatusMsg({ type: "success", text: `Zone "${zoneName}" removed` });
                  setTimeout(() => setStatusMsg(null), 3000);
                };

                const handleAddBranchToZone = (zoneIndex: number) => {
                  const zone = org.zones[zoneIndex];
                  const branchName = (branchInputByZone[zone.id] || "").trim();
                  if (!branchName) return;

                  const newBranch = {
                    id: crypto.randomUUID(),
                    name: branchName,
                    churches: ["I", "K", "LJ", "UJ"],
                  };

                  const updatedZones = [...org.zones];
                  updatedZones[zoneIndex] = {
                    ...zone,
                    branches: [...(zone.branches || []), newBranch],
                  };

                  updateOrg({ ...org, zones: updatedZones });
                  setBranchInputByZone((prev) => ({ ...prev, [zone.id]: "" }));
                  setStatusMsg({ type: "success", text: `Branch "${branchName}" added to ${zone.name}` });
                  setTimeout(() => setStatusMsg(null), 3000);
                };

                const handleRemoveBranch = (zoneIndex: number, branchIndex: number, branchName: string) => {
                  if (!window.confirm(`Remove branch "${branchName}"?`)) return;
                  const updatedZones = [...org.zones];
                  const currentBranches = updatedZones[zoneIndex].branches || [];
                  updatedZones[zoneIndex] = {
                    ...updatedZones[zoneIndex],
                    branches: currentBranches.filter((_: any, idx: number) => idx !== branchIndex),
                  };
                  updateOrg({ ...org, zones: updatedZones });
                };

                const handleRenameBranch = async (zoneIndex: number, branchIndex: number, branch: any) => {
                  const newName = editingBranchName.trim();
                  const oldName = branch.name;
                  if (!newName || newName === oldName) {
                    setEditingBranchId(null);
                    return;
                  }

                  const branchId = branch.id || `branch-${zoneIndex}-${branchIndex}`;
                  const updatedZones = [...org.zones];
                  updatedZones[zoneIndex].branches[branchIndex] = {
                    ...updatedZones[zoneIndex].branches[branchIndex],
                    name: newName,
                  };
                  const updatedOrg = { ...org, zones: updatedZones };
                  const updatedSettings = {
                    ...localSettings,
                    organization: updatedOrg,
                  };

                  setLocalSettings(updatedSettings);
                  setEditingBranchId(null);

                  try {
                    await renameBranchCascade(branchId, oldName, newName, updatedSettings, currentUser.name);
                    setStatusMsg({
                      type: "success",
                      text: `Branch "${oldName}" renamed to "${newName}" and updated across all records.`,
                    });
                    setTimeout(() => setStatusMsg(null), 4000);
                    onUpdate();
                  } catch (err) {
                    console.error("Error cascading branch rename:", err);
                    setStatusMsg({
                      type: "error",
                      text: "Failed to update branch name across application.",
                    });
                    setTimeout(() => setStatusMsg(null), 4000);
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* TOP SUMMARY & ACTION BAR */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                          <Layers size={22} className="text-indigo-600" /> Organization Structure
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Manage Directorates, Zones, and Campus Branches with real-time application updates.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsAddingZone(true)}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
                        >
                          <Plus size={16} /> Add Zone
                        </button>
                        <button
                          onClick={saveConfig}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                        >
                          <Save size={16} /> Save All
                        </button>
                      </div>
                    </div>

                    {/* KPI CARDS BAR */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Directorate Card */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Building2 size={13} className="text-indigo-500" /> Directorate Name
                        </span>
                        <input
                          type="text"
                          value={org.directorate || ""}
                          onChange={(e) => updateOrg({ ...org, directorate: e.target.value })}
                          className="w-full font-bold text-sm text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          placeholder="Directorate Title"
                        />
                      </div>

                      {/* Total Zones */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                            Total Zones
                          </span>
                          <h4 className="text-2xl font-black text-indigo-900 mt-1">
                            {org.zones?.length || 0}
                          </h4>
                        </div>
                        <span className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                          <MapPin size={20} />
                        </span>
                      </div>

                      {/* Total Branches */}
                      <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
                            Active Branches
                          </span>
                          <h4 className="text-2xl font-black text-teal-900 mt-1">
                            {totalBranches}
                          </h4>
                        </div>
                        <span className="p-3 bg-teal-100 text-teal-600 rounded-2xl">
                          <Building2 size={20} />
                        </span>
                      </div>
                    </div>

                    {/* ADD ZONE MODAL / INLINE CARD */}
                    {isAddingZone && (
                      <div className="p-4 bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                            <Plus size={16} /> Create New Zone
                          </h4>
                          <button
                            onClick={() => setIsAddingZone(false)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                          >
                            &times;
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newZoneName}
                            onChange={(e) => setNewZoneName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreateZone()}
                            placeholder="Enter Zone Name (e.g. Northern Zone, Tema Zone)"
                            className="flex-1 px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={handleCreateZone}
                            disabled={!newZoneName.trim()}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                          >
                            Create Zone
                          </button>
                          <button
                            onClick={() => setIsAddingZone(false)}
                            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ZONES LIST */}
                    <div className="space-y-4">
                      {(org.zones || []).map((zone: any, zIndex: number) => {
                        const branches = zone.branches || [];
                        const currentInput = branchInputByZone[zone.id] || "";

                        return (
                          <div
                            key={zone.id || zIndex}
                            className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4 hover:border-indigo-200 transition-all"
                          >
                            {/* ZONE HEADER */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                                  <MapPin size={20} />
                                </span>
                                <div className="flex-1 min-w-0">
                                  {editingZoneId === (zone.id || `zone-${zIndex}`) ? (
                                    <div className="flex items-center gap-1.5 w-full max-w-sm">
                                      <input
                                        type="text"
                                        value={editingZoneName}
                                        onChange={(e) => setEditingZoneName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            const updatedZones = [...org.zones];
                                            updatedZones[zIndex] = { ...updatedZones[zIndex], name: editingZoneName.trim() || zone.name };
                                            updateOrg({ ...org, zones: updatedZones });
                                            setEditingZoneId(null);
                                          } else if (e.key === "Escape") {
                                            setEditingZoneId(null);
                                          }
                                        }}
                                        autoFocus
                                        className="font-extrabold text-sm sm:text-base text-slate-800 bg-white px-2.5 py-1 rounded-lg border-2 border-indigo-500 focus:outline-none w-full shadow-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedZones = [...org.zones];
                                          updatedZones[zIndex] = { ...updatedZones[zIndex], name: editingZoneName.trim() || zone.name };
                                          updateOrg({ ...org, zones: updatedZones });
                                          setEditingZoneId(null);
                                        }}
                                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shrink-0"
                                        title="Save Zone Name"
                                      >
                                        <Check size={15} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingZoneId(null)}
                                        className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors shrink-0"
                                        title="Cancel"
                                      >
                                        <X size={15} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => {
                                        setEditingZoneId(zone.id || `zone-${zIndex}`);
                                        setEditingZoneName(zone.name);
                                      }}
                                      className="flex items-center gap-2 group cursor-pointer"
                                      title="Click to rename zone"
                                    >
                                      <span className="font-extrabold text-base text-slate-800 group-hover:text-indigo-600 transition-colors break-words whitespace-normal leading-snug">
                                        {zone.name}
                                      </span>
                                      <Edit2 size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                                  {branches.length} {branches.length === 1 ? "Branch" : "Branches"}
                                </span>
                                <button
                                  onClick={() => handleRemoveZone(zone.id, zone.name)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                  title="Delete Zone"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* BRANCHES CONTAINER */}
                            <div className="space-y-3 pl-2 sm:pl-4">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <span>Branches in this Zone</span>
                              </div>

                              {/* BRANCH CARDS GRID */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {branches.map((branch: any, bIndex: number) => (
                                  <div
                                    key={branch.id || bIndex}
                                    className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 hover:shadow-sm hover:bg-white transition-all group"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <Building2 size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                        {editingBranchId === (branch.id || `branch-${zIndex}-${bIndex}`) ? (
                                          <div className="flex items-center gap-1 w-full">
                                            <input
                                              type="text"
                                              value={editingBranchName}
                                              onChange={(e) => setEditingBranchName(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  handleRenameBranch(zIndex, bIndex, branch);
                                                } else if (e.key === "Escape") {
                                                  setEditingBranchId(null);
                                                }
                                              }}
                                              autoFocus
                                              className="text-xs font-bold text-slate-800 bg-white px-2 py-1 rounded border-2 border-indigo-500 focus:outline-none w-full shadow-sm"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleRenameBranch(zIndex, bIndex, branch)}
                                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shrink-0"
                                              title="Save Branch Name"
                                            >
                                              <Check size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingBranchId(null)}
                                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors shrink-0"
                                              title="Cancel"
                                            >
                                              <X size={13} />
                                            </button>
                                          </div>
                                        ) : (
                                          <div
                                            onClick={() => {
                                              setEditingBranchId(branch.id || `branch-${zIndex}-${bIndex}`);
                                              setEditingBranchName(branch.name);
                                            }}
                                            className="flex items-start gap-1.5 flex-1 min-w-0 group cursor-pointer"
                                            title="Click to rename branch"
                                          >
                                            <span className="text-xs font-bold text-slate-800 break-words whitespace-normal leading-snug group-hover:text-indigo-600 transition-colors">
                                              {branch.name}
                                            </span>
                                            <Edit2 size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleRemoveBranch(zIndex, bIndex, branch.name)}
                                        className="opacity-40 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-all shrink-0 mt-0.5"
                                        title="Remove Branch"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>

                                    {/* Children Ministries Badges */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {["I", "K", "LJ", "UJ"].map((c) => (
                                        <span
                                          key={c}
                                          className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-700"
                                        >
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* INLINE ADD BRANCH ROW */}
                              <div className="flex items-center gap-2 pt-2">
                                <input
                                  type="text"
                                  value={currentInput}
                                  onChange={(e) =>
                                    setBranchInputByZone((prev) => ({
                                      ...prev,
                                      [zone.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => e.key === "Enter" && handleAddBranchToZone(zIndex)}
                                  placeholder={`+ Add branch to ${zone.name}...`}
                                  className="flex-1 max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleAddBranchToZone(zIndex)}
                                  disabled={!currentInput.trim()}
                                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                                >
                                  <Plus size={14} /> Add
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {(!org.zones || org.zones.length === 0) && (
                        <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-3 bg-slate-50/50">
                          <span className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl inline-block">
                            <Layers size={32} />
                          </span>
                          <h4 className="font-bold text-slate-700 text-base">No Zones Configured</h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Zones group your campus branches together under the central directorate.
                          </p>
                          <button
                            onClick={() => setIsAddingZone(true)}
                            className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2"
                          >
                            <Plus size={16} /> Create First Zone
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* THEME TAB */}
          {activeTab === "THEME"&& (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Palette size={20} className="text-indigo-600" /> Theme
                  Customization
                </h3>
              </div>
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 text-sm">
                <p>
                  Select a primary brand color for the interface. This changes
                  the accent color dynamically.
                </p>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-700">
                    Select Church / Branch
                  </label>
                  <select
                    value={selectedConfigChurch}
                    onChange={(e) => setSelectedConfigChurch(e.target.value)}
                    className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {(localSettings.churches || ["UJ", "LJ", "K", "I", "N"]).map((church) => (
                      <option key={church} value={church}>
                        {church}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(themeColorPalettes).map(
                  ([colorName, palette]) => {
                    const currentThemeColors = localSettings.themeColors || {};
                    const isSelected =
                      (currentThemeColors[selectedConfigChurch] || "indigo") ===
                      colorName;
                    return (
                      <button
                        key={colorName}
                        onClick={() => {
                          const newThemeColors = {
                            ...currentThemeColors,
                            [selectedConfigChurch]: colorName,
                          };
                          setLocalSettings({
                            ...localSettings,
                            themeColors: newThemeColors,
                          });
                        }}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${isSelected ? "border-indigo-600 bg-indigo-50 shadow-md scale-105" : "border-slate-100 hover:border-slate-300 bg-white hover:bg-slate-50"}`}
                      >
                        <div
                          className="w-10 h-10 rounded-full mb-3 shadow-sm"
                          style={{ backgroundColor: palette["500"] }}
                        />
                        <span className="text-sm font-bold text-slate-700 capitalize">
                          {colorName}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}

          
          {/* MAINTENANCE TAB */}
          {activeTab === "MAINTENANCE" && isAdmin && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Wrench size={20} className="text-indigo-600" /> System Maintenance
                </h3>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h4 className="font-bold text-red-800 mb-2">Duplicate Attendance Records</h4>
                <p className="text-sm text-red-700 mb-4">
                  Identify and remove duplicate attendance entries for the same date and church.
                </p>
                
                <button
                  onClick={scanForDuplicates}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  Scan for Duplicates
                </button>
                
                {duplicateRecords.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {duplicateRecords.map((group, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                        <div className="font-bold text-slate-800 mb-3 border-b pb-2">
                          {group.churchId} Church - {group.date} ({group.records.length} records)
                        </div>
                        <div className="space-y-3">
                          {group.records.map((record, j) => (
                            <div key={j} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <div>
                                <div className="text-xs font-bold text-slate-500">Event: {record.eventName || "N/A"}</div>
                                <div className="text-xs text-slate-600">Present: {record.presentMemberIds?.length || 0}</div>
                              </div>
                              <button
                                onClick={() => deleteDuplicateRecord(record)}
                                className="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PERMISSIONS TAB */}
          {activeTab === "PERMISSIONS" && (
            <div className="space-y-6">
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                    <ShieldCheck size={22} className="text-indigo-600" /> Role Permissions and Access Control
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage granular access to all 8 core features and {APP_FEATURES_REGISTRY.reduce((acc, f) => acc + f.subfeatures.length, 0)} subfeatures across ministry roles.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isSavingPerms ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-200 animate-pulse">
                      <RefreshCw size={13} className="animate-spin" /> Saving to database...
                    </span>
                  ) : permsSaveSuccess ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200">
                      <CheckCircle size={13} className="text-emerald-600" /> Saved in database
                    </span>
                  ) : null}

                  <button
                    onClick={() => savePermissionsToDb({}, "Permissions successfully saved to database")}
                    disabled={isSavingPerms}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
                  >
                    <Save size={16} /> {isSavingPerms ? "Saving..." : "Save Permissions"}
                  </button>
                </div>
              </div>

              {/* VIEW MODE TOGGLE */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setPermTab("INDIVIDUAL")}
                    className={`px-4 py-2 font-bold text-xs rounded-xl transition-all flex items-center gap-2 ${
                      permTab === "INDIVIDUAL"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Users size={15} /> Role Feature Manager
                  </button>
                  <button
                    onClick={() => setPermTab("MATRIX")}
                    className={`px-4 py-2 font-bold text-xs rounded-xl transition-all flex items-center gap-2 ${
                      permTab === "MATRIX"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Layers size={15} /> Full Matrix Overview
                  </button>
                </div>

                {/* SEARCH BAR */}
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    placeholder="Search features or actions..."
                    className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  />
                  {permSearchQuery && (
                    <button
                      onClick={() => setPermSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* TAB 1: ROLE FEATURE MANAGER */}
              {permTab === "INDIVIDUAL" && (
                <div className="space-y-6">
                  {/* ROLE SELECTOR CAROUSEL / TABS */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {ROLES_LIST.map((r) => {
                      const isSelected = selectedRoleForPerms === r.id;
                      const rolePerms = getRolePermissions(r.id);
                      const isFull = rolePerms.includes("ALL");

                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRoleForPerms(r.id)}
                          className={`px-4 py-3 rounded-2xl text-left border transition-all shrink-0 min-w-[140px] flex flex-col gap-1 ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 scale-[1.02]"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <span className={`text-xs font-extrabold ${isSelected ? "text-white" : "text-slate-800"}`}>
                            {r.label}
                          </span>
                          <span className={`text-[10px] font-semibold ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                            {isFull ? "Full Access" : `${rolePerms.filter((p) => !p.includes(".")).length} Features`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ACTIVE ROLE BANNER & QUICK ACTIONS */}
                  {(() => {
                    const currentRoleMeta = ROLES_LIST.find((r) => r.id === selectedRoleForPerms) || ROLES_LIST[0];

                    return (
                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-sm">
                              Managing Access for: <span className="text-indigo-600">{currentRoleMeta.label}</span>
                            </span>
                            {isRoleFullAdmin(currentRoleMeta.id) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-700">
                                Full Administrator
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{currentRoleMeta.desc}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => grantAllForRole(currentRoleMeta.id)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center gap-1"
                          >
                            <Unlock size={13} /> Grant All
                          </button>
                          <button
                            onClick={() => revokeAllForRole(currentRoleMeta.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition-colors flex items-center gap-1"
                          >
                            <Lock size={13} /> Revoke All
                          </button>
                          <button
                            onClick={() => resetRoleToDefaults(currentRoleMeta.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1"
                          >
                            <RotateCcw size={13} /> Reset Defaults
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* FEATURES & SUBFEATURES LIST */}
                  <div className="space-y-4">
                    {APP_FEATURES_REGISTRY.filter((f) => {
                      if (!permSearchQuery.trim()) return true;
                      const q = permSearchQuery.toLowerCase();
                      return (
                        f.name.toLowerCase().includes(q) ||
                        f.description.toLowerCase().includes(q) ||
                        f.subfeatures.some((sf) => sf.name.toLowerCase().includes(q) || sf.description.toLowerCase().includes(q))
                      );
                    }).map((feature) => {
                      const IconComponent = getFeatureIconComponent(feature.iconName);
                      const isExpanded = expandedFeatures.has(feature.id) || !!permSearchQuery.trim();
                      const featureActive = hasRoleFeature(selectedRoleForPerms, feature.id);

                      const enabledSubCount = feature.subfeatures.filter((sf) =>
                        hasRoleSubfeature(selectedRoleForPerms, feature.id, sf.id),
                      ).length;

                      const isFullFeature = enabledSubCount === feature.subfeatures.length;

                      const toggleExpand = () => {
                        setExpandedFeatures((prev) => {
                          const n = new Set(prev);
                          if (n.has(feature.id)) n.delete(feature.id);
                          else n.add(feature.id);
                          return n;
                        });
                      };

                      return (
                        <div
                          key={feature.id}
                          className={`bg-white border rounded-3xl transition-all shadow-sm ${
                            featureActive ? "border-indigo-200" : "border-slate-200 opacity-90"
                          }`}
                        >
                          {/* FEATURE CARD HEADER */}
                          <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div
                              onClick={toggleExpand}
                              className="flex items-center gap-3.5 flex-1 cursor-pointer select-none"
                            >
                              <span
                                className={`p-3 rounded-2xl transition-colors ${
                                  featureActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                <IconComponent size={22} />
                              </span>
                              <div>
                                <div className="flex items-center gap-2.5">
                                  <h4 className="font-extrabold text-base text-slate-800">{feature.name}</h4>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                                      isFullFeature
                                        ? "bg-emerald-100 text-emerald-700"
                                        : enabledSubCount > 0
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {enabledSubCount} / {feature.subfeatures.length} enabled
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{feature.description}</p>
                              </div>
                            </div>

                            {/* MASTER TOGGLE & EXPAND CHEVRON */}
                            <div className="flex items-center gap-4 self-end sm:self-auto">
                              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                                <span>{featureActive ? "Enabled" : "Disabled"}</span>
                                <input
                                  type="checkbox"
                                  checked={featureActive}
                                  onChange={() => toggleFeatureForRole(selectedRoleForPerms, feature.id)}
                                  className="w-5 h-5 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
                                />
                              </label>

                              <button
                                onClick={toggleExpand}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                              >
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                            </div>
                          </div>

                          {/* SUBFEATURES EXPANDABLE SECTION */}
                          {isExpanded && (
                            <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl space-y-3">
                              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                                Subfeatures and Detailed Actions
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {feature.subfeatures
                                  .filter((sf) => {
                                    if (!permSearchQuery.trim()) return true;
                                    const q = permSearchQuery.toLowerCase();
                                    return sf.name.toLowerCase().includes(q) || sf.description.toLowerCase().includes(q);
                                  })
                                  .map((sf) => {
                                    const isSubActive = hasRoleSubfeature(selectedRoleForPerms, feature.id, sf.id);

                                    return (
                                      <label
                                        key={sf.id}
                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                                          isSubActive
                                            ? "bg-white border-indigo-200/90 shadow-sm"
                                            : "bg-slate-100/60 border-slate-200/70 hover:bg-white"
                                        }`}
                                      >
                                        <div className="space-y-0.5 pr-2">
                                          <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                            {sf.name}
                                          </div>
                                          <p className="text-[11px] text-slate-500 leading-relaxed">{sf.description}</p>
                                        </div>

                                        <input
                                          type="checkbox"
                                          checked={isSubActive}
                                          onChange={() =>
                                            toggleSubfeatureForRole(selectedRoleForPerms, feature.id, sf.id)
                                          }
                                          className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                                        />
                                      </label>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: FULL MATRIX OVERVIEW */}
              {permTab === "MATRIX" && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">Role Permissions Comparison Matrix</h4>
                      <p className="text-xs text-slate-500">Cross-table view of all roles vs. application features.</p>
                    </div>
                  </div>

                  {/* DESKTOP TABLE VIEW */}
                  <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-600 text-xs font-extrabold uppercase tracking-wide border-b border-slate-200">
                        <tr>
                          <th className="sticky left-0 bg-slate-50 z-20 px-4 py-3 min-w-[240px] border-r border-slate-200 shadow-sm">
                            Feature / Action
                          </th>
                          {ROLES_LIST.map((r) => (
                            <th key={r.id} className="px-3 py-3 text-center min-w-[120px]">
                              <div>{r.label}</div>
                              <button
                                onClick={() =>
                                  getRolePermissions(r.id).length > 0 ? revokeAllForRole(r.id) : grantAllForRole(r.id)
                                }
                                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 lowercase tracking-normal"
                              >
                                {getRolePermissions(r.id).length > 0 ? "clear" : "all"}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 text-xs">
                        {APP_FEATURES_REGISTRY.filter((f) => {
                          if (!permSearchQuery.trim()) return true;
                          const q = permSearchQuery.toLowerCase();
                          return (
                            f.name.toLowerCase().includes(q) ||
                            f.subfeatures.some((sf) => sf.name.toLowerCase().includes(q))
                          );
                        }).map((feature) => (
                          <React.Fragment key={feature.id}>
                            {/* TOP-LEVEL FEATURE ROW */}
                            <tr className="bg-indigo-50/40 font-extrabold text-slate-800 hover:bg-indigo-50/70">
                              <td className="sticky left-0 bg-indigo-50/95 z-10 px-4 py-3 min-w-[240px] border-r border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                                  {React.createElement(getFeatureIconComponent(feature.iconName), { size: 14 })}
                                </span>
                                <span className="break-words whitespace-normal leading-snug">{feature.name}</span>
                              </td>
                              {ROLES_LIST.map((r) => {
                                const active = hasRoleFeature(r.id, feature.id);

                                return (
                                  <td key={r.id} className="px-3 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={active}
                                      onChange={() => toggleFeatureForRole(r.id, feature.id)}
                                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                  </td>
                                );
                              })}
                            </tr>

                            {/* SUBFEATURE ROWS */}
                            {feature.subfeatures
                              .filter((sf) => {
                                if (!permSearchQuery.trim()) return true;
                                const q = permSearchQuery.toLowerCase();
                                return sf.name.toLowerCase().includes(q) || feature.name.toLowerCase().includes(q);
                              })
                              .map((sf) => (
                                <tr key={sf.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="sticky left-0 bg-white z-10 px-4 py-2.5 pl-9 min-w-[240px] border-r border-slate-200 shadow-sm text-slate-600 font-medium break-words whitespace-normal leading-snug">
                                    <span className="text-slate-400 mr-1.5">&bull;</span>
                                    {sf.name}
                                  </td>
                                  {ROLES_LIST.map((r) => {
                                    const active = hasRoleSubfeature(r.id, feature.id, sf.id);

                                    return (
                                      <td key={r.id} className="px-3 py-2.5 text-center">
                                        <input
                                          type="checkbox"
                                          checked={active}
                                          onChange={() => toggleSubfeatureForRole(r.id, feature.id, sf.id)}
                                          className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE CARD VIEW */}
                  <div className="block md:hidden space-y-4">
                    {APP_FEATURES_REGISTRY.filter((f) => {
                      if (!permSearchQuery.trim()) return true;
                      const q = permSearchQuery.toLowerCase();
                      return (
                        f.name.toLowerCase().includes(q) ||
                        f.subfeatures.some((sf) => sf.name.toLowerCase().includes(q))
                      );
                    }).map((feature) => (
                      <div key={feature.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                            {React.createElement(getFeatureIconComponent(feature.iconName), { size: 16 })}
                          </span>
                          <h5 className="font-extrabold text-sm text-slate-800">{feature.name}</h5>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {ROLES_LIST.map((r) => {
                            const active = hasRoleFeature(r.id, feature.id);
                            return (
                              <button
                                key={r.id}
                                onClick={() => toggleFeatureForRole(r.id, feature.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                                  active
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                }`}
                              >
                                {r.label}
                              </button>
                            );
                          })}
                        </div>

                        {feature.subfeatures.filter((sf) => {
                          if (!permSearchQuery.trim()) return true;
                          const q = permSearchQuery.toLowerCase();
                          return sf.name.toLowerCase().includes(q) || feature.name.toLowerCase().includes(q);
                        }).length > 0 && (
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            {feature.subfeatures
                              .filter((sf) => {
                                if (!permSearchQuery.trim()) return true;
                                const q = permSearchQuery.toLowerCase();
                                return sf.name.toLowerCase().includes(q) || feature.name.toLowerCase().includes(q);
                              })
                              .map((sf) => (
                                <div key={sf.id} className="space-y-2">
                                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <span className="text-slate-400">&bull;</span> {sf.name}
                                  </div>
                                  <div className="flex flex-wrap gap-2 pl-2">
                                    {ROLES_LIST.map((r) => {
                                      const active = hasRoleSubfeature(r.id, feature.id, sf.id);
                                      return (
                                        <button
                                          key={r.id}
                                          onClick={() => toggleSubfeatureForRole(r.id, feature.id, sf.id)}
                                          className={`px-2 py-1.5 rounded-md border text-[10px] font-bold transition-colors ${
                                            active
                                              ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                              : "bg-slate-50 text-slate-400 border-slate-200"
                                          }`}
                                        >
                                          {r.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SAVE ACTION BAR */}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={saveConfig}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Save size={16} /> Save Permissions
                </button>
              </div>
            </div>
          )}

          {/* CLOUD TAB */}
          {activeTab === "CLOUD"&& (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Cloud size={20} className="text-indigo-600" /> Firebase Sync
                Configuration
              </h3>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm">
                <p>
                  Data is synchronized securely with Firebase. Ensure you are
                  signed in with the authorized Google Account.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <button
                    onClick={async () => {
                      try {
                        /* loginWithGoogle statically imported */
                        await loginWithGoogle();
                        setStatusMsg({
                          type: "success",
                          text: "Firebase signed in successfully!",
                        });
                      } catch (e: any) {
                        setStatusMsg({
                          type: "error",
                          text: "Firebase Sign in failed",
                        });
                      }
                    }}
                    className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600"
                  >
                    Sign In with Google
                  </button>
                  <button
                    onClick={handleForcePush}
                    disabled={isSyncing}
                    className="px-6 py-3 bg-green-100 text-green-700 font-bold rounded-xl hover:bg-green-200 flex items-center gap-2"
                  >
                    <Cloud
                      size={18}
                      className={isSyncing ? "animate-pulse" : ""}
                    />{" "}
                    Force Push
                  </button>
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 flex items-center gap-2"
                  >
                    <RefreshCw
                      size={18}
                      className={isSyncing ? "animate-spin" : ""}
                    />{" "}
                    Force Pull
                  </button>
                </div>
              </div>

              
              {isAdmin && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Database size={18} className="text-slate-500" /> Demo Data Setup
                  </h4>
                  <p className="text-sm text-slate-600 mb-4">
                    If your database is empty, you can generate 50 mock members and 12 months of historical attendance data to explore the features and analytics charts.
                  </p>
                  
                </div>
              )}

              {isAdmin && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Terminal size={18} className="text-slate-500" /> Sync Debug
                  </h4>
                  <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between">
                      <span className="font-medium">Local `lastUpdated`:</span>
                      <span className="font-mono">
                        {data.lastUpdated
                          ? new Date(data.lastUpdated).toISOString()
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Cloud `lastUpdated`:</span>
                      <span className="font-mono">
                        {cloudLastUpdated
                          ? new Date(cloudLastUpdated).toISOString()
                          : "Not Fetched Yet"}
                      </span>
                    </div>
                    <button
                      onClick={handleInspectCloud}
                      className="w-full mt-2 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
                    >
                      <Database size={16} /> Force Fetch Raw Cloud Document
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Save Button (if not in cloud tab) */}
      {activeTab !=="GENERAL"&& (
        <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8">
          <button
            onClick={saveConfig}
            className="bg-green-600 text-white px-6 py-4 rounded-full shadow-xl shadow-green-200 font-bold text-lg hover:bg-green-700 hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
          >
            <Save size={20} /> Save Changes
          </button>
        </div>
      )}

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
    </div>
  );
};

export default React.memo(Settings);
