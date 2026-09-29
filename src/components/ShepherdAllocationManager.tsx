import React, { useState, useMemo, useEffect } from "react";
import { AppData, Member, MemberStatus, Church } from "../types";
import { saveMembers } from "../services/storageService";
import {
  getEligibleShepherdsForChurch,
  autoAllocateChildrenForChurch,
  groupMembersIntoHouseholds,
  areMembersInSameHousehold,
  extractSurname,
  setHookedTeacherId,
  CHURCH_NAMES,
  isStaffOrTeacher,
  isExplicitlySolo,
  isExplicitlyLinkedFamily,
} from "../lib/teacherDivision";
import {
  Users,
  UserCheck,
  ArrowRightLeft,
  Sparkles,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Home,
  Check,
  ChevronDown,
  UserX,
  Phone,
  Layers,
  ArrowRight,
  ArrowLeft,
  Columns,
  Grid,
  Undo2,
  X,
  HeartHandshake,
  Link2,
  RefreshCw,
} from "lucide-react";
import { MemberAvatar } from "./MemberAvatar";

interface ShepherdAllocationManagerProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
  activeBranchId?: string;
}

interface RecentMove {
  childId: string;
  childName: string;
  fromShepherdId: string | null;
  fromShepherdName: string;
  toShepherdId: string | null;
  toShepherdName: string;
  clusterIds: string[];
  count: number;
}

