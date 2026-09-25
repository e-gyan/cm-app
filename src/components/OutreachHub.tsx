import { calculateChurchDivisions, matchesScope, getScopeDisplayLabel } from "../lib/teacherDivision";
import { generatePrayerSchedule, generateOutreachSchedule } from "../services/storageService";
import { hasRoleSubfeature, isSuperAdminUser } from "../lib/permissions";
import React, { useState, useMemo, useEffect } from "react";
import {
  AppData,
  Member,
  OutreachSession,
  PrayerSlot,
  MemberType,
  MemberStatus,
  Church,
} from "../types";
import {
  saveOutreachSession,
  saveOutreachSessions,
  deleteOutreachSession,
  savePrayerSlot,
  savePrayerSlots,
  deletePrayerSlot,
  addNotification,
  updateMember,
} from "../services/storageService";
import {
  Calendar,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Heart,
  AlertCircle,
  ArrowRightLeft,
  BarChart2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  CalendarDays,
  RefreshCw,
  Zap,
  Loader2,
  User,
  Cloud,
  Save,
  Target,
  Phone,
  MessageSquare,
  Map as MapIcon,
  CalendarPlus,
  ExternalLink,
  UserCheck,
  Search,
  Users,
  UserPlus,
  TrendingUp,
  Award,
  Activity,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface OutreachHubProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
  activeChurch: Church;
  activeBranchId?: string;
}

const GOOGLE_CALENDAR_ID =
  "b7a17362d923e887199867f0fedff992c6e2d2ff6bb206fc0c9cd900d476ec8c@group.calendar.google.com";

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getRelativeTime = (dateStr: string) => {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = (target.getTime() - today.getTime()) / (1000 * 3600 * 24);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff < 7)
    return target.toLocaleDateString("en-US", { weekday: "long" });
  return formatDateDDMMYYYY(dateStr);
};

const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
};

const addToGoogleCalendar = (
  title: string,
  dateStr: string,
  description: string,
  durationMins: number = 30,
  isVisit: boolean = false,
) => {
  const start = new Date(dateStr);
  // Set default times (Visit: 10am, Prayer: 6am)
  start.setHours(isVisit ? 10 : 6, 0, 0, 0);

  const end = new Date(start.getTime() + durationMins * 60000);

  // Format for Google: YYYYMMDDTHHMMSSZ
  const format = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.append("action", "TEMPLATE");
  url.searchParams.append("text", title);
  url.searchParams.append("dates", `${format(start)}/${format(end)}`);
  url.searchParams.append("details", description);
  url.searchParams.append("src", GOOGLE_CALENDAR_ID);

  window.open(url.toString(), "_blank");
};

