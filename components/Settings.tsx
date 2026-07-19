import React, { useState, useEffect } from "react";
import { AppData, Member, AppSettings } from "../types";
import { updateSettings, syncFromCloud, syncToCloud } from "../services/storageService";
import { doc, getDoc } from "firebase/firestore";
import { db, loginWithGoogle } from "../services/firebase";
import {
  Settings as SettingsIcon,
  Cloud,
  List,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Database,
  Terminal,
  Palette,
  Wrench,
  Trash2,
} from "lucide-react";
import { themeColorPalettes, applyTheme } from "../lib/theme";

interface SettingsProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
  activeChurch: string;
}

const Settings: React.FC<SettingsProps> = ({
  data,
  onUpdate,
  currentUser,
  activeChurch,
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
  const [newChurch, setNewChurch] = useState("");
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedConfigChurch, setSelectedConfigChurch] = useState(activeChurch);

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
      await syncToCloud(true);
      onUpdate();
      setStatusMsg({ type: "success", text: "Record deleted successfully." });
      scanForDuplicates(); // Rescan
    }
  };

  const [permTab, setPermTab] = useState<"MATRIX" | "INDIVIDUAL">("MATRIX");
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string>("ZONAL_HEAD");
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

  const saveConfig = () => {
    updateSettings(localSettings);
    setStatusMsg({ type: "success", text: "Settings saved successfully" });
    setTimeout(() => setStatusMsg(null), 3000);
    onUpdate();
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
    const res = await syncFromCloud(true);
    if (res.success) {
      setStatusMsg({ type: "success", text: "Cloud pull successful" });
      onUpdate();
    } else {
      setStatusMsg({ type: "error", text: res.message || "Sync failed" });
    }
    setIsSyncing(false);
  };

  const handleForcePush = async () => {
    setIsSyncing(true);
    try {
            await syncToCloud(true);
      setStatusMsg({ type: "success", text: "Cloud push successful" });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Push failed" });
    }
    setIsSyncing(false);
  };

  return (
    <div className="pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <SettingsIcon size={24} className="text-slate-400" /> Settings &
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
          <button
            onClick={() => setActiveTab("GENERAL")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === "GENERAL"? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("CHURCHES")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab ==="GENERAL"? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            Church Branches
          </button>
          <button
            onClick={() => setActiveTab("ORGANIZATION")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab ==="GENERAL"? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            Organization Structure
          </button>
          <button
            onClick={() => setActiveTab("THEME")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab ==="GENERAL"? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            Theme Colors
          </button>
          <button
            onClick={() => setActiveTab("PERMISSIONS")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab ==="PERMISSIONS" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            Role Permissions
          </button>
          <button
            onClick={() => setActiveTab("CLOUD")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab ==="GENERAL"? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            Cloud Sync
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("MAINTENANCE")}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "MAINTENANCE" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <Wrench size={16} /> Maintenance
            </button>
          )}

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
                    {localSettings.churches.map((church) => (
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
          {activeTab ==="GENERAL"&& (
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
                {localSettings.churches.map((church, idx) => (
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
          {activeTab ==="GENERAL"&& (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800">
                  Organization Hierarchy
                </h3>
              </div>
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 text-sm">
                <p>
                  Configure your organization structure. Directorates contain
                  Zones, and Zones contain Branches. Each Branch automatically
                  has the following Children's Ministries:{" "}
                  <strong>I, K, LJ, and UJ</strong>.
                </p>
              </div>

              {(() => {
                const org = localSettings.organization || {
                  directorate: "Central Directorate",
                  zones: [],
                };

                const updateOrg = (newOrg: any) => {
                  setLocalSettings({ ...localSettings, organization: newOrg });
                };

                return (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        Directorate Name
                      </label>
                      <input
                        type="text"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        value={org.directorate}
                        onChange={(e) =>
                          updateOrg({ ...org, directorate: e.target.value })
                        }
                        placeholder="e.g. Main CM Directorate"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">Zones</h4>
                        <button
                          onClick={() => {
                            updateOrg({
                              ...org,
                              zones: [
                                ...(org.zones || []),
                                {
                                  id: crypto.randomUUID(),
                                  name: "New Zone",
                                  branches: [],
                                },
                              ],
                            });
                          }}
                          className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          + Add Zone
                        </button>
                      </div>

                      {(org.zones || []).map((zone: any, zIndex: number) => (
                        <div
                          key={zIndex}
                          className="p-4 border border-slate-200 rounded-xl bg-white space-y-4"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                              value={zone.name}
                              onChange={(e) => {
                                const newZones = [...org.zones];
                                newZones[zIndex].name = e.target.value;
                                updateOrg({ ...org, zones: newZones });
                              }}
                              placeholder="Zone Name"
                            />
                            <button
                              onClick={() => {
                                const newZones = org.zones.filter(
                                  (_: any, i: number) => i !== zIndex,
                                );
                                updateOrg({ ...org, zones: newZones });
                              }}
                              className="text-red-500 hover:text-red-700 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                              title="Remove Zone"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>

                          <div className="pl-6 border-l-2 border-indigo-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Branches
                              </label>
                              <button
                                onClick={() => {
                                  const newZones = [...org.zones];
                                  newZones[zIndex].branches = [
                                    ...(newZones[zIndex].branches || []),
                                    {
                                      id: crypto.randomUUID(),
                                      name: "New Branch",
                                      churches: ["I", "K", "LJ", "UJ"],
                                    },
                                  ];
                                  updateOrg({ ...org, zones: newZones });
                                }}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                + Add Branch
                              </button>
                            </div>

                            {(zone.branches || []).map(
                              (branch: any, bIndex: number) => (
                                <div
                                  key={bIndex}
                                  className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      className="flex-1 p-1.5 text-sm bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
                                      value={branch.name}
                                      onChange={(e) => {
                                        const newZones = [...org.zones];
                                        newZones[zIndex].branches[bIndex].name =
                                          e.target.value;
                                        updateOrg({ ...org, zones: newZones });
                                      }}
                                      placeholder="Branch Name"
                                    />
                                    <button
                                      onClick={() => {
                                        const newZones = [...org.zones];
                                        newZones[zIndex].branches = newZones[
                                          zIndex
                                        ].branches.filter(
                                          (_: any, i: number) => i !== bIndex,
                                        );
                                        updateOrg({ ...org, zones: newZones });
                                      }}
                                      className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                                      title="Remove Branch"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    {["I", "K", "LJ", "UJ"].map((church) => (
                                      <span
                                        key={church}
                                        className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded shadow-sm"
                                      >
                                        {church}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ),
                            )}
                            {(!zone.branches || zone.branches.length === 0) && (
                              <p className="text-xs text-slate-400 italic">
                                No branches added to this zone.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}

                      {(!org.zones || org.zones.length === 0) && (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
                          No zones configured. Click "Add Zone" to start
                          building your hierarchy.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* THEME TAB */}
          {activeTab ==="GENERAL"&& (
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
                    {localSettings.churches.map((church) => (
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
          {activeTab ==="GENERAL" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <SettingsIcon size={20} className="text-indigo-600" /> Role Permissions
                </h3>
              </div>
              <p className="text-sm text-slate-500">
                Configure module access for different roles across the system.
              </p>

              <div className="flex gap-4 border-b border-slate-100 pb-4 mb-4">
                <button
                  onClick={() => setPermTab("MATRIX")}
                  className={`px-4 py-2 font-bold text-sm rounded-xl transition-colors ${permTab === "MATRIX" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  Role Access Overview
                </button>
                <button
                  onClick={() => setPermTab("INDIVIDUAL")}
                  className={`px-4 py-2 font-bold text-sm rounded-xl transition-colors ${permTab === "INDIVIDUAL" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  Individual Role Management
                </button>
              </div>

              {permTab === "MATRIX" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3 text-center">Dashboard</th>
                        <th className="px-4 py-3 text-center">People Hub</th>
                        <th className="px-4 py-3 text-center">Attendance</th>
                        <th className="px-4 py-3 text-center">Finances</th>
                        <th className="px-4 py-3 text-center">Outreach</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {["ZONAL_HEAD", "BRANCH_COORDINATOR", "CMD_COORDINATOR", "EXTERNAL", "ADMIN", "SUPER_ADMIN", "TEACHER"].map((role) => {
                        const permissions = localSettings.permissions || {};
                        const rolePerms = permissions[role] || [];
                        const hasPerm = (module: string) => rolePerms.includes(module);
                        
                        const togglePerm = (module: string) => {
                          const newPerms = hasPerm(module) 
                            ? rolePerms.filter(p => p !== module)
                            : [...rolePerms, module];
                          setLocalSettings({
                            ...localSettings,
                            permissions: {
                              ...permissions,
                              [role]: newPerms
                            }
                          });
                        };

                        return (
                          <tr key={role} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 font-bold text-slate-800">{role.replace(/_/g, " ")}</td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={hasPerm("Dashboard")}
                                onChange={() => togglePerm("Dashboard")}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={hasPerm("People Hub")}
                                onChange={() => togglePerm("People Hub")}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={hasPerm("Attendance")}
                                onChange={() => togglePerm("Attendance")}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={hasPerm("Finances")}
                                onChange={() => togglePerm("Finances")}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={hasPerm("Outreach")}
                                onChange={() => togglePerm("Outreach")}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {permTab === "INDIVIDUAL" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Select Role to Manage</label>
                    <select
                      value={selectedRoleForPerms}
                      onChange={(e) => setSelectedRoleForPerms(e.target.value)}
                      className="w-full md:w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {["ZONAL_HEAD", "BRANCH_COORDINATOR", "CMD_COORDINATOR", "EXTERNAL", "ADMIN", "SUPER_ADMIN", "TEACHER"].map(role => (
                        <option key={role} value={role}>{role.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {["Dashboard", "People Hub", "Attendance", "Finances", "Outreach"].map(module => {
                      const permissions = localSettings.permissions || {};
                      const rolePerms = permissions[selectedRoleForPerms] || [];
                      const hasPerm = rolePerms.includes(module);
                      
                      const togglePerm = () => {
                        const newPerms = hasPerm
                          ? rolePerms.filter(p => p !== module)
                          : [...rolePerms, module];
                        setLocalSettings({
                          ...localSettings,
                          permissions: {
                            ...permissions,
                            [selectedRoleForPerms]: newPerms
                          }
                        });
                      };

                      return (
                        <label key={module} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                          <span className="font-bold text-slate-700">{module}</span>
                          <input
                            type="checkbox"
                            checked={hasPerm}
                            onChange={togglePerm}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-6 flex justify-end">
                <button
                  onClick={saveConfig}
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Save size={18} /> Save Permissions
                </button>
              </div>
            </div>
          )}

          {/* CLOUD TAB */}
          {activeTab ==="GENERAL"&& (
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
    </div>
  );
};

export default Settings;
