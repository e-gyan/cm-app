import React, { useState, useEffect, useMemo } from "react";
import {
  AppData,
  Member,
  MemberType,
  MemberStatus,
  Church,
  ServiceType,
} from "../types";
import { getSundaysInYear } from "../constants";
import {
  Search,
  Save,
  Check,
  Trophy,
  X,
  Calendar,
  UserPlus,
  Crown,
  CheckCircle2,
  Sun,
  Zap,
  Filter,
  Info,
} from "lucide-react";
import { motion } from "motion/react";
import {
  addMember,
  saveAttendance,
  syncFromCloud,
  syncToCloud,
  getAppData,
  updateMember,
} from "../services/storageService";
import { sanitizeInput, determineGenderByName } from "../services/securityService";

interface AttendanceTakerProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({
  data,
  onUpdate,
  activeChurch,
  currentUser,
}) => {
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );
  const availableChurches = data.settings.churches;

  // State
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [punctualIds, setPunctualIds] = useState<Set<string>>(new Set());

  // New State for Service Logic
  const [serviceMap, setServiceMap] = useState<Record<string, ServiceType>>({});
  const [currentService, setCurrentService] = useState<ServiceType>(
    () => (sessionStorage.getItem("attendance_service") as any) || "JOY",
  );
  const [specialEventName, setSpecialEventName] = useState("");
  const [showEventModal, setShowEventModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>(
    () => (sessionStorage.getItem("attendance_filterType") as string) || "All",
  );

  // Internal Church Filter for Admins when activeChurch is 'CM'
  const [internalChurchFilter, setInternalChurchFilter] = useState<
    Church | "COMBINED"
  >(
    () =>
      (sessionStorage.getItem("attendance_churchFilter") as any) || "COMBINED",
  );

  const [newMemberName, setNewMemberName] = useState("");
  const [isSubmittingVisitor, setIsSubmittingVisitor] = useState(false);
  const [isAddingFNF, setIsAddingFNF] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<
    "2_WEEKS" | "MONTH" | "QUARTER" | "ALL_TIME" | "CM"
  >("MONTH");
  const [successMsg, setSuccessMsg] = useState("");

  const [attendanceMode, setAttendanceMode] = useState<"MEMBERS" | "STAFF">(
    () => (sessionStorage.getItem("attendance_mode") as any) || "MEMBERS",
  );

  // Persist State
  useEffect(() => {
    sessionStorage.setItem("attendance_filterType", filterType);
  }, [filterType]);
  useEffect(() => {
    sessionStorage.setItem("attendance_mode", attendanceMode);
  }, [attendanceMode]);
  useEffect(() => {
    sessionStorage.setItem("attendance_churchFilter", internalChurchFilter);
  }, [internalChurchFilter]);
  useEffect(() => {
    sessionStorage.setItem("attendance_service", currentService);
  }, [currentService]);

  // Determine the effective church context
  const effectiveChurch =
    activeChurch === "CM" ? internalChurchFilter : activeChurch;
  const isCombinedView = effectiveChurch === "COMBINED";

  const isPunctualityEnabledForChurch = 
    effectiveChurch === "UJ" 
      ? data.settings.features?.[effectiveChurch]?.punctuality ?? false
      : false;

  const enablePunctuality =
    effectiveChurch === "UJ" && (
      (attendanceMode === "MEMBERS" && isPunctualityEnabledForChurch) ||
      attendanceMode === "STAFF"
    );
  const currentYear = new Date().getFullYear();
  const sundaysCurrentYear = useMemo(
    () => getSundaysInYear(currentYear),
    [currentYear],
  );

  // Helper to determine which branches are relevant based on mode and filter
  const getRelevantBranches = (
    churchFilter: Church | "COMBINED",
    mode: "MEMBERS" | "STAFF",
  ): Church[] => {
    if (churchFilter !== "COMBINED") return [churchFilter];
    return [...availableChurches, "CM", "All"];
  };

  useEffect(() => {
    setPresentIds(new Set());
    setPunctualIds(new Set());
    setServiceMap({});

    if (sundaysCurrentYear.length > 0) {
      if (!selectedDate) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const currentSunday = new Date(today);
        currentSunday.setDate(today.getDate() - dayOfWeek);
        const currentSundayStr = currentSunday.toISOString().split("T")[0];
        const exists = sundaysCurrentYear.some(
          (d) => d.toISOString().split("T")[0] === currentSundayStr,
        );

        if (exists) setSelectedDate(currentSundayStr);
        else setSelectedDate(sundaysCurrentYear[0].toISOString().split("T")[0]);
      }
    }
  }, [sundaysCurrentYear]);

  const getDraftKey = () =>
    `attendance_draft_${effectiveChurch}_${attendanceMode}_${selectedDate}`;

  const saveDraft = (
    present: Set<string>,
    punctual: Set<string>,
    sMap: Record<string, ServiceType>,
  ) => {
    if (!selectedDate) return;
    sessionStorage.setItem(
      getDraftKey(),
      JSON.stringify({
        presentIds: Array.from(present),
        punctualIds: Array.from(punctual),
        serviceMap: sMap,
        timestamp: Date.now(),
      }),
    );
  };

  const clearDraft = () => {
    if (!selectedDate) return;
    sessionStorage.removeItem(getDraftKey());
  };

  // Load attendance data when context changes
  useEffect(() => {
    if (selectedDate) {
      const branchesToLoad = getRelevantBranches(
        effectiveChurch,
        attendanceMode,
      );

      const combinedPresent = new Set<string>();
      const combinedPunctual = new Set<string>();
      const combinedServices: Record<string, ServiceType> = {};
      let loadedEventName = "";

      const globalEventRecord = data.attendance.find(
        (r) => r.date === selectedDate && !!r.eventName,
      );
      if (globalEventRecord) {
        loadedEventName = globalEventRecord.eventName!;
      }

      branchesToLoad.forEach((churchId) => {
        const record = data.attendance.find(
          (r) => r.date === selectedDate && r.churchId === churchId,
        );
        if (record) {
          if (record.eventName) loadedEventName = record.eventName;

          const targetIds = record.presentMemberIds.filter((id) => {
            const m = data.members.find((mem) => mem.id === id);
            if (!m) return false;
            const isStaff = ["Teacher", "Helper", "Volunteer"].includes(m.type);
            return attendanceMode === "STAFF" ? isStaff : !isStaff;
          });

          const targetPunctual = (record.punctualMemberIds || []).filter(
            (id) => {
              const m = data.members.find((mem) => mem.id === id);
              if (!m) return false;
              const isStaff = ["Teacher", "Helper", "Volunteer"].includes(
                m.type,
              );
              return attendanceMode === "STAFF" ? isStaff : !isStaff;
            },
          );

          targetIds.forEach((id) => {
            combinedPresent.add(id);
            // Load existing service assignment if available
            if (record.serviceMap && record.serviceMap[id]) {
              combinedServices[id] = record.serviceMap[id];
            }
          });
          targetPunctual.forEach((id) => combinedPunctual.add(id));
        }
      });

      let loadedFromDraft = false;
      try {
        const key = `attendance_draft_${effectiveChurch}_${attendanceMode}_${selectedDate}`;
        const draftData = sessionStorage.getItem(key);
        if (draftData) {
          const parsed = JSON.parse(draftData);
          setPresentIds(new Set(parsed.presentIds));
          setPunctualIds(new Set(parsed.punctualIds));
          setServiceMap(parsed.serviceMap);
          setSpecialEventName(loadedEventName);
          loadedFromDraft = true;
        }
      } catch (e) {
        console.error("Failed to parse attendance draft", e);
      }

      if (!loadedFromDraft) {
        setPresentIds(combinedPresent);
        setPunctualIds(combinedPunctual);
        setServiceMap(combinedServices);
        setSpecialEventName(loadedEventName);
      }
    }
  }, [
    selectedDate,
    data.attendance,
    effectiveChurch,
    attendanceMode,
    data.members,
  ]);

  // Auto-refresh listener triggered by real-time sync
  useEffect(() => {
    const handleDataUpdated = async () => {
      // Re-fetch latest data explicitly
      await syncFromCloud();
      onUpdate();

      // We do not want stale drafts to override incoming cloud data updates.
      // So if a remote update happens, we clear the draft.
      // This will allow the main attendance loader useEffect to re-run and
      // pull in the genuine fresh remote state without seeing a local draft.
      if (selectedDate) {
        sessionStorage.removeItem(
          `attendance_draft_${effectiveChurch}_${attendanceMode}_${selectedDate}`,
        );
      }
    };

    window.addEventListener("dataUpdated", handleDataUpdated);
    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdated);
    };
  }, [selectedDate, effectiveChurch, attendanceMode, onUpdate]);

  // --- TOGGLE LOGIC ---
  const handleToggle = (id: string) => {
    const newPresent = new Set(presentIds);
    const newServiceMap = { ...serviceMap };
    let nextPunctual = punctualIds;

    // If not currently present, mark present with CURRENT selected service
    if (!newPresent.has(id)) {
      newPresent.add(id);
      newServiceMap[id] = currentService;
    } else {
      // If already present...
      const assignedService = newServiceMap[id];

      // If assigned service matches current selection, toggle OFF (absent)
      if (assignedService === currentService) {
        newPresent.delete(id);
        delete newServiceMap[id];

        // Remove from punctual if they become absent
        if (punctualIds.has(id)) {
          const newPunctual = new Set(punctualIds);
          newPunctual.delete(id);
          setPunctualIds(newPunctual);
          nextPunctual = newPunctual;
        }
      } else {
        // If assigned service DIFFERENT from current selection, SWITCH service
        // e.g. Was 'JOY', now clicking while 'ENLARGEMENT' is active -> Switch to 'ENLARGEMENT'
        newServiceMap[id] = currentService;
      }
    }

    setPresentIds(newPresent);
    setServiceMap(newServiceMap);
    saveDraft(newPresent, nextPunctual, newServiceMap);
  };

  const handlePunctualToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!enablePunctuality) return;
    const newPunctual = new Set(punctualIds);
    let nextPresent = presentIds;
    let nextServiceMap = serviceMap;

    // Determine the service of the target member (or default to current selected service)
    const targetService = serviceMap[id] || currentService;

    if (newPunctual.has(id)) {
      newPunctual.delete(id);
    } else {
      if (!isCombinedView) {
        // Count existing punctual stars for THIS specific service
        let currentServiceCount = 0;
        newPunctual.forEach((pid) => {
          const s = serviceMap[pid] || "JOY"; // Fallback to joy if legacy
          if (s === targetService) currentServiceCount++;
        });

        if (currentServiceCount >= 3) {
          // alert(`Maximum 3 punctual stars allowed for ${targetService} Service.`);
          return; // Silently block or use UI feedback
        }
      }

      newPunctual.add(id);

      // If they weren't present, add them to attendance under current service
      if (!presentIds.has(id)) {
        const newPresent = new Set(presentIds);
        newPresent.add(id);
        setPresentIds(newPresent);
        nextPresent = newPresent;

        const newServices = { ...serviceMap, [id]: currentService };
        setServiceMap(newServices);
        nextServiceMap = newServices;
      }
    }
    setPunctualIds(newPunctual);
    saveDraft(nextPresent, newPunctual, nextServiceMap);
  };

  const handleSave = async () => {
    if (!selectedDate) return;

    const hasSpecialMembers = Object.values(serviceMap).includes("SPECIAL");
    if (
      (currentService === "SPECIAL" || hasSpecialMembers) &&
      !specialEventName
    ) {
      setShowEventModal(true);
      return;
    }

    confirmSave();
  };

  const confirmSave = async (
    overridePresentIds?: Set<string>,
    overrideServiceMap?: Record<string, ServiceType>,
  ) => {
    const activePresentIds = overridePresentIds || presentIds;
    const activeServiceMap = overrideServiceMap || serviceMap;

    // Notify saving started if desired, but user wants it swift, so we just calculate and save directly.
    const branchesToSave = getRelevantBranches(effectiveChurch, attendanceMode);
    let hasActualChanges = false;
    const allMembers = getAppData().members;

    branchesToSave.forEach((churchId) => {
      const existingRecord = data.attendance.find(
        (r) => r.date === selectedDate && r.churchId === churchId,
      );

      const currentBranchPresentIds: string[] = [...activePresentIds].filter((id) => {
        const m = allMembers.find((mem) => mem.id === id);
        if (!m) return false;
        if (isCombinedView) return m.assignedChurch === churchId;
        return churchId === effectiveChurch;
      });

      const currentBranchPunctualIds: string[] = [...punctualIds].filter(
        (id) => {
          const m = allMembers.find((mem) => mem.id === id);
          if (!m) return false;
          if (isCombinedView) return m.assignedChurch === churchId;
          return churchId === effectiveChurch;
        },
      );

      let finalPresent: string[] = [];
      let finalPunctual: string[] = [];
      // Ensure initial map is strictly typed
      let finalServiceMap: Record<string, ServiceType> =
        existingRecord?.serviceMap ? { ...existingRecord.serviceMap } : {};

      if (existingRecord) {
        if (attendanceMode === "STAFF") {
          const existingMembers = existingRecord.presentMemberIds.filter(
            (id) => {
              const m = allMembers.find((mem) => mem.id === id);
              return m && !["Teacher", "Helper", "Volunteer"].includes(m.type);
            },
          );
          const existingMembersPunctual = (
            existingRecord.punctualMemberIds || []
          ).filter((id: string) => {
            const m = allMembers.find((mem) => mem.id === id);
            return m && !["Teacher", "Helper", "Volunteer"].includes(m.type);
          });
          finalPresent = [...existingMembers, ...currentBranchPresentIds];
          finalPunctual = [
            ...existingMembersPunctual,
            ...currentBranchPunctualIds,
          ];
        } else {
          const existingStaff = existingRecord.presentMemberIds.filter((id) => {
            const m = allMembers.find((mem) => mem.id === id);
            return m && ["Teacher", "Helper", "Volunteer"].includes(m.type);
          });
          const existingStaffPunctual = (
            existingRecord.punctualMemberIds || []
          ).filter((id: string) => {
            const m = allMembers.find((mem) => mem.id === id);
            return m && ["Teacher", "Helper", "Volunteer"].includes(m.type);
          });
          finalPresent = [...existingStaff, ...currentBranchPresentIds];
          finalPunctual = [
            ...existingStaffPunctual,
            ...currentBranchPunctualIds,
          ];
        }
      } else {
        finalPresent = currentBranchPresentIds;
        finalPunctual = currentBranchPunctualIds;
      }

      // Update Service Map Logic:
      // We only update the map for people currently being saved in this context.
      finalPresent.forEach((id: string) => {
        if (activeServiceMap[id]) {
          finalServiceMap[id] = activeServiceMap[id];
        }
      });

      // Clean up map entries for people who are NOT in the final present list at all
      const cleanServiceMap: Record<string, ServiceType> = {};
      const keys = Object.keys(finalServiceMap);
      keys.forEach((key) => {
        if (finalPresent.includes(key)) {
          cleanServiceMap[key] = finalServiceMap[key];
        }
      });
      finalServiceMap = cleanServiceMap;

      // Determine changes
      const oldPresent = existingRecord
        ? existingRecord.presentMemberIds.sort().join(",")
        : "";
      const newPresent = finalPresent.sort().join(",");
      const oldPunctual = existingRecord
        ? (existingRecord.punctualMemberIds || []).sort().join(",")
        : "";
      const newPunctual = finalPunctual.sort().join(",");
      const oldMapStr = JSON.stringify(existingRecord?.serviceMap || {});
      const newMapStr = JSON.stringify(finalServiceMap);
      const oldEventName = existingRecord?.eventName || "";
      const hasSpecialInFinal =
        Object.values(finalServiceMap).includes("SPECIAL");
      const newEventName =
        hasSpecialInFinal && specialEventName ? specialEventName : oldEventName;

      if (
        oldPresent !== newPresent ||
        oldPunctual !== newPunctual ||
        oldMapStr !== newMapStr ||
        oldEventName !== newEventName
      ) {
        hasActualChanges = true;
        saveAttendance(
          selectedDate,
          churchId,
          finalPresent,
          finalPunctual,
          finalServiceMap,
          newEventName,
        );
      }
    });

    setSuccessMsg(hasActualChanges ? `Changes saved` : `No changes saved`);
    setShowEventModal(false);
    clearDraft();
    onUpdate();
    setTimeout(() => setSuccessMsg(""), 2000);

    // Explicitly push to cloud in background without blocking UI
    if (hasActualChanges) {
      syncToCloud(true);
    }
  };

  const handleAddFNF = async () => {
    if (!newMemberName.trim() || isSubmittingVisitor) return;
    setIsSubmittingVisitor(true);
    try {
      const cleanName = sanitizeInput(newMemberName);
      
      // Copy teacher's/currentUser's branch, zone, and church details
      const targetChurch = currentUser?.assignedChurch || (isCombinedView ? "UJ" : (effectiveChurch as Church));
      const targetBranchId = currentUser?.branchId;
      const targetZoneId = currentUser?.zoneId;
      const determinedGender = determineGenderByName(cleanName);

      // Set initial status to NOT_ACTIVE for VISITOR
      const newMember = await addMember(
        cleanName,
        MemberType.VISITOR,
        targetChurch,
        "",
        MemberStatus.NOT_ACTIVE,
      );

      // Update with extra automatic fields and save
      const updatedMember: Member = {
        ...newMember,
        gender: determinedGender,
        branchId: targetBranchId || newMember.branchId,
        zoneId: targetZoneId || newMember.zoneId,
      };
      await updateMember(updatedMember);

      const newSet = new Set(presentIds);
      newSet.add(newMember.id);
      setPresentIds(newSet);

      // Add to current service map
      const newSMap = { ...serviceMap, [newMember.id]: currentService };
      setServiceMap(newSMap);

      saveDraft(newSet, punctualIds, newSMap);

      setNewMemberName("");
      setIsAddingFNF(false);
      await confirmSave(newSet, newSMap);
    } finally {
      setIsSubmittingVisitor(false);
    }
  };

  // --- LIST GENERATION ---
  let membersToList: Member[] = [];
  const targetChurches = getRelevantBranches(effectiveChurch, attendanceMode);

  if (attendanceMode === "STAFF") {
    membersToList = data.members.filter(
      (m) =>
        [MemberStatus.ACTIVE, MemberStatus.INCONSISTENT].includes(m.status) &&
        targetChurches.includes(m.assignedChurch) &&
        ["Teacher", "Helper", "Volunteer"].includes(m.type),
    );
  } else {
    membersToList = data.members.filter(
      (m) =>
        [MemberStatus.ACTIVE, MemberStatus.NOT_ACTIVE, MemberStatus.INCONSISTENT].includes(m.status) &&
        targetChurches.includes(m.assignedChurch) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type),
    );
  }

  const filteredMembers = membersToList.filter((m) => {
    const matchesSearch = m.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "All" || m.type === filterType;

    // --- SPECIAL LOGIC: HIDE JOY ATTENDEES IN ENLARGEMENT VIEW ---
    if (attendanceMode === "MEMBERS" && currentService === "ENLARGEMENT") {
      // If the member is already marked as 'JOY' in the current map, hide them.
      if (serviceMap[m.id] === "JOY") {
        return false;
      }
    }

    return matchesSearch && matchesType;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (isCombinedView && a.assignedChurch !== b.assignedChurch) {
      return a.assignedChurch.localeCompare(b.assignedChurch);
    }
    if (a.transferPendingDate && !b.transferPendingDate) return -1;
    if (!a.transferPendingDate && b.transferPendingDate) return 1;

    // We no longer sort by present/punctual status dynamically to prevent the
    // UI from jumping around and losing scroll position while taking attendance.
    return a.name.localeCompare(b.name);
  });

  // Calculate hidden count to show user
  const hiddenJoyCount =
    attendanceMode === "MEMBERS" && currentService === "ENLARGEMENT"
      ? membersToList.filter((m) => serviceMap[m.id] === "JOY").length
      : 0;

  // Total present in state (including hidden)
  const totalSavedInState = presentIds.size;

  // Total punctual for current service
  const punctualForCurrentService = [...punctualIds].filter(
    (pid) => (serviceMap[pid] || "JOY") === currentService,
  ).length;

  // Leaderboard Calc
  const leaderboardData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let relevantRecords = data.attendance.filter((r) => {
      const rDate = new Date(r.date);

      let isTimeMatch = false;
      if (
        leaderboardTimeframe === "ALL_TIME" ||
        leaderboardTimeframe === "CM"
      ) {
        isTimeMatch = true;
      } else if (leaderboardTimeframe === "2_WEEKS") {
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        isTimeMatch =
          rDate.getTime() >= twoWeeksAgo.getTime() &&
          rDate.getTime() <= now.getTime();
      } else if (leaderboardTimeframe === "MONTH") {
        isTimeMatch =
          rDate.getMonth() === currentMonth &&
          rDate.getFullYear() === currentYear;
      } else if (leaderboardTimeframe === "QUARTER") {
        const currentQuarter = Math.floor(currentMonth / 3);
        const rQuarter = Math.floor(rDate.getMonth() / 3);
        isTimeMatch =
          rQuarter === currentQuarter && rDate.getFullYear() === currentYear;
      }

      const isChurchMatch = isCombinedView
        ? true
        : r.churchId === effectiveChurch;
      return isChurchMatch && isTimeMatch;
    });

    const scores: Record<string, number> = {};
    relevantRecords.forEach((r) => {
      r.punctualMemberIds?.forEach((id) => {
        const m = data.members.find((mem) => mem.id === id);
        if (m) {
          const isStaff = ["Teacher", "Helper", "Volunteer"].includes(m.type);
          if (
            (attendanceMode === "STAFF" && isStaff) ||
            (attendanceMode === "MEMBERS" && !isStaff)
          ) {
            scores[id] = (scores[id] || 0) + 1;
          }
        }
      });
    });

    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, score], index) => ({
        rank: index + 1,
        id,
        name: data.members.find((mem) => mem.id === id)?.name || "Unknown",
        count: score,
      }));
  }, [
    data.attendance,
    effectiveChurch,
    attendanceMode,
    leaderboardTimeframe,
    data.members,
    isCombinedView,
  ]);

  const churchOptions = useMemo(() => {
    const base = [...availableChurches];
    if (attendanceMode === "STAFF") return ["All", "CM", ...base];
    return base;
  }, [attendanceMode, availableChurches]);

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] md:h-[calc(100vh-140px)] relative overflow-hidden">
      {/* 1. TOP BAR */}
      <div className="shrink-0 space-y-3 z-20 pb-2">
        {/* SERVICE TOGGLE (Visible only in Member Mode for UJ, I, K, LJ) */}
        {attendanceMode === "MEMBERS" &&
          (effectiveChurch !== "CM" || isCombinedView) && (
            <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 mb-1 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setCurrentService("JOY")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${currentService === "JOY" ? "bg-amber-100 text-amber-700 shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
              >
                <Sun
                  size={18}
                  fill={currentService === "JOY" ? "currentColor" : "none"}
                />{" "}
                Joy Service
              </button>
              <button
                onClick={() => setCurrentService("ENLARGEMENT")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${currentService === "ENLARGEMENT" ? "bg-sky-100 text-sky-700 shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
              >
                <Zap
                  size={18}
                  fill={
                    currentService === "ENLARGEMENT" ? "currentColor" : "none"
                  }
                />{" "}
                Enlargement
              </button>
              <button
                onClick={() => setCurrentService("SPECIAL")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${currentService === "SPECIAL" ? "bg-purple-100 text-purple-700 shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
              >
                <Crown
                  size={18}
                  fill={currentService === "SPECIAL" ? "currentColor" : "none"}
                />{" "}
                Special
              </button>
            </div>
          )}

        {/* Row 1: Main Controls */}
        <div className="bg-white rounded-3xl p-3 md:p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex gap-2 w-full items-center">
            {activeChurch === "CM" && (
              <div className="relative w-28 md:w-48 shrink-0">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-indigo-600">
                  <Crown size={16} />
                </div>
                <select
                  value={internalChurchFilter}
                  onChange={(e) =>
                    setInternalChurchFilter(
                      e.target.value as Church | "COMBINED",
                    )
                  }
                  className="w-full bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs md:text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block pl-8 p-3 appearance-none cursor-pointer"
                >
                  <option value="COMBINED">View Combined</option>
                  {churchOptions.map((church) => (
                    <option key={church} value={church}>
                      {church}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Calendar size={16} />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs md:text-sm font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block w-full pl-9 p-3 appearance-none cursor-pointer"
              />
            </div>

            {enablePunctuality && (
              <div
                className="flex items-center gap-1.5 px-3 py-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shrink-0 font-bold text-sm"
                title="Punctual for current service"
              >
                <Trophy size={16} className="text-amber-500" />
                <span>{punctualForCurrentService}</span>
                <span className="hidden sm:inline text-xs font-medium text-amber-600">
                  Punctual
                </span>
              </div>
            )}

            <button
              onClick={handleSave}
              className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 shrink-0"
            >
              <Save size={18} />
              <span className="hidden sm:inline">Save</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono">
                {totalSavedInState}
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
              <button
                onClick={() => {
                  setAttendanceMode("MEMBERS");
                  setFilterType("All");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${attendanceMode === "MEMBERS" ? "bg-white shadow-sm text-indigo-700" : "text-slate-500"}`}
              >
                Members
              </button>
              <button
                onClick={() => {
                  setAttendanceMode("STAFF");
                  setFilterType("All");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${attendanceMode === "STAFF" ? "bg-white shadow-sm text-purple-700" : "text-slate-500"}`}
              >
                Teachers
              </button>
            </div>
            {enablePunctuality && (
              <button
                onClick={() => setShowLeaderboard(true)}
                className="p-3 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors border border-amber-100"
                title="Leaderboard"
              >
                <Trophy size={20} />
              </button>
            )}
            {attendanceMode === "MEMBERS" && (
              <button
                onClick={() => setIsAddingFNF(!isAddingFNF)}
                className="p-3 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100"
                title="Add Visitor"
              >
                <UserPlus size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search & Filters */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl md:rounded-3xl p-2 shadow-sm border border-slate-100">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                className="w-full pl-9 pr-4 py-2 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400"
                placeholder={`Search ${filteredMembers.length} names...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 px-1 hide-scrollbar items-center">
              <div className="md:hidden flex items-center gap-1 pr-2 border-r border-slate-200 mr-1 shrink-0">
                {enablePunctuality && (
                  <button
                    onClick={() => setShowLeaderboard(true)}
                    className="p-1.5 text-amber-600 bg-amber-50 rounded-lg border border-amber-100"
                  >
                    <Trophy size={18} />
                  </button>
                )}
                {attendanceMode === "MEMBERS" && (
                  <button
                    onClick={() => setIsAddingFNF(!isAddingFNF)}
                    className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg border border-indigo-100"
                  >
                    <UserPlus size={18} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setFilterType("All")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filterType === "All" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                All
              </button>
              {(attendanceMode === "STAFF"
                ? [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER]
                : [
                    MemberType.MEMBER,
                    MemberType.FNF,
                    MemberType.VISITOR,
                  ]
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterType === type ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                >
                  {type}
                </button>
              ))}

              <div className="md:hidden flex items-center gap-1 border-l pl-2 ml-1">
                <button
                  onClick={() => {
                    setAttendanceMode(
                      attendanceMode === "MEMBERS" ? "STAFF" : "MEMBERS",
                    );
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded border ${attendanceMode === "STAFF" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-white text-slate-500"}`}
                >
                  {attendanceMode === "MEMBERS" ? "Teachers?" : "Mems?"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {hiddenJoyCount > 0 && (
        <div className="mx-2 mb-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
            <Filter size={14} />
            <span>Hiding {hiddenJoyCount} members present for Joy Service</span>
          </div>
          <button
            onClick={() => setCurrentService("JOY")}
            className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-amber-200 text-amber-600 hover:bg-amber-100"
          >
            View Joy List
          </button>
        </div>
      )}

      {isAddingFNF && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 relative border border-slate-100">
            <button
              onClick={() => setIsAddingFNF(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              title="Close"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <UserPlus className="text-indigo-600" size={22} />
              Add New Visitor
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new visitor to the directory and mark them present for this Sunday ({formatDateDDMMYYYY(selectedDate)}).
            </p>
            
            <input
              type="text"
              placeholder="Visitor's Full Name"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-700 bg-slate-50 placeholder:text-slate-400"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddFNF()}
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingFNF(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFNF}
                disabled={!newMemberName.trim() || isSubmittingVisitor}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-100"
              >
                {isSubmittingVisitor ? "Adding..." : "Add & Mark Present"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN GRID */}
      <div className="flex-1 overflow-y-auto pr-1 pb-4 md:pb-10">
        {isCombinedView && filteredMembers.length > 0 && (
          <div className="mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
            Viewing All Churches ({filteredMembers.length})
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {sortedMembers.map((member) => {
            const isPresent = presentIds.has(member.id);
            const isPunctual = punctualIds.has(member.id);
            const assignedService = serviceMap[member.id];
            const isGraduating = !!member.transferPendingDate;

            // Card Styling based on Service Type
            let cardStyle =
              "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md";
            let textStyle = "text-slate-800";
            let iconStyle = "bg-slate-100 text-slate-300";

            if (isPresent) {
              if (assignedService === "JOY") {
                cardStyle =
                  "bg-amber-50 border-amber-300 shadow-md shadow-amber-100 transform scale-[1.01]";
                textStyle = "text-amber-900";
                iconStyle = "bg-white text-amber-500 border border-amber-200";
              } else if (assignedService === "ENLARGEMENT") {
                cardStyle =
                  "bg-sky-50 border-sky-300 shadow-md shadow-sky-100 transform scale-[1.01]";
                textStyle = "text-sky-900";
                iconStyle = "bg-white text-sky-500 border border-sky-200";
              } else {
                // Fallback for generic present or staff
                cardStyle =
                  "bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200 transform scale-[1.01]";
                textStyle = "text-white";
                iconStyle = "bg-white text-indigo-600";
              }
            }

            return (
              <div
                key={member.id}
                onClick={() => handleToggle(member.id)}
                className={`
                                relative p-4 rounded-2xl cursor-pointer transition-all duration-200 select-none group border
                                ${cardStyle}
                            `}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4
                      className={`font-bold text-lg leading-tight ${textStyle}`}
                    >
                      {member.name}
                    </h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <p
                        className={`text-xs font-medium uppercase tracking-wider ${isPresent ? "opacity-80" : "text-slate-400"}`}
                      >
                        {member.type}
                      </p>
                      {(isCombinedView || effectiveChurch === "CM") && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isPresent ? "bg-white/30" : "bg-slate-100 text-slate-500"}`}
                        >
                          {member.assignedChurch}
                        </span>
                      )}
                    </div>

                    {/* Service Badge if Present */}
                    {isPresent && assignedService && (
                      <div
                        className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${assignedService === "JOY" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-sky-100 text-sky-700 border-sky-200"}`}
                      >
                        {assignedService === "JOY" ? (
                          <Sun size={10} />
                        ) : (
                          <Zap size={10} />
                        )}
                        {assignedService}
                      </div>
                    )}
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${iconStyle}`}
                  >
                    <Check size={14} strokeWidth={4} />
                  </div>
                </div>

                {/* Actions / Badges */}
                <div className="mt-4 flex items-center gap-2">
                  {enablePunctuality && (
                    <button
                      onClick={(e) => handlePunctualToggle(e, member.id)}
                      disabled={
                        !isPunctual &&
                        !isCombinedView &&
                        // Calculate current count for this service
                        [...punctualIds].filter(
                          (pid) =>
                            (serviceMap[pid] || "JOY") ===
                            (assignedService || currentService),
                        ).length >= 3
                      }
                      className={`p-1.5 rounded-lg transition-all ${
                        isPunctual
                          ? "bg-amber-400 text-white shadow-sm"
                          : isPresent
                            ? "bg-black/10 hover:bg-black/20 text-current disabled:opacity-30 disabled:cursor-not-allowed"
                            : "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      }`}
                    >
                      <motion.div
                        animate={
                          isPunctual ? { scale: [1, 1.4, 1] } : { scale: 1 }
                        }
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <Trophy
                          size={16}
                          fill={isPunctual ? "currentColor" : "none"}
                        />
                      </motion.div>
                    </button>
                  )}
                  {isGraduating && (
                    <div
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${isPresent ? "bg-white/20" : "bg-blue-50 text-blue-600"}`}
                    >
                      MOVING UP
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
          {successMsg === "No changes saved" ? (
            <Info size={24} className="text-blue-400" />
          ) : (
            <CheckCircle2 size={24} className="text-green-400" />
          )}
          <span className="font-bold text-sm md:text-base">{successMsg}</span>
        </div>
      )}

      {/* Event Name Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              Name this Special Event
            </h3>
            <input
              type="text"
              placeholder="e.g., Easter Service, Convention"
              value={specialEventName}
              onChange={(e) => setSpecialEventName(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-700"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowEventModal(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmSave()}
                disabled={!specialEventName.trim()}
                className="flex-1 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-center">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Crown size={24} /> {effectiveChurch} Leaderboard
                </h3>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="relative z-10 text-amber-100 text-sm mt-1">
                Celebrating our most punctual stars!
              </p>
              <div className="absolute -bottom-10 -right-10 text-white/10 rotate-12">
                <Trophy size={140} />
              </div>
            </div>

            <div className="p-2 flex gap-2 bg-slate-50 border-b border-slate-100 overflow-x-auto hide-scrollbar">
              {(() => {
                const options = isAdmin
                  ? [
                      { v: "2_WEEKS", l: "2 Weeks" },
                      { v: "MONTH", l: "This Month" },
                      { v: "QUARTER", l: "Quarter" },
                      { v: "ALL_TIME", l: "All Time" },
                    ]
                  : [
                      { v: "MONTH", l: "This Month" },
                      { v: "ALL_TIME", l: "All Time" },
                    ];

                return options.map(({ v, l }) => {
                  const isActive =
                    leaderboardTimeframe === v ||
                    (v === "ALL_TIME" && leaderboardTimeframe === "CM");
                  return (
                    <button
                      key={v}
                      onClick={() => setLeaderboardTimeframe(v as any)}
                      className={`flex-1 shrink-0 px-3 py-2 text-xs font-bold rounded-xl transition-all ${isActive ? "bg-white shadow-sm text-amber-600" : "text-slate-400 hover:bg-white border border-transparent hover:border-slate-200"}`}
                    >
                      {l}
                    </button>
                  );
                });
              })()}
            </div>

            <div className="overflow-y-auto p-4 space-y-3 flex-1">
              {leaderboardData.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p>No data yet.</p>
                </div>
              ) : (
                leaderboardData.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? "bg-yellow-100 text-yellow-700" : idx === 1 ? "bg-slate-200 text-slate-700" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"}`}
                    >
                      #{item.rank}
                    </div>
                    <div className="flex-1 font-bold text-slate-800">
                      {item.name}
                    </div>
                    <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold text-xs">
                      {item.count}x
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTaker;
