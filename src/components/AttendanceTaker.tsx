import React, { useState, useEffect, useMemo } from "react";
import {
  AppData,
  Member,
  MemberType,
  MemberStatus,
  Church,
  ServiceType,
  isFnfMember,
  isVisitorMember,
  isFnfCombined,
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
  Users,
  UserCheck,
  UserX,
  Loader2,
  Undo2,
  AlertCircle,
  Plus,
  ClipboardPaste,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import {
  addMember,
  addMembers,
  saveAttendance,
  loadData,
  updateMember,
  flushPendingWrites,
} from "../services/storageService";
import { sanitizeInput, determineGenderByName } from "../services/securityService";
import { matchesScope, getScopeDisplayLabel, isStaffOrTeacher } from "../lib/teacherDivision";
import { MemberAvatar } from "./MemberAvatar";
import {
  isSunday,
  isWednesday,
  getNextSunday,
  getActiveSunday,
  getActiveWednesday,
} from "../lib/dateUtils";

interface AttendanceTakerProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
  activeBranchId?: string;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

const CHURCH_DISPLAY_NAMES: Record<string, string> = {
  UJ: "UJ",
  LJ: "LJ",
  K: "K",
  I: "I",

  CM: "Children Ministry",
  All: "All Churches",
};

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({
  data,
  onUpdate,
  activeChurch,
  currentUser,
  activeBranchId,
}) => {
  const isLeadership = [
    "ADMIN",
    "SUPER_ADMIN",
    "ZONAL_HEAD",
    "BRANCH_COORDINATOR",
    "DIRECTORATE_HEAD",
  ].includes(currentUser.role || "");
  const isAdmin = isLeadership;
  const availableChurches = Array.isArray(data.settings?.churches) ? data.settings?.churches : ["UJ", "LJ", "K", "I", "N"];

  // State
  const [selectedDate, setSelectedDate] = useState<string>(
    () => sessionStorage.getItem("attendance_selectedDate") || "",
  );
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [punctualIds, setPunctualIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // New State for Service Logic
  const [serviceMap, setServiceMap] = useState<any>({});
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

  const [newMemberNames, setNewMemberNames] = useState<string[]>([""]);
  const [firstTimerEntries, setFirstTimerEntries] = useState<
    {
      name: string;
      gender: "MALE" | "FEMALE";
      parentPhone: string;
      address: string;
      roleType: MemberType.VISITOR | MemberType.FNF;
    }[]
  >([
    {
      name: "",
      gender: "MALE",
      parentPhone: "",
      address: "",
      roleType: MemberType.VISITOR,
    },
  ]);
  const [isSubmittingVisitor, setIsSubmittingVisitor] = useState(false);
  const [isAddingFNF, setIsAddingFNF] = useState(false);

  // Smart Paste Attendance Pop Feature State
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);
  const [smartPasteRawText, setSmartPasteRawText] = useState("");
  const [smartPasteStep, setSmartPasteStep] = useState<"INPUT" | "REVIEW">("INPUT");
  const [smartPasteItems, setSmartPasteItems] = useState<
    {
      id: string;
      rawLine: string;
      status: "EXACT" | "CONFUSION" | "FIRST_TIMER" | "SKIP";
      selectedMemberId?: string;
      candidates: Member[];
      firstTimerName: string;
      firstTimerGender: "MALE" | "FEMALE";
      firstTimerPhone: string;
      firstTimerLocation: string;
    }[]
  >([]);
  const [isRecordingSmartPaste, setIsRecordingSmartPaste] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<
    "2_WEEKS" | "MONTH" | "QUARTER" | "ALL_TIME" | "CM"
  >("MONTH");
  const [successMsg, setSuccessMsg] = useState("");

  // Bulk Check-in State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  const [attendanceMode, setAttendanceMode] = useState<"MEMBERS" | "STAFF">(
    () => (sessionStorage.getItem("attendance_mode") as any) || "MEMBERS",
  );
  const [selectedShepherdFilter, setSelectedShepherdFilter] = useState<string>("ALL");

  // Persist State
  useEffect(() => {
    if (selectedDate) {
      sessionStorage.setItem("attendance_selectedDate", selectedDate);
    }
  }, [selectedDate]);
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
  const canFilterChurch =
    activeChurch === "CM" ||
    activeChurch === "All" ||
    isLeadership ||
    currentUser.role === "BRANCH_COORDINATOR";

  const effectiveChurch = canFilterChurch ? internalChurchFilter : activeChurch;
  const isCombinedView = effectiveChurch === "COMBINED";

  const [fnfTargetChurch, setFnfTargetChurch] = useState<Church>(() => {
    if (effectiveChurch && availableChurches.includes(effectiveChurch as Church)) {
      return effectiveChurch as Church;
    }
    if (currentUser?.assignedChurch && availableChurches.includes(currentUser.assignedChurch as Church)) {
      return currentUser.assignedChurch as Church;
    }
    return "UJ";
  });

  useEffect(() => {
    if (effectiveChurch && availableChurches.includes(effectiveChurch as Church)) {
      setFnfTargetChurch(effectiveChurch as Church);
    }
  }, [effectiveChurch, availableChurches]);

  const getDayNumber = (dateStr: string): number => {
    if (!dateStr) return -1;
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3) return -1;
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  };

  const dayOfWeek = useMemo(() => getDayNumber(selectedDate), [selectedDate]);
  const isWednesdayDate = dayOfWeek === 3;
  const isSundayDate = dayOfWeek === 0;
  const isDynamicSpecialDate = Boolean(selectedDate && !isWednesdayDate && !isSundayDate);

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

  const isWednesdayCell = isWednesdayDate;

  const targetSundayForCell = useMemo(
    () => (selectedDate && isWednesdayDate ? getNextSunday(selectedDate) : ""),
    [selectedDate, isWednesdayDate],
  );

  // Helper to determine which branches are relevant based on mode and filter
  const getRelevantBranches = (
    churchFilter: Church | "COMBINED",
    mode: "MEMBERS" | "STAFF",
  ): Church[] => {
    if (churchFilter !== "COMBINED") {
      if (mode === "STAFF") {
        return Array.from(new Set([churchFilter, "CM", "All"] as Church[]));
      }
      return [churchFilter];
    }
    return [...availableChurches, "CM", "All"];
  };

  useEffect(() => {
    setPresentIds(new Set());
    setPunctualIds(new Set());
    setServiceMap({});

    if (sundaysCurrentYear.length > 0) {
      if (!selectedDate) {
        const savedDate = sessionStorage.getItem("attendance_selectedDate");
        if (savedDate) {
          setSelectedDate(savedDate);
        } else {
          const today = new Date();
          const isTodayWed = today.getDay() === 3;
          if (isTodayWed) {
            setSelectedDate(getActiveWednesday(today));
            setCurrentService("CELL");
            setAttendanceMode("STAFF");
          } else {
            const currentSundayStr = getActiveSunday(today);
            const exists = sundaysCurrentYear.some(
              (d) => d.toISOString().split("T")[0] === currentSundayStr,
            );

            if (exists) setSelectedDate(currentSundayStr);
            else setSelectedDate(sundaysCurrentYear[0].toISOString().split("T")[0]);
            setCurrentService("JOY");
          }
        }
      }
    }
  }, [sundaysCurrentYear]);

  // Synchronize service selection and mode when date changes
  useEffect(() => {
    if (!selectedDate) return;
    const day = getDayNumber(selectedDate);
    if (day === 3) {
      // Wednesdays are for LC live only and is mainly for shepherds
      if (currentService !== "CELL") setCurrentService("CELL");
      setAttendanceMode("STAFF");
    } else if (day === 0) {
      // Sundays are for our 3 services: Joy, enlargement or special type
      if (currentService === "CELL") setCurrentService("JOY");
    } else {
      // Dynamic and flexible special service for all other days
      if (currentService !== "SPECIAL") setCurrentService("SPECIAL");
    }
  }, [selectedDate]);

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
            const isStaff = isStaffOrTeacher(m);
            return attendanceMode === "STAFF" ? isStaff : !isStaff;
          });

          const targetPunctual = (record.punctualMemberIds || []).filter(
            (id) => {
              const m = data.members.find((mem) => mem.id === id);
              if (!m) return false;
              const isStaff = isStaffOrTeacher(m);
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
      let serviceMapToScan = {};

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
          serviceMapToScan = parsed.serviceMap || {};
        }
      } catch (e) {
        console.error("Failed to parse attendance draft", e);
      }

      if (!loadedFromDraft) {
        setPresentIds(combinedPresent);
        setPunctualIds(combinedPunctual);
        setServiceMap(combinedServices);
        setSpecialEventName(loadedEventName);
        serviceMapToScan = combinedServices;
      }

      let joyCount = 0;
      let engCount = 0;
      let specialCount = 0;
      Object.values(serviceMapToScan).forEach((s) => {
        if (s === "JOY") joyCount++;
        else if (s === "ENLARGEMENT") engCount++;
        else if (s === "SPECIAL") specialCount++;
      });

      let autoService = null;
      if (engCount > 0 && joyCount === 0) autoService = "ENLARGEMENT";
      else if (specialCount > 0 && joyCount === 0 && engCount === 0) autoService = "SPECIAL";
      else if (joyCount > 0) autoService = "JOY";

      if (autoService) {
        setCurrentService(autoService);
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
      await Promise.resolve();
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
    if (isBulkMode) {
      const newBulk = new Set(bulkSelectedIds);
      if (newBulk.has(id)) {
        newBulk.delete(id);
      } else {
        newBulk.add(id);
      }
      setBulkSelectedIds(newBulk);
      return;
    }

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

  const handleBulkCheckIn = () => {
    if (bulkSelectedIds.size === 0) return;
    const newPresent = new Set(presentIds);
    const newServiceMap = { ...serviceMap };

    bulkSelectedIds.forEach(id => {
      newPresent.add(id);
      newServiceMap[id] = currentService;
    });

    setPresentIds(newPresent);
    setServiceMap(newServiceMap);
    saveDraft(newPresent, punctualIds, newServiceMap);

    setBulkSelectedIds(new Set());
    setIsBulkMode(false);
  };

  const handleSave = async () => {
    if (!selectedDate || isSaving) return;

    const day = getDayNumber(selectedDate);
    const isOtherDay = day !== 0 && day !== 3;
    const hasSpecialMembers = Object.values(serviceMap).includes("SPECIAL");
    const isSpecialType = currentService === "SPECIAL" || hasSpecialMembers || isOtherDay;

    if (isSpecialType) {
      // Check if an existing event name was already provided for this date by any user
      const existingWithName = data.attendance.find(
        (r) => r.date === selectedDate && !!r.eventName?.trim()
      );
      const existingName =
        existingWithName?.eventName?.trim() || specialEventName?.trim();

      if (existingName) {
        if (!specialEventName) {
          setSpecialEventName(existingName);
        }
        await confirmSave();
        return;
      }

      // If no name has been provided yet by any user, prompt user:
      setShowEventModal(true);
      return;
    }

    await confirmSave();
  };

  const confirmSave = async (
    overridePresentIds?: Set<string>,
    overrideServiceMap?: Record<string, ServiceType>,
    additionalMembers?: Member[],
  ) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const activePresentIds = overridePresentIds || presentIds;
      const activeServiceMap = overrideServiceMap || serviceMap;

      const branchesToSave = getRelevantBranches(effectiveChurch, attendanceMode);
      let hasActualChanges = false;
      const allMembers = additionalMembers && additionalMembers.length > 0
        ? [...data.members, ...additionalMembers]
        : data.members;
      const recordsToSave: any[] = [];

      branchesToSave.forEach((churchId) => {
        const existingRecord = data.attendance.find(
          (r) => r.date === selectedDate && r.churchId === churchId,
        );

        const currentBranchPresentIds: string[] = [...activePresentIds].filter((id) => {
          const m = allMembers.find((mem) => mem.id === id);
          if (!m) return false;
          if (isCombinedView) {
            if (m.assignedChurch === churchId) return true;
            if ((!m.assignedChurch || !availableChurches.includes(m.assignedChurch as Church)) && (churchId === "CM" || churchId === "All")) return true;
            return false;
          }
          return churchId === effectiveChurch;
        });

        const currentBranchPunctualIds: string[] = [...punctualIds].filter(
          (id) => {
            const m = allMembers.find((mem) => mem.id === id);
            if (!m) return false;
            if (isCombinedView) {
              if (m.assignedChurch === churchId) return true;
              if ((!m.assignedChurch || !availableChurches.includes(m.assignedChurch as Church)) && (churchId === "CM" || churchId === "All")) return true;
              return false;
            }
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
                return m && !isStaffOrTeacher(m);
              },
            );
            const existingMembersPunctual = (
              existingRecord.punctualMemberIds || []
            ).filter((id: string) => {
              const m = allMembers.find((mem) => mem.id === id);
              return m && !isStaffOrTeacher(m);
            });
            finalPresent = [...existingMembers, ...currentBranchPresentIds];
            finalPunctual = [
              ...existingMembersPunctual,
              ...currentBranchPunctualIds,
            ];
          } else {
            const existingStaff = existingRecord.presentMemberIds.filter((id) => {
              const m = allMembers.find((mem) => mem.id === id);
              return m && isStaffOrTeacher(m);
            });
            const existingStaffPunctual = (
              existingRecord.punctualMemberIds || []
            ).filter((id: string) => {
              const m = allMembers.find((mem) => mem.id === id);
              return m && isStaffOrTeacher(m);
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
          const effectiveBranchId = existingRecord?.branchId || activeBranchId || currentUser.branchId || undefined;
          const id = `${selectedDate}_${churchId}`;
          const isLCLive = isWednesday(selectedDate) && (currentService === "CELL" || Object.values(finalServiceMap).includes("CELL"));
          const recordEventName = isLCLive
            ? (specialEventName || existingRecord?.eventName || "Wednesday LC Live")
            : newEventName;
          recordsToSave.push({
            id,
            date: selectedDate,
            churchId,
            branchId: effectiveBranchId,
            presentMemberIds: finalPresent,
            punctualMemberIds: finalPunctual,
            serviceMap: finalServiceMap,
            eventName: recordEventName,
            attendanceType: isLCLive ? "CELL" : "SUNDAY",
            lastUpdated: Date.now()
          });
        }
      });

      // Instant optimistic feedback in 0ms
      setSuccessMsg(hasActualChanges ? `Changes saved` : `No changes saved`);
      setShowEventModal(false);
      clearDraft();
      setIsSaving(false);
      setTimeout(() => setSuccessMsg(""), 2000);

      if (recordsToSave.length > 0) {
        saveAttendance(recordsToSave[0].id, recordsToSave)
          .then(() => {
            onUpdate();
          })
          .catch((err) => {
            console.error("Failed to save attendance in background:", err);
            setSuccessMsg("Error saving attendance");
          });
      } else {
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to save attendance:", err);
      setSuccessMsg("Error saving attendance");
      setIsSaving(false);
    }
  };

  const validFirstTimerEntries = useMemo(() => {
    return firstTimerEntries
      .map((entry) => ({
        ...entry,
        name: sanitizeInput(entry.name).trim(),
        parentPhone: sanitizeInput(entry.parentPhone).trim(),
        address: sanitizeInput(entry.address).trim(),
      }))
      .filter((entry) => entry.name.length > 0);
  }, [firstTimerEntries]);

  const handleAddFNF = async () => {
    if (validFirstTimerEntries.length === 0 || isSubmittingVisitor) return;
    setIsSubmittingVisitor(true);
    try {
      const targetChurch: Church = (fnfTargetChurch && availableChurches.includes(fnfTargetChurch))
        ? fnfTargetChurch
        : ((effectiveChurch && availableChurches.includes(effectiveChurch as Church))
          ? (effectiveChurch as Church)
          : ((currentUser?.assignedChurch && availableChurches.includes(currentUser.assignedChurch as Church))
            ? (currentUser.assignedChurch as Church)
            : "UJ"));
      const targetBranchId = (activeBranchId && activeBranchId !== "ALL")
        ? activeBranchId
        : (currentUser?.branchId || "");
      const targetZoneId = currentUser?.zoneId || "";

      const shouldCombine = isFnfCombined(data.settings);
      const joinDateIso = selectedDate
        ? `${selectedDate}T${new Date().toISOString().split("T")[1] || "09:00:00.000Z"}`
        : new Date().toISOString();

      const newMembers: Member[] = validFirstTimerEntries.map((entry) => ({
        id: crypto.randomUUID(),
        name: entry.name,
        type:
          entry.roleType === MemberType.FNF
            ? MemberType.FNF
            : shouldCombine
            ? MemberType.FNF
            : MemberType.VISITOR,
        previousType: entry.roleType,
        assignedChurch: targetChurch,
        passcode: "",
        status: MemberStatus.ACTIVE,
        gender: entry.gender || determineGenderByName(entry.name),
        parentPhone: entry.parentPhone || undefined,
        phone: entry.parentPhone || undefined,
        address: entry.address || undefined,
        branchId: targetBranchId,
        zoneId: targetZoneId,
        assignedTeacherId: undefined,
        joinedDate: joinDateIso,
        addedAt: Date.now(),
      }));

      // 1. Instant 0ms optimistic update
      const newSet = new Set(presentIds);
      const newSMap = { ...serviceMap };
      newMembers.forEach((m) => {
        newSet.add(m.id);
        newSMap[m.id] = currentService;
      });

      setPresentIds(newSet);
      setServiceMap(newSMap);
      saveDraft(newSet, punctualIds, newSMap);

      setFirstTimerEntries([
        {
          name: "",
          gender: "MALE",
          parentPhone: "",
          address: "",
          roleType: MemberType.VISITOR,
        },
      ]);
      setIsAddingFNF(false);
      setIsSubmittingVisitor(false);
      setSuccessMsg(
        newMembers.length > 1
          ? `${newMembers.length} First Timers / FNFs added & saved`
          : "First Timer / FNF added & saved"
      );
      setTimeout(() => setSuccessMsg(""), 2500);

      // 2. Background database persistence
      (async () => {
        try {
          await addMembers(newMembers);
          await confirmSave(newSet, newSMap, newMembers);
        } catch (err) {
          console.error("Failed to save First Timers in background:", err);
          setSuccessMsg("Error saving First Timers");
        }
      })();
    } catch (err) {
      console.error("Failed to add First Timers:", err);
      setIsSubmittingVisitor(false);
      setIsAddingFNF(false);
    }
  };

  // --- SMART PASTE ATTENDANCE MATCHING & RECORDING ---
  const parseSmartPasteLine = (rawLine: string) => {
    // Strip leading numbering or bullets e.g. "1. ", "2) ", "- ", "• "
    const cleanedLine = rawLine.replace(/^\s*(?:\d+[\.\)\-:]|[\u2022\-\*])\s*/, "").trim();
    // Support optional pipe, dash, or comma separated details: Name | Gender | Phone | Location
    const parts = cleanedLine
      .split(/\s*\|\s*|\s+-\s+|\s*,\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    let name = parts[0] || "";
    let gender: "MALE" | "FEMALE" | undefined = undefined;
    let phone = "";
    let location = "";

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const upper = p.toUpperCase();
      if (upper === "M" || upper === "MALE" || upper === "BOY") {
        gender = "MALE";
      } else if (upper === "F" || upper === "FEMALE" || upper === "GIRL") {
        gender = "FEMALE";
      } else if (/\d{7,}/.test(p.replace(/\s+/g, ""))) {
        phone = p;
      } else if (!location) {
        location = p;
      } else {
        location += `, ${p}`;
      }
    }

    const cleanName = sanitizeInput(name).trim();
    const resolvedGender: "MALE" | "FEMALE" =
      gender || (determineGenderByName(cleanName) === "FEMALE" ? "FEMALE" : "MALE");

    return {
      name: cleanName,
      gender: resolvedGender,
      phone: sanitizeInput(phone).trim(),
      location: sanitizeInput(location).trim(),
    };
  };

  const handleAnalyzeSmartPaste = () => {
    const lines = smartPasteRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const rosterPool = membersToList;
    const norm = (s: string) =>
      (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

    const parsedItems = lines.map((line, idx) => {
      const extracted = parseSmartPasteLine(line);
      const qNorm = norm(extracted.name);
      const qTokens = qNorm.split(" ").filter((t) => t.length >= 2);

      // 1. Exact full name match
      const exactMatches = rosterPool.filter((m) => norm(m.name) === qNorm);
      if (exactMatches.length === 1) {
        return {
          id: `paste-${idx}-${Date.now()}`,
          rawLine: line,
          status: "EXACT" as const,
          selectedMemberId: exactMatches[0].id,
          candidates: exactMatches,
          firstTimerName: extracted.name,
          firstTimerGender: extracted.gender,
          firstTimerPhone: extracted.phone,
          firstTimerLocation: extracted.location,
        };
      }
      if (exactMatches.length > 1) {
        return {
          id: `paste-${idx}-${Date.now()}`,
          rawLine: line,
          status: "CONFUSION" as const,
          selectedMemberId: exactMatches[0].id,
          candidates: exactMatches,
          firstTimerName: extracted.name,
          firstTimerGender: extracted.gender,
          firstTimerPhone: extracted.phone,
          firstTimerLocation: extracted.location,
        };
      }

      // 2. Token / partial match
      const scoredCandidates: { member: Member; score: number }[] = [];
      for (const m of rosterPool) {
        const mNorm = norm(m.name);
        const mTokens = mNorm.split(" ").filter(Boolean);
        if (mNorm.includes(qNorm) || qNorm.includes(mNorm)) {
          scoredCandidates.push({ member: m, score: 3 });
          continue;
        }
        let matchedTokens = 0;
        for (const qt of qTokens) {
          if (mTokens.some((mt) => mt === qt || (qt.length >= 4 && mt.startsWith(qt)))) {
            matchedTokens++;
          }
        }
        if (matchedTokens > 0) {
          const score = matchedTokens / Math.max(qTokens.length, 1);
          if (score >= 0.5 || matchedTokens >= 2) {
            scoredCandidates.push({ member: m, score });
          }
        }
      }

      scoredCandidates.sort((a, b) => b.score - a.score);
      const candidates = scoredCandidates.slice(0, 5).map((c) => c.member);

      // Single unambiguous high-confidence token match (all query tokens matched, >= 2 tokens)
      if (
        scoredCandidates.length === 1 &&
        scoredCandidates[0].score >= 1 &&
        qTokens.length >= 2
      ) {
        return {
          id: `paste-${idx}-${Date.now()}`,
          rawLine: line,
          status: "EXACT" as const,
          selectedMemberId: scoredCandidates[0].member.id,
          candidates,
          firstTimerName: extracted.name,
          firstTimerGender: extracted.gender,
          firstTimerPhone: extracted.phone,
          firstTimerLocation: extracted.location,
        };
      }

      if (candidates.length > 0) {
        return {
          id: `paste-${idx}-${Date.now()}`,
          rawLine: line,
          status: "CONFUSION" as const,
          selectedMemberId: candidates[0].id,
          candidates,
          firstTimerName: extracted.name,
          firstTimerGender: extracted.gender,
          firstTimerPhone: extracted.phone,
          firstTimerLocation: extracted.location,
        };
      }

      return {
        id: `paste-${idx}-${Date.now()}`,
        rawLine: line,
        status: "FIRST_TIMER" as const,
        selectedMemberId: undefined,
        candidates: [],
        firstTimerName: extracted.name,
        firstTimerGender: extracted.gender,
        firstTimerPhone: extracted.phone,
        firstTimerLocation: extracted.location,
      };
    });

    setSmartPasteItems(parsedItems);
    setSmartPasteStep("REVIEW");
  };

  const handleConfirmSmartPaste = async () => {
    if (isRecordingSmartPaste) return;
    setIsRecordingSmartPaste(true);
    try {
      const targetChurch: Church =
        fnfTargetChurch && availableChurches.includes(fnfTargetChurch)
          ? fnfTargetChurch
          : effectiveChurch && availableChurches.includes(effectiveChurch as Church)
          ? (effectiveChurch as Church)
          : currentUser?.assignedChurch &&
            availableChurches.includes(currentUser.assignedChurch as Church)
          ? (currentUser.assignedChurch as Church)
          : "UJ";
      const targetBranchId =
        activeBranchId && activeBranchId !== "ALL"
          ? activeBranchId
          : currentUser?.branchId || "";
      const targetZoneId = currentUser?.zoneId || "";
      const shouldCombine = isFnfCombined(data.settings);
      const joinDateIso = selectedDate
        ? `${selectedDate}T${new Date().toISOString().split("T")[1] || "09:00:00.000Z"}`
        : new Date().toISOString();

      const nextPresent = new Set(presentIds);
      const nextServiceMap = { ...serviceMap };
      const createdFirstTimers: Member[] = [];

      smartPasteItems.forEach((item) => {
        if (item.status === "SKIP") return;
        if (
          (item.status === "EXACT" || item.status === "CONFUSION") &&
          item.selectedMemberId
        ) {
          nextPresent.add(item.selectedMemberId);
          nextServiceMap[item.selectedMemberId] = currentService;
        } else if (item.status === "FIRST_TIMER" && item.firstTimerName.trim()) {
          const cleanName = sanitizeInput(item.firstTimerName).trim();
          const newFt: Member = {
            id: crypto.randomUUID(),
            name: cleanName,
            type: shouldCombine ? MemberType.FNF : MemberType.VISITOR,
            previousType: MemberType.VISITOR,
            assignedChurch: targetChurch,
            passcode: "",
            status: MemberStatus.ACTIVE,
            gender: item.firstTimerGender || determineGenderByName(cleanName),
            parentPhone: sanitizeInput(item.firstTimerPhone).trim() || undefined,
            phone: sanitizeInput(item.firstTimerPhone).trim() || undefined,
            address: sanitizeInput(item.firstTimerLocation).trim() || undefined,
            branchId: targetBranchId,
            zoneId: targetZoneId,
            assignedTeacherId: undefined,
            joinedDate: joinDateIso,
            addedAt: Date.now(),
          };
          createdFirstTimers.push(newFt);
          nextPresent.add(newFt.id);
          nextServiceMap[newFt.id] = currentService;
        }
      });

      setPresentIds(nextPresent);
      setServiceMap(nextServiceMap);
      saveDraft(nextPresent, punctualIds, nextServiceMap);

      setIsSmartPasteOpen(false);
      setSmartPasteRawText("");
      setSmartPasteItems([]);
      setSmartPasteStep("INPUT");
      setIsRecordingSmartPaste(false);

      if (createdFirstTimers.length > 0) {
        await addMembers(createdFirstTimers);
      }
      await confirmSave(nextPresent, nextServiceMap, createdFirstTimers);
    } catch (err) {
      console.error("Smart paste attendance error:", err);
      setIsRecordingSmartPaste(false);
    }
  };

  // --- LIST GENERATION ---
  let membersToList: Member[] = [];
  const targetChurches = getRelevantBranches(effectiveChurch, attendanceMode);

  if (attendanceMode === "STAFF") {
    membersToList = (data.members || []).filter(
      (m) =>
        matchesScope(m, activeBranchId, data.settings?.organization) &&
        [MemberStatus.ACTIVE, MemberStatus.INCONSISTENT, MemberStatus.NOT_ACTIVE].includes(m.status) &&
        (targetChurches.includes(m.assignedChurch as Church) || m.assignedChurch === "All" || m.assignedChurch === "CM" || !m.assignedChurch) &&
        isStaffOrTeacher(m),
    );
  } else {
    membersToList = (data.members || []).filter(
      (m) =>
        matchesScope(m, activeBranchId, data.settings?.organization) &&
        [MemberStatus.ACTIVE, MemberStatus.NOT_ACTIVE, MemberStatus.INCONSISTENT].includes(m.status) &&
        targetChurches.includes(m.assignedChurch as Church) &&
        !isStaffOrTeacher(m),
    );
  }

  const availableShepherdsForAttendance = useMemo(() => {
    return (data.members || []).filter(
      (m) =>
        matchesScope(m, activeBranchId, data.settings?.organization) &&
        isStaffOrTeacher(m) &&
        m.status !== MemberStatus.ARCHIVED &&
        m.status !== MemberStatus.TRANSFERRED &&
        (targetChurches.includes(m.assignedChurch as Church) ||
          m.assignedChurch === effectiveChurch ||
          effectiveChurch === "All" ||
          effectiveChurch === "CM")
    );
  }, [data.members, activeBranchId, data.settings?.organization, targetChurches, effectiveChurch]);

  useEffect(() => {
    if (
      selectedShepherdFilter !== "ALL" &&
      selectedShepherdFilter !== "UNASSIGNED" &&
      !availableShepherdsForAttendance.some((s) => s.id === selectedShepherdFilter)
    ) {
      setSelectedShepherdFilter("ALL");
    }
  }, [availableShepherdsForAttendance, selectedShepherdFilter]);

  const filteredMembers = membersToList.filter((m) => {
    const matchesSearch = m.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === "All" ||
      (filterType === MemberType.FNF
        ? isFnfMember(m, data.settings)
        : filterType === MemberType.VISITOR
        ? isVisitorMember(m, data.settings)
        : m.type === filterType);

    const matchesShepherd =
      attendanceMode !== "MEMBERS" ||
      selectedShepherdFilter === "ALL" ||
      (selectedShepherdFilter === "UNASSIGNED"
        ? !m.assignedTeacherId
        : m.assignedTeacherId === selectedShepherdFilter);

    // --- SPECIAL LOGIC: HIDE JOY ATTENDEES IN ENLARGEMENT VIEW ---
    if (attendanceMode === "MEMBERS" && currentService === "ENLARGEMENT") {
      // If the member is already marked as 'JOY' in the current map, hide them.
      if (serviceMap[m.id] === "JOY") {
        return false;
      }
    }

    return matchesSearch && matchesType && matchesShepherd;
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

  // Helper to check if a member matches a specific status/type tab
  const matchesStatusFilter = (m: Member, targetFilter: MemberType | string) => {
    if (targetFilter === "All") return true;
    if (targetFilter === MemberType.FNF) return isFnfMember(m, data.settings);
    if (targetFilter === MemberType.VISITOR) return isVisitorMember(m, data.settings);
    return m.type === targetFilter;
  };

  // Exact count recorded for the active status filter (or total attendance when 'All' is selected)
  const totalSavedInState = useMemo(() => {
    const presentInCurrentScope = membersToList.filter((m) => presentIds.has(m.id));
    if (filterType === "All") {
      return presentInCurrentScope.length;
    }
    return presentInCurrentScope.filter((m) => matchesStatusFilter(m, filterType)).length;
  }, [membersToList, presentIds, filterType, data.settings]);

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
          const isStaff = isStaffOrTeacher(m);
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
    <div className="flex flex-col h-[calc(100dvh-130px)] md:h-[calc(100vh-140px)] relative overflow-hidden pb-2 md:pb-0">
      {/* 1. TOP BAR (Static & Sticky) */}
      <div className="shrink-0 space-y-2 z-20 pb-2 bg-slate-50/95 backdrop-blur-xs sticky top-0">
        {/* Day-Aware Service Display */}
        {isSundayDate && attendanceMode === "MEMBERS" && (effectiveChurch !== "CM" || isCombinedView) && (
          <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 mb-1 overflow-x-auto hide-scrollbar gap-1">
            <button
              onClick={() => setCurrentService("JOY")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${currentService === "JOY" ? "bg-amber-100 text-amber-700 shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <Sun
                size={16}
                fill={currentService === "JOY" ? "currentColor" : "none"}
              />{" "}
              Joy Service
            </button>
            <button
              onClick={() => setCurrentService("ENLARGEMENT")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${currentService === "ENLARGEMENT" ? "bg-sky-100 text-sky-700 shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <Zap
                size={16}
                fill={
                  currentService === "ENLARGEMENT" ? "currentColor" : "none"
                }
              />{" "}
              Enlargement
            </button>
            <button
              onClick={() => setCurrentService("SPECIAL")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${currentService === "SPECIAL" ? "bg-purple-100 text-purple-700 shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <Crown
                size={16}
                fill={currentService === "SPECIAL" ? "currentColor" : "none"}
              />{" "}
              Special
            </button>
          </div>
        )}

        {isWednesdayDate && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-2xl text-xs font-bold mb-1 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🌿</span>
              <span>LC Live — Wednesday Shepherds Meeting</span>
            </div>
            <span className="text-[10px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              Shepherds Only
            </span>
          </div>
        )}

        {isDynamicSpecialDate && (
          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 text-purple-900 px-3.5 py-2 rounded-2xl text-xs font-bold mb-1 shadow-2xs">
            <div className="flex items-center gap-2 truncate">
              <Crown size={16} className="text-purple-600 shrink-0" />
              <span className="truncate">
                Special Program: <strong className="text-purple-950 font-black">{specialEventName || "(Name asked on save)"}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowEventModal(true)}
              className="text-[11px] bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-xl font-bold transition-all shadow-xs shrink-0"
            >
              {specialEventName ? "Edit Event" : "Set Name"}
            </button>
          </div>
        )}

        {/* Row 1: Main Controls */}
        <div className="bg-white rounded-3xl p-3 md:p-4 shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          <div className="flex justify-between items-center gap-2">
            {/* Members vs Shepherds Mode Toggle (Accessible on all screen sizes) */}
            <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 border border-slate-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setAttendanceMode("MEMBERS");
                  setFilterType("All");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${attendanceMode === "MEMBERS" ? "bg-white shadow-xs text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Users size={13} className={attendanceMode === "MEMBERS" ? "text-indigo-600" : "text-slate-400"} />
                <span>Members</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAttendanceMode("STAFF");
                  setFilterType("All");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${attendanceMode === "STAFF" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
              >
                <UserCheck size={13} className={attendanceMode === "STAFF" ? "text-white" : "text-slate-400"} />
                <span>Shepherds</span>
              </button>
            </div>

            {/* Quick Action Buttons on mobile (visible on small screens) */}
            <div className="flex lg:hidden items-center gap-1.5">
              {enablePunctuality && (
                <button
                  type="button"
                  onClick={() => setShowLeaderboard(true)}
                  className="p-2 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors border border-amber-200 shrink-0"
                  title="Leaderboard"
                >
                  <Trophy size={16} />
                </button>
              )}

              {attendanceMode === "MEMBERS" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSmartPasteStep("INPUT");
                      setIsSmartPasteOpen(true);
                    }}
                    className="p-2 text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors border border-purple-200 shrink-0"
                    title="Paste Attendance List"
                  >
                    <ClipboardPaste size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingFNF(!isAddingFNF)}
                    className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200 shrink-0"
                    title="Add First Timer / FNF"
                  >
                    <UserPlus size={16} />
                  </button>
                </>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-xl transition-all active:scale-95 shrink-0 ${successMsg && !successMsg.includes("Error")
                  ? "bg-emerald-600 shadow-md shadow-emerald-200"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-70"
                  }`}
              >
                {successMsg && !successMsg.includes("Error") ? (
                  <Check size={14} />
                ) : (
                  <Save size={14} />
                )}
                <span>{isSaving ? "Saving..." : successMsg && !successMsg.includes("Error") ? "Saved!" : "Save"}</span>
                <span className="bg-white/20 px-1 py-0.5 rounded text-[10px] font-mono">
                  {totalSavedInState}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              {canFilterChurch && (
                <div className="relative flex-1 sm:w-44 shrink-0">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-indigo-600">
                    <Crown size={15} />
                  </div>
                  <select
                    value={internalChurchFilter}
                    onChange={(e) =>
                      setInternalChurchFilter(
                        e.target.value as Church | "COMBINED",
                      )
                    }
                    aria-label="Filter Church"
                    className="w-full bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs sm:text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block pl-8 pr-3 py-2.5 appearance-none cursor-pointer"
                  >
                    <option value="COMBINED">All Churches</option>
                    {availableChurches.map((church) => (
                      <option key={church} value={church}>
                        {CHURCH_DISPLAY_NAMES[church] || church}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative flex-1 min-w-[120px]">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Calendar size={15} />
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block w-full pl-8 pr-2 py-2.5 appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-2">
              {enablePunctuality && (
                <div
                  className="flex items-center gap-1 px-2.5 py-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shrink-0 font-bold text-xs sm:text-sm"
                  title="Punctual for current service"
                >
                  <Trophy size={15} className="text-amber-500" />
                  <span>{punctualForCurrentService}</span>
                  <span className="text-[11px] font-medium text-amber-600">
                    Punctual
                  </span>
                </div>
              )}

              {enablePunctuality && (
                <button
                  type="button"
                  onClick={() => setShowLeaderboard(true)}
                  className="p-2.5 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors border border-amber-200 shrink-0"
                  title="Leaderboard"
                >
                  <Trophy size={18} />
                </button>
              )}

              {attendanceMode === "MEMBERS" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSmartPasteStep("INPUT");
                      setIsSmartPasteOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-purple-700 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors border border-purple-200 shrink-0"
                    title="Paste a list of children to match and record attendance"
                  >
                    <ClipboardPaste size={16} />
                    <span>Paste List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingFNF(!isAddingFNF)}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200 shrink-0"
                    title="Add First Timer or FNF with contact, location & gender"
                  >
                    <UserPlus size={16} />
                    <span>+ First Timer</span>
                  </button>
                </>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl transition-all active:scale-95 shrink-0 ${successMsg && !successMsg.includes("Error")
                  ? "bg-emerald-600 shadow-md shadow-emerald-200"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-70"
                  }`}
              >
                {successMsg && !successMsg.includes("Error") ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}
                <span>
                  {isSaving ? "Saving..." : successMsg && !successMsg.includes("Error") ? "Saved!" : "Save"}
                </span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[11px] font-mono">
                  {totalSavedInState}
                </span>
              </button>
            </div>
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
                className="w-full pl-9 pr-24 py-2 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400"
                placeholder={`Search ${filteredMembers.length} names...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  if (isBulkMode) setBulkSelectedIds(new Set());
                }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[10px] font-bold ${isBulkMode ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {isBulkMode ? "Cancel Bulk" : "Bulk Check-In"}
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 px-1 hide-scrollbar items-center">
              {canFilterChurch && (
                <div className="flex items-center gap-1 pr-2 border-r border-slate-200 mr-1 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
                    Church:
                  </span>
                  <button
                    type="button"
                    onClick={() => setInternalChurchFilter("COMBINED")}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${internalChurchFilter === "COMBINED"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    All
                  </button>
                  {availableChurches.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setInternalChurchFilter(c as Church)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${internalChurchFilter === c
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setFilterType("All")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filterType === "All" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                All Status ({membersToList.filter((m) => presentIds.has(m.id)).length})
              </button>
              {(attendanceMode === "STAFF"
                ? [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER]
                : isFnfCombined(data.settings)
                ? [
                    MemberType.MEMBER,
                    MemberType.FNF,
                  ]
                : [
                    MemberType.MEMBER,
                    MemberType.FNF,
                    MemberType.VISITOR,
                  ]
              ).map((type) => {
                const statusPresentCount = membersToList.filter(
                  (m) => presentIds.has(m.id) && matchesStatusFilter(m, type)
                ).length;
                const label =
                  type === MemberType.FNF
                    ? "FNF"
                    : type === MemberType.VISITOR
                    ? "First Timers"
                    : type === MemberType.TEACHER
                    ? "Shepherd"
                    : type;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterType === type ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    {label} ({statusPresentCount})
                  </button>
                );
              })}

              {attendanceMode === "MEMBERS" && (
                <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold text-purple-900 shadow-2xs">
                  <UserCheck size={13} className="text-purple-600 shrink-0" />
                  <span className="text-[11px] text-purple-600 font-semibold">Shepherd:</span>
                  <select
                    value={selectedShepherdFilter}
                    onChange={(e) => setSelectedShepherdFilter(e.target.value)}
                    className="bg-transparent text-purple-900 font-bold focus:outline-none cursor-pointer pr-1 text-xs"
                  >
                    <option value="ALL">
                      All Shepherds {effectiveChurch && effectiveChurch !== "All" && effectiveChurch !== "CM" ? `(${effectiveChurch})` : ""}
                    </option>
                    <option value="UNASSIGNED">Unassigned Only</option>
                    {availableShepherdsForAttendance.map((shepherd) => {
                      const count = membersToList.filter((m) => m.assignedTeacherId === shepherd.id).length;
                      return (
                        <option key={shepherd.id} value={shepherd.id}>
                          {shepherd.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
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
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 relative border border-slate-100">
            <button
              onClick={() => setIsAddingFNF(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              title="Close"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <UserPlus className="text-indigo-600" size={22} />
              Add First Timer / FNF
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Register First Timers (with Gender, Parent Contact Number &amp; Location for reporting) and mark them present for {formatDateDDMMYYYY(selectedDate)}.
            </p>

            <div className="space-y-3 mb-4">
              {firstTimerEntries.map((entry, index) => (
                <div
                  key={index}
                  className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5 relative"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      Child #{index + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...firstTimerEntries];
                          updated[index] = {
                            ...updated[index],
                            roleType:
                              updated[index].roleType === MemberType.VISITOR
                                ? MemberType.FNF
                                : MemberType.VISITOR,
                          };
                          setFirstTimerEntries(updated);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                          entry.roleType === MemberType.VISITOR
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-teal-50 text-teal-700 border-teal-200"
                        }`}
                      >
                        {entry.roleType === MemberType.VISITOR ? "First Timer" : "FNF"}
                      </button>
                      {firstTimerEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFirstTimerEntries(
                              firstTimerEntries.filter((_, i) => i !== index)
                            );
                          }}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove entry"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name & Gender Row */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={entry.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = [...firstTimerEntries];
                        const inferred = determineGenderByName(val);
                        updated[index] = {
                          ...updated[index],
                          name: val,
                          gender:
                            inferred === "FEMALE" || inferred === "MALE"
                              ? inferred
                              : updated[index].gender,
                        };
                        setFirstTimerEntries(updated);
                      }}
                      className="flex-1 p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800 bg-white placeholder:text-slate-400 text-xs"
                      autoFocus={index === firstTimerEntries.length - 1}
                    />
                    <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...firstTimerEntries];
                          updated[index] = { ...updated[index], gender: "MALE" };
                          setFirstTimerEntries(updated);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all ${
                          entry.gender === "MALE"
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...firstTimerEntries];
                          updated[index] = { ...updated[index], gender: "FEMALE" };
                          setFirstTimerEntries(updated);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all ${
                          entry.gender === "FEMALE"
                            ? "bg-pink-600 text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Female
                      </button>
                    </div>
                  </div>

                  {/* Parent Contact & Location Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Phone
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="tel"
                        placeholder="Parent Contact Number"
                        value={entry.parentPhone}
                        onChange={(e) => {
                          const updated = [...firstTimerEntries];
                          updated[index] = {
                            ...updated[index],
                            parentPhone: e.target.value,
                          };
                          setFirstTimerEntries(updated);
                        }}
                        className="w-full pl-8 pr-2.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-medium text-slate-700 bg-white placeholder:text-slate-400"
                      />
                    </div>
                    <div className="relative">
                      <MapPin
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Location / Residence"
                        value={entry.address}
                        onChange={(e) => {
                          const updated = [...firstTimerEntries];
                          updated[index] = {
                            ...updated[index],
                            address: e.target.value,
                          };
                          setFirstTimerEntries(updated);
                        }}
                        className="w-full pl-8 pr-2.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-medium text-slate-700 bg-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setFirstTimerEntries([
                  ...firstTimerEntries,
                  {
                    name: "",
                    gender: "MALE",
                    parentPhone: "",
                    address: "",
                    roleType: MemberType.VISITOR,
                  },
                ])
              }
              className="w-full py-2.5 mb-4 text-xs font-bold text-indigo-600 border border-indigo-200 border-dashed hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={15} />
              Add Another First Timer
            </button>

            {/* Auto-assigned Profile Details */}
            <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-2xl p-3 mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Church:</span>
                <select
                  value={fnfTargetChurch}
                  onChange={(e) => setFnfTargetChurch(e.target.value as Church)}
                  className="font-extrabold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {availableChurches.map((c) => (
                    <option key={c} value={c}>
                      {CHURCH_DISPLAY_NAMES[c] || c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Service Marked:</span>
                <span className="font-bold text-indigo-700">{currentService}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Auto-Promotion Rule:</span>
                <span className="font-semibold text-emerald-700 text-[11px]">
                  2nd attendance → Auto-changes to FNF
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingFNF(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFNF}
                disabled={validFirstTimerEntries.length === 0 || isSubmittingVisitor}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-1.5"
              >
                {isSubmittingVisitor ? (
                  "Adding & Marking..."
                ) : validFirstTimerEntries.length > 1 ? (
                  `Add & Mark ${validFirstTimerEntries.length} Present`
                ) : (
                  "Add & Mark Present"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART PASTE ATTENDANCE POP MODAL (For App Heads & Users) */}
      {isSmartPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <ClipboardPaste size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    Smart Paste Attendance Recorder
                  </h3>
                  <p className="text-[11px] text-purple-100 font-medium">
                    Paste a list of children for {formatDateDDMMYYYY(selectedDate)} ({currentService}) • Auto-match &amp; resolve confusions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSmartPasteOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {smartPasteStep === "INPUT" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Target Church (for New First Timers)
                      </label>
                      <select
                        value={fnfTargetChurch}
                        onChange={(e) => setFnfTargetChurch(e.target.value as Church)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {availableChurches.map((c) => (
                          <option key={c} value={c}>
                            {CHURCH_DISPLAY_NAMES[c] || c} Church
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Service Session
                      </label>
                      <select
                        value={currentService}
                        onChange={(e) => setCurrentService(e.target.value as ServiceType)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      >
                        <option value="JOY">Joy Service</option>
                        <option value="ENLARGEMENT">Enlargement Service</option>
                        <option value="SPECIAL">Special Service</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Paste Attendance List (One child per line)
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Paste names from WhatsApp or notes. For First Timers, you can also include details on the same line (e.g. <code>John Mensah | Male | 0244123456 | Madina</code>) or fill them in the next step.
                    </p>
                    <textarea
                      rows={9}
                      value={smartPasteRawText}
                      onChange={(e) => setSmartPasteRawText(e.target.value)}
                      placeholder={"1. Beatrice Yeboah Adomako\n2. Jedidiah Oti-Boateng\n3. Kwame Boateng | Male | 0244112233 | Adenta"}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-xs font-medium text-slate-800 resize-none"
                      autoFocus
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Summary Pills */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        {smartPasteItems.filter((i) => i.status === "EXACT").length} Exact Match
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                        {smartPasteItems.filter((i) => i.status === "CONFUSION").length} Confusion / Resolve
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                        {smartPasteItems.filter((i) => i.status === "FIRST_TIMER").length} First Timer(s)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSmartPasteStep("INPUT")}
                      className="text-xs font-bold text-purple-600 hover:underline"
                    >
                      &larr; Edit Pasted Text
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="space-y-3">
                    {smartPasteItems.map((item, idx) => {
                      const matchedMember = item.selectedMemberId
                        ? data.members.find((m) => m.id === item.selectedMemberId)
                        : null;

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            item.status === "EXACT"
                              ? "bg-emerald-50/40 border-emerald-200"
                              : item.status === "CONFUSION"
                              ? "bg-amber-50/60 border-amber-300"
                              : item.status === "FIRST_TIMER"
                              ? "bg-indigo-50/40 border-indigo-200"
                              : "bg-slate-50 border-slate-200 opacity-60"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                #{idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                "{item.rawLine}"
                              </span>
                            </div>

                            {/* Mode Switcher */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...smartPasteItems];
                                  next[idx] = {
                                    ...item,
                                    status: item.candidates.length > 1 ? "CONFUSION" : "EXACT",
                                    selectedMemberId:
                                      item.selectedMemberId ||
                                      item.candidates[0]?.id ||
                                      membersToList[0]?.id,
                                  };
                                  setSmartPasteItems(next);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                  item.status === "EXACT" || item.status === "CONFUSION"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                Existing Child
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...smartPasteItems];
                                  next[idx] = {
                                    ...item,
                                    status: "FIRST_TIMER",
                                  };
                                  setSmartPasteItems(next);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                  item.status === "FIRST_TIMER"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                New First Timer
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...smartPasteItems];
                                  next[idx] = {
                                    ...item,
                                    status: item.status === "SKIP" ? "EXACT" : "SKIP",
                                  };
                                  setSmartPasteItems(next);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                  item.status === "SKIP"
                                    ? "bg-rose-600 text-white"
                                    : "bg-white border border-slate-200 text-slate-400 hover:text-rose-600"
                                }`}
                              >
                                Skip
                              </button>
                            </div>
                          </div>

                          {/* EXACT OR CONFUSION RESOLUTION */}
                          {(item.status === "EXACT" || item.status === "CONFUSION") && (
                            <div className="space-y-2">
                              {item.status === "CONFUSION" && (
                                <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                                  <AlertCircle size={13} className="text-amber-600 shrink-0" />
                                  <span>
                                    Multiple or partial matches found — step in to confirm the right child:
                                  </span>
                                </div>
                              )}

                              {item.candidates.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.candidates.map((cand) => {
                                    const isChosen = item.selectedMemberId === cand.id;
                                    return (
                                      <button
                                        key={cand.id}
                                        type="button"
                                        onClick={() => {
                                          const next = [...smartPasteItems];
                                          next[idx] = {
                                            ...item,
                                            status: "EXACT",
                                            selectedMemberId: cand.id,
                                          };
                                          setSmartPasteItems(next);
                                        }}
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                          isChosen
                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400"
                                        }`}
                                      >
                                        <Check size={12} className={isChosen ? "opacity-100" : "opacity-0"} />
                                        <span>{cand.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded ${isChosen ? "bg-emerald-700 text-emerald-100" : "bg-slate-100 text-slate-500"}`}>
                                          {cand.assignedChurch}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Full Roster Dropdown Fallback */}
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                                  Selected Record:
                                </span>
                                <select
                                  value={item.selectedMemberId || ""}
                                  onChange={(e) => {
                                    const next = [...smartPasteItems];
                                    next[idx] = {
                                      ...item,
                                      status: "EXACT",
                                      selectedMemberId: e.target.value,
                                    };
                                    setSmartPasteItems(next);
                                  }}
                                  className="flex-1 p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                >
                                  <option value="">-- Choose from full roster --</option>
                                  {membersToList.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.assignedChurch} • {isVisitorMember(m, data.settings) ? "First Timer" : isFnfMember(m, data.settings) ? "FNF" : m.type})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          {/* NEW FIRST TIMER INLINE REQUIREMENTS (Name, Gender, Parent Contact, Location) */}
                          {item.status === "FIRST_TIMER" && (
                            <div className="space-y-2 pt-1">
                              <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                                <Sparkles size={13} className="text-indigo-600 shrink-0" />
                                <span>
                                  New First Timer — verify Name, Gender, Parent Contact &amp; Location:
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <input
                                  type="text"
                                  placeholder="Full Name *"
                                  value={item.firstTimerName}
                                  onChange={(e) => {
                                    const next = [...smartPasteItems];
                                    next[idx] = {
                                      ...item,
                                      firstTimerName: e.target.value,
                                    };
                                    setSmartPasteItems(next);
                                  }}
                                  className="sm:col-span-4 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                />
                                <select
                                  value={item.firstTimerGender}
                                  onChange={(e) => {
                                    const next = [...smartPasteItems];
                                    next[idx] = {
                                      ...item,
                                      firstTimerGender: e.target.value as "MALE" | "FEMALE",
                                    };
                                    setSmartPasteItems(next);
                                  }}
                                  className="sm:col-span-2 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                >
                                  <option value="MALE">Male</option>
                                  <option value="FEMALE">Female</option>
                                </select>
                                <input
                                  type="tel"
                                  placeholder="Parent Phone"
                                  value={item.firstTimerPhone}
                                  onChange={(e) => {
                                    const next = [...smartPasteItems];
                                    next[idx] = {
                                      ...item,
                                      firstTimerPhone: e.target.value,
                                    };
                                    setSmartPasteItems(next);
                                  }}
                                  className="sm:col-span-3 p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                                />
                                <input
                                  type="text"
                                  placeholder="Location / Address"
                                  value={item.firstTimerLocation}
                                  onChange={(e) => {
                                    const next = [...smartPasteItems];
                                    next[idx] = {
                                      ...item,
                                      firstTimerLocation: e.target.value,
                                    };
                                    setSmartPasteItems(next);
                                  }}
                                  className="sm:col-span-3 p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsSmartPasteOpen(false)}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              {smartPasteStep === "INPUT" ? (
                <button
                  type="button"
                  disabled={!smartPasteRawText.trim()}
                  onClick={handleAnalyzeSmartPaste}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} />
                  Match &amp; Review List
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isRecordingSmartPaste || smartPasteItems.every((i) => i.status === "SKIP")}
                  onClick={handleConfirmSmartPaste}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5"
                >
                  <Save size={15} />
                  {isRecordingSmartPaste
                    ? "Recording Attendance..."
                    : `Confirm & Record (${smartPasteItems.filter((i) => i.status !== "SKIP").length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN GRID (Scrolls smoothly underneath static controls) */}
      <div className="flex-1 overflow-y-auto overscroll-contain pr-1 pb-28 md:pb-20">
        {isCombinedView && filteredMembers.length > 0 && (
          <div className="mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
            Viewing All Churches ({filteredMembers.length})
          </div>
        )}

        {filteredMembers.length === 0 && (
          <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 my-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              {searchTerm.trim() ? (
                <Search size={28} className="text-indigo-500" />
              ) : (
                <UserPlus size={28} className="text-slate-400" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {searchTerm.trim()
                ? `No Names Match "${searchTerm}"`
                : selectedShepherdFilter !== "ALL"
                ? `No Children Found for Shepherd`
                : filterType !== "All"
                ? `No ${filterType === MemberType.FNF ? "FNFs" : filterType === MemberType.VISITOR ? "First Timers" : filterType} in Roster`
                : `No ${attendanceMode === "STAFF" ? "Shepherds" : "Members"} Found for ${effectiveChurch}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto font-medium">
              {searchTerm.trim() ? (
                <>No member names match your search term in {effectiveChurch}. Try clearing your search.</>
              ) : selectedShepherdFilter !== "ALL" ? (
                <>
                  {(() => {
                    const sh = availableShepherdsForAttendance.find(
                      (s) => s.id === selectedShepherdFilter
                    );
                    return sh
                      ? `No children are currently allocated to Shepherd ${sh.name} for ${effectiveChurch}.`
                      : `No children match this shepherd filter in ${effectiveChurch}.`;
                  })()}
                </>
              ) : filterType !== "All" ? (
                <>No profiles match the filter type "{filterType === MemberType.FNF ? "FNF" : filterType === MemberType.VISITOR ? "First Timer" : filterType}".</>
              ) : (
                <>No active profiles match this church and branch scope. Switch scope or click "+ First Timer" / "+ FNF" to record a new attendee.</>
              )}
            </p>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-md mx-auto">
              {searchTerm.trim() && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <span>Search: "{searchTerm}"</span>
                  <button onClick={() => setSearchTerm("")} className="hover:text-indigo-900 rounded-full p-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedShepherdFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                  <span>
                    Shepherd:{" "}
                    {selectedShepherdFilter === "UNASSIGNED"
                      ? "Unassigned"
                      : availableShepherdsForAttendance.find((s) => s.id === selectedShepherdFilter)?.name || "Selected"}
                  </span>
                  <button onClick={() => setSelectedShepherdFilter("ALL")} className="hover:text-purple-900 rounded-full p-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filterType !== "All" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  <span>Type: {filterType === MemberType.FNF ? "FNF" : filterType === MemberType.VISITOR ? "First Timer" : filterType}</span>
                  <button onClick={() => setFilterType("All")} className="hover:text-amber-900 rounded-full p-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {(searchTerm.trim() || selectedShepherdFilter !== "ALL" || filterType !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedShepherdFilter("ALL");
                    setFilterType("All");
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Undo2 size={13} />
                  Reset Roster Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAddingFNF(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
              >
                <UserPlus size={13} />
                + Add FNF / First Timer
              </button>
            </div>
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
              if (assignedService === "CELL") {
                cardStyle =
                  "bg-emerald-50 border-emerald-300 shadow-md shadow-emerald-100 transform scale-[1.01]";
                textStyle = "text-emerald-950";
                iconStyle = "bg-white text-emerald-600 border border-emerald-200";
              } else if (assignedService === "JOY") {
                cardStyle =
                  "bg-amber-50 border-amber-300 shadow-md shadow-amber-100 transform scale-[1.01]";
                textStyle = "text-amber-900";
                iconStyle = "bg-white text-amber-500 border border-amber-200";
              } else if (assignedService === "ENLARGEMENT") {
                cardStyle =
                  "bg-sky-50 border-sky-300 shadow-md shadow-sky-100 transform scale-[1.01]";
                textStyle = "text-sky-900";
                iconStyle = "bg-white text-sky-500 border border-sky-200";
              } else if (assignedService === "SPECIAL") {
                cardStyle =
                  "bg-purple-50 border-purple-300 shadow-md shadow-purple-100 transform scale-[1.01]";
                textStyle = "text-purple-900";
                iconStyle = "bg-white text-purple-600 border border-purple-200";
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
                                ${isBulkMode && bulkSelectedIds.has(member.id) ? "ring-2 ring-indigo-500" : ""}
                            `}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                    <MemberAvatar member={member} size="sm" showBorder={!isPresent} />
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`font-bold text-lg leading-tight break-words ${textStyle}`}
                      >
                        {member.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <p
                          className={`text-xs font-medium uppercase tracking-wider ${isPresent ? "opacity-80" : "text-slate-400"}`}
                        >
                          {isVisitorMember(member, data.settings)
                            ? "First Timer"
                            : isFnfMember(member, data.settings)
                            ? "FNF"
                            : (member.type as any) === "Teacher" || (member.type as any) === MemberType.TEACHER || attendanceMode === "STAFF"
                              ? "Shepherd"
                              : member.type}
                        </p>
                        {(isCombinedView || effectiveChurch === "CM") && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isPresent ? "bg-white/30" : "bg-slate-100 text-slate-500"}`}
                          >
                            {member.assignedChurch}
                          </span>
                        )}
                        {/* Assigned Shepherd Badge */}
                        {attendanceMode === "MEMBERS" && (
                          (() => {
                            if (!member.assignedTeacherId) {
                              return (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${isPresent
                                      ? "bg-white/15 text-current opacity-75"
                                      : "bg-slate-50 text-slate-400 border border-slate-200"
                                    }`}
                                >
                                  <UserX size={9} className="shrink-0" />
                                  <span>Unassigned</span>
                                </span>
                              );
                            }

                            const shepherd = data.members.find((m) => m.id === member.assignedTeacherId);
                            if (shepherd) {
                              const isInactive = shepherd.status === MemberStatus.ARCHIVED || shepherd.status === MemberStatus.TRANSFERRED;
                              if (isInactive) {
                                return (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 ${isPresent
                                        ? "bg-amber-400/30 text-current border border-amber-300"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                      }`}
                                    title={`Assigned shepherd ${shepherd.name} is currently ${shepherd.status.toLowerCase()}.`}
                                  >
                                    <AlertCircle size={9} className="shrink-0" />
                                    <span>Inactive Shepherd</span>
                                  </span>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedShepherdFilter(shepherd.id);
                                  }}
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 transition-transform active:scale-95 cursor-pointer ${isPresent
                                      ? "bg-white/25 text-current border border-white/30 hover:bg-white/35"
                                      : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                                    }`}
                                  title={`Assigned Shepherd: ${shepherd.name}. Click to view cohort.`}
                                >
                                  <UserCheck size={9} className="shrink-0" />
                                  <span>Shepherd: {shepherd.name.split(" ")[0]}</span>
                                </button>
                              );
                            }

                            return (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 ${isPresent
                                    ? "bg-amber-400/30 text-current border border-amber-300"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                title="Assigned shepherd was removed or not found."
                              >
                                <AlertCircle size={9} className="shrink-0" />
                                <span>Unlinked Shepherd</span>
                              </span>
                            );
                          })()
                        )}
                      </div>

                      {/* Service Badge if Present */}
                      {isPresent && assignedService && (
                        <div
                          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${assignedService === "CELL"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : assignedService === "JOY"
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : assignedService === "ENLARGEMENT"
                                ? "bg-sky-100 text-sky-700 border-sky-200"
                                : "bg-purple-100 text-purple-700 border-purple-200"
                            }`}
                        >
                          {assignedService === "CELL" ? (
                            <>
                              <span className="text-[11px]">🌿</span>
                              <span>LC Live</span>
                            </>
                          ) : assignedService === "JOY" ? (
                            <>
                              <Sun size={10} />
                              <span>JOY</span>
                            </>
                          ) : assignedService === "ENLARGEMENT" ? (
                            <>
                              <Zap size={10} />
                              <span>Enlargement</span>
                            </>
                          ) : (
                            <>
                              <Crown size={10} />
                              <span>Special</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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
                      className={`p-1.5 rounded-lg transition-all ${isPunctual
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
                onClick={() => {
                  setShowEventModal(false);
                  confirmSave();
                }}
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

      {/* Bulk Check-In FAB */}
      {isBulkMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-4 rounded-full shadow-2xl border border-indigo-100 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-5">
          <span className="font-bold text-slate-700">{bulkSelectedIds.size} Selected</span>
          <div className="w-px h-6 bg-slate-200"></div>
          <button
            onClick={() => {
              const allVisibleIds = filteredMembers.map(m => m.id);
              const newSet = new Set(bulkSelectedIds);
              allVisibleIds.forEach(id => newSet.add(id));
              setBulkSelectedIds(newSet);
            }}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-800"
          >
            Select All
          </button>
          <button
            onClick={handleBulkCheckIn}
            disabled={bulkSelectedIds.size === 0}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            Check In <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{currentService}</span>
          </button>
        </div>
      )}

      {/* Floating Quick Save Pill so users never have to scroll up to save */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 animate-in fade-in slide-in-from-bottom-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-3 rounded-full font-extrabold text-xs sm:text-sm shadow-xl transition-all active:scale-95 text-white ${successMsg && !successMsg.includes("Error")
            ? "bg-emerald-600 shadow-emerald-200"
            : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-300 disabled:opacity-70"
            }`}
          title="Save Attendance without scrolling"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Save Attendance ({totalSavedInState})</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(AttendanceTaker);