export const ShepherdAllocationManager: React.FC<ShepherdAllocationManagerProps> = ({
  data,
  onUpdate,
  currentUser,
  activeBranchId,
}) => {
  const availableChurches = useMemo(() => {
    return data.settings?.churches || ["UJ", "LJ", "K", "I"];
  }, [data.settings?.churches]);

  const [selectedChurch, setSelectedChurch] = useState<string>(() => {
    return availableChurches[0] || "UJ";
  });

  const [viewMode, setViewMode] = useState<"GRID" | "SIDE_BY_SIDE">("GRID");
  const [branchFilter, setBranchFilter] = useState<string>(activeBranchId || "ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>("");

  // Local working copy of all members
  const [workingMembers, setWorkingMembers] = useState<Member[]>(data.members);

  // Move history for visual transparency & undo
  const [recentMove, setRecentMove] = useState<RecentMove | null>(null);
  const [justMovedChildIds, setJustMovedChildIds] = useState<Set<string>>(new Set());

  // Modal state for moving a child
  const [movingChild, setMovingChild] = useState<Member | null>(null);
  const [moveWithHousehold, setMoveWithHousehold] = useState<boolean>(true);

  // Modal state for deciding family / household relationships
  const [familyManagingChild, setFamilyManagingChild] = useState<Member | null>(null);
  const [linkTargetMemberId, setLinkTargetMemberId] = useState<string>("");
  const [customFamilyNameInput, setCustomFamilyNameInput] = useState<string>("");

  // Side-by-Side Mode Shepherds
  const [leftShepherdId, setLeftShepherdId] = useState<string>("");
  const [rightShepherdId, setRightShepherdId] = useState<string>("");

  useEffect(() => {
    setWorkingMembers(data.members);
  }, [data.members]);

  // Eligible shepherds in the selected church
  const eligibleShepherds = useMemo(() => {
    return getEligibleShepherdsForChurch(selectedChurch, workingMembers, branchFilter);
  }, [selectedChurch, workingMembers, branchFilter]);

  // Default side-by-side shepherds when eligibleShepherds load
  useEffect(() => {
    if (eligibleShepherds.length >= 2) {
      if (!leftShepherdId || !eligibleShepherds.some((s) => s.id === leftShepherdId)) {
        setLeftShepherdId(eligibleShepherds[0].id);
      }
      if (!rightShepherdId || !eligibleShepherds.some((s) => s.id === rightShepherdId)) {
        setRightShepherdId(eligibleShepherds[1].id);
      }
    } else if (eligibleShepherds.length === 1) {
      setLeftShepherdId(eligibleShepherds[0].id);
      setRightShepherdId("");
    }
  }, [eligibleShepherds, leftShepherdId, rightShepherdId]);

  // Pure children in the selected church
  const churchChildren = useMemo(() => {
    return workingMembers.filter((m) => {
      const matchChurch = m.assignedChurch === selectedChurch;
      const matchBranch =
        !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
      return (
        matchChurch &&
        matchBranch &&
        m.status !== MemberStatus.ARCHIVED &&
        m.status !== MemberStatus.TRANSFERRED &&
        !isStaffOrTeacher(m)
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedChurch, workingMembers, branchFilter]);

  // Map of shepherdId -> list of assigned children
  const allocationsMap = useMemo(() => {
    const map = new Map<string, Member[]>();
    eligibleShepherds.forEach((s) => map.set(s.id, []));

    churchChildren.forEach((child) => {
      const shepherdId = child.assignedTeacherId;
      if (shepherdId && map.has(shepherdId)) {
        map.get(shepherdId)!.push(child);
      }
    });

    return map;
  }, [eligibleShepherds, churchChildren]);

  // Unassigned children in the selected church
  const unassignedChildren = useMemo(() => {
    const eligibleIds = new Set(eligibleShepherds.map((s) => s.id));
    return churchChildren.filter(
      (c) => !c.assignedTeacherId || !eligibleIds.has(c.assignedTeacherId)
    );
  }, [churchChildren, eligibleShepherds]);

  // Stats
  const totalChildren = churchChildren.length;
  const totalShepherds = eligibleShepherds.length;
  const targetPerShepherd = totalShepherds > 0 ? Math.ceil(totalChildren / totalShepherds) : 0;

  // Household clusters
  const allHouseholdClusters = useMemo(() => {
    return groupMembersIntoHouseholds(churchChildren);
  }, [churchChildren]);

  const getHouseholdSiblings = (child: Member): Member[] => {
    const cluster = allHouseholdClusters.find((cl) => cl.some((m) => m.id === child.id));
    return cluster ? cluster.filter((m) => m.id !== child.id) : [];
  };

  // Centralized DB Auto-Save & Synchronous React Propagation
  const persistChanges = async (newMembers: Member[]) => {
    setWorkingMembers(newMembers);
    setIsSavingToDb(true);
    try {
      await saveMembers(newMembers);
      onUpdate();
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to auto-save shepherd allocation changes to database:", err);
    } finally {
      setIsSavingToDb(false);
    }
  };

  // Record movement & update working copy with instant DB persistence
  const executeMove = async (
    child: Member,
    newShepherdId: string | null,
    includeHousehold: boolean
  ) => {
    const cluster = includeHousehold
      ? allHouseholdClusters.find((cl) => cl.some((m) => m.id === child.id)) || [child]
      : [child];
    const clusterIds = new Set(cluster.map((m) => m.id));

    const fromShepherdId = child.assignedTeacherId || null;
    const fromShepherd = eligibleShepherds.find((s) => s.id === fromShepherdId);
    const toShepherd = eligibleShepherds.find((s) => s.id === newShepherdId);

    const updated = workingMembers.map((m) => {
      if (clusterIds.has(m.id)) {
        const up = { ...m, assignedTeacherId: newShepherdId || undefined };
        setHookedTeacherId(up, newShepherdId || undefined);
        return up;
      }
      return m;
    });

    // Save recent move for user visibility & undo
    setRecentMove({
      childId: child.id,
      childName: child.name,
      fromShepherdId,
      fromShepherdName: fromShepherd ? fromShepherd.name : "Unassigned Tray",
      toShepherdId: newShepherdId,
      toShepherdName: toShepherd ? toShepherd.name : "Unassigned Tray",
      clusterIds: Array.from(clusterIds),
      count: cluster.length,
    });

    setJustMovedChildIds(clusterIds);
    setMovingChild(null);
    await persistChanges(updated);
  };

  // Undo the most recent move
  const handleUndoRecentMove = async () => {
    if (!recentMove) return;

    const { fromShepherdId, clusterIds } = recentMove;
    const idsSet = new Set(clusterIds);

    const updated = workingMembers.map((m) => {
      if (idsSet.has(m.id)) {
        const up = { ...m, assignedTeacherId: fromShepherdId || undefined };
        setHookedTeacherId(up, fromShepherdId || undefined);
        return up;
      }
      return m;
    });

    setRecentMove(null);
    setJustMovedChildIds(new Set());
    await persistChanges(updated);
  };

  // Move all children from one shepherd to another
  const moveAllChildrenFromShepherd = async (sourceShepherdId: string, targetShepherdId: string | null) => {
    const fromShepherd = eligibleShepherds.find((s) => s.id === sourceShepherdId);
    const toShepherd = eligibleShepherds.find((s) => s.id === targetShepherdId);

    const childrenToMove = (allocationsMap.get(sourceShepherdId) || []);
    const movedIds = new Set(childrenToMove.map((c) => c.id));

    const updated = workingMembers.map((m) => {
      if (m.assignedTeacherId === sourceShepherdId && m.assignedChurch === selectedChurch) {
        const up = { ...m, assignedTeacherId: targetShepherdId || undefined };
        setHookedTeacherId(up, targetShepherdId || undefined);
        return up;
      }
      return m;
    });

    setRecentMove({
      childId: "",
      childName: `All ${childrenToMove.length} children`,
      fromShepherdId: sourceShepherdId,
      fromShepherdName: fromShepherd ? fromShepherd.name : "Shepherd",
      toShepherdId: targetShepherdId,
      toShepherdName: toShepherd ? toShepherd.name : "Unassigned Tray",
      clusterIds: Array.from(movedIds),
      count: childrenToMove.length,
    });

    setJustMovedChildIds(movedIds);
    await persistChanges(updated);
  };

  // User Family Decision: Explicitly separate child from household ("Not a family")
  const handleSeparateFromFamily = async (child: Member) => {
    const soloId = `SOLO-${child.id}`;
    const updated = workingMembers.map((m) =>
      m.id === child.id ? { ...m, householdId: soloId, householdName: undefined } : m
    );
    if (familyManagingChild?.id === child.id) {
      setFamilyManagingChild({ ...child, householdId: soloId, householdName: undefined });
    }
    await persistChanges(updated);
  };

  // User Family Decision: Link child with another child as a family / siblings
  const handleLinkAsFamily = async (childA: Member, targetChildId: string, customName?: string) => {
    if (!targetChildId || childA.id === targetChildId) return;
    const target = workingMembers.find((m) => m.id === targetChildId);
    if (!target) return;

    const sharedId =
      childA.householdId && !childA.householdId.startsWith("SOLO")
        ? childA.householdId
        : target.householdId && !target.householdId.startsWith("SOLO")
        ? target.householdId
        : `FAM-${Date.now()}`;

    const familyName = customName?.trim() || childA.householdName || target.householdName || undefined;

    const updated = workingMembers.map((m) => {
      if (m.id === childA.id || m.id === targetChildId) {
        return { ...m, householdId: sharedId, householdName: familyName };
      }
      return m;
    });
    setLinkTargetMemberId("");
    setCustomFamilyNameInput("");
    if (familyManagingChild?.id === childA.id) {
      setFamilyManagingChild({ ...childA, householdId: sharedId, householdName: familyName });
    }
    await persistChanges(updated);
  };

  // User Family Decision: Reset child back to automatic heuristic detection
  const handleResetFamilyAuto = async (child: Member) => {
    const updated = workingMembers.map((m) =>
      m.id === child.id ? { ...m, householdId: undefined, householdName: undefined } : m
    );
    if (familyManagingChild?.id === child.id) {
      setFamilyManagingChild({ ...child, householdId: undefined, householdName: undefined });
    }
    await persistChanges(updated);
  };

  // Auto-allocate all children evenly while preserving households
  const handleAutoAllocate = async () => {
    if (eligibleShepherds.length === 0 || totalChildren === 0) return;

    const { updatedMembers } = autoAllocateChildrenForChurch(
      selectedChurch,
      workingMembers,
      branchFilter
    );

    setRecentMove({
      childId: "",
      childName: `All ${totalChildren} children`,
      fromShepherdId: null,
      fromShepherdName: "Previous Allocation",
      toShepherdId: null,
      toShepherdName: `Equally Distributed (~${targetPerShepherd} each)`,
      clusterIds: [],
      count: totalChildren,
    });
    await persistChanges(updatedMembers);
  };

  // Distribute unassigned children
  const handleDistributeUnassigned = async () => {
    if (unassignedChildren.length === 0 || eligibleShepherds.length === 0) return;

    const currentMap = new Map<string, number>();
    eligibleShepherds.forEach((s) => {
      currentMap.set(s.id, allocationsMap.get(s.id)?.length || 0);
    });

    const unassignedClusters = groupMembersIntoHouseholds(unassignedChildren);
    unassignedClusters.sort((a, b) => b.length - a.length);

    const childToShepherd = new Map<string, string>();

    unassignedClusters.forEach((cluster) => {
      let minShepherdId = eligibleShepherds[0].id;
      let minCount = currentMap.get(minShepherdId) || 0;

      eligibleShepherds.forEach((s) => {
        const count = currentMap.get(s.id) || 0;
        if (count < minCount) {
          minCount = count;
          minShepherdId = s.id;
        }
      });

      cluster.forEach((child) => {
        childToShepherd.set(child.id, minShepherdId);
      });
      currentMap.set(minShepherdId, minCount + cluster.length);
    });

    const movedIds = new Set(unassignedChildren.map((c) => c.id));
    const updated = workingMembers.map((m) => {
      if (childToShepherd.has(m.id)) {
        const sId = childToShepherd.get(m.id)!;
        setHookedTeacherId(m, sId);
        return { ...m, assignedTeacherId: sId };
      }
      return m;
    });

    setRecentMove({
      childId: "",
      childName: `${unassignedChildren.length} unassigned children`,
      fromShepherdId: null,
      fromShepherdName: "Unassigned Tray",
      toShepherdId: null,
      toShepherdName: "Balanced Shepherds",
      clusterIds: Array.from(movedIds),
      count: unassignedChildren.length,
    });
    setJustMovedChildIds(movedIds);
    await persistChanges(updated);
  };

  const handleClearAllInChurch = async () => {
    if (!window.confirm(`Are you sure you want to unassign all children in ${selectedChurch} Church?`)) {
      return;
    }
    const updated = workingMembers.map((m) => {
      if (m.assignedChurch === selectedChurch && !isStaffOrTeacher(m)) {
        setHookedTeacherId(m, undefined);
        return { ...m, assignedTeacherId: undefined };
      }
      return m;
    });
    await persistChanges(updated);
  };

  const matchesSearch = (member: Member) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(q) ||
      (member.phone && member.phone.includes(q)) ||
      (member.parentPhone && member.parentPhone.includes(q))
    );
  };

  const leftShepherd = eligibleShepherds.find((s) => s.id === leftShepherdId);
  const rightShepherd = eligibleShepherds.find((s) => s.id === rightShepherdId);

  const leftChildren = leftShepherd
    ? (allocationsMap.get(leftShepherd.id) || []).filter(matchesSearch)
    : [];
  const rightChildren = rightShepherd
    ? (allocationsMap.get(rightShepherd.id) || []).filter(matchesSearch)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="text-indigo-600" size={24} />
            Shepherd Allocation Manager
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Organize and transfer children between shepherds with live capacity feedback. Changes auto-save to cloud DB and reflect everywhere.
          </p>
        </div>

        {/* Action Controls & Live Auto-Save Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSavingToDb ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold animate-pulse">
              <RefreshCw size={13} className="animate-spin text-amber-600" />
              <span>Saving to Database...</span>
            </div>
          ) : lastSavedTime || saveSuccess ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold shadow-2xs">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Auto-Saved & Live {lastSavedTime ? `(${lastSavedTime})` : ""}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs font-medium">
              <CheckCircle2 size={13} className="text-slate-400" />
              <span>Cloud DB Synced</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleAutoAllocate}
            disabled={isSavingToDb}
            className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
            title="Automatically distribute all children equally while keeping siblings together"
          >
            <Sparkles size={15} className="text-indigo-600" /> Auto-Allocate & Equalize
          </button>

          <button
            type="button"
            onClick={() => persistChanges(workingMembers)}
            disabled={isSavingToDb}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
            title="Force refresh & sync current allocations with cloud database"
          >
            <RefreshCw size={14} className={isSavingToDb ? "animate-spin text-indigo-600" : "text-slate-500"} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* Church Selector, View Mode Switcher, and Search Filter */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Church tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto hide-scrollbar">
          {availableChurches.map((church) => {
            const count = workingMembers.filter(
              (m) =>
                m.assignedChurch === church &&
                m.status !== MemberStatus.ARCHIVED &&
                m.status !== MemberStatus.TRANSFERRED &&
                !isStaffOrTeacher(m)
            ).length;
            const isSelected = selectedChurch === church;

            return (
              <button
                key={church}
                type="button"
                onClick={() => {
                  setSelectedChurch(church);
                  setSearchQuery("");
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <span>{CHURCH_NAMES[church] || `${church} Church`}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    isSelected
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode("GRID")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "GRID"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Grid size={13} />
              <span>All Shepherds</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("SIDE_BY_SIDE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "SIDE_BY_SIDE"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Columns size={13} />
              <span>Transfer Mode (Side-by-Side)</span>
            </button>
          </div>

          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search names or phones..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Live Recent Movement Banner (Visual Clarity) */}
      {recentMove && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="text-xs text-emerald-950 font-medium truncate">
              <span className="font-extrabold text-emerald-800">{recentMove.childName}</span>
              {" "}moved from{" "}
              <span className="font-bold underline decoration-emerald-300">{recentMove.fromShepherdName}</span>
              {" "}→{" "}
              <span className="font-bold text-emerald-700 underline decoration-emerald-400">{recentMove.toShepherdName}</span>
              {recentMove.count > 1 && (
                <span className="ml-2 font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                  {recentMove.count} family members together
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleUndoRecentMove}
            className="px-3 py-1 bg-white hover:bg-emerald-100/70 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 active:scale-95"
            title="Revert this move"
          >
            <Undo2 size={12} /> Undo
          </button>
        </div>
      )}

      {/* Quota & Balance Overview Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-slate-50 border border-indigo-100/80 rounded-2xl p-4 shadow-2xs">
        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Children
          </span>
          <div className="text-xl font-black text-slate-800">{totalChildren}</div>
          <p className="text-[10px] text-slate-500 font-medium">In {selectedChurch} Church</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Eligible Shepherds
          </span>
          <div className="text-xl font-black text-indigo-700">{totalShepherds}</div>
          <p className="text-[10px] text-slate-500 font-medium">Active pastoral staff</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Target Quota
          </span>
          <div className="text-xl font-black text-purple-700">
            ~{targetPerShepherd} <span className="text-xs font-normal text-slate-500">per shepherd</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Balanced capacity</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Unassigned
          </span>
          <div
            className={`text-xl font-black ${
              unassignedChildren.length > 0 ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {unassignedChildren.length}
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            {unassignedChildren.length === 0 ? "All placed" : "Needs assignment"}
          </p>
        </div>
      </div>

      {/* Unassigned Children Section (if any exist) */}
      {unassignedChildren.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <AlertCircle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-amber-900">
                  Unassigned Children ({unassignedChildren.length})
                </h4>
                <p className="text-xs text-amber-700">
                  These children have not yet been placed with a shepherd in {selectedChurch} Church.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDistributeUnassigned}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-center active:scale-95"
            >
              <Sparkles size={14} /> Distribute Unassigned Evenly
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
            {unassignedChildren.filter(matchesSearch).map((child) => {
              const siblings = getHouseholdSiblings(child);
              const surname = extractSurname(child.name);

              return (
                <div
                  key={child.id}
                  className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {child.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                      {isExplicitlySolo(child) ? (
                        <button
                          type="button"
                          onClick={() => setFamilyManagingChild(child)}
                          className="inline-flex items-center gap-0.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-1 py-0.2 rounded transition-colors"
                          title="User decided: Not a family / Solo. Click to edit."
                        >
                          <UserX size={9} />
                          <span>Solo</span>
                        </button>
                      ) : isExplicitlyLinkedFamily(child) ? (
                        <button
                          type="button"
                          onClick={() => setFamilyManagingChild(child)}
                          className="inline-flex items-center gap-0.5 font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 px-1 py-0.2 rounded transition-colors"
                          title="Custom family link. Click to edit."
                        >
                          <Home size={9} />
                          <span>{child.householdName || "Family"} ({siblings.length + 1})</span>
                        </button>
                      ) : siblings.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setFamilyManagingChild(child)}
                          className="inline-flex items-center gap-0.5 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 hover:bg-indigo-100 px-1 py-0.2 rounded transition-colors cursor-pointer"
                          title="Auto-detected family. Click to decide if family or unlink."
                        >
                          <Home size={9} />
                          <span>{surname || "Household"} ({siblings.length + 1})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFamilyManagingChild(child)}
                          className="text-[9px] text-slate-400 hover:text-indigo-600 font-medium opacity-70 hover:opacity-100"
                          title="Click to link siblings or manage family"
                        >
                          + Link
                        </button>
                      )}
                      {child.parentPhone && (
                        <span className="truncate flex items-center gap-0.5">
                          <Phone size={9} /> {child.parentPhone}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMovingChild(child);
                      setMoveWithHousehold(true);
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>Assign</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 1: SIDE-BY-SIDE DIRECT TRANSFER MODE */}
      {viewMode === "SIDE_BY_SIDE" && eligibleShepherds.length >= 2 && (
        <div className="bg-slate-50/70 border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <ArrowRightLeft className="text-indigo-600" size={18} />
                Direct Transfer Mode (See Moving In Real Time)
              </h4>
              <p className="text-xs text-slate-500">
                Pick a source shepherd and a target shepherd. Click the transfer arrow on any child or household to watch them move across!
              </p>
            </div>

            <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1.5">
              <span>Target Quota: ~{targetPerShepherd} each</span>
            </div>
          </div>

          {/* Two Columns Grid with Transfer Arrows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT SHEPHERD COLUMN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col min-h-[400px]">
              {/* Shepherd Selector Header */}
              <div className="pb-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Shepherd A (Left)</span>
                  <span
                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      (leftChildren.length || 0) > targetPerShepherd + 1
                        ? "bg-amber-100 text-amber-800"
                        : (leftChildren.length || 0) < Math.max(1, targetPerShepherd - 1)
                        ? "bg-blue-100 text-blue-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {leftChildren.length} children
                  </span>
                </div>

                <select
                  value={leftShepherdId}
                  onChange={(e) => setLeftShepherdId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {eligibleShepherds.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === rightShepherdId}>
                      {s.name} ({allocationsMap.get(s.id)?.length || 0} children)
                    </option>
                  ))}
                </select>
              </div>

              {/* Children List */}
              <div className="flex-1 py-3 space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {leftChildren.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">
                    No children assigned to this shepherd
                  </div>
                ) : (
                  leftChildren.map((child) => {
                    const siblings = getHouseholdSiblings(child);
                    const isJustMoved = justMovedChildIds.has(child.id);

                    return (
                      <div
                        key={child.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isJustMoved
                            ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
                            : "bg-slate-50/80 hover:bg-slate-100 border-slate-200/80"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="truncate">{child.name}</span>
                            {child.gender && (
                              <span
                                className={`text-[9px] font-bold px-1 rounded ${
                                  child.gender === "MALE"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-pink-100 text-pink-700"
                                }`}
                              >
                                {child.gender.charAt(0)}
                              </span>
                            )}
                            {isJustMoved && (
                              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                                Just Moved
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {isExplicitlySolo(child) ? (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-slate-500 font-bold inline-flex items-center gap-1 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                                title="Explicitly marked as single / not in a family. Click to change."
                              >
                                <UserX size={10} className="text-slate-400" />
                                <span>Solo (Not Family)</span>
                              </button>
                            ) : isExplicitlyLinkedFamily(child) ? (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-purple-700 font-bold inline-flex items-center gap-1 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 transition-colors"
                                title="Custom linked family. Click to edit."
                              >
                                <Home size={10} />
                                <span>{child.householdName || "Custom Family"} ({siblings.length + 1})</span>
                              </button>
                            ) : siblings.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-indigo-600 font-bold inline-flex items-center gap-1 hover:text-indigo-800 hover:underline cursor-pointer"
                                title="Auto-grouped. Click to decide if they are actually a family or separate them."
                              >
                                <Home size={10} />
                                <span>Household ({siblings.length + 1})</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium inline-flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                title="Click to link siblings or manage family"
                              >
                                <span>+ Link Family</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Move Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {siblings.length > 0 && (
                            <button
                              type="button"
                              onClick={() => executeMove(child, rightShepherdId, true)}
                              disabled={!rightShepherdId}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                              title={`Move whole household (${siblings.length + 1} children) to ${rightShepherd?.name}`}
                            >
                              <span>Family</span>
                              <ArrowRight size={11} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => executeMove(child, rightShepherdId, false)}
                            disabled={!rightShepherdId}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                            title={`Move to ${rightShepherd?.name}`}
                          >
                            <span>Move</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT SHEPHERD COLUMN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col min-h-[400px]">
              {/* Shepherd Selector Header */}
              <div className="pb-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Shepherd B (Right)</span>
                  <span
                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      (rightChildren.length || 0) > targetPerShepherd + 1
                        ? "bg-amber-100 text-amber-800"
                        : (rightChildren.length || 0) < Math.max(1, targetPerShepherd - 1)
                        ? "bg-blue-100 text-blue-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {rightChildren.length} children
                  </span>
                </div>

                <select
                  value={rightShepherdId}
                  onChange={(e) => setRightShepherdId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {eligibleShepherds.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === leftShepherdId}>
                      {s.name} ({allocationsMap.get(s.id)?.length || 0} children)
                    </option>
                  ))}
                </select>
              </div>

              {/* Children List */}
              <div className="flex-1 py-3 space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {rightChildren.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">
                    No children assigned to this shepherd
                  </div>
                ) : (
                  rightChildren.map((child) => {
                    const siblings = getHouseholdSiblings(child);
                    const isJustMoved = justMovedChildIds.has(child.id);

                    return (
                      <div
                        key={child.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isJustMoved
                            ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
                            : "bg-slate-50/80 hover:bg-slate-100 border-slate-200/80"
                        }`}
                      >
                        {/* Move Back to Left Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => executeMove(child, leftShepherdId, false)}
                            disabled={!leftShepherdId}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                            title={`Move to ${leftShepherd?.name}`}
                          >
                            <ArrowLeft size={12} />
                            <span>Move</span>
                          </button>

                          {siblings.length > 0 && (
                            <button
                              type="button"
                              onClick={() => executeMove(child, leftShepherdId, true)}
                              disabled={!leftShepherdId}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                              title={`Move whole household (${siblings.length + 1} children) to ${leftShepherd?.name}`}
                            >
                              <ArrowLeft size={11} />
                              <span>Family</span>
                            </button>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 text-right">
                          <div className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1.5">
                            {isJustMoved && (
                              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                                Just Moved
                              </span>
                            )}
                            <span className="truncate">{child.name}</span>
                            {child.gender && (
                              <span
                                className={`text-[9px] font-bold px-1 rounded ${
                                  child.gender === "MALE"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-pink-100 text-pink-700"
                                }`}
                              >
                                {child.gender.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 flex-wrap mt-0.5">
                            {isExplicitlySolo(child) ? (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-slate-500 font-bold inline-flex items-center gap-1 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                                title="Explicitly marked as single / not in a family. Click to change."
                              >
                                <span>Solo (Not Family)</span>
                                <UserX size={10} className="text-slate-400" />
                              </button>
                            ) : isExplicitlyLinkedFamily(child) ? (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-purple-700 font-bold inline-flex items-center gap-1 hover:text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 transition-colors"
                                title="Custom linked family. Click to edit."
                              >
                                <span>{child.householdName || "Custom Family"} ({siblings.length + 1})</span>
                                <Home size={10} />
                              </button>
                            ) : siblings.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-indigo-600 font-bold inline-flex items-center gap-1 hover:text-indigo-800 hover:underline cursor-pointer"
                                title="Auto-grouped. Click to decide if they are actually a family or separate them."
                              >
                                <span>Household ({siblings.length + 1})</span>
                                <Home size={10} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setFamilyManagingChild(child)}
                                className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium inline-flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                title="Click to link siblings or manage family"
                              >
                                <span>+ Link Family</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: GRID OVERVIEW OF ALL SHEPHERDS */}
      {viewMode === "GRID" && (
        <>
          {eligibleShepherds.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <UserX size={36} className="text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700">No Shepherds Available</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are no active eligible shepherds assigned to {selectedChurch} Church. Add or assign shepherds in People Hub.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {eligibleShepherds.map((shepherd) => {
                const assignedChildren = (allocationsMap.get(shepherd.id) || []).filter(
                  matchesSearch
                );
                const totalCount = allocationsMap.get(shepherd.id)?.length || 0;

                const isOver = totalCount > targetPerShepherd + 1;
                const isUnder = totalCount < Math.max(1, targetPerShepherd - 1);
                const isBalanced = !isOver && !isUnder;

                const badgeBg = isBalanced
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isOver
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200";

                return (
                  <div
                    key={shepherd.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                  >
                    {/* Shepherd Header */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <MemberAvatar member={shepherd} size="sm" className="shrink-0" />
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-800 truncate">
                            {shepherd.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                              Shepherd
                            </span>
                            {shepherd.branchId && (
                              <span className="text-[10px] text-slate-400 font-medium truncate">
                                {shepherd.branchId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border flex items-center gap-1 shadow-2xs ${badgeBg}`}
                          title={`Capacity: ${totalCount} of ~${targetPerShepherd}`}
                        >
                          <Users size={12} />
                          <span>{totalCount}</span>
                        </span>

                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            if (val === "UNASSIGN_ALL") {
                              moveAllChildrenFromShepherd(shepherd.id, null);
                            } else if (val.startsWith("MOVE_ALL_TO:")) {
                              const targetId = val.replace("MOVE_ALL_TO:", "");
                              moveAllChildrenFromShepherd(shepherd.id, targetId);
                            }
                          }}
                          className="text-xs bg-white border border-slate-200 text-slate-500 rounded-lg p-1 hover:border-slate-300 focus:outline-none cursor-pointer"
                          title="Bulk Shepherd Actions"
                        >
                          <option value="">Bulk...</option>
                          {eligibleShepherds
                            .filter((s) => s.id !== shepherd.id)
                            .map((other) => (
                              <option key={other.id} value={`MOVE_ALL_TO:${other.id}`}>
                                Move all to {other.name}
                              </option>
                            ))}
                          <option value="UNASSIGN_ALL">Unassign all</option>
                        </select>
                      </div>
                    </div>

                    {/* Children List */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2 max-h-80 overflow-y-auto">
                      {assignedChildren.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 font-medium">
                          No children assigned
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {assignedChildren.map((child) => {
                            const siblings = getHouseholdSiblings(child);
                            const surname = extractSurname(child.name);
                            const siblingsWithSameShepherd = siblings.filter(
                              (sib) => sib.assignedTeacherId === shepherd.id
                            );
                            const isJustMoved = justMovedChildIds.has(child.id);

                            return (
                              <div
                                key={child.id}
                                className={`p-2 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                                  isJustMoved
                                    ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
                                    : "bg-slate-50/90 hover:bg-slate-100 border-slate-200/60"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                    <span className="truncate">{child.name}</span>
                                    {child.gender && (
                                      <span
                                        className={`text-[9px] font-bold px-1 rounded ${
                                          child.gender === "MALE"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-pink-100 text-pink-700"
                                        }`}
                                      >
                                        {child.gender.charAt(0)}
                                      </span>
                                    )}
                                    {isJustMoved && (
                                      <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                                        Moved
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                    {isExplicitlySolo(child) ? (
                                      <button
                                        type="button"
                                        onClick={() => setFamilyManagingChild(child)}
                                        className="inline-flex items-center gap-0.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-1 py-0.2 rounded transition-colors"
                                        title="User decided: Not a family / Solo. Click to edit."
                                      >
                                        <UserX size={9} />
                                        <span>Solo</span>
                                      </button>
                                    ) : isExplicitlyLinkedFamily(child) ? (
                                      <button
                                        type="button"
                                        onClick={() => setFamilyManagingChild(child)}
                                        className="inline-flex items-center gap-0.5 font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 px-1 py-0.2 rounded transition-colors"
                                        title="Custom family link. Click to edit."
                                      >
                                        <Home size={9} />
                                        <span>{child.householdName || "Family"} ({siblings.length + 1})</span>
                                      </button>
                                    ) : siblingsWithSameShepherd.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setFamilyManagingChild(child)}
                                        className="inline-flex items-center gap-0.5 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 hover:bg-indigo-100 px-1 py-0.2 rounded transition-colors cursor-pointer"
                                        title="Auto-detected family. Click to decide if family or unlink."
                                      >
                                        <Home size={9} />
                                        <span>
                                          {surname || "Household"} ({siblingsWithSameShepherd.length + 1})
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setFamilyManagingChild(child)}
                                        className="text-[9px] text-slate-400 hover:text-indigo-600 font-medium opacity-60 hover:opacity-100"
                                        title="Click to link siblings or manage family"
                                      >
                                        + Link Family
                                      </button>
                                    )}
                                    {child.parentPhone && (
                                      <span className="truncate text-slate-400 flex items-center gap-0.5">
                                        <Phone size={9} /> {child.parentPhone}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Reassign / Move Button opening designated modal */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMovingChild(child);
                                    setMoveWithHousehold(true);
                                  }}
                                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 active:scale-95"
                                  title="Transfer to another shepherd"
                                >
                                  <span>Transfer</span>
                                  <ArrowRightLeft size={11} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Shepherd Footer */}
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium flex items-center justify-between">
                      <span>Count: {totalCount} / ~{targetPerShepherd}</span>
                      <span
                        className={`font-bold ${
                          isBalanced
                            ? "text-emerald-600"
                            : isOver
                            ? "text-amber-600"
                            : "text-blue-600"
                        }`}
                      >
                        {isBalanced ? "Balanced" : isOver ? "Over Quota" : "Under Quota"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DEDICATED MOVE / REASSIGN DIALOG (MAKES TRANSFER CRYSTAL CLEAR) */}
      {movingChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Transfer Child to Shepherd
                  </h4>
                  <p className="text-xs text-slate-500">
                    Choose a new shepherd for <span className="font-bold text-slate-800">{movingChild.name}</span>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMovingChild(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Allocation & Household info */}
            {(() => {
              const currentShepherd = eligibleShepherds.find((s) => s.id === movingChild.assignedTeacherId);
              const siblings = getHouseholdSiblings(movingChild);
              const surname = extractSurname(movingChild.name);

              return (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Currently With</span>
                      <span className="font-extrabold text-slate-800">
                        {currentShepherd ? currentShepherd.name : "Unassigned Tray"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Church Department</span>
                      <span className="font-extrabold text-indigo-700">{selectedChurch} Church</span>
                    </div>
                  </div>

                  {siblings.length > 0 && (
                    <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={moveWithHousehold}
                          onChange={(e) => setMoveWithHousehold(e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="text-xs">
                          <span className="font-extrabold text-purple-900 block">
                            Keep Household Together ({siblings.length + 1} children)
                          </span>
                          <span className="text-purple-700 text-[11px]">
                            Move {movingChild.name} and {siblings.map((s) => s.name).join(", ")} together to the selected shepherd.
                          </span>
                        </div>
                      </label>

                      <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-purple-700 font-medium">Not actually in this family?</span>
                        <button
                          type="button"
                          onClick={() => {
                            handleSeparateFromFamily(movingChild);
                            setMoveWithHousehold(false);
                          }}
                          className="text-[11px] font-extrabold text-red-600 hover:text-red-700 bg-white border border-red-200 hover:border-red-300 px-2 py-0.5 rounded-lg shadow-2xs transition-colors"
                        >
                          Separate {movingChild.name} (Not Family)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Destination Shepherds List */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Select Destination Shepherd:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {eligibleShepherds
                  .filter((s) => s.id !== movingChild.assignedTeacherId)
                  .map((shepherd) => {
                    const currentCount = allocationsMap.get(shepherd.id)?.length || 0;
                    const increment = moveWithHousehold ? getHouseholdSiblings(movingChild).length + 1 : 1;
                    const newCount = currentCount + increment;

                    return (
                      <button
                        key={shepherd.id}
                        type="button"
                        onClick={() => executeMove(movingChild, shepherd.id, moveWithHousehold)}
                        className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition-all flex items-center justify-between gap-2 group active:scale-98"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <MemberAvatar member={shepherd} size="sm" className="shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-slate-800 group-hover:text-indigo-900 truncate block">
                              {shepherd.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Current: {currentCount} children
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-black text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {newCount} (+{increment})
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {movingChild.assignedTeacherId && (
                <button
                  type="button"
                  onClick={() => executeMove(movingChild, null, moveWithHousehold)}
                  className="px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
                >
                  Move to Unassigned
                </button>
              )}

              <button
                type="button"
                onClick={() => setMovingChild(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors ml-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED FAMILY & HOUSEHOLD DECISION MODAL */}
      {familyManagingChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Home size={20} />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Decide Family &amp; Household
                  </h4>
                  <p className="text-xs text-slate-500">
                    Control whether <span className="font-bold text-slate-800">{familyManagingChild.name}</span> belongs to a family or is independent
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFamilyManagingChild(null);
                  setLinkTargetMemberId("");
                  setCustomFamilyNameInput("");
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Child Information & Current Grouping */}
            {(() => {
              const currentChildInWorking = workingMembers.find((m) => m.id === familyManagingChild.id) || familyManagingChild;
              const siblings = getHouseholdSiblings(currentChildInWorking);
              const surname = extractSurname(currentChildInWorking.name);
              const isSolo = isExplicitlySolo(currentChildInWorking);
              const isLinked = isExplicitlyLinkedFamily(currentChildInWorking);

              return (
                <div className="space-y-4">
                  {/* Status Card */}
                  <div
                    className={`p-4 rounded-2xl border ${
                      isSolo
                        ? "bg-slate-50 border-slate-200"
                        : isLinked
                        ? "bg-purple-50/70 border-purple-200"
                        : siblings.length > 0
                        ? "bg-indigo-50/70 border-indigo-200"
                        : "bg-slate-50/80 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={currentChildInWorking} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            {currentChildInWorking.name}
                          </span>
                          {currentChildInWorking.assignedChurch && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                              {currentChildInWorking.assignedChurch}
                            </span>
                          )}
                        </div>

                        <div className="text-xs mt-1">
                          {isSolo ? (
                            <span className="text-slate-600 font-bold flex items-center gap-1.5">
                              <UserX size={13} className="text-slate-400" />
                              Decided as: Independent (Not in any family)
                            </span>
                          ) : isLinked ? (
                            <span className="text-purple-700 font-bold flex items-center gap-1.5">
                              <Home size={13} />
                              Custom Linked Family: {currentChildInWorking.householdName || "Siblings"} ({siblings.length + 1} children)
                            </span>
                          ) : siblings.length > 0 ? (
                            <span className="text-indigo-700 font-bold flex items-center gap-1.5">
                              <Home size={13} />
                              Auto-grouped by surname &ldquo;{surname}&rdquo; ({siblings.length + 1} children)
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">
                              Single Child (No siblings currently linked)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sibling members list if grouped */}
                    {siblings.length > 0 && !isSolo && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Grouped With ({siblings.length} sibling{siblings.length > 1 ? "s" : ""}):
                        </span>
                        <div className="space-y-1">
                          {siblings.map((sib) => {
                            const sibShepherd = eligibleShepherds.find((s) => s.id === sib.assignedTeacherId);
                            return (
                              <div
                                key={sib.id}
                                className="bg-white/90 p-2 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-slate-800 truncate">{sib.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    (Shepherd: {sibShepherd ? sibShepherd.name : "Unassigned"})
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSeparateFromFamily(sib)}
                                  className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded transition-colors shrink-0"
                                  title={`Separate ${sib.name} into their own individual record`}
                                >
                                  Separate
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACTION 1: NOT A FAMILY (SEPARATE) */}
                  {!isSolo && siblings.length > 0 && (
                    <div className="p-3.5 bg-red-50/60 border border-red-200/80 rounded-2xl space-y-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                          <UserX size={15} />
                        </div>
                        <div className="text-xs">
                          <span className="font-extrabold text-red-950 block">Not Actually a Family?</span>
                          <p className="text-red-700 text-[11px] mt-0.5">
                            If {currentChildInWorking.name} and the others just happen to share the surname &ldquo;{surname}&rdquo; or phone number but are not family, click below to mark as independent.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSeparateFromFamily(currentChildInWorking)}
                        className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-98"
                      >
                        <UserX size={14} />
                        <span>Separate {currentChildInWorking.name} (Not a Family)</span>
                      </button>
                    </div>
                  )}

                  {/* ACTION 2: LINK SIBLING / FAMILY (CUSTOM FAMILY) */}
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                        <HeartHandshake size={15} />
                      </div>
                      <div className="text-xs">
                        <span className="font-extrabold text-indigo-950 block">Link Sibling / Family Member</span>
                        <p className="text-indigo-700 text-[11px] mt-0.5">
                          Connect {currentChildInWorking.name} with any sibling or family member in {selectedChurch} Church (even with different surnames).
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <select
                        value={linkTargetMemberId}
                        onChange={(e) => setLinkTargetMemberId(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose child to link with {currentChildInWorking.name} --</option>
                        {churchChildren
                          .filter((c) => c.id !== currentChildInWorking.id)
                          .map((c) => {
                            const cShepherd = eligibleShepherds.find((s) => s.id === c.assignedTeacherId);
                            return (
                              <option key={c.id} value={c.id}>
                                {c.name} {cShepherd ? `(Shepherd: ${cShepherd.name})` : "(Unassigned)"}
                              </option>
                            );
                          })}
                      </select>

                      <input
                        type="text"
                        placeholder="Optional Family Name (e.g. Asante-Mensah Household)"
                        value={customFamilyNameInput}
                        onChange={(e) => setCustomFamilyNameInput(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          handleLinkAsFamily(
                            currentChildInWorking,
                            linkTargetMemberId,
                            customFamilyNameInput
                          )
                        }
                        disabled={!linkTargetMemberId}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
                      >
                        <Home size={14} />
                        <span>Link as Family</span>
                      </button>
                    </div>
                  </div>

                  {/* ACTION 3: RESET TO AUTO-DETECT */}
                  {(isSolo || isLinked) && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700 block">Manual Decision Active</span>
                        <span className="text-[11px] text-slate-400">
                          Revert {currentChildInWorking.name} to automatic surname and phone detection
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetFamilyAuto(currentChildInWorking)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
                      >
                        <RotateCcw size={12} />
                        <span>Reset to Auto</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Done Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Click <strong>Save Allocations</strong> when done to keep changes permanent.
              </span>
              <button
                type="button"
                onClick={() => {
                  setFamilyManagingChild(null);
                  setLinkTargetMemberId("");
                  setCustomFamilyNameInput("");
                }}
                className="px-5 py-2 text-xs font-extrabold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Reset & Link Information */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-slate-400" />
          <span>
            Allocations automatically feed into <strong>Attendance</strong>, <strong>Directory</strong>, and <strong>Report Export</strong>.
          </span>
        </div>

        <button
          type="button"
          onClick={handleClearAllInChurch}
          className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
        >
          Reset All in {selectedChurch} Church
        </button>
      </div>
    </div>
  );
};