const downloadICS = (
  filename: string,
  events: { title: string; start: Date; end: Date; description: string }[],
) => {
  let icsContent =
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Childrens Ministry//Attendance App//EN\n";

  const formatICSDate = (date: Date) => {
    // Format to floating time YYYYMMDDTHHMMSS (No Z) so it stays absolute to user's selected calendar timezone
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"; // Actually, let's use UTC 'Z' for consistency if we set UTC hours correctly
  };

  events.forEach((evt) => {
    icsContent += "BEGIN:VEVENT\n";
    icsContent += `UID:${crypto.randomUUID()}\n`;
    icsContent += `DTSTAMP:${formatICSDate(new Date())}\n`;
    icsContent += `DTSTART:${formatICSDate(evt.start)}\n`;
    icsContent += `DTEND:${formatICSDate(evt.end)}\n`;
    icsContent += `SUMMARY:${evt.title}\n`;
    icsContent += `DESCRIPTION:${evt.description}\n`;
    icsContent += "END:VEVENT\n";
  });

  icsContent += "END:VCALENDAR";

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const OutreachHub: React.FC<OutreachHubProps> = ({
  data,
  onUpdate,
  currentUser,
  activeChurch,
  activeBranchId,
}) => {
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Member>>({});

  const handleEditClick = (member: Member) => {
    setEditingMember(member);
    setEditFormData({
      phone: member.phone || "",
      parentPhone: member.parentPhone || "",
      address: member.address || "",
      status: member.status,
    });
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;
    const updated: Member = {
      ...editingMember,
      ...editFormData,
      assignedTeacherId: editingMember.assignedTeacherId,
    };
    setEditingMember(null);
    updateMember(editingMember.id, updated)
      .then(() => onUpdate())
      .catch(console.error);
  };

  const divisions = useMemo(() => {
    return calculateChurchDivisions(
      data.members,
      ["UJ", "LJ", "K", "I"],
    );
  }, [data.members]);

  const visitorFnfIds = useMemo(() => {
    return new Set(
      data.members
        .filter(
          (m) =>
            m.type === MemberType.VISITOR ||
            m.type === MemberType.FNF ||
            m.type === MemberType.NOT_MEMBER,
        )
        .map((m) => m.id)
    );
  }, [data.members]);

  const [activeTab, setActiveTab] = useState<
    "VISIT" | "PRAYER" | "CONNECT" | "TRACK"
  >(() => {
    const saved = sessionStorage.getItem("outreach_activeTab");
    if (saved === "FOLLOW_UP") return "CONNECT";
    return (saved as any) || "VISIT";
  });

  useEffect(() => {
    sessionStorage.setItem("outreach_activeTab", activeTab);
  }, [activeTab]);

  const [memberSearch, setMemberSearch] = useState<string>("");
  const [memberCategoryFilter, setMemberCategoryFilter] = useState<
    "ALL" | "ACTIVE" | "INCONSISTENT" | "NOT_ACTIVE" | "VISITOR" | "FNF"
  >("ALL");
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const [selectedProgressChurch, setSelectedProgressChurch] = useState<string>(
    activeChurch !== "All" && activeChurch !== "CM" ? activeChurch : "UJ"
  );

  useEffect(() => {
    if (activeChurch !== "All" && activeChurch !== "CM") {
      setSelectedProgressChurch(activeChurch);
    }
  }, [activeChurch]);

  const [messageTarget, setMessageTarget] = useState<Member | null>(null);
  const handleMessageClick = (member: Member) => {
    setMessageTarget(member);
  };
  const confirmMessageMethod = (method: "sms" | "whatsapp") => {
    if (!messageTarget) return;
    const phone = messageTarget.phone || messageTarget.parentPhone;
    if (!phone) return;

    handleTrackCall(messageTarget, "SMS");
    setMessageTarget(null);

    if (method === "sms") {
      window.location.href = `sms:${phone}`;
    } else {
      window.open(`https://wa.me/${phone.replace(/[^\d+]/g, "")}`, "_blank");
    }
  };

  const isAdmin = [
    "ADMIN",
    "SUPER_ADMIN",
    "ZONAL_HEAD",
    "DIRECTORATE_HEAD",
    "BRANCH_COORDINATOR",
  ].includes(currentUser.role || "");

  const [filterChurch, setFilterChurch] = useState<string>("ALL");

  const isMemberInActiveChurch = (m: Member) => {
    const scopeMatch = matchesScope(m, activeBranchId, data.settings?.organization);
    if (!scopeMatch) return false;

    // App-level logic
    let appAllowed = true;
    if (activeChurch !== "CM" && activeChurch !== "All") {
      appAllowed = m.assignedChurch === activeChurch;
    }

    // Admin filtering
    let adminAllowed = true;
    if (isAdmin) {
      if (filterChurch !== "ALL" && m.assignedChurch !== filterChurch) adminAllowed = false;
    }

    return appAllowed && adminAllowed;
  };

  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Visitation State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [moveModal, setMoveModal] = useState<{
    show: boolean;
    memberId: string;
    currentSessionId: string;
  } | null>(null);
  const [customRescheduleDate, setCustomRescheduleDate] = useState<string>("");
  const [addMemberModal, setAddMemberModal] = useState<{
    show: boolean;
    sessionId: string;
  } | null>(null);

  const [callModal, setCallModal] = useState<{
    show: boolean;
    member: Member;
    method: "Call" | "SMS";
  } | null>(null);

  // UNIFIED LOCAL STATE FOR BATCH SAVING
  const [localSessions, setLocalSessions] = useState<OutreachSession[]>([]);
  const [localPrayerSlots, setLocalPrayerSlots] = useState<PrayerSlot[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [changeCounts, setChangeCounts] = useState({ marked: 0, unmarked: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [completionConfirm, setCompletionConfirm] = useState<{
    show: boolean;
    sessionId: string;
  } | null>(null);

  // Prayer UI State
  const [prayerWeek, setPrayerWeek] = useState(getStartOfWeek(new Date()));
  const [prayerDurationModal, setPrayerDurationModal] = useState<string | null>(
    null,
  );

  function getStartOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    // If today is Sunday (0), return the upcoming Monday (+1).
    // Otherwise return the current week's Monday (-day + 1).
    const diff = d.getDate() - day + (day === 0 ? 1 : 1);
    return new Date(d.setDate(diff));
  }

  // --- SYNC LOCAL STATE ---
  useEffect(() => {
    // Sync sessions if not dirty
    const sessionIds = new Set(localSessions.map((s) => s.id));
    const hasSessionChanges = Array.from(unsavedChanges).some((id) =>
      sessionIds.has(id),
    );

    if (!hasSessionChanges && data.outreachSessions) {
      let filteredSessions = data.outreachSessions;
      filteredSessions = data.outreachSessions.filter((s) => {
        // Check if assigned members belong to activeChurch
        const hasAssigned = s.assignedMemberIds.some((id) => {
          const m = data.members.find((mem) => mem.id === id);
          return m && isMemberInActiveChurch(m);
        });
        if (hasAssigned) return true;

        // Check if completedBy belongs to activeChurch
        if (s.completedBy) {
          const m = data.members.find((mem) => mem.id === s.completedBy);
          if (m && isMemberInActiveChurch(m)) return true;
        }

        // Check if visited members belong to activeChurch
        if (s.visitedMemberIds) {
          const hasVisited = s.visitedMemberIds.some((id) => {
            const m = data.members.find((mem) => mem.id === id);
            return m && isMemberInActiveChurch(m);
          });
          if (hasVisited) return true;
        }

        return false;
      });
      setLocalSessions(JSON.parse(JSON.stringify(filteredSessions)));
    }

    // Sync prayer if not dirty
    const prayerIds = new Set(localPrayerSlots.map((s) => s.id));
    const hasPrayerChanges = Array.from(unsavedChanges).some((id) =>
      prayerIds.has(id),
    );

    if (!hasPrayerChanges && data.prayerSchedule) {
      const filteredPrayer = data.prayerSchedule.filter((s) => {
        if (activeChurch === "All" || activeChurch === "CM") {
          return true;
        }
        if (s.branchId && (s.branchId === activeChurch || s.branchId === "ALL" || s.branchId === "All")) {
          return true;
        }
        const assigned = s.assignedMemberIds || [];
        if (assigned.length === 0) return true;
        const hasAssigned = assigned.some((id) => {
          const m = data.members.find((mem) => mem.id === id);
          return m && isMemberInActiveChurch(m);
        });
        return hasAssigned;
      });
      setLocalPrayerSlots(JSON.parse(JSON.stringify(filteredPrayer)));
    }
  }, [
    data.outreachSessions,
    data.prayerSchedule,
    unsavedChanges.size,
    activeChurch,
    filterChurch,
    isAdmin,
  ]);

  // --- AUTO GENERATION FOR CURRENT WEEK ---
  useEffect(() => {
    const checkAndAutoGenerate = async () => {
      if (!data.members || data.members.length === 0) return;

      const today = new Date();
      const startOfCurrentWeek = getStartOfWeek(today);
      const startStr = startOfCurrentWeek.toISOString().split("T")[0];

      // Check if we have *any* slots for this week (Mon-Fri)
      let hasSlots = false;
      for (let i = 0; i < 5; i++) {
        const checkDate = new Date(startOfCurrentWeek);
        checkDate.setDate(startOfCurrentWeek.getDate() + i);
        const dateStr = checkDate.toISOString().split("T")[0];
        if (data.prayerSchedule?.some((s) => s.date === dateStr)) {
          hasSlots = true;
          break;
        }
      }

      if (!hasSlots) {
        let targetMembers = data.members.filter(
          (m) =>
            isMemberInActiveChurch(m) &&
            !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
            m.status !== MemberStatus.ARCHIVED,
        );

        const isTeacher = !isAdmin && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER);

        if (isTeacher && activeChurch !== "All" && activeChurch !== "CM") {
          const churchDiv = divisions[activeChurch] || divisions[currentUser.assignedChurch || ""];
          if (churchDiv) {
            const assignment = churchDiv.assignments.find((a) => a.teacher.id === currentUser.id);
            if (assignment) {
              const assignedIds = new Set(assignment.members.map((m) => m.id));
              targetMembers = targetMembers.filter(m => assignedIds.has(m.id) || visitorFnfIds.has(m.id));
            }
          }
        }

        if (targetMembers.length > 0) {
          const res = await generatePrayerSchedule(startOfCurrentWeek, targetMembers, isTeacher ? currentUser.id : undefined);
          if (res.success) {
            onUpdate();
            setGenMsg({
              type: "success",
              text: "New weekly prayer schedule ready! Don't forget to add it to your calendar.",
            });
            setTimeout(() => setGenMsg(null), 5000);
          }
        }
      }
    };

    // Short delay to ensure data is loaded
    const timer = setTimeout(checkAndAutoGenerate, 1000);
    return () => clearTimeout(timer);
  }, [data.prayerSchedule?.length]);

  // --- ACTIONS ---

  const handleAddDate = () => {
    if (newDateInput) {
      if (selectedDates.includes(newDateInput)) {
        setNewDateInput("");
        return;
      }
      if (localSessions?.some((s) => s.date === newDateInput)) {
        setErrorMsg("Date already scheduled.");
        setTimeout(() => setErrorMsg(""), 2000);
        return;
      }
      setSelectedDates([...selectedDates, newDateInput].sort());
      setNewDateInput("");
    }
  };

  const handleRemoveDate = (date: string) => {
    setSelectedDates(selectedDates.filter((d) => d !== date));
  };

  const handleGenerateSchedule = async () => {
    let targetMembers = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
        m.status !== MemberStatus.ARCHIVED
    );

    const isTeacher = !isAdmin && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER);

    if (isTeacher && activeChurch !== "All" && activeChurch !== "CM") {
      const churchDiv = divisions[activeChurch] || divisions[currentUser.assignedChurch || ""];
      if (churchDiv) {
        const assignment = churchDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment && assignment.members.length > 0) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          const hasAssignedFnf = assignment.members.some((m) => m.type === MemberType.FNF);
          const hasAssignedVisitor = assignment.members.some(
            (m) => m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER,
          );

          targetMembers = targetMembers.filter((m) => {
            if (assignedIds.has(m.id)) return true;
            if (!hasAssignedFnf && m.type === MemberType.FNF) return true;
            if (
              !hasAssignedVisitor &&
              (m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER)
            )
              return true;
            return false;
          });
        }
      }
    }

    const res = await generateOutreachSchedule(targetMembers, selectedDates, isTeacher ? currentUser.id : undefined);
    if (res.success) {
      if (res.data) {
        setLocalSessions(JSON.parse(JSON.stringify(res.data)));
      }
      setSelectedDates([]);
      setIsCreatorOpen(false);
      setUnsavedChanges(new Set()); // Reset local state
      onUpdate();
    } else {
      setErrorMsg(res.message);
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Are you sure you want to permanently delete this schedule?",
      )
    ) {
      setUnsavedChanges((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setLocalSessions((prev) => prev.filter(s => s.id !== id));
      onUpdate();
      deleteOutreachSession(id).catch(console.error);
    }
  };

  const toggleVisitForMember = async (sessionId: string, memberId: string) => {
    const sessionIndex = localSessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex === -1) return;

    const session = { ...localSessions[sessionIndex] };
    const currentVisited = session.visitedMemberIds || [];
    const isCurrentlyVisited = currentVisited.includes(memberId);

    // If marking as visited: save immediately & move to Completed History
    if (!isCurrentlyVisited) {
      setLoadingId(sessionId);
      try {
        const remainingAssigned = (session.assignedMemberIds || []).filter((id) => id !== memberId);
        const remainingVisited = (session.visitedMemberIds || []).filter((id) => id !== memberId);

        // Check if an existing completed session exists on that date for this teacher/branch
        const existingCompleted = localSessions.find(
          (s) =>
            s.date === session.date &&
            s.status === "COMPLETED" &&
            (!session.teacherId || s.teacherId === session.teacherId)
        );

        let completedSession: OutreachSession;
        if (existingCompleted) {
          completedSession = {
            ...existingCompleted,
            assignedMemberIds: Array.from(new Set([...(existingCompleted.assignedMemberIds || []), memberId])),
            visitedMemberIds: Array.from(new Set([...(existingCompleted.visitedMemberIds || []), memberId])),
            completedBy: currentUser.name || existingCompleted.completedBy || "Shepherd",
          };
          await saveOutreachSession(completedSession);
        } else {
          if (remainingAssigned.length === 0) {
            // Only this child was on the schedule: turn session directly to COMPLETED
            completedSession = {
              ...session,
              status: "COMPLETED",
              assignedMemberIds: [memberId],
              visitedMemberIds: [memberId],
              completedBy: currentUser.name || "Shepherd",
            };
            await saveOutreachSession(completedSession);
          } else {
            completedSession = {
              id: `session_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              date: session.date,
              status: "COMPLETED",
              assignedMemberIds: [memberId],
              visitedMemberIds: [memberId],
              completedBy: currentUser.name || "Shepherd",
              teacherId: session.teacherId,
              branchId: session.branchId || activeBranchId,
              sessionType: session.sessionType || "REGULAR",
            };
            await saveOutreachSession(completedSession);
          }
        }

        // Clean up pending session
        if (remainingAssigned.length === 0 && !existingCompleted) {
          setLocalSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? completedSession : s))
          );
        } else if (remainingAssigned.length === 0 && existingCompleted) {
          await deleteOutreachSession(session.id);
          setLocalSessions((prev) =>
            prev.filter((s) => s.id !== session.id).map((s) => (s.id === existingCompleted.id ? completedSession : s))
          );
        } else {
          const updatedPending: OutreachSession = {
            ...session,
            assignedMemberIds: remainingAssigned,
            visitedMemberIds: remainingVisited,
          };
          await saveOutreachSession(updatedPending);
          setLocalSessions((prev) => {
            const list = prev.map((s) => (s.id === sessionId ? updatedPending : s));
            if (existingCompleted) {
              return list.map((s) => (s.id === existingCompleted.id ? completedSession : s));
            } else {
              return [...list, completedSession];
            }
          });
        }

        setUnsavedChanges((prev) => {
          const n = new Set(prev);
          n.delete(sessionId);
          return n;
        });
        onUpdate();
      } catch (err) {
        console.error("Error marking visit completed:", err);
      } finally {
        setLoadingId(null);
      }
    }
  };

  const handleUndoVisit = async (completedSessionId: string, memberId: string) => {
    const sessionIdx = localSessions.findIndex((s) => s.id === completedSessionId);
    if (sessionIdx === -1) return;

    const completedSession = { ...localSessions[sessionIdx] };
    const remainingAssigned = (completedSession.assignedMemberIds || []).filter((id) => id !== memberId);
    const remainingVisited = (completedSession.visitedMemberIds || []).filter((id) => id !== memberId);

    const today = new Date().toISOString().split("T")[0];
    const targetDate = (completedSession.date && completedSession.date >= today) ? completedSession.date : today;

    const existingPending = localSessions.find(
      (s) =>
        s.date === targetDate &&
        s.status === "PENDING" &&
        (!completedSession.teacherId || s.teacherId === completedSession.teacherId)
    );

    let targetPending: OutreachSession;
    if (existingPending) {
      targetPending = {
        ...existingPending,
        assignedMemberIds: Array.from(new Set([...(existingPending.assignedMemberIds || []), memberId])),
      };
    } else {
      targetPending = {
        id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: targetDate,
        status: "PENDING",
        assignedMemberIds: [memberId],
        visitedMemberIds: [],
        branchId: completedSession.branchId || activeBranchId,
        teacherId: completedSession.teacherId,
        sessionType: completedSession.sessionType || "REGULAR",
      };
    }

    setLoadingId(completedSessionId);
    try {
      await saveOutreachSession(targetPending);

      if (remainingAssigned.length === 0 && remainingVisited.length === 0) {
        await deleteOutreachSession(completedSession.id);
        setLocalSessions((prev) => {
          const list = prev.filter((s) => s.id !== completedSession.id);
          if (existingPending) {
            return list.map((s) => (s.id === existingPending.id ? targetPending : s));
          } else {
            return [...list, targetPending];
          }
        });
      } else {
        const updatedCompleted: OutreachSession = {
          ...completedSession,
          assignedMemberIds: remainingAssigned,
          visitedMemberIds: remainingVisited,
        };
        await saveOutreachSession(updatedCompleted);
        setLocalSessions((prev) => {
          const list = prev.map((s) => (s.id === completedSession.id ? updatedCompleted : s));
          if (existingPending) {
            return list.map((s) => (s.id === existingPending.id ? targetPending : s));
          } else {
            return [...list, targetPending];
          }
        });
      }
      onUpdate();
    } catch (err) {
      console.error("Error undoing completed visit:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const confirmCompletion = (confirm: boolean) => {
    if (!completionConfirm) return;
    const { sessionId } = completionConfirm;
    const sessionIndex = localSessions.findIndex((s) => s.id === sessionId);

    if (sessionIndex !== -1) {
      const newSessions = [...localSessions];
      newSessions[sessionIndex].status = confirm ? "COMPLETED" : "PENDING";
      if (confirm) newSessions[sessionIndex].completedBy = currentUser.name;
      setLocalSessions(newSessions);
    }
    setCompletionConfirm(null);
  };

  const handleRemoveMemberFromSession = async (memberId: string, currentSessionId: string) => {
    if (!window.confirm("Are you sure you want to remove this child from the schedule?")) return;

    const currentIdx = localSessions.findIndex((s) => s.id === currentSessionId);
    if (currentIdx === -1) return;

    const currentSession = { ...localSessions[currentIdx] };
    currentSession.assignedMemberIds = (currentSession.assignedMemberIds || []).filter((id) => id !== memberId);
    currentSession.visitedMemberIds = (currentSession.visitedMemberIds || []).filter((id) => id !== memberId);

    setLoadingId(currentSessionId);
    try {
      // Clear and delete schedule if no assigned members left
      if (currentSession.assignedMemberIds.length === 0) {
        await deleteOutreachSession(currentSessionId);
        setLocalSessions((prev) => prev.filter((s) => s.id !== currentSessionId));
      } else {
        await saveOutreachSession(currentSession);
        setLocalSessions((prev) => prev.map((s) => (s.id === currentSessionId ? currentSession : s)));
      }
      setUnsavedChanges((prev) => {
        const n = new Set(prev);
        n.delete(currentSessionId);
        return n;
      });
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleMoveMember = async (targetSessionId: string | "REMOVE") => {
    if (!moveModal) return;
    const { memberId, currentSessionId } = moveModal;

    if (targetSessionId === "REMOVE") {
      setMoveModal(null);
      await handleRemoveMemberFromSession(memberId, currentSessionId);
      return;
    }

    const currentIdx = localSessions.findIndex((s) => s.id === currentSessionId);
    const targetIdx = localSessions.findIndex((s) => s.id === targetSessionId);
    if (currentIdx === -1 || targetIdx === -1) {
      setMoveModal(null);
      return;
    }

    const currentSession = { ...localSessions[currentIdx] };
    const targetSession = { ...localSessions[targetIdx] };

    // Remove from current
    currentSession.assignedMemberIds = (currentSession.assignedMemberIds || []).filter((id) => id !== memberId);
    currentSession.visitedMemberIds = (currentSession.visitedMemberIds || []).filter((id) => id !== memberId);

    // Add to target
    if (!targetSession.assignedMemberIds.includes(memberId)) {
      targetSession.assignedMemberIds = [...targetSession.assignedMemberIds, memberId];
    }

    setMoveModal(null);
    setLoadingId(currentSessionId);
    try {
      await saveOutreachSession(targetSession);

      // Clear that schedule if no members left!
      if (currentSession.assignedMemberIds.length === 0) {
        await deleteOutreachSession(currentSession.id);
        setLocalSessions((prev) =>
          prev.filter((s) => s.id !== currentSession.id).map((s) => (s.id === targetSession.id ? targetSession : s))
        );
      } else {
        await saveOutreachSession(currentSession);
        setLocalSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSession.id) return currentSession;
            if (s.id === targetSession.id) return targetSession;
            return s;
          })
        );
      }

      setUnsavedChanges((prev) => {
        const n = new Set(prev);
        n.delete(currentSessionId);
        n.delete(targetSessionId);
        return n;
      });
      onUpdate();
    } catch (err) {
      console.error("Error moving member:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRescheduleToDate = async (newDate: string) => {
    if (!moveModal || !newDate) return;
    const { memberId, currentSessionId } = moveModal;

    const currentIdx = localSessions.findIndex((s) => s.id === currentSessionId);
    if (currentIdx === -1) {
      setMoveModal(null);
      return;
    }

    const currentSession = { ...localSessions[currentIdx] };
    currentSession.assignedMemberIds = (currentSession.assignedMemberIds || []).filter((id) => id !== memberId);
    currentSession.visitedMemberIds = (currentSession.visitedMemberIds || []).filter((id) => id !== memberId);

    const existingTarget = localSessions.find(
      (s) =>
        s.date === newDate &&
        s.status === "PENDING" &&
        (!currentSession.teacherId || s.teacherId === currentSession.teacherId)
    );

    let targetSession: OutreachSession;
    if (existingTarget) {
      targetSession = {
        ...existingTarget,
        assignedMemberIds: Array.from(new Set([...(existingTarget.assignedMemberIds || []), memberId])),
      };
    } else {
      targetSession = {
        id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: newDate,
        status: "PENDING",
        assignedMemberIds: [memberId],
        visitedMemberIds: [],
        branchId: currentSession.branchId || activeBranchId,
        teacherId: currentSession.teacherId,
        sessionType: currentSession.sessionType || "REGULAR",
      };
    }

    setMoveModal(null);
    setLoadingId(currentSessionId);
    try {
      await saveOutreachSession(targetSession);

      // Clear old schedule if empty
      if (currentSession.assignedMemberIds.length === 0) {
        await deleteOutreachSession(currentSession.id);
        setLocalSessions((prev) => {
          const list = prev.filter((s) => s.id !== currentSession.id);
          if (existingTarget) {
            return list.map((s) => (s.id === existingTarget.id ? targetSession : s));
          } else {
            return [...list, targetSession];
          }
        });
      } else {
        await saveOutreachSession(currentSession);
        setLocalSessions((prev) => {
          const list = prev.map((s) => (s.id === currentSession.id ? currentSession : s));
          if (existingTarget) {
            return list.map((s) => (s.id === existingTarget.id ? targetSession : s));
          } else {
            return [...list, targetSession];
          }
        });
      }

      setUnsavedChanges((prev) => {
        const n = new Set(prev);
        n.delete(currentSessionId);
        return n;
      });
      onUpdate();
    } catch (err) {
      console.error("Error rescheduling to date:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleAutoFill = (sessionId: string) => {
    const sessionIdx = localSessions.findIndex((s) => s.id === sessionId);
    if (sessionIdx === -1) return;

    const session = { ...localSessions[sessionIdx] };
    const currentMemberIds = session.assignedMemberIds;

    // 1. Analyze Composition (Strict Goal: 2 Members, 1 FNF, 1 First Timer)
    const currentMembers = currentMemberIds
      .map((id) => data.members.find((m) => m.id === id))
      .filter(Boolean) as Member[];
    const memberCount = currentMembers.filter(
      (m) => m.type === MemberType.MEMBER,
    ).length;
    const fnfCount = currentMembers.filter(
      (m) => m.type === MemberType.FNF,
    ).length;
    const visitorCount = currentMembers.filter(
      (m) => m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER,
    ).length;

    // 2. Determine Priority Need
    let neededCategory: "MEMBER" | "FNF" | "VISITOR" | "ANY" = "ANY";
    if (visitorCount < 1) neededCategory = "VISITOR";
    else if (fnfCount < 1) neededCategory = "FNF";
    else if (memberCount < 2) neededCategory = "MEMBER";

    // 3. Find Candidate
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

    const recentlyVisited = new Set<string>();
    localSessions.forEach((s) => {
      if (new Date(s.date) >= twoMonthsAgo && s.visitedMemberIds) {
        s.visitedMemberIds.forEach((id) => recentlyVisited.add(id));
      }
    });

    const assignedInPending = new Set<string>();
    localSessions
      .filter((s) => s.status === "PENDING" && s.id !== sessionId)
      .forEach((s) => {
        s.assignedMemberIds.forEach((id) => assignedInPending.add(id));
      });

    const candidates = data.members.filter((m) => {
      if (!isMemberInActiveChurch(m)) return false;
      if (currentMemberIds.includes(m.id)) return false;
      if (recentlyVisited.has(m.id) || assignedInPending.has(m.id)) return false;
      if (m.status === MemberStatus.ARCHIVED || m.status === MemberStatus.TRANSFERRED) return false;
      if (["Teacher", "Helper", "Volunteer"].includes(m.type)) return false;

      if (neededCategory === "VISITOR") {
        return m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER;
      }
      if (neededCategory === "FNF") {
        return m.type === MemberType.FNF;
      }
      if (neededCategory === "MEMBER") {
        return m.type === MemberType.MEMBER;
      }
      return true;
    });

    let candidate =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : null;

    // Fallback to any unassigned non-staff member in church
    if (!candidate) {
      const fallbackCandidates = data.members.filter(
        (m) =>
          isMemberInActiveChurch(m) &&
          !currentMemberIds.includes(m.id) &&
          !recentlyVisited.has(m.id) &&
          !assignedInPending.has(m.id) &&
          !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
          m.status !== MemberStatus.ARCHIVED,
      );
      if (fallbackCandidates.length > 0)
        candidate =
          fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
    }

    if (candidate) {
      session.assignedMemberIds = [...session.assignedMemberIds, candidate.id];
      const newSessions = [...localSessions];
      newSessions[sessionIdx] = session;
      setLocalSessions(newSessions);
      setUnsavedChanges((prev) => new Set(prev).add(sessionId));
      setGenMsg({ type: "success", text: `Auto-added ${candidate.name} (${candidate.type})` });
    } else {
      setGenMsg({ type: "error", text: "No suitable candidates found." });
    }
    setTimeout(() => setGenMsg(null), 3000);
  };

  const handleAddMember = (sessionId: string, memberId: string) => {
    const sessionIdx = localSessions.findIndex((s) => s.id === sessionId);
    if (sessionIdx === -1) return;

    const session = { ...localSessions[sessionIdx] };
    if (!session.assignedMemberIds.includes(memberId)) {
      session.assignedMemberIds = [...session.assignedMemberIds, memberId];
      const newSessions = [...localSessions];
      newSessions[sessionIdx] = session;
      setLocalSessions(newSessions);
      setUnsavedChanges((prev) => new Set(prev).add(sessionId));
      setAddMemberModal(null);
    }
  };

  // --- PRAYER LOGIC ---

  const handleGeneratePrayer = async () => {
    const startStr = prayerWeek.toISOString().split("T")[0];
    const endOfWeek = new Date(prayerWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const endStr = endOfWeek.toISOString().split("T")[0];

    // Check if there are already slots for this week for this user
    const teacherHasSlots = filteredLocalPrayerSlots.some(s => s.date >= startStr && s.date < endStr);

    if (teacherHasSlots) {
      setGenMsg({ type: "error", text: "You already have a prayer schedule for this week!" });
      setTimeout(() => setGenMsg(null), 4000);
      return;
    }

    let targetMembers = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
        m.status !== MemberStatus.ARCHIVED,
    );

    const isTeacher = !isAdmin && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER);

    if (isTeacher && activeChurch !== "All" && activeChurch !== "CM") {
      const churchDiv = divisions[activeChurch] || divisions[currentUser.assignedChurch || ""];
      if (churchDiv) {
        const assignment = churchDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment && assignment.members.length > 0) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          const hasAssignedFnf = assignment.members.some((m) => m.type === MemberType.FNF);
          const hasAssignedVisitor = assignment.members.some(
            (m) => m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER,
          );

          targetMembers = targetMembers.filter((m) => {
            if (assignedIds.has(m.id)) return true;
            if (!hasAssignedFnf && m.type === MemberType.FNF) return true;
            if (
              !hasAssignedVisitor &&
              (m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER)
            )
              return true;
            return false;
          });
        }
      }
    }

    const res = await generatePrayerSchedule(prayerWeek, targetMembers, isTeacher ? currentUser.id : undefined);

    if (res.success) {
      if (res.data) {
        setLocalPrayerSlots(JSON.parse(JSON.stringify(res.data)));
      }
      setGenMsg({ type: "success", text: res.message });
      onUpdate();
    } else {
      setGenMsg({ type: "error", text: res.message });
    }
    setTimeout(() => setGenMsg(null), 4000);
  };

  const togglePrayerComplete = async (slotId: string) => {
    const slotIdx = localPrayerSlots.findIndex((s) => s.id === slotId);
    if (slotIdx === -1) return;

    const slot = { ...localPrayerSlots[slotIdx] };
    const wasComplete = slot.isCompleted;

    if (!wasComplete) {
      // Open modal to ask for duration instead of immediately toggling
      setPrayerDurationModal(slotId);
      return;
    }

    // Unmarking
    slot.isCompleted = false;
    slot.durationMins = 0;

    const newSlots = [...localPrayerSlots];
    newSlots[slotIdx] = slot;
    setLocalPrayerSlots(newSlots);

    try {
      await savePrayerSlot(slot);
      setUnsavedChanges((prev) => {
        const next = new Set(prev);
        next.delete(slotId);
        return next;
      });
      onUpdate();
      setGenMsg({ type: "success", text: "Prayer slot reverted to pending & saved." });
      setTimeout(() => setGenMsg(null), 3000);
    } catch (err) {
      console.error("Failed to unmark prayer slot:", err);
      setUnsavedChanges((prev) => new Set(prev).add(slotId));
      setGenMsg({ type: "error", text: "Failed to update prayer slot on server." });
      setTimeout(() => setGenMsg(null), 4000);
    }
  };

  const confirmPrayerDuration = async (mins: number) => {
    if (!prayerDurationModal) return;

    const slotId = prayerDurationModal;
    const slotIdx = localPrayerSlots.findIndex(
      (s) => s.id === slotId,
    );
    if (slotIdx === -1) {
      setPrayerDurationModal(null);
      return;
    }

    const currentSlot = localPrayerSlots[slotIdx];
    const slot: PrayerSlot = {
      ...currentSlot,
      isCompleted: true,
      durationMins: mins,
      completedBy: currentUser.name || currentUser.id || "Shepherd",
      teacherId: currentSlot.teacherId || currentUser.id,
      branchId: currentSlot.branchId || (currentUser.assignedChurch || "ALL"),
    };

    const newSlots = [...localPrayerSlots];
    newSlots[slotIdx] = slot;
    setLocalPrayerSlots(newSlots);
    setPrayerDurationModal(null);

    try {
      await savePrayerSlot(slot);
      setUnsavedChanges((prev) => {
        const next = new Set(prev);
        next.delete(slotId);
        return next;
      });
      onUpdate();
      setGenMsg({ type: "success", text: `Prayer session (${mins}m) saved!` });
      setTimeout(() => setGenMsg(null), 3000);
    } catch (err) {
      console.error("Failed to save prayer slot:", err);
      setUnsavedChanges((prev) => new Set(prev).add(slotId));
      setGenMsg({ type: "error", text: "Failed to sync prayer to server." });
      setTimeout(() => setGenMsg(null), 4000);
    }
  };

  const saveBatchChanges = async () => {
    setIsSaving(true);
    try {
      const sessionsToSave: OutreachSession[] = [];
      const prayersToSave: PrayerSlot[] = [];
      const sessionDeletes: Promise<any>[] = [];
      const prayerDeletes: Promise<any>[] = [];

      unsavedChanges.forEach((id) => {
        const session = localSessions.find((s) => s.id === id);
        if (session) {
          sessionsToSave.push(session);
          return;
        }
        const slot = localPrayerSlots.find((s) => s.id === id);
        if (slot) {
          prayersToSave.push(slot);
          return;
        }
        if (data.outreachSessions?.find((s) => s.id === id)) {
          sessionDeletes.push(deleteOutreachSession(id));
        } else if (data.prayerSchedule?.find((s) => s.id === id)) {
          prayerDeletes.push(deletePrayerSlot(id));
        }
      });

      await Promise.all([
        saveOutreachSessions(sessionsToSave),
        savePrayerSlots(prayersToSave),
        ...sessionDeletes,
        ...prayerDeletes,
      ]);

      setUnsavedChanges(new Set());
      setChangeCounts({ marked: 0, unmarked: 0 });
      onUpdate();
      setGenMsg({ type: "success", text: "All changes saved!" });
      setTimeout(() => setGenMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setGenMsg({ type: "error", text: "Failed to save changes." });
    } finally {
      setIsSaving(false);
    }
  };

  // --- DERIVED DATA & EXPORT LOGIC ---

  const filteredLocalSessions = useMemo(() => {
    let sessions = localSessions || [];
    const isTeacher = !isAdmin && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER);

    if (isTeacher && activeChurch !== "All" && activeChurch !== "CM") {
      const churchDiv = divisions[activeChurch] || divisions[currentUser.assignedChurch || ""];
      const assignment = churchDiv?.assignments.find((a) => a.teacher.id === currentUser.id);
      const assignedIds = assignment ? new Set(assignment.members.map((m) => m.id)) : new Set<string>();

      sessions = sessions.filter((s) => {
        if (s.teacherId) return s.teacherId === currentUser.id;
        return s.assignedMemberIds.some((id) => assignedIds.has(id));
      });
    }
    return sessions;
  }, [localSessions, isAdmin, activeChurch, currentUser, divisions]);

  const sortedVisits = useMemo(() => {
    const all = filteredLocalSessions || [];
    const today = new Date().toISOString().split("T")[0];

    // Only active (today or future) pending sessions appear in Up Next / Other Pending
    const pending = all
      .filter((s) => s.status === "PENDING" && (!s.date || s.date >= today))
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());
    const completed = all
      .filter((s) => s.status === "COMPLETED")
      .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime());
    const nextUp = pending.length > 0 ? pending[0] : null;
    const otherPending = pending.length > 0 ? pending.slice(1) : [];
    return { nextUp, otherPending, completed };
  }, [filteredLocalSessions]);

  // Derived list of MISSED/INCOMPLETE visits from past sessions
  const incompleteVisits = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const list: { memberId: string; date: string; sessionId: string }[] = [];

    (filteredLocalSessions || []).forEach((session) => {
      // If session date has ended (past), find unvisited members
      if (session.date && session.date < today && session.status !== "COMPLETED") {
        (session.assignedMemberIds || []).forEach((mid) => {
          if (!session.visitedMemberIds?.includes(mid)) {
            list.push({
              memberId: mid,
              date: session.date,
              sessionId: session.id,
            });
          }
        });
      }
    });
    return list.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [filteredLocalSessions]);

  const filteredLocalPrayerSlots = useMemo(() => {
    let slots = localPrayerSlots || [];
    const isTeacher = !isAdmin && (currentUser.role !== "BRANCH_COORDINATOR") && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.type === MemberType.HELPER);

    if (isTeacher && activeChurch !== "All" && activeChurch !== "CM") {
      const churchDiv = divisions[activeChurch] || divisions[currentUser.assignedChurch || ""];
      const assignment = churchDiv?.assignments.find((a) => a.teacher.id === currentUser.id);
      const assignedIds = assignment ? new Set(assignment.members.map((m) => m.id)) : new Set<string>();

      slots = slots.filter((s) => {
        if (s.teacherId) return s.teacherId === currentUser.id;
        return (s.assignedMemberIds || []).some((id) => assignedIds.has(id));
      });
    }
    return slots;
  }, [localPrayerSlots, isAdmin, activeChurch, currentUser, divisions]);

  const prayerData = useMemo(() => {
    if (filteredLocalPrayerSlots.length === 0)
      return { active: [], expired: [], completed: [] };
    const today = new Date().toISOString().split("T")[0];

    const all = [...filteredLocalPrayerSlots].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const expired = all.filter((s) => s.date < today && !s.isCompleted);
    const completed = all.filter((s) => s.isCompleted);
    const active = all.filter((s) => s.date >= today && !s.isCompleted);

    return { active, expired, completed };
  }, [filteredLocalPrayerSlots]);

  const prayerStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const completed = prayerData.completed.filter(
      (s) => !s.date || new Date(s.date).getFullYear() === currentYear
    );
    const totalSessions = completed.length;
    const totalDurationMins = completed.reduce((acc, s) => acc + (s.durationMins || 30), 0);
    const uniqueKids = new Set<string>();
    completed.forEach((s) => {
      (s.assignedMemberIds || []).forEach((id) => uniqueKids.add(id));
    });
    const hours = Math.floor(totalDurationMins / 60);
    const mins = totalDurationMins % 60;
    const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      totalSessions,
      timeFormatted,
      totalDurationMins,
      uniqueChildrenCount: uniqueKids.size,
      activeRemaining: prayerData.active.length,
    };
  }, [prayerData]);

  const handleExportVisits = () => {
    const pendingVisits = [
      sortedVisits.nextUp,
      ...sortedVisits.otherPending,
    ].filter(Boolean) as OutreachSession[];
    if (pendingVisits.length === 0) return;

    const events = pendingVisits.map((s) => {
      const names = s.assignedMemberIds
        .map((id) => data.members.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      // Construct UTC Dates manually for consistent ICS export (10 AM Local)
      const start = new Date(s.date);
      start.setUTCHours(10, 0, 0, 0); // 10:00 UTC (will render as 10:00 in calendar if we don't assume timezone offset)
      const end = new Date(start.getTime() + 5 * 60 * 60 * 1000); // 15:00 UTC

      return {
        title: `Visit: ${names}`,
        start,
        end,
        description: `Outreach visit to: ${names}`,
      };
    });
    downloadICS("visitation_schedule.ics", events);
  };

  const handleExportPrayer = () => {
    if (prayerData.active.length === 0) return;

    const events = prayerData.active.map((s) => {
      const names = s.assignedMemberIds
        .map((id) => data.members.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      // Construct UTC Dates (6 AM Local)
      const start = new Date(s.date);
      start.setUTCHours(6, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins

      return {
        title: `Prayer: ${names}`,
        start,
        end,
        description: `Praying for: ${names}`,
      };
    });
    downloadICS("prayer_schedule.ics", events);
  };

  // --- CONNECT TAB DATA (All Outreach Directory: Members, First Timers, FNF) ---
  const connectList = useMemo(() => {
    let list = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
        m.status !== MemberStatus.ARCHIVED,
    );

    const isTeacher =
      !isAdmin &&
      activeChurch !== "All" &&
      activeChurch !== "CM" &&
      (currentUser.type === MemberType.TEACHER ||
        currentUser.role === "TEACHER" ||
        currentUser.role === "BRANCH_COORDINATOR" ||
        currentUser.type === MemberType.HELPER);

    if (isTeacher) {
      const churchDiv =
        divisions[activeChurch] ||
        divisions[currentUser.assignedChurch || ""];
      if (churchDiv) {
        const assignment = churchDiv.assignments.find(
          (a) => a.teacher.id === currentUser.id,
        );
        if (assignment && assignment.members.length > 0) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          list = list.filter((m) => assignedIds.has(m.id));
        }
      }
    }

    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.phone && m.phone.includes(q)) ||
          (m.parentPhone && m.parentPhone.includes(q)) ||
          (m.address && m.address.toLowerCase().includes(q)),
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.members, activeChurch, filterChurch, isAdmin, currentUser, divisions, memberSearch]);

  // --- VISITOR / FIRST TIMER / FNF COUNT POOL ---
  const visitorList = useMemo(() => {
    return connectList.filter(
      (m) =>
        m.type === MemberType.VISITOR ||
        m.type === MemberType.FNF ||
        m.type === MemberType.NOT_MEMBER,
    );
  }, [connectList]);

  const handlePromoteToMember = async (member: Member) => {
    try {
      setPromotingId(member.id);
      const updated: Member = {
        ...member,
        type: MemberType.MEMBER,
        status: MemberStatus.ACTIVE,
      };
      await updateMember(updated.id, updated);
      setGenMsg({
        type: "success",
        text: `${member.name} promoted to full Member!`,
      });
      setTimeout(() => setGenMsg(null), 3000);
      onUpdate();
    } catch (e) {
      console.error(e);
      setGenMsg({ type: "error", text: `Failed to promote ${member.name}` });
    } finally {
      setPromotingId(null);
    }
  };

  const handleTrackCall = (member: Member, method: "Call" | "SMS") => {
    setCallModal({ show: true, member, method });
  };

  const confirmCallTrack = (
    outcome: "REACHED" | "UNREACHABLE" | "PENDING",
  ) => {
    if (!callModal) return;
    const { member, method } = callModal;

    const newSession: OutreachSession = {
      id: Date.now().toString(),
      sessionType: "CALL",
      outcome: outcome,
      date: new Date().toISOString().split("T")[0],
      startTime: "00:00",
      endTime: "00:00",
      assignedMemberIds: [member.id],
      visitedMemberIds: [member.id],
      status: "COMPLETED",
      notes: `Connected via ${method} - ${outcome}`,
      completedBy: currentUser.id,
    };
    setCallModal(null);
    saveOutreachSession(newSession)
      .then(() => onUpdate())
      .catch(console.error);
  };

  const scopeLabel = useMemo(() => {
    return getScopeDisplayLabel(activeBranchId, data.settings?.organization);
  }, [activeBranchId, data.settings?.organization]);

  const isSuperAdmin = isSuperAdminUser(currentUser);

  const visibleOutreachTabs = useMemo(() => {
    const all: { id: "VISIT" | "PRAYER" | "CONNECT" | "TRACK"; label: string; icon: any; badge?: number }[] = [
      { id: "VISIT", label: "Visits", icon: MapPin },
      { id: "PRAYER", label: "Prayer", icon: Heart },
      { id: "CONNECT", label: "Members", icon: Phone, badge: connectList.length },
      { id: "TRACK", label: "Progress", icon: BarChart2 },
    ];
    if (isSuperAdmin || currentUser.role === "ADMIN") return all;
    return all.filter((tab) => hasRoleSubfeature(data, currentUser.role || "", "Outreach", tab.id));
  }, [data, currentUser.role, isSuperAdmin, connectList.length]);

  useEffect(() => {
    if (visibleOutreachTabs.length > 0 && !visibleOutreachTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleOutreachTabs[0].id);
    }
  }, [visibleOutreachTabs, activeTab]);

  return (
    <div className="space-y-4 pb-24 relative min-h-screen">
      {connectList.length === 0 && (filteredLocalSessions || []).length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center space-y-2 animate-in fade-in">
          <MapPin className="mx-auto text-amber-500" size={32} />
          <h3 className="font-extrabold text-amber-900 text-base">
            No Outreach Records Found {scopeLabel ? `for ${scopeLabel}` : ""}
          </h3>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            There are currently no outreach sessions or assigned members for this branch/zone. Switch branches above or generate an outreach schedule to begin.
          </p>
        </div>
      )}

      {/* HEADER TABS */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-1.5 sticky top-0 z-30 overflow-x-auto hide-scrollbar">
        {visibleOutreachTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[85px] flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-500 hover:bg-slate-50"
                }`}
            >
              <Icon size={16} /> {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab.id
                    ? "bg-indigo-700 text-white"
                    : "bg-slate-100 text-slate-600"
                    }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isAdmin && (
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block pl-2">
              Church
            </label>
            <select
              value={filterChurch}
              onChange={(e) => setFilterChurch(e.target.value)}
              className="w-full text-sm font-bold bg-slate-50 border-none rounded-xl px-4 py-2.5 text-slate-700 outline-none hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <option value="ALL">All Churches</option>
              {Array.isArray(data.settings?.churches) ? data.settings?.churches : ["UJ", "LJ", "K", "I", "N"].map((church) => (
                <option key={church} value={church}>
                  {church}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* VISIT TAB */}
      {activeTab === "VISIT" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => setIsCreatorOpen(!isCreatorOpen)}
            className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 font-bold hover:bg-indigo-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Calendar size={20} /> Plan New Visits
            </span>
            {isCreatorOpen ? <ChevronUp size={20} /> : <Plus size={20} />}
          </button>

          {isCreatorOpen && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                />
                <button
                  onClick={handleAddDate}
                  disabled={!newDateInput}
                  className="px-4 bg-indigo-600 text-white rounded-xl"
                >
                  <Plus />
                </button>
              </div>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDates.map((d) => (
                    <span
                      key={d}
                      className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-2"
                    >
                      {formatDateDDMMYYYY(d)}{" "}
                      <button onClick={() => handleRemoveDate(d)}>
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={handleGenerateSchedule}
                disabled={selectedDates.length === 0}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
              >
                Generate Schedule
              </button>
              {errorMsg && (
                <p className="text-xs text-red-500 font-bold text-center">
                  {errorMsg}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            {(sortedVisits.nextUp || sortedVisits.otherPending.length > 0) && (
              <div className="flex justify-end">
                <button
                  onClick={handleExportVisits}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs shadow-sm hover:bg-indigo-50 transition-colors"
                >
                  <CalendarPlus size={16} /> Add Schedule to Calendar
                </button>
              </div>
            )}

            {sortedVisits.nextUp && (
              <div className="relative">
                <div className="absolute -left-3 top-4 bottom-4 w-1 bg-gradient-to-b from-indigo-500 to-indigo-200 rounded-full hidden md:block"></div>
                <div
                  className={`bg-white rounded-3xl shadow-lg border overflow-hidden transition-all ${unsavedChanges.has(sortedVisits.nextUp.id) ? "border-amber-400 shadow-amber-100" : "border-indigo-100 shadow-indigo-100"}`}
                >
                  <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">
                        Up Next
                      </div>
                      <h3 className="text-2xl font-bold">
                        {getRelativeTime(sortedVisits.nextUp.date)}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-extrabold opacity-20">
                        <CalendarDays size={40} />
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <SessionChildList
                      session={sortedVisits.nextUp}
                      data={data}
                      onToggle={toggleVisitForMember}
                      onMove={(mid, sid) =>
                        setMoveModal({
                          show: true,
                          memberId: mid,
                          currentSessionId: sid,
                        })
                      }
                      onRemove={handleRemoveMemberFromSession}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() =>
                          setAddMemberModal({
                            show: true,
                            sessionId: sortedVisits.nextUp!.id,
                          })
                        }
                        className="flex-1 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={14} /> Add Member
                      </button>
                      {sortedVisits.nextUp.assignedMemberIds.length < 4 && (
                        <button
                          onClick={() =>
                            handleAutoFill(sortedVisits.nextUp!.id)
                          }
                          className="flex-1 py-2 text-xs font-bold text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <Zap size={14} /> Auto-Fill
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">
                      {sortedVisits.nextUp.assignedMemberIds.length} Kids
                      Assigned
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const names = sortedVisits
                            .nextUp!.assignedMemberIds.map(
                              (id) =>
                                data.members.find((m) => m.id === id)?.name,
                            )
                            .filter(Boolean)
                            .join(", ");
                          addToGoogleCalendar(
                            `Visit: ${names}`,
                            sortedVisits.nextUp!.date,
                            `Visit to: ${names}`,
                            300,
                            true,
                          );
                        }}
                        className="text-slate-300 hover:text-indigo-500 p-2"
                        title="Add to Google Calendar"
                      >
                        <CalendarPlus size={16} />
                      </button>
                      <button
                        onClick={(e) =>
                          handleDeleteSession(sortedVisits.nextUp!.id, e)
                        }
                        disabled={loadingId === sortedVisits.nextUp.id}
                        className="text-slate-300 hover:text-red-500 p-2 disabled:opacity-50"
                      >
                        {loadingId === sortedVisits.nextUp.id ? (
                          <Loader2
                            size={16}
                            className="animate-spin text-indigo-500"
                          />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {sortedVisits.otherPending.map((session) => (
              <div
                key={session.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden opacity-90 hover:opacity-100 transition-all ${unsavedChanges.has(session.id) ? "border-amber-400 ring-1 ring-amber-400" : "border-slate-200"}`}
              >
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h4 className="font-bold text-slate-700">
                    {formatDateDDMMYYYY(session.date)}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const names = session.assignedMemberIds
                          .map(
                            (id) => data.members.find((m) => m.id === id)?.name,
                          )
                          .filter(Boolean)
                          .join(", ");
                        addToGoogleCalendar(
                          `Visit: ${names}`,
                          session.date,
                          `Visit to: ${names}`,
                          300,
                          true,
                        );
                      }}
                      className="text-slate-300 hover:text-indigo-500 p-1"
                      title="Add to Google Calendar"
                    >
                      <CalendarPlus size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      disabled={loadingId === session.id}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                    >
                      {loadingId === session.id ? (
                        <Loader2
                          size={16}
                          className="animate-spin text-indigo-500"
                        />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <SessionChildList
                    session={session}
                    data={data}
                    onToggle={toggleVisitForMember}
                    onMove={(mid, sid) =>
                      setMoveModal({
                        show: true,
                        memberId: mid,
                        currentSessionId: sid,
                      })
                    }
                    onRemove={handleRemoveMemberFromSession}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() =>
                        setAddMemberModal({ show: true, sessionId: session.id })
                      }
                      className="flex-1 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={14} /> Add Member
                    </button>
                    {session.assignedMemberIds.length < 4 && (
                      <button
                        onClick={() => handleAutoFill(session.id)}
                        className="flex-1 py-2 text-xs font-bold text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Zap size={14} /> Auto-Fill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* MISSED / YET TO COMPLETE SECTION - FOLDABLE ASCENDING */}
            {incompleteVisits.length > 0 && (
              <div className="pt-4 border-t border-dashed border-slate-200">
                <CollapsibleMissedSection
                  title="Missed Visits (Awaiting Rescheduling)"
                  items={incompleteVisits}
                  data={data}
                  onReschedule={(mid, sid) =>
                    setMoveModal({
                      show: true,
                      memberId: mid,
                      currentSessionId: sid,
                    })
                  }
                  onRemove={handleRemoveMemberFromSession}
                />
              </div>
            )}

            {sortedVisits.completed.length > 0 && (
              <div className="pt-6">
                <CollapsibleCompletedVisits
                  title="Completed History"
                  sessions={sortedVisits.completed}
                  data={data}
                  loadingId={loadingId}
                  onDelete={handleDeleteSession}
                  onUndoVisit={handleUndoVisit}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRAYER TAB */}
      {activeTab === "PRAYER" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-1">Prayer Wall</h3>
              <p className="text-indigo-100 text-sm opacity-90 mb-4">
                Interceding for 5 specific children daily.
              </p>
              <button
                onClick={handleGeneratePrayer}
                className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow-sm hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-2"
              >
                <RefreshCw size={14} /> Generate This Week
              </button>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <Heart size={120} />
            </div>
          </div>

          {/* Live Prayer Achievement & Accounting Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-indigo-600" /> Sessions Done
              </span>
              <span className="text-2xl font-black text-slate-800">
                {prayerStats.totalSessions}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Completed intercessions</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-purple-600" /> Time Interceded
              </span>
              <span className="text-2xl font-black text-slate-800">
                {prayerStats.timeFormatted}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Total duration prayed</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Heart size={13} className="text-teal-600" /> Children Covered
              </span>
              <span className="text-2xl font-black text-slate-800">
                {prayerStats.uniqueChildrenCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Unique souls lifted</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CalendarDays size={13} className="text-amber-600" /> Pending This Week
              </span>
              <span className="text-2xl font-black text-slate-800">
                {prayerStats.activeRemaining}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Slots remaining</span>
            </div>
          </div>

          {genMsg && (
            <div
              className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${genMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
            >
              {genMsg.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              {genMsg.text}
            </div>
          )}

          {/* Missed & Expired Section */}
          <CollapsibleSection
            title="Missed and Expired"
            items={prayerData.expired}
            data={data}
            unsavedChanges={unsavedChanges}
            onToggle={togglePrayerComplete}
            isExpired={true}
            color="amber"
            icon={AlertCircle}
          />

          {/* Current Schedule Section */}
          <CollapsibleSection
            title="Current Schedule"
            items={prayerData.active}
            data={data}
            unsavedChanges={unsavedChanges}
            onToggle={togglePrayerComplete}
            color="indigo"
            icon={CalendarDays}
            defaultOpen={true}
            headerAction={
              prayerData.active.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportPrayer();
                  }}
                  className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors mr-2"
                  title="Add All to Calendar"
                >
                  <CalendarPlus size={18} />
                </button>
              )
            }
          />

          {/* Completed History Section (Grouped by Period) */}
          <CollapsibleHistorySection
            items={prayerData.completed}
            data={data}
            unsavedChanges={unsavedChanges}
            onToggle={togglePrayerComplete}
          />
        </div>
      )}

      {/* CONNECT TAB (Members, First Timers & FNF with Categories) */}
      {activeTab === "CONNECT" && (() => {
        const activeMembers = connectList.filter(
          (m) => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE,
        );
        const inconsistentMembers = connectList.filter(
          (m) => m.type === MemberType.MEMBER && m.status === MemberStatus.INCONSISTENT,
        );
        const notActiveMembers = connectList.filter(
          (m) => m.type === MemberType.MEMBER && m.status === MemberStatus.NOT_ACTIVE,
        );
        const firstTimers = connectList.filter(
          (m) => m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER,
        );
        const fnfMembers = connectList.filter(
          (m) => m.type === MemberType.FNF,
        );

        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {/* Search & Category Filter Header */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search by name, phone, parent phone, or address..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
                {memberSearch && (
                  <button
                    onClick={() => setMemberSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-1">
                <button
                  onClick={() => setMemberCategoryFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${memberCategoryFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  <span>All Contacts</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${memberCategoryFilter === "ALL" ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-700"}`}>
                    {connectList.length}
                  </span>
                </button>

                <button
                  onClick={() => setMemberCategoryFilter("ACTIVE")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${memberCategoryFilter === "ACTIVE"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    }`}
                >
                  <User size={12} />
                  <span>Active</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${memberCategoryFilter === "ACTIVE" ? "bg-indigo-700 text-white" : "bg-indigo-200/70 text-indigo-800"}`}>
                    {activeMembers.length}
                  </span>
                </button>

                <button
                  onClick={() => setMemberCategoryFilter("INCONSISTENT")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${memberCategoryFilter === "INCONSISTENT"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                >
                  <AlertCircle size={12} />
                  <span>Inconsistent</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${memberCategoryFilter === "INCONSISTENT" ? "bg-rose-700 text-white" : "bg-rose-200/70 text-rose-800"}`}>
                    {inconsistentMembers.length}
                  </span>
                </button>

                <button
                  onClick={() => setMemberCategoryFilter("NOT_ACTIVE")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${memberCategoryFilter === "NOT_ACTIVE"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                >
                  <Clock size={12} />
                  <span>Not Active</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${memberCategoryFilter === "NOT_ACTIVE" ? "bg-amber-700 text-white" : "bg-amber-200/70 text-amber-800"}`}>
                    {notActiveMembers.length}
                  </span>
                </button>

                <button
                  onClick={() => setMemberCategoryFilter("VISITOR")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${memberCategoryFilter === "VISITOR"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                    }`}
                >
                  <UserPlus size={12} />
                  <span>First Timers</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${memberCategoryFilter === "VISITOR" ? "bg-teal-700 text-white" : "bg-teal-200/70 text-teal-800"}`}>
                    {firstTimers.length}
                  </span>
                </button>

                <button
                  onClick={() => setMemberCategoryFilter("FNF")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${memberCategoryFilter === "FNF"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                >
                  <Heart size={12} />
                  <span>Friends & Family</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${memberCategoryFilter === "FNF" ? "bg-emerald-700 text-white" : "bg-emerald-200/70 text-emerald-800"}`}>
                    {fnfMembers.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Collapsible Category Sections */}
            {(memberCategoryFilter === "ALL" || memberCategoryFilter === "ACTIVE") && (
              <CollapsibleContactSection
                title="Active Members"
                members={activeMembers}
                color="indigo"
                icon={User}
                defaultOpen={true}
                onTrackCall={handleTrackCall}
                onMessageClick={handleMessageClick}
                onEditClick={handleEditClick}
              />
            )}

            {(memberCategoryFilter === "ALL" || memberCategoryFilter === "INCONSISTENT") && (
              <CollapsibleContactSection
                title="Inconsistent Members"
                members={inconsistentMembers}
                color="rose"
                icon={AlertCircle}
                defaultOpen={memberCategoryFilter === "INCONSISTENT"}
                onTrackCall={handleTrackCall}
                onMessageClick={handleMessageClick}
                onEditClick={handleEditClick}
              />
            )}

            {(memberCategoryFilter === "ALL" || memberCategoryFilter === "NOT_ACTIVE") && (
              <CollapsibleContactSection
                title="Not Active Members"
                members={notActiveMembers}
                color="amber"
                icon={Clock}
                defaultOpen={memberCategoryFilter === "NOT_ACTIVE"}
                onTrackCall={handleTrackCall}
                onMessageClick={handleMessageClick}
                onEditClick={handleEditClick}
              />
            )}

            {(memberCategoryFilter === "ALL" || memberCategoryFilter === "VISITOR") && (
              <CollapsibleContactSection
                title="First Timers (Follow Up)"
                members={firstTimers}
                color="teal"
                icon={UserPlus}
                defaultOpen={memberCategoryFilter === "VISITOR" || memberCategoryFilter === "ALL"}
                onTrackCall={handleTrackCall}
                onMessageClick={handleMessageClick}
                onEditClick={handleEditClick}
                onPromoteClick={handlePromoteToMember}
                promotingId={promotingId}
              />
            )}

            {(memberCategoryFilter === "ALL" || memberCategoryFilter === "FNF") && (
              <CollapsibleContactSection
                title="(FNF)"
                members={fnfMembers}
                color="emerald"
                icon={Heart}
                defaultOpen={memberCategoryFilter === "FNF"}
                onTrackCall={handleTrackCall}
                onMessageClick={handleMessageClick}
                onEditClick={handleEditClick}
                onPromoteClick={handlePromoteToMember}
                promotingId={promotingId}
              />
            )}
          </div>
        );
      })()}

      {/* TRACKING TAB */}
      {activeTab === "TRACK" &&
        (() => {
          const focusChurchId =
            currentUser.assignedChurch &&
              currentUser.assignedChurch !== "All" &&
              currentUser.assignedChurch !== "CM"
              ? currentUser.assignedChurch
              : activeChurch !== "All" && activeChurch !== "CM"
                ? activeChurch
                : "UJ";

          const churchConfigMap: Record<
            string,
            { id: string; name: string; ageRange: string }
          > = {
            UJ: { id: "UJ", name: "UJ", ageRange: "Ages 9-12" },
            LJ: { id: "LJ", name: "LJ", ageRange: "Ages 6-8" },
            K: { id: "K", name: "K", ageRange: "Ages 2-5" },
            I: { id: "I", name: "I", ageRange: "Ages 0-1" },
          };

          const currentChurch =
            churchConfigMap[focusChurchId] || {
              id: focusChurchId,
              name: `${focusChurchId} Church`,
              ageRange: "",
            };

          const currentYear = new Date().getFullYear();
          let exactlyOnceVisit = 0;
          let multipleTimesVisit = 0;
          let exactlyOnceCall = 0;
          let multipleTimesCall = 0;
          let exactlyOncePrayed = 0;
          let multipleTimesPrayed = 0;

          // Focus on target children based on shepherd roster vs church-wide
          const churchKids = data.members.filter(
            (m) =>
              m.assignedChurch === focusChurchId &&
              !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
              m.status !== MemberStatus.ARCHIVED,
          );

          const isTeacher = !isAdmin && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.type === MemberType.HELPER);
          const churchDiv = divisions[focusChurchId];
          const teacherAssignment = isTeacher && churchDiv?.assignments
            ? churchDiv.assignments.find((a) => a.teacher.id === currentUser.id)
            : null;

          const targetKids = teacherAssignment ? teacherAssignment.members : churchKids;
          const targetKidIds = new Set(targetKids.map((k) => k.id));

          // Completed prayer slots in currentYear
          const completedPrayersThisYear = (localPrayerSlots || []).filter(
            (s) => s.isCompleted && (!s.date || new Date(s.date).getFullYear() === currentYear)
          );

          targetKids.forEach((m) => {
            const visits = localSessions.filter(
              (s) =>
                s.status === "COMPLETED" &&
                (s.sessionType === "VISIT" || !s.sessionType) &&
                new Date(s.date).getFullYear() === currentYear &&
                s.visitedMemberIds?.includes(m.id),
            ).length;

            if (visits === 1) exactlyOnceVisit++;
            else if (visits > 1) multipleTimesVisit++;

            const calls = localSessions.filter(
              (s) =>
                s.status === "COMPLETED" &&
                s.sessionType === "CALL" &&
                s.outcome === "REACHED" &&
                new Date(s.date).getFullYear() === currentYear &&
                s.visitedMemberIds?.includes(m.id),
            ).length;

            if (calls === 1) exactlyOnceCall++;
            else if (calls > 1) multipleTimesCall++;

            const prayers = completedPrayersThisYear.filter((s) =>
              (s.assignedMemberIds || []).includes(m.id)
            ).length;

            if (prayers === 1) exactlyOncePrayed++;
            else if (prayers > 1) multipleTimesPrayed++;
          });

          const churchPrayerSlots = completedPrayersThisYear.filter((s) => {
            if (teacherAssignment) {
              return (
                (s.assignedMemberIds || []).some((id) => targetKidIds.has(id)) ||
                (s.teacherId && s.teacherId === currentUser.id)
              );
            }
            return (
              (s.assignedMemberIds || []).some((id) => churchKids.some((k) => k.id === id)) ||
              (s.branchId && (s.branchId === focusChurchId || focusChurchId === "ALL"))
            );
          });
          const totalPrayerMins = churchPrayerSlots.reduce((acc, s) => acc + (s.durationMins || 30), 0);

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center xl:text-left">
                    <h3 className="font-bold text-xl text-slate-800 mb-1">
                      Visits Progress {currentYear} ({currentChurch.name})
                    </h3>
                    <p className="text-sm text-slate-500">
                      Goal: 2 visits per child per year.
                    </p>
                  </div>
                  <div className="flex gap-4 w-full xl:w-auto text-center md:text-left">
                    <div className="flex-1 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 min-w-[120px] text-center">
                      <div className="flex justify-center items-center gap-2 mb-1">
                        <Target size={18} className="text-indigo-500" />
                        <div className="text-2xl font-black text-indigo-700">
                          {exactlyOnceVisit}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">
                        Visited Once
                      </div>
                      <div className="text-[10px] text-indigo-500 mt-1">
                        Needs 1 more visit
                      </div>
                    </div>
                    <div className="flex-1 bg-teal-50 p-4 rounded-2xl border border-teal-100 min-w-[120px] text-center">
                      <div className="flex justify-center items-center gap-2 mb-1">
                        <CheckCircle2 size={18} className="text-teal-500" />
                        <div className="text-2xl font-black text-teal-700">
                          {multipleTimesVisit}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-teal-900 uppercase tracking-wider">
                        Visited 2+ Times
                      </div>
                      <div className="text-[10px] text-teal-500 mt-1">
                        Goal Reached
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center xl:text-left">
                    <h3 className="font-bold text-xl text-slate-800 mb-1">
                      Calls Progress {currentYear} ({currentChurch.name})
                    </h3>
                    <p className="text-sm text-slate-500">
                      Number of children reached.
                    </p>
                  </div>
                  <div className="flex gap-4 w-full xl:w-auto text-center md:text-left">
                    <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100 min-w-[120px] text-center">
                      <div className="flex justify-center items-center gap-2 mb-1">
                        <Phone size={18} className="text-blue-500" />
                        <div className="text-2xl font-black text-blue-700">
                          {exactlyOnceCall}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                        Called Once
                      </div>
                    </div>
                    <div className="flex-1 bg-purple-50 p-4 rounded-2xl border border-purple-100 min-w-[120px] text-center">
                      <div className="flex justify-center items-center gap-2 mb-1">
                        <Phone size={18} className="text-purple-500" />
                        <div className="text-2xl font-black text-purple-700">
                          {multipleTimesCall}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                        Called 2+ Times
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const churchConfig = [
                  { id: "UJ", name: "UJ", ageRange: "Ages 9-12" },
                  { id: "LJ", name: "LJ", ageRange: "Ages 6-8" },
                  { id: "K", name: "K", ageRange: "Ages 2-5" },
                  { id: "I", name: "I", ageRange: "Ages 0-1" },
                ];

                const currentChurch =
                  churchConfig.find((c) => c.id === focusChurchId) ||
                  churchConfig[0];

                // Children in this church
                const churchKids = data.members.filter(
                  (m) =>
                    m.assignedChurch === focusChurchId &&
                    !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
                    m.status !== MemberStatus.ARCHIVED,
                );
                const churchKidIds = new Set(churchKids.map((m) => m.id));

                // Teachers in this church
                const churchDivision = divisions[focusChurchId];
                const teacherAssignments = churchDivision?.assignments || [];

                const churchTeachersMap = new Map<
                  string,
                  { teacher: Member; assignedKids: Member[] }
                >();

                teacherAssignments
                  .filter((a) => a.members.length > 0)
                  .forEach((a) => {
                    churchTeachersMap.set(a.teacher.id, {
                      teacher: a.teacher,
                      assignedKids: a.members,
                    });
                  });

                // Completed sessions in current year for children in this church
                const churchSessionsThisYear = localSessions.filter(
                  (s) =>
                    s.status === "COMPLETED" &&
                    new Date(s.date).getFullYear() === currentYear &&
                    s.visitedMemberIds?.some((id) => churchKidIds.has(id)),
                );

                // Map teacher metrics within this church
                const churchTeacherMetrics = Array.from(
                  churchTeachersMap.values(),
                )
                  .map(({ teacher, assignedKids }) => {
                    const assignedKidIds = new Set(
                      assignedKids.map((k) => k.id),
                    );

                    // Visits by this teacher for this church's kids
                    const teacherVisits = localSessions.filter(
                      (s) =>
                        s.status === "COMPLETED" &&
                        (s.sessionType === "VISIT" || !s.sessionType) &&
                        new Date(s.date).getFullYear() === currentYear &&
                        s.completedBy === teacher.id &&
                        s.visitedMemberIds?.some((id) => churchKidIds.has(id)),
                    );
                    const visitTouches = teacherVisits.reduce((acc, s) => {
                      return (
                        acc +
                        (s.visitedMemberIds?.filter((id) => churchKidIds.has(id))
                          .length || 0)
                      );
                    }, 0);

                    // Calls by this teacher for this church's kids
                    const teacherCalls = localSessions.filter(
                      (s) =>
                        s.status === "COMPLETED" &&
                        s.sessionType === "CALL" &&
                        s.outcome === "REACHED" &&
                        new Date(s.date).getFullYear() === currentYear &&
                        s.completedBy === teacher.id &&
                        s.visitedMemberIds?.some((id) => churchKidIds.has(id)),
                    );
                    const callTouches = teacherCalls.reduce((acc, s) => {
                      return (
                        acc +
                        (s.visitedMemberIds?.filter((id) => churchKidIds.has(id))
                          .length || 0)
                      );
                    }, 0);

                    // Unique kids contacted by this teacher
                    const contactedKidIds = new Set<string>();
                    teacherVisits.forEach((s) =>
                      s.visitedMemberIds?.forEach((id) => {
                        if (churchKidIds.has(id)) contactedKidIds.add(id);
                      }),
                    );
                    teacherCalls.forEach((s) =>
                      s.visitedMemberIds?.forEach((id) => {
                        if (churchKidIds.has(id)) contactedKidIds.add(id);
                      }),
                    );

                    let assignedContactedCount = 0;
                    contactedKidIds.forEach((id) => {
                      if (assignedKidIds.has(id)) assignedContactedCount++;
                    });

                    const coveragePercent =
                      assignedKids.length > 0
                        ? Math.round(
                          (assignedContactedCount / assignedKids.length) * 100,
                        )
                        : contactedKidIds.size > 0
                          ? 100
                          : 0;

                    const allTeacherDates = [
                      ...teacherVisits,
                      ...teacherCalls,
                    ].map((s) => new Date(s.date).getTime());
                    const lastActiveTimestamp =
                      allTeacherDates.length > 0
                        ? Math.max(...allTeacherDates)
                        : null;

                    return {
                      id: teacher.id,
                      name: teacher.name,
                      role: teacher.role || teacher.type,
                      assignedCount: assignedKids.length,
                      visits: visitTouches,
                      calls: callTouches,
                      total: visitTouches + callTouches,
                      uniqueContacted: contactedKidIds.size,
                      coveragePercent,
                      lastActive: lastActiveTimestamp
                        ? new Date(lastActiveTimestamp).toISOString()
                        : null,
                    };
                  })
                  .sort((a, b) => b.total - a.total);

                // Monthly trend data for this church
                const monthLabels = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                const churchMonthlyTrends = monthLabels.map((mName, mIdx) => {
                  const mVisits = localSessions
                    .filter((s) => {
                      if (
                        s.status !== "COMPLETED" ||
                        (s.sessionType !== "VISIT" && s.sessionType)
                      )
                        return false;
                      const d = new Date(s.date);
                      return (
                        d.getFullYear() === currentYear &&
                        d.getMonth() === mIdx &&
                        s.visitedMemberIds?.some((id) => churchKidIds.has(id))
                      );
                    })
                    .reduce(
                      (acc, s) =>
                        acc +
                        (s.visitedMemberIds?.filter((id) => churchKidIds.has(id))
                          .length || 0),
                      0,
                    );

                  const mCalls = localSessions
                    .filter((s) => {
                      if (
                        s.status !== "COMPLETED" ||
                        s.sessionType !== "CALL" ||
                        s.outcome !== "REACHED"
                      )
                        return false;
                      const d = new Date(s.date);
                      return (
                        d.getFullYear() === currentYear &&
                        d.getMonth() === mIdx &&
                        s.visitedMemberIds?.some((id) => churchKidIds.has(id))
                      );
                    })
                    .reduce(
                      (acc, s) =>
                        acc +
                        (s.visitedMemberIds?.filter((id) => churchKidIds.has(id))
                          .length || 0),
                      0,
                    );

                  return {
                    month: mName,
                    visits: mVisits,
                    calls: mCalls,
                    total: mVisits + mCalls,
                  };
                });

                const totalChurchVisits = churchMonthlyTrends.reduce(
                  (sum, m) => sum + m.visits,
                  0,
                );
                const totalChurchCalls = churchMonthlyTrends.reduce(
                  (sum, m) => sum + m.calls,
                  0,
                );
                const totalChurchTouches = totalChurchVisits + totalChurchCalls;

                const allContactedKidsInChurch = new Set<string>();
                churchSessionsThisYear.forEach((s) => {
                  if (s.sessionType === "CALL" && s.outcome !== "REACHED") return;
                  s.visitedMemberIds?.forEach((id) => {
                    if (churchKidIds.has(id)) allContactedKidsInChurch.add(id);
                  });
                });
                const churchOverallCoverage =
                  churchKids.length > 0
                    ? Math.round(
                      (allContactedKidsInChurch.size / churchKids.length) * 100,
                    )
                    : 0;


                return (
                  <div className="space-y-6">
                    {/* SECTION CONTAINER */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                      {/* HEADER */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                              <TrendingUp size={20} />
                            </span>
                            <h3 className="font-extrabold text-slate-800 text-lg">
                              Outreach by Age Group ({currentChurch.name})
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Trends and insights for calls and visits for teachers within {currentChurch.name} church.
                          </p>
                        </div>
                      </div>

                      {/* CHARTS GRID: MONTHLY TREND & TEACHER COMPARISON */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                        {/* CHART 1: MONTHLY TRENDS */}
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">
                                Monthly Outreach Trend ({currentYear})
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Total calls and visits logged per month in {currentChurch.name}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                              {currentChurch.id}
                            </span>
                          </div>

                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={churchMonthlyTrends}
                                margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                  stroke="#E2E8F0"
                                />
                                <XAxis
                                  dataKey="month"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: "#64748B" }}
                                />
                                <YAxis
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: "#64748B" }}
                                  allowDecimals={false}
                                />
                                <RechartsTooltip
                                  cursor={{ fill: "#F1F5F9" }}
                                  contentStyle={{
                                    borderRadius: "12px",
                                    border: "1px solid #E2E8F0",
                                    boxShadow:
                                      "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                  }}
                                />
                                <Legend verticalAlign="top" height={30} />
                                <Bar
                                  dataKey="visits"
                                  name="Visits"
                                  stackId="a"
                                  fill="#6366f1"
                                  radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                  dataKey="calls"
                                  name="Calls"
                                  stackId="a"
                                  fill="#06b6d4"
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* CHART 2: SHEPHERD OUTREACH */}
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">
                                Shepherd Outreach
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Visits vs calls completed by shepherds within {currentChurch.name}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                              {churchTeacherMetrics.length} Shepherds
                            </span>
                          </div>

                          <div className="h-56">
                            {churchTeacherMetrics.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                                No shepherds assigned to this church yet.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={churchTeacherMetrics.slice(0, 6).map((t) => ({
                                    name:
                                      t.name.length > 12
                                        ? t.name.substring(0, 11) + "…"
                                        : t.name,
                                    visits: t.visits,
                                    calls: t.calls,
                                  }))}
                                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#E2E8F0"
                                  />
                                  <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#64748B" }}
                                  />
                                  <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#64748B" }}
                                    allowDecimals={false}
                                  />
                                  <RechartsTooltip
                                    cursor={{ fill: "#F1F5F9" }}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid #E2E8F0",
                                      boxShadow:
                                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                    }}
                                  />
                                  <Legend verticalAlign="top" height={30} />
                                  <Bar
                                    dataKey="visits"
                                    name="Visits"
                                    fill="#6366f1"
                                    radius={[4, 4, 0, 0]}
                                  />
                                  <Bar
                                    dataKey="calls"
                                    name="Calls"
                                    fill="#06b6d4"
                                    radius={[4, 4, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <CollapsibleProgressSection
                title="Members"
                members={connectList.filter(
                  (m) => m.type === MemberType.MEMBER,
                )}
                data={data}
                icon={User}
                color="indigo"
              />
              <CollapsibleProgressSection
                title="Friends & Family (FNF)"
                members={connectList.filter((m) => m.type === MemberType.FNF)}
                data={data}
                icon={User}
                color="amber"
              />
              <CollapsibleProgressSection
                title="First Timers"
                members={connectList.filter(
                  (m) => m.type === MemberType.VISITOR,
                )}
                data={data}
                icon={UserPlus}
                color="teal"
              />
            </div>
          );
        })()}

      {/* PRAYER DURATION MODAL */}
      {prayerDurationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-1 text-slate-800">
              Prayer Duration
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              How many minutes did you pray for this group today?
            </p>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[0, 5, 10, 15, 20, 25, 30].map((mins) => (
                <button
                  key={mins}
                  onClick={() => confirmPrayerDuration(mins)}
                  className="py-2.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 transition-colors"
                >
                  {mins}m
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setPrayerDurationModal(null)}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALL MODAL */}
      {callModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg mb-1 text-slate-800">
              Record {callModal.method}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Did you reach {callModal.member.name}?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => confirmCallTrack("REACHED")}
                className="w-full p-4 text-left border border-green-100 bg-green-50/50 rounded-2xl hover:bg-green-100 transition-colors flex items-center gap-3"
              >
                <div className="p-2 bg-green-500 text-white rounded-full">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div className="font-bold text-green-800">Reached</div>
                  <div className="text-xs text-green-600">
                    Successfully connected
                  </div>
                </div>
              </button>
              <button
                onClick={() => confirmCallTrack("UNREACHABLE")}
                className="w-full p-4 text-left border border-amber-100 bg-amber-50/50 rounded-2xl hover:bg-amber-100 transition-colors flex items-center gap-3"
              >
                <div className="p-2 bg-amber-500 text-white rounded-full">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <div className="font-bold text-amber-800">Unreachable</div>
                  <div className="text-xs text-amber-600">No answer / Off</div>
                </div>
              </button>
              <button
                onClick={() => confirmCallTrack("PENDING")}
                className="w-full p-4 text-left border border-slate-100 bg-slate-50/50 rounded-2xl hover:bg-slate-100 transition-colors flex items-center gap-3"
              >
                <div className="p-2 bg-slate-400 text-white rounded-full">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="font-bold text-slate-700">Pending</div>
                  <div className="text-xs text-slate-500">Call back later</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setCallModal(null)}
              className="mt-6 w-full p-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {moveModal && (() => {
        const member = data.members.find((m) => m.id === moveModal.memberId);
        const todayStr = new Date().toISOString().split("T")[0];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-indigo-600" /> Reschedule Visit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reschedule <span className="font-bold text-slate-800">{member?.name || "Child"}</span> to a new date:
                </p>
              </div>

              {/* Option 1: Pick Any New Date */}
              <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-2xl space-y-2">
                <label className="block text-[10px] font-bold text-indigo-900 uppercase">
                  Pick A New Date
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    min={todayStr}
                    value={customRescheduleDate}
                    onChange={(e) => setCustomRescheduleDate(e.target.value)}
                    className="flex-1 text-xs p-2 bg-white border border-indigo-200 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    disabled={!customRescheduleDate}
                    onClick={() => {
                      handleRescheduleToDate(customRescheduleDate);
                      setCustomRescheduleDate("");
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    Reschedule
                  </button>
                </div>
              </div>

              {/* Option 2: Choose Upcoming Session */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase px-1">
                  Or Move To Upcoming Schedule
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {sortedVisits.nextUp &&
                    sortedVisits.nextUp.id !== moveModal.currentSessionId && (
                      <button
                        onClick={() => handleMoveMember(sortedVisits.nextUp!.id)}
                        className="w-full p-2.5 text-left border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group flex items-center justify-between"
                      >
                        <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-700">
                          {formatDateDDMMYYYY(sortedVisits.nextUp.date)}
                        </div>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                          Up Next
                        </span>
                      </button>
                    )}
                  {sortedVisits.otherPending
                    .filter((s) => s.id !== moveModal.currentSessionId)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleMoveMember(s.id)}
                        className="w-full p-2.5 text-left border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                      >
                        <div className="font-bold text-xs text-slate-800">
                          {formatDateDDMMYYYY(s.date)}
                        </div>
                      </button>
                    ))}
                  {(!sortedVisits.nextUp || sortedVisits.nextUp.id === moveModal.currentSessionId) &&
                    sortedVisits.otherPending.filter((s) => s.id !== moveModal.currentSessionId).length === 0 && (
                      <div className="text-[11px] text-slate-400 italic text-center py-2">
                        No other upcoming schedules. Use the date picker above to choose any date.
                      </div>
                    )}
                </div>
              </div>

              {/* Option 3: Remove & Clear Schedule */}
              <button
                onClick={() => handleMoveMember("REMOVE")}
                className="w-full p-2.5 text-left border border-rose-100 bg-rose-50/40 rounded-xl hover:bg-rose-50 transition-colors group"
              >
                <div className="font-bold text-xs text-rose-600 flex items-center gap-1.5">
                  <Trash2 size={13} /> Remove and Clear from Schedule
                </div>
                <div className="text-[10px] text-rose-400 mt-0.5">
                  Child will be returned to pool for future visits
                </div>
              </button>

              <button
                onClick={() => {
                  setMoveModal(null);
                  setCustomRescheduleDate("");
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* ADD MEMBER MODAL */}
      {addMemberModal && (
        <AddMemberModal
          isOpen={addMemberModal.show}
          onClose={() => setAddMemberModal(null)}
          onSelect={(mid: string) =>
            handleAddMember(addMemberModal.sessionId, mid)
          }
          members={
            !isAdmin && activeChurch !== "All" && activeChurch !== "CM" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)
              ? data.members.filter(m => connectList.some(cl => cl.id === m.id) || visitorFnfIds.has(m.id))
              : data.members
          }
          currentSessionMembers={
            filteredLocalSessions.find((s) => s.id === addMemberModal.sessionId)
              ?.assignedMemberIds || []
          }
          activeChurch={activeChurch}
        />
      )}

      {/* CONFIRM COMPLETION MODAL */}
      {completionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="font-bold text-xl mb-2 text-slate-800">
              All Visits Marked!
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Do you want to mark this session as <b>Completed</b>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmCompletion(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
              >
                Not Yet
              </button>
              <button
                onClick={() => confirmCompletion(true)}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200"
              >
                Yes, Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SAVE BUTTON */}
      {unsavedChanges.size > 0 &&
        (activeTab === "VISIT" || activeTab === "PRAYER") && (
          <div className="fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
            <button
              onClick={saveBatchChanges}
              disabled={isSaving}
              className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-xl shadow-indigo-300 hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95 disabled:opacity-80"
            >
              {isSaving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
              )}
              <div className="flex flex-col items-start leading-none">
                <span className="text-sm">Save Changes</span>
                <span className="text-[10px] font-medium opacity-80">
                  {changeCounts.marked > 0
                    ? `+${changeCounts.marked} marked`
                    : ""}
                  {changeCounts.unmarked > 0
                    ? ` -${changeCounts.unmarked} unmarked`
                    : ""}
                </span>
              </div>
            </button>
          </div>
        )}

      {/* MESSAGE OPTION MODAL */}
      {messageTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800">
                Message {messageTarget.name.split(" ")[0]}
              </h3>
              <button
                onClick={() => setMessageTarget(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-slate-500 text-sm mb-6 text-center">
              How would you like to reach out?
              <br />
              <span className="font-bold text-slate-700">{messageTarget.phone || messageTarget.parentPhone}</span>
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => confirmMessageMethod("whatsapp")}
                className="flex items-center justify-center gap-2 w-full p-4 bg-green-50 hover:bg-green-100 text-green-700 rounded-2xl transition-colors font-bold"
              >
                <MessageSquare size={18} /> WhatsApp
              </button>
              <button
                onClick={() => confirmMessageMethod("sms")}
                className="flex items-center justify-center gap-2 w-full p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl transition-colors font-bold"
              >
                <MessageSquare size={18} /> SMS
              </button>
              <button
                onClick={() => setMessageTarget(null)}
                className="mt-2 text-slate-500 text-sm font-medium hover:text-slate-700 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Edit {editingMember.name}</h3>
              <button
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as MemberStatus })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                >
                  <option value={MemberStatus.ACTIVE}>Active</option>
                  <option value={MemberStatus.INCONSISTENT}>Inconsistent</option>
                  <option value={MemberStatus.NOT_ACTIVE}>Not Active</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                <input
                  type="text"
                  value={editFormData.phone || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Phone</label>
                <input
                  type="text"
                  value={editFormData.parentPhone || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, parentPhone: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                <input
                  type="text"
                  value={editFormData.address || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setEditingMember(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- SUB COMPONENTS ---

interface CollapsibleHistorySectionProps {
  items: PrayerSlot[];
  data: AppData;
  unsavedChanges: Set<string>;
  onToggle: (id: string) => void;
}

const CollapsibleHistorySection = ({
  items,
  data,
  unsavedChanges,
  onToggle,
}: CollapsibleHistorySectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Group By Period (2 Weeks, This Month, Quarter)
  const groupedHistory = useMemo(() => {
    const groups: Record<string, PrayerSlot[]> = {};
    if (!items) return groups;

    const now = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(now.getDate() - 14);

    items.forEach((slot: PrayerSlot) => {
      const d = new Date(slot.date);
      let key = "";

      if (d >= twoWeeksAgo) {
        key = "Last 2 Weeks";
      } else if (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        key = "This Month";
      } else {
        const q = Math.floor(d.getMonth() / 3) + 1;
        key = `Q${q} ${d.getFullYear()}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(slot);
    });

    return groups;
  }, [items]);

  if (!items || items.length === 0) return null;

  // Define sort order for keys
  const sortKeys = (keys: string[]) => {
    return keys.sort((a, b) => {
      if (a === "Last 2 Weeks") return -1;
      if (b === "Last 2 Weeks") return 1;
      if (a === "This Month") return -1;
      if (b === "This Month") return 1;
      return b.localeCompare(a); // Descending for Quarters
    });
  };

  return (
    <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? "text-green-600 bg-green-50/50" : "bg-white hover:bg-slate-50"}`}
      >
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-500" />
          Completed History ({items.length})
        </h3>
        {isOpen ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-3 space-y-4 bg-slate-50/30">
          {sortKeys(Object.keys(groupedHistory)).map((period) => (
            <div key={period}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pl-2 sticky top-0 bg-slate-50/90 backdrop-blur py-1 z-10">
                {period}
              </h4>
              <div className="space-y-3">
                {groupedHistory[period]
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  ) // Descending date
                  .map((slot: PrayerSlot) => (
                    <PrayerSlotCard
                      key={slot.id}
                      slot={slot}
                      data={data}
                      unsavedChanges={unsavedChanges}
                      onToggle={onToggle}
                      isExpired={false}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CollapsibleMissedSection = ({
  title,
  items,
  data,
  onReschedule,
  onRemove,
}: any) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? "bg-red-50/50 text-rose-600" : "bg-white hover:bg-red-50/10"}`}
      >
        <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
          <AlertCircle size={14} /> {title} ({items.length})
        </h4>
        {isOpen ? (
          <ChevronUp size={16} className="text-rose-300" />
        ) : (
          <ChevronDown size={16} className="text-rose-300" />
        )}
      </button>

      {isOpen && (
        <div className="divide-y divide-red-50">
          {items.map((item: any) => {
            const m = data.members.find((mem: any) => mem.id === item.memberId);
            if (!m) return null;
            return (
              <div
                key={`${item.sessionId}-${item.memberId}`}
                className="flex items-center justify-between p-3 bg-red-50/10 hover:bg-red-50/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-500">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">
                      {m.name}
                    </div>
                    <div className="text-[10px] text-red-400 font-medium">
                      Missed on {formatDateDDMMYYYY(item.date)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReschedule(item.memberId, item.sessionId)}
                    className="text-xs bg-white border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shadow-sm font-bold"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => onRemove(item.memberId, item.sessionId)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CollapsibleCompletedVisits = ({
  title,
  sessions,
  data,
  loadingId,
  onDelete,
  onUndoVisit,
}: any) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? "bg-slate-50" : "bg-white hover:bg-slate-50"}`}
      >
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <CheckCircle2 size={14} /> {title} ({sessions.length})
        </h4>
        {isOpen ? (
          <ChevronUp size={16} className="text-slate-300" />
        ) : (
          <ChevronDown size={16} className="text-slate-300" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 p-3 bg-slate-50/30">
          {sessions.map((s: OutreachSession) => (
            <div
              key={s.id}
              className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 shadow-sm"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 text-green-600 rounded-full">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 text-sm line-through">
                      {formatDateDDMMYYYY(s.date)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      By {s.completedBy || "Shepherd"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => onDelete(s.id, e)}
                  disabled={loadingId === s.id}
                  className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                  title="Delete this completed record"
                >
                  {loadingId === s.id ? (
                    <Loader2
                      size={16}
                      className="animate-spin text-indigo-500"
                    />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
              {s.visitedMemberIds && s.visitedMemberIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1 pl-11">
                  {s.visitedMemberIds.map((vid) => {
                    const m = data.members.find((mem) => mem.id === vid);
                    return m ? (
                      <span
                        key={vid}
                        className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-lg border border-green-200 font-semibold flex items-center gap-1.5"
                      >
                        <span>{m.name}</span>
                        {onUndoVisit && (
                          <button
                            type="button"
                            onClick={() => onUndoVisit(s.id, vid)}
                            title="Undo visit / move back to schedule"
                            className="text-green-600 hover:text-red-600 hover:bg-red-50 rounded p-0.5 transition-colors font-bold text-xs leading-none"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CollapsibleSectionProps {
  title: string;
  items: PrayerSlot[];
  data: AppData;
  unsavedChanges: Set<string>;
  onToggle: (id: string) => void;
  isExpired?: boolean;
  color: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
}

const CollapsibleSection = ({
  title,
  items,
  data,
  unsavedChanges,
  onToggle,
  isExpired,
  color,
  icon: Icon,
  defaultOpen = false,
  headerAction,
}: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (!items || items.length === 0) return null;

  const colorClasses: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50/50",
    amber: "text-amber-600 bg-amber-50/50",
    green: "text-green-600 bg-green-50/50",
    teal: "text-teal-600 bg-teal-50/50",
  };

  return (
    <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div
        className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? colorClasses[color] || "text-indigo-600 bg-indigo-50/50" : "bg-white hover:bg-slate-50"}`}
      >
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center gap-2 cursor-pointer"
        >
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Icon
              size={18}
              className={
                color === "amber"
                  ? "text-amber-500"
                  : color === "green"
                    ? "text-green-500"
                    : "text-indigo-600"
              }
            />
            {title} ({items.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          <button onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? (
              <ChevronUp size={18} className="text-slate-400" />
            ) : (
              <ChevronDown size={18} className="text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 bg-slate-50/30">
          {items.map((slot: PrayerSlot) => (
            <PrayerSlotCard
              key={slot.id}
              slot={slot}
              data={data}
              unsavedChanges={unsavedChanges}
              onToggle={onToggle}
              isExpired={isExpired}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const PrayerSlotCard = ({
  slot,
  data,
  unsavedChanges,
  onToggle,
  isExpired,
}: any) => {
  const assigned = slot.assignedMemberIds || [];
  const memberNames = assigned
    .map((id: string) => data.members.find((m: any) => m.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`bg-white rounded-2xl border transition-all ${slot.isCompleted ? "border-green-200 shadow-none" : isExpired ? "border-amber-200 bg-amber-50/50" : "border-slate-100 shadow-sm"} ${unsavedChanges.has(slot.id) ? "ring-2 ring-amber-300" : ""}`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold border ${slot.isCompleted ? "bg-green-50 text-green-700 border-green-100" : isExpired ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
            >
              <span>{(slot.dayOfWeek || "MON").substring(0, 3).toUpperCase()}</span>
            </div>
            <div>
              <h4
                className={`font-bold text-sm ${slot.isCompleted ? "text-green-800" : "text-slate-800"}`}
              >
                {formatDateDDMMYYYY(slot.date)}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">
                {assigned.length} Children •{" "}
                {slot.durationMins !== undefined ? slot.durationMins : 30} mins
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Updated to use memberNames as the title
                addToGoogleCalendar(
                  `Prayer: ${memberNames}`,
                  slot.date,
                  `Praying for: ${memberNames}`,
                  slot.durationMins !== undefined ? slot.durationMins : 30,
                );
              }}
              className="text-slate-300 hover:text-indigo-500 p-1"
              title="Add to Google Calendar"
            >
              <CalendarPlus size={16} />
            </button>
            <div
              onClick={() => onToggle(slot.id)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${slot.isCompleted ? "bg-green-500 border-green-500 text-white" : "border-slate-300 text-transparent hover:border-green-400"}`}
            >
              <Check size={14} strokeWidth={4} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {assigned.map((id: string) => {
            const m = data.members.find((mem: any) => mem.id === id);

            // Handle removed or archived members
            if (
              !m ||
              m.status === MemberStatus.ARCHIVED ||
              m.status === MemberStatus.TRANSFERRED
            ) {
              return (
                <div
                  key={id}
                  className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold border bg-gray-100 text-gray-400 border-gray-200"
                >
                  <span>{m ? m.name : "Unknown"}</span>
                  <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded">
                    GONE
                  </span>
                </div>
              );
            }

            let colorClass = "bg-slate-50 text-slate-600 border-slate-100";
            if (m.type === MemberType.FNF)
              colorClass = "bg-amber-50 text-amber-700 border-amber-100";
            else if (
              m.status === MemberStatus.INCONSISTENT ||
              m.status === MemberStatus.NOT_ACTIVE
            )
              colorClass = "bg-rose-50 text-rose-700 border-rose-100";
            else colorClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
            if (slot.isCompleted)
              colorClass =
                "bg-green-50 text-green-700 border-green-100 opacity-80";

            return (
              <div
                key={id}
                className={`flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold border ${colorClass}`}
              >
                <span>{m.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface CollapsibleProgressSectionProps {
  title: string;
  members: Member[];
  data: AppData;
  icon: React.ElementType;
  color: string;
}

const CollapsibleProgressSection = ({
  title,
  members,
  data,
  icon: Icon,
  color,
}: CollapsibleProgressSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const colorClasses: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
    teal: "text-teal-600 bg-teal-50 border-teal-100",
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-4 flex items-center justify-between transition-colors ${isOpen ? "bg-slate-50" : "bg-white"}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${(colorClasses[color] || "text-indigo-600 bg-indigo-50 border-indigo-100").replace("border-indigo-100", "")}`}
          >
            <Icon size={18} />
          </div>
          <span className="font-bold text-slate-800 text-sm">
            {title} ({members.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="divide-y divide-slate-50">
          {members.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 font-medium">
              No members found in this category.
            </div>
          ) : (
            members.map((m: Member) => {
              const stats = getMemberStats(m.id, data);
              const isVisitor = m.type === MemberType.VISITOR;
              const cardStyle = m.status === MemberStatus.INCONSISTENT
                ? "border-l-4 border-l-rose-500 bg-rose-50/5 hover:bg-rose-50/10"
                : m.status === MemberStatus.NOT_ACTIVE
                  ? "border-l-4 border-l-yellow-500 bg-yellow-50/5 hover:bg-yellow-50/10"
                  : isVisitor
                    ? "border-l-4 border-l-teal-500 bg-teal-50/5 hover:bg-teal-50/10"
                    : "hover:bg-slate-50";
              return (
                <div
                  key={m.id}
                  className={`p-4 transition-colors ${cardStyle}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 text-sm flex items-center flex-wrap gap-1">
                      {m.name}
                      {m.status === MemberStatus.INCONSISTENT && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                          Inconsistent
                        </span>
                      )}
                      {m.status === MemberStatus.NOT_ACTIVE && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600 border border-yellow-100 shrink-0">
                          Not Active
                        </span>
                      )}
                      {isVisitor && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-100 flex items-center gap-1 shrink-0">
                          <UserPlus size={8} /> First Timer
                        </span>
                      )}
                    </h4>
                    <div className="flex gap-1">
                      <Badge
                        label="W"
                        value={formatDuration(stats.prayer.week)}
                      />
                      <Badge
                        label="M"
                        value={formatDuration(stats.prayer.month)}
                      />
                      <Badge
                        label="Q"
                        value={formatDuration(stats.prayer.quarter)}
                      />
                      <Badge
                        label="Y"
                        value={formatDuration(stats.prayer.year)}
                        highlight
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                      <span>Visits</span>
                      <span>{stats.visits}/2</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (stats.visits / 2) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                      <span>Calls</span>
                      <span>{stats.calls}/4</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (stats.calls / 4) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            }))}
        </div>
      )}

    </div>
  );
};

interface CollapsibleContactSectionProps {
  title: string;
  members: Member[];
  icon: React.ElementType;
  color: string;
  defaultOpen?: boolean;
  onTrackCall?: (member: Member, method: "Call" | "SMS") => void;
  onMessageClick?: (member: Member) => void;
  onEditClick?: (member: Member) => void;
  onPromoteClick?: (member: Member) => void;
  promotingId?: string | null;
}

const CollapsibleContactSection = ({
  title,
  members,
  icon: Icon,
  color,
  defaultOpen = false,
  onTrackCall,
  onMessageClick,
  onEditClick,
  onPromoteClick,
  promotingId,
}: CollapsibleContactSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
    teal: "text-teal-600 bg-teal-50 border-teal-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-4 flex items-center justify-between transition-colors ${isOpen ? "bg-slate-50" : "bg-white"}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${colorClasses[color]?.replace("border-indigo-100", "") || "bg-slate-50 text-slate-500"}`}
          >
            <Icon size={18} />
          </div>
          <span className="font-bold text-slate-800 text-sm">
            {title} ({members.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50">
          {members.length === 0 ? (
            <div className="col-span-full p-4 text-center text-xs text-slate-400 font-medium">
              No contacts found in this category.
            </div>
          ) : (
            members.map((member: Member) => {
              const phone = member.phone || member.parentPhone;
              const hasPhone = !!phone;
              const gps = member.gpsCoordinates;
              const address = member.address;
              const hasLoc = !!gps || !!address;
              const mapLink = gps
                ? `https://www.google.com/maps/dir/?api=1&destination=${gps}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || "")}`;

              const isVisitor = member.type === MemberType.VISITOR || member.type === MemberType.NOT_MEMBER;
              const isFnf = member.type === MemberType.FNF;
              const canPromote = isVisitor || isFnf;
              const isPromoting = promotingId === member.id;

              const cardStyle = member.status === MemberStatus.INCONSISTENT
                ? "border-l-4 border-l-rose-500 bg-rose-50/10 hover:bg-rose-50/20"
                : member.status === MemberStatus.NOT_ACTIVE
                  ? "border-l-4 border-l-yellow-500 bg-yellow-50/10 hover:bg-yellow-50/20"
                  : isVisitor
                    ? "border-l-4 border-l-teal-500 bg-teal-50/10 hover:bg-teal-50/20"
                    : isFnf
                      ? "border-l-4 border-l-emerald-500 bg-emerald-50/10 hover:bg-emerald-50/20"
                      : "border-slate-100 bg-white hover:border-indigo-200";

              return (
                <div
                  key={member.id}
                  onClick={() => onEditClick?.(member)}
                  className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between gap-3 transition-colors cursor-pointer ${cardStyle}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center flex-wrap gap-1.5 break-words">
                        {member.name}
                        {member.status === MemberStatus.INCONSISTENT && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                            Inconsistent
                          </span>
                        )}
                        {member.status === MemberStatus.NOT_ACTIVE && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600 border border-yellow-100 shrink-0">
                            Not Active
                          </span>
                        )}
                        {isVisitor && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100 flex items-center gap-1 shrink-0">
                            <UserPlus size={10} /> First Timer
                          </span>
                        )}
                        {isFnf && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1 shrink-0">
                            <Heart size={10} /> FNF
                          </span>
                        )}
                        {member.assignedChurch && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {member.assignedChurch}
                          </span>
                        )}
                      </h4>
                      {phone && (
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                          <Phone size={11} className="text-slate-400" />
                          <span>{phone}</span>
                          {member.parentPhone && member.parentPhone === phone && (
                            <span className="text-[9px] text-slate-400 font-normal">(Parent)</span>
                          )}
                        </div>
                      )}
                      {address && (
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} /> {address.substring(0, 26)}...
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      {hasPhone ? (
                        <>
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => { e.stopPropagation(); onTrackCall?.(member, "Call"); }}
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                            title="Call"
                          >
                            <Phone size={15} />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); onMessageClick?.(member); }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Message"
                          >
                            <MessageSquare size={15} />
                          </button>
                        </>
                      ) : (
                        <div className="p-2 bg-slate-50 text-slate-300 rounded-lg">
                          <Phone size={15} />
                        </div>
                      )}
                      {hasLoc ? (
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                          title="Directions"
                        >
                          <MapIcon size={15} />
                        </a>
                      ) : (
                        <div className="p-2 bg-slate-50 text-slate-300 rounded-lg">
                          <MapIcon size={15} />
                        </div>
                      )}
                    </div>
                  </div>

                  {canPromote && onPromoteClick && (
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPromoteClick(member);
                        }}
                        disabled={isPromoting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isPromoting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserCheck size={12} />
                        )}
                        <span>Promote to Member</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const Badge = ({ label, value, highlight }: any) => (
  <div
    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border flex flex-col items-center leading-none ${highlight ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-slate-50 border-slate-100 text-slate-500"}`}
  >
    <span className="opacity-50 text-[8px]">{label}</span>
    <span>{value}</span>
  </div>
);

const getMemberStats = (memberId: string, data: AppData) => {
  const year = new Date().getFullYear();
  // Visits (Count completed sessions where visited)
  const visits = (data.outreachSessions || []).filter(
    (s) =>
      s.status === "COMPLETED" &&
      (s.sessionType === "VISIT" || !s.sessionType) &&
      new Date(s.date).getFullYear() === year &&
      s.visitedMemberIds?.includes(memberId),
  ).length;

  const calls = (data.outreachSessions || []).filter(
    (s) =>
      s.status === "COMPLETED" &&
      s.sessionType === "CALL" &&
      s.outcome === "REACHED" &&
      new Date(s.date).getFullYear() === year &&
      s.visitedMemberIds?.includes(memberId),
  ).length;

  // Prayers: Calculate minutes (Count * duration or 30 mins)
  const prayers = (data.prayerSchedule || []).filter(
    (s) => s.isCompleted && (s.assignedMemberIds || []).includes(memberId),
  );
  const now = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  // Helper to sum minutes
  const sumMins = (slots: PrayerSlot[]) =>
    slots.reduce((acc, s) => acc + (s.durationMins || 30), 0);

  return {
    visits,
    calls,
    prayer: {
      week: sumMins(
        prayers.filter(
          (s) => Math.abs(now.getTime() - new Date(s.date).getTime()) < oneWeek,
        ),
      ),
      month: sumMins(
        prayers.filter(
          (s) =>
            new Date(s.date).getMonth() === now.getMonth() &&
            new Date(s.date).getFullYear() === year,
        ),
      ),
      quarter: sumMins(
        prayers.filter(
          (s) =>
            Math.floor(new Date(s.date).getMonth() / 3) ===
            Math.floor(now.getMonth() / 3) &&
            new Date(s.date).getFullYear() === year,
        ),
      ),
      year: sumMins(
        prayers.filter((s) => new Date(s.date).getFullYear() === year),
      ),
    },
  };
};

const SessionChildList = ({
  session,
  data,
  onToggle,
  onMove,
  onRemove,
}: {
  session: OutreachSession;
  data: AppData;
  onToggle: (sid: string, mid: string) => void;
  onMove: (mid: string, sid: string) => void;
  onRemove: (mid: string, sid: string) => void;
}) => {
  return (
    <div className="divide-y divide-slate-50">
      {session.assignedMemberIds.map((id) => {
        const m = data.members.find((mem) => mem.id === id);
        const isVisited = session.visitedMemberIds?.includes(id);

        // Handle archived/deleted members who are still in schedule
        if (
          !m ||
          m.status === MemberStatus.ARCHIVED ||
          m.status === MemberStatus.TRANSFERRED
        ) {
          return (
            <div
              key={id}
              className="flex items-center justify-between p-3 bg-red-50/50"
            >
              <div className="flex items-center gap-3 opacity-50">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                  ?
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-500">
                    {m ? m.name : "Unknown Child"}
                  </div>
                  <div className="text-[10px] text-red-500 font-bold uppercase">
                    {m ? m.status : "DELETED"}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(id, session.id);
                }}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </div>
          );
        }

        return (
          <div
            key={id}
            onClick={() => onToggle(session.id, id)}
            className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${isVisited ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
              >
                {m.name.charAt(0)}
              </div>
              <div>
                <div
                  className={`font-bold text-sm transition-colors duration-300 ${isVisited ? "text-slate-400 line-through" : "text-slate-800"}`}
                >
                  {m.name}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${m.type === "Member" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}
                  >
                    {m.type === "Visitor" ? "First Timer" : m.type}
                  </span>
                  {m.address && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <MapPin size={8} /> {m.address.substring(0, 15)}...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isVisited && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(id, session.id);
                    }}
                    className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title="Reschedule"
                  >
                    <ArrowRightLeft size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(id, session.id);
                    }}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isVisited ? "bg-green-500 border-green-500 text-white scale-110" : "border-slate-200 text-transparent hover:border-indigo-300"}`}
              >
                <Check size={14} strokeWidth={4} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AddMemberModal = ({
  isOpen,
  onClose,
  onSelect,
  members,
  currentSessionMembers,
  activeChurch,
}: any) => {
  const [search, setSearch] = useState("");
  if (!isOpen) return null;

  const available = members
    .filter(
      (m: Member) =>
        !currentSessionMembers.includes(m.id) &&
        (activeChurch === "CM" ||
          activeChurch === "All" ||
          m.assignedChurch === activeChurch) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
        m.status !== MemberStatus.ARCHIVED,
    )
    .filter((m: Member) => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800">Add Member</h3>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <input
          type="text"
          placeholder="Search..."
          className="w-full p-3 bg-slate-50 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="overflow-y-auto flex-1 space-y-2">
          {available.map((m: Member) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="w-full p-3 text-left hover:bg-slate-50 rounded-xl flex items-center justify-between group"
            >
              <div>
                <div className="font-bold text-slate-700">{m.name}</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">
                  {m.type === "Visitor" ? "First Timer" : m.type}
                </div>
              </div>
              <Plus
                size={16}
                className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </button>
          ))}
          {available.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">
              No members found.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

export default React.memo(OutreachHub);
