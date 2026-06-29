import React, { useState } from "react";
import {
  AppData,
  Member,
  MemberType,
  MemberStatus,
  Church,
  Role,
  PromotionRecord,
} from "../types";
import {
  User,
  Users,
  Edit2,
  Archive,
  X,
  Save,
  GraduationCap,
  Undo2,
  HelpCircle,
  AlertCircle,
  Activity,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Plus,
  Lock,
  Key,
  Heart,
  Hand,
  Trash2,
  Building2,
  Filter,
  Sun,
  Zap,
  LineChart,
  ArrowRightLeft,
  PartyPopper,
  Phone,
  MapPin,
  Calendar,
  Smartphone,
  UserCircle,
  BadgeCheck,
} from "lucide-react";
import {
  updateMember,
  bulkArchiveMembers,
  addMember,
  deleteMember,
} from "../services/storageService";
import { sanitizeInput } from "../services/securityService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MembersListProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
  activeBranchId: string;
}

const MembersList: React.FC<MembersListProps> = ({
  data,
  onUpdate,
  activeChurch,
  currentUser,
  activeBranchId,
}) => {
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );
  const isTeacher = currentUser.role === "TEACHER";

  // Teachers can edit if they are viewing their own church
  const canManage =
    isAdmin || (isTeacher && activeChurch === currentUser.assignedChurch);

  // Dynamic list of churches
  const availableChurches = data.settings.churches;

  // Tabs for the Central Hub
  const [hubTab, setHubTab] = useState<"MEMBERS" | "TEACHERS">(
    () =>
      (localStorage.getItem("members_hubTab") as "MEMBERS" | "TEACHERS") ||
      "MEMBERS",
  );
  const [filter, setFilter] = useState<"CM" | "ARCHIVED" | string>(
    () => localStorage.getItem("members_filter") || "CM",
  );

  // Church Filter for Admins
  const [churchFilter, setChurchFilter] = useState<Church | "All">(
    () =>
      (localStorage.getItem("members_churchFilter") as Church | "All") || "All",
  );
  const [sortOrder, setSortOrder] = useState<
    "A-Z" | "ATTENDANCE_HIGH" | "ATTENDANCE_LOW"
  >(() => (localStorage.getItem("members_sortOrder") as any) || "A-Z");

  // Persist state changes
  React.useEffect(() => {
    localStorage.setItem("members_hubTab", hubTab);
  }, [hubTab]);
  React.useEffect(() => {
    localStorage.setItem("members_filter", filter);
  }, [filter]);
  React.useEffect(() => {
    localStorage.setItem("members_churchFilter", churchFilter);
  }, [churchFilter]);
  React.useEffect(() => {
    localStorage.setItem("members_sortOrder", sortOrder);
  }, [sortOrder]);

  // SELECTION STATE
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});

  // MODAL STATES
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [memberToArchive, setMemberToArchive] = useState<Member | null>(null);
  const [isBulkArchiveConfirming, setIsBulkArchiveConfirming] = useState(false);
  const [transferMember, setTransferMember] = useState<Member | null>(null);
  const [transferTarget, setTransferTarget] = useState<Church | "">("");

  // HISTORY MODAL STATE
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);

  // FORM DATA
  const [formData, setFormData] = useState<Partial<Member>>({
    name: "",
    type: MemberType.MEMBER,
    status: MemberStatus.ACTIVE,
    birthDate: "",
    assignedChurch: activeChurch === "CM" ? "UJ" : activeChurch,
    role: "NONE",
    passcode: "",
    isAccessActive: false,
    phone: "",
    parentPhone: "",
    address: "",
    gpsCoordinates: "",
    branchId: activeBranchId === "ALL" ? "" : activeBranchId,
    zoneId: currentUser.zoneId || "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const openEditModal = (member: Member) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      type: member.type,
      status: member.status,
      birthDate: member.birthDate || "",
      assignedChurch: member.assignedChurch || "UJ",
      role: member.role || "NONE",
      passcode: member.passcode || "",
      isAccessActive: member.isAccessActive || false,
      phone: member.phone || "",
      parentPhone: member.parentPhone || "",
      address: member.address || "",
      gpsCoordinates: member.gpsCoordinates || "",
      branchId: member.branchId || "",
      zoneId: member.zoneId || "",
    });
    setIsEditModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      type: hubTab === "TEACHERS" ? MemberType.TEACHER : MemberType.MEMBER,
      status: MemberStatus.ACTIVE,
      birthDate: "",
      assignedChurch: activeChurch === "CM" ? "UJ" : activeChurch,
      role: "NONE",
      passcode: "",
      isAccessActive: false,
      phone: "",
      parentPhone: "",
      address: "",
      gpsCoordinates: "",
      branchId: activeBranchId === "ALL" ? "" : activeBranchId,
      zoneId: currentUser.zoneId || "",
    });
    setIsCreateModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;

    // Sanitize inputs
    const cleanName = sanitizeInput(formData.name);

    if (editingId) {
      // UPDATE EXISTING
      const original = data.members.find((m) => m.id === editingId);
      if (original) {
        let updatedMember = {
          ...original,
          ...formData,
          name: cleanName,
        } as Member;

        // Check for promotion/transfer
        if (original.assignedChurch !== formData.assignedChurch) {
          const promotion: PromotionRecord = {
            date: new Date().toISOString(),
            fromChurch: original.assignedChurch,
            toChurch: formData.assignedChurch as Church,
          };
          updatedMember.promotionHistory = [
            ...(original.promotionHistory || []),
            promotion,
          ];
        }

        // Check for Inconsistent -> Active/FNF/Member status change
        if (
          original.type === MemberType.INCONSISTENT &&
          (updatedMember.type === MemberType.MEMBER ||
            updatedMember.type === MemberType.FNF) &&
          updatedMember.status === MemberStatus.ACTIVE
        ) {
          updatedMember.lastActivationDate = new Date().toISOString();
        }

        await updateMember(updatedMember);
      }
      setIsEditModalOpen(false);
    } else {
      // CREATE NEW
      const newMember = addMember(
        cleanName,
        formData.type!,
        formData.assignedChurch!,
        formData.birthDate!,
        formData.status!,
      );
      // Update with extra fields that addMember doesn't support by default args
      await updateMember({
        ...newMember,
        ...formData,
        name: cleanName,
      } as Member);
      setIsCreateModalOpen(false);
    }
    setEditingId(null);
    onUpdate();
  };

  const archiveMember = (member: Member) => {
    setMemberToArchive(member);
  };

  const confirmArchiveSingle = async () => {
    if (memberToArchive) {
      await updateMember({ ...memberToArchive, status: MemberStatus.ARCHIVED });
      setMemberToArchive(null);
      onUpdate();
    }
  };

  const openTransferModal = (member: Member) => {
    setTransferMember(member);
    setTransferTarget(member.assignedChurch);
  };

  const confirmTransfer = async () => {
    if (
      transferMember &&
      transferTarget &&
      transferTarget !== transferMember.assignedChurch
    ) {
      const promotion: PromotionRecord = {
        date: new Date().toISOString(),
        fromChurch: transferMember.assignedChurch,
        toChurch: transferTarget as Church,
      };
      const updatedMember = {
        ...transferMember,
        assignedChurch: transferTarget,
        promotionHistory: [
          ...(transferMember.promotionHistory || []),
          promotion,
        ],
      };
      await updateMember(updatedMember as Member);
      setTransferMember(null);
      setTransferTarget("");
      onUpdate();
    } else {
      setTransferMember(null);
      setTransferTarget("");
    }
  };

  const restoreMember = async (member: Member) => {
    await updateMember({ ...member, status: MemberStatus.ACTIVE });
    onUpdate();
  };

  const handleDeletePermanent = (member: Member) => {
    if (
      window.confirm(
        `WARNING: This will PERMANENTLY delete ${member.name} from the database. This cannot be undone. Are you sure?`,
      )
    ) {
      deleteMember(member.id);
      onUpdate();
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = (members: Member[]) => {
    const allIds = members.map((m) => m.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    const newSelection = new Set(selectedIds);
    if (allSelected) allIds.forEach((id) => newSelection.delete(id));
    else allIds.forEach((id) => newSelection.add(id));
    setSelectedIds(newSelection);
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;
    setIsBulkArchiveConfirming(true);
  };

  const confirmBulkArchive = async () => {
    if (selectedIds.size > 0) {
      await bulkArchiveMembers(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsBulkArchiveConfirming(false);
      onUpdate();
    }
  };

  const getTeenStatus = (birthDateStr?: string) => {
    if (!birthDateStr)
      return {
        label: "NO",
        colorClass: "bg-red-50 text-red-600 border-red-100",
      };
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age >= 13)
      return {
        label: "YES",
        colorClass: "bg-green-100 text-green-700 border-green-200",
      };

    const thirteenthBirthday = new Date(birth);
    thirteenthBirthday.setFullYear(birth.getFullYear() + 13);
    const fiveMonthsFromNow = new Date(today);
    fiveMonthsFromNow.setMonth(today.getMonth() + 5);

    if (thirteenthBirthday <= fiveMonthsFromNow)
      return {
        label: "SOON",
        colorClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
      };
    return { label: "NO", colorClass: "bg-red-50 text-red-600 border-red-100" };
  };

  const getCheckColumnName = () => {
    if (activeChurch === "I") return "K Check";
    if (activeChurch === "K") return "LJ Check";
    if (activeChurch === "LJ") return "UJ Check";
    // Default / UJ
    return "Teen Check";
  };

  const getStatusBadgeColor = (status: MemberStatus) => {
    switch (status) {
      case MemberStatus.ACTIVE:
        return "bg-green-100 text-green-700";
      case MemberStatus.NOT_ACTIVE:
        return "bg-yellow-100 text-yellow-700";
      case MemberStatus.ARCHIVED:
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB");
  };

  const isBirthdayThisWeek = (birthDateString?: string) => {
    if (!birthDateString) return false;
    const parts = birthDateString.includes("-")
      ? birthDateString.split("-")
      : birthDateString.split("/");
    let month, day;
    if (birthDateString.includes("-")) {
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }

    if (isNaN(day) || isNaN(month)) return false;

    const today = new Date();
    const currentYear = today.getFullYear();
    const bdayThisYear = new Date(currentYear, month - 1, day);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return bdayThisYear >= startOfWeek && bdayThisYear <= endOfWeek;
  };

  const getMemberAttendanceCount = (member: Member) => {
    const latestPromotion = member.promotionHistory
      ?.filter((p) => p.toChurch === member.assignedChurch)
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0];

    let startDate = new Date(member.joinedDate);
    if (latestPromotion && new Date(latestPromotion.date) > startDate) {
      startDate = new Date(latestPromotion.date);
    }
    if (
      member.lastActivationDate &&
      new Date(member.lastActivationDate) > startDate
    ) {
      startDate = new Date(member.lastActivationDate);
    }
    startDate.setHours(0, 0, 0, 0);

    const churchAttendance = data.attendance.filter((r) => {
      const recordDate = new Date(r.date);
      recordDate.setHours(0, 0, 0, 0);
      return (
        r.churchId === member.assignedChurch &&
        recordDate.getTime() >= startDate.getTime()
      );
    });

    return churchAttendance.filter((r) =>
      r.presentMemberIds.includes(member.id),
    ).length;
  };

  const renderAttendanceBadge = (member: Member) => {
    // Calculate attendance stats
    // Filter sessions based on promotion history
    const latestPromotion = member.promotionHistory
      ?.filter((p) => p.toChurch === member.assignedChurch)
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0];

    // Determine the start date for attendance calculation
    // Priority: Last Activation Date > Latest Promotion Date > Joined Date
    let startDate = new Date(member.joinedDate);
    if (latestPromotion && new Date(latestPromotion.date) > startDate) {
      startDate = new Date(latestPromotion.date);
    }
    if (
      member.lastActivationDate &&
      new Date(member.lastActivationDate) > startDate
    ) {
      startDate = new Date(member.lastActivationDate);
    }

    // Normalize to midnight to ensure inclusive comparison regardless of time
    startDate.setHours(0, 0, 0, 0);

    const churchAttendance = data.attendance.filter((r) => {
      const recordDate = new Date(r.date);
      recordDate.setHours(0, 0, 0, 0);
      // Include if it's the current church AND on or after the calculated start date
      return (
        r.churchId === member.assignedChurch &&
        recordDate.getTime() >= startDate.getTime()
      );
    });

    const totalSessions = churchAttendance.length;
    const attendedSessions = churchAttendance.filter((r) =>
      r.presentMemberIds.includes(member.id),
    ).length;
    const attendanceRate =
      totalSessions > 0
        ? Math.round((attendedSessions / totalSessions) * 100)
        : 0;

    // Calculate consecutive streaks
    const sortedAttendance = [...churchAttendance].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    let consecutiveAttendances = 0;
    let consecutiveAbsences = 0;
    for (const r of sortedAttendance) {
      if (r.presentMemberIds.includes(member.id)) {
        if (consecutiveAbsences > 0) break;
        consecutiveAttendances++;
      } else {
        if (consecutiveAttendances > 0) break;
        consecutiveAbsences++;
      }
    }

    // Proactive Alerts
    let alertMsg = null;
    let alertColor = "";
    if (member.status === MemberStatus.ACTIVE) {
      if (consecutiveAbsences >= 6) {
        alertMsg = "At Risk: 1 absence away from Deactivation";
        alertColor = "text-orange-500 bg-orange-100 border-orange-200";
      } else if (
        member.type === MemberType.FNF &&
        consecutiveAttendances >= 6
      ) {
        alertMsg = "Promotion ready: 1 visit away from Full Member";
        alertColor = "text-emerald-500 bg-emerald-100 border-emerald-200";
      }
    } else if (member.status === MemberStatus.NOT_ACTIVE) {
      if (
        (member.type === MemberType.VISITOR ||
          member.type === MemberType.FNF) &&
        consecutiveAttendances >= 2
      ) {
        alertMsg = "1 visit away from Active FNF";
        alertColor = "text-emerald-500 bg-emerald-100 border-emerald-200";
      } else if (
        (member.type === MemberType.MEMBER ||
          member.type === MemberType.INCONSISTENT) &&
        consecutiveAttendances >= 3
      ) {
        alertMsg = "1 visit away from Reactivation";
        alertColor = "text-emerald-500 bg-emerald-100 border-emerald-200";
      }
    }

    // Determine visual style based on percentage
    let styles = {
      bg: "bg-slate-50",
      text: "text-slate-500",
      bar: "bg-slate-300",
      border: "border-slate-200",
    };

    if (attendanceRate >= 75) {
      styles = {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        bar: "bg-emerald-500",
        border: "border-emerald-200",
      };
    } else if (attendanceRate >= 50) {
      styles = {
        bg: "bg-amber-50",
        text: "text-amber-700",
        bar: "bg-amber-500",
        border: "border-amber-200",
      };
    } else if (attendedSessions > 0) {
      styles = {
        bg: "bg-rose-50",
        text: "text-rose-700",
        bar: "bg-rose-500",
        border: "border-rose-200",
      };
    }

    return (
      <div
        className="w-full max-w-[140px] cursor-pointer group flex items-center gap-2"
        onClick={() => setHistoryMemberId(member.id)}
      >
        <div className="flex-1">
          <div
            className={`flex items-center justify-between mb-1 px-2 py-1 rounded-md border ${styles.bg} ${styles.border} group-hover:shadow-sm transition-all`}
            title={
              alertMsg
                ? `${alertMsg} (${attendanceRate}% overall)`
                : `${attendanceRate}% overall attendance`
            }
          >
            <span
              className={`text-xs font-bold flex items-center gap-1 ${styles.text}`}
            >
              {alertMsg && (
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${alertColor.split(" ")[1]}`}
                />
              )}
              {attendanceRate}%
            </span>
            <span
              className={`text-[10px] font-medium ${styles.text} opacity-80 flex items-center gap-1`}
            >
              <Activity size={10} />
              {attendedSessions}/{totalSessions}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
              style={{
                width: `${totalSessions > 0 ? Math.max(5, attendanceRate) : 0}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  const renderMemberTableSection = ({
    title,
    members,
    icon: Icon,
    colorClass,
    badgeClass,
    isTeacherSection,
  }: any) => {
    const isOpen = sectionsOpen[title] !== false;
    if (members.length === 0) return null;
    const allSectionSelected =
      members.length > 0 && members.every((m: Member) => selectedIds.has(m.id));
    const isArchivedView = filter === "ARCHIVED";

    return (
      <div className="mb-6 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
        <button
          onClick={() =>
            setSectionsOpen((prev) => ({ ...prev, [title]: !isOpen }))
          }
          className={`w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100/80 transition-colors ${!isOpen ? "rounded-2xl" : ""}`}
        >
          <h3
            className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${colorClass}`}
          >
            <Icon size={18} />
            {title} ({members.length})
          </h3>
          {isOpen ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>

        {isOpen && (
          <div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500 min-w-[900px]">
                <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-700">
                  <tr>
                    {!isArchivedView && canManage && (
                      <th className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={allSectionSelected}
                          onChange={() => toggleSelectAll(members)}
                        />
                      </th>
                    )}
                    <th className="px-6 py-4 w-[250px]">Full Name</th>
                    <th className="px-6 py-4">Assigned Church</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Birth Date</th>
                    {isTeacherSection && isAdmin ? (
                      <th className="px-6 py-4">System Access</th>
                    ) : (
                      <th className="px-6 py-4">{getCheckColumnName()}</th>
                    )}
                    {!isTeacherSection && (
                      <th className="px-6 py-4">Attendance</th>
                    )}
                    {canManage && (
                      <th className="px-6 py-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map((member: Member) => {
                    const isSelected = selectedIds.has(member.id);
                    const teenStatus = getTeenStatus(member.birthDate);
                    const bdayWeek = isBirthdayThisWeek(member.birthDate);

                    return (
                      <tr
                        key={member.id}
                        className={`hover:bg-gray-50/80 transition-colors ${isSelected ? "bg-indigo-50/30" : ""}`}
                      >
                        {!isArchivedView && canManage && (
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleSelection(member.id)}
                            />
                          </td>
                        )}

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${badgeClass}`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {member.name}
                              </div>
                              {bdayWeek && (
                                <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-pink-600 mt-0.5 animate-pulse">
                                  <PartyPopper size={12} /> Birthday Week!
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 bg-gray-50 text-gray-700`}
                          >
                            {member.assignedChurch}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-semibold ${badgeClass}`}
                          >
                            {member.type}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-semibold ${getStatusBadgeColor(member.status)}`}
                          >
                            {member.status}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {formatDateDDMMYYYY(member.birthDate || "")}
                          </span>
                        </td>

                        {isTeacherSection && isAdmin ? (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {member.role !== "NONE" &&
                              member.isAccessActive ? (
                                <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-medium">
                                  <Key size={12} />{" "}
                                  {member.role === "ADMIN"
                                    ? "Admin"
                                    : "Teacher"}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded border border-gray-100">
                                  <Lock size={12} /> No Access
                                </span>
                              )}
                            </div>
                          </td>
                        ) : (
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-sm ${teenStatus.colorClass}`}
                            >
                              {teenStatus.label}
                            </span>
                          </td>
                        )}

                        {!isTeacherSection && (
                          <td className="px-6 py-4">
                            {renderAttendanceBadge(member)}
                          </td>
                        )}

                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {!isTeacherSection && (
                                <button
                                  onClick={() => setHistoryMemberId(member.id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Attendance History"
                                >
                                  <LineChart size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => openTransferModal(member)}
                                className="p-2 text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition-colors"
                                title="Transfer"
                              >
                                <ArrowRightLeft size={16} />
                              </button>
                              <button
                                onClick={() => openEditModal(member)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              {member.status === MemberStatus.ARCHIVED ? (
                                <>
                                  <button
                                    onClick={() => restoreMember(member)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Restore"
                                  >
                                    <Undo2 size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeletePermanent(member)
                                    }
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Permanently Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => archiveMember(member)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Archive"
                                >
                                  <Archive size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="md:hidden p-2 space-y-3">
              {members.map((member: Member) => {
                const teenStatus = getTeenStatus(member.birthDate);
                const bdayWeek = isBirthdayThisWeek(member.birthDate);
                return (
                  <div
                    key={member.id}
                    className="p-4 rounded-2xl border shadow-sm bg-white border-gray-100"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`mt-1 p-2 rounded-full shrink-0 ${badgeClass}`}
                        >
                          <Icon size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg flex flex-wrap gap-2 items-center">
                            {member.name}
                            {bdayWeek && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100 animate-pulse">
                                <PartyPopper size={10} /> Bday Week
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-md font-medium ${getStatusBadgeColor(member.status)}`}
                            >
                              {member.status}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                              {member.assignedChurch}
                            </span>
                            {member.birthDate && (
                              <span className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                                🎂 {formatDateDDMMYYYY(member.birthDate)}
                              </span>
                            )}
                            {!isTeacherSection && teenStatus.label !== "NO" && (
                              <span
                                className={`text-xs px-2 py-1 rounded-md border font-bold ${teenStatus.colorClass}`}
                              >
                                {getCheckColumnName()}: {teenStatus.label}
                              </span>
                            )}
                            {isTeacherSection && member.isAccessActive && (
                              <span className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-100 flex items-center gap-1 font-medium">
                                <Key size={10} /> Access
                              </span>
                            )}
                          </div>
                          {!isTeacherSection && (
                            <div className="mt-3">
                              {renderAttendanceBadge(member)}
                            </div>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex flex-col gap-2 pl-2">
                          {!isTeacherSection && (
                            <button
                              onClick={() => setHistoryMemberId(member.id)}
                              className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
                              title="History"
                            >
                              <LineChart size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => openTransferModal(member)}
                            className="p-2 text-fuchsia-600 bg-fuchsia-50 rounded-xl hover:bg-fuchsia-100 transition-colors shadow-sm"
                            title="Transfer"
                          >
                            <ArrowRightLeft size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
                          >
                            <Edit2 size={18} />
                          </button>
                          {member.status === MemberStatus.ARCHIVED ? (
                            <>
                              <button
                                onClick={() => restoreMember(member)}
                                className="p-2 text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition-colors shadow-sm"
                              >
                                <Undo2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDeletePermanent(member)}
                                className="p-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => archiveMember(member)}
                              className="p-2 text-red-400 bg-red-50 rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                            >
                              <Archive size={18} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getFilteredContent = () => {
    // Determine sorting
    let baseList = [...data.members];

    if (sortOrder === "A-Z") {
      baseList.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Pre-calculate attendance to avoid redundant iteration
      const attendanceMap = new Map<string, number>();
      baseList.forEach((m) =>
        attendanceMap.set(m.id, getMemberAttendanceCount(m)),
      );

      baseList.sort((a, b) => {
        const countA = attendanceMap.get(a.id) || 0;
        const countB = attendanceMap.get(b.id) || 0;
        if (sortOrder === "ATTENDANCE_HIGH") {
          return countB - countA;
        } else {
          return countA - countB;
        }
      });
    }

    const teacherTypes = [
      MemberType.TEACHER,
      MemberType.HELPER,
      MemberType.VOLUNTEER,
    ];

    if (hubTab === "TEACHERS") {
      baseList = baseList.filter((m) => teacherTypes.includes(m.type));
    } else {
      baseList = baseList.filter((m) => !teacherTypes.includes(m.type));
    }

    // Filter by Church: if activeChurch is CM (Admin), show everything unless filtered, otherwise filter by assignment
    if (activeChurch !== "CM") {
      baseList = baseList.filter(
        (m) =>
          m.assignedChurch === activeChurch ||
          (m.assignedChurch === "All" && isAdmin && hubTab === "TEACHERS"),
      );
    } else {
      // Admin (CM) View: Filter by selected church from toolbar
      if (churchFilter !== "All") {
        baseList = baseList.filter((m) => m.assignedChurch === churchFilter);
      }
    }

    if (filter === "ARCHIVED") {
      const archivedMembers = baseList.filter(
        (m) => m.status === MemberStatus.ARCHIVED,
      );
      return renderMemberTableSection({
        title: "Archived",
        members: archivedMembers,
        icon: Archive,
        colorClass: "text-gray-500",
        badgeClass: "bg-gray-100 text-gray-700",
        isTeacherSection: hubTab === "TEACHERS",
      });
    }

    let membersToShow = baseList.filter(
      (m) => m.status !== MemberStatus.ARCHIVED,
    );
    if (filter !== "CM") {
      membersToShow = membersToShow.filter((m) => m.type === filter);
      return renderMemberTableSection({
        title: `${filter}s`,
        members: membersToShow,
        icon: Users,
        colorClass: "text-indigo-600",
        badgeClass: "bg-indigo-100 text-indigo-700",
        isTeacherSection: hubTab === "TEACHERS",
      });
    }

    if (hubTab === "TEACHERS") {
      return (
        <div className="space-y-4">
          {renderMemberTableSection({
            title: "Teachers",
            members: membersToShow.filter((m) => m.type === MemberType.TEACHER),
            icon: GraduationCap,
            colorClass: "text-purple-600",
            badgeClass: "bg-purple-100 text-purple-700",
            isTeacherSection: true,
          })}
          {renderMemberTableSection({
            title: "Helpers",
            members: membersToShow.filter((m) => m.type === MemberType.HELPER),
            icon: Heart,
            colorClass: "text-pink-600",
            badgeClass: "bg-pink-100 text-pink-700",
            isTeacherSection: true,
          })}
          {renderMemberTableSection({
            title: "Volunteers",
            members: membersToShow.filter(
              (m) => m.type === MemberType.VOLUNTEER,
            ),
            icon: Hand,
            colorClass: "text-orange-600",
            badgeClass: "bg-orange-100 text-orange-700",
            isTeacherSection: true,
          })}
        </div>
      );
    } else {
      return (
        <div className="space-y-4">
          {renderMemberTableSection({
            title: "Members",
            members: membersToShow.filter((m) => m.type === MemberType.MEMBER),
            icon: User,
            colorClass: "text-indigo-600",
            badgeClass: "bg-indigo-100 text-indigo-700",
          })}
          {renderMemberTableSection({
            title: "Friends & Family",
            members: membersToShow.filter((m) => m.type === MemberType.FNF),
            icon: Users,
            colorClass: "text-amber-600",
            badgeClass: "bg-amber-100 text-amber-700",
          })}
          {renderMemberTableSection({
            title: "Visitors",
            members: membersToShow.filter((m) => m.type === MemberType.VISITOR),
            icon: Users,
            colorClass: "text-teal-600",
            badgeClass: "bg-teal-100 text-teal-700",
          })}
          {renderMemberTableSection({
            title: "Inconsistent",
            members: membersToShow.filter(
              (m) => m.type === MemberType.INCONSISTENT,
            ),
            icon: AlertCircle,
            colorClass: "text-rose-600",
            badgeClass: "bg-rose-100 text-rose-700",
          })}
          {renderMemberTableSection({
            title: "Not A Member",
            members: membersToShow.filter(
              (m) => m.type === MemberType.NOT_MEMBER,
            ),
            icon: HelpCircle,
            colorClass: "text-slate-600",
            badgeClass: "bg-slate-100 text-slate-700",
          })}
        </div>
      );
    }
  };

  const getCreationRoleOptions = () => {
    if (hubTab === "TEACHERS") {
      return [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER];
    } else {
      return [
        MemberType.MEMBER,
        MemberType.FNF,
        MemberType.VISITOR,
        MemberType.INCONSISTENT,
        MemberType.NOT_MEMBER,
      ];
    }
  };

  const renderFormContent = () => (
    <div className="space-y-6">
      {/* Basic Info Section */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
          <UserCircle size={16} className="text-indigo-500" /> Personal Info
        </h4>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800"
              placeholder="e.g., John Doe"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              autoFocus
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
              Date of Birth
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="date"
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800"
                value={formData.birthDate}
                onChange={(e) =>
                  setFormData({ ...formData, birthDate: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
              Status
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Activity size={18} className="text-gray-400" />
              </div>
              <select
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800 appearance-none"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as MemberStatus,
                  })
                }
              >
                {Object.values(MemberStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Church & Role Section */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
          <Building2 size={16} className="text-indigo-500" /> Church & Role
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
              Role Category
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <BadgeCheck size={18} className="text-gray-400" />
              </div>
              <select
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800 appearance-none"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as MemberType,
                  })
                }
              >
                {getCreationRoleOptions().map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
              Assigned Church
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 size={18} className="text-gray-400" />
              </div>
              <select
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800 appearance-none"
                value={formData.assignedChurch}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assignedChurch: e.target.value as Church,
                  })
                }
              >
                {availableChurches.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {isAdmin && <option value="CM">CM (Admin)</option>}
                {hubTab === "TEACHERS" && isAdmin && (
                  <option value="All">All Churches</option>
                )}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
          <Phone size={16} className="text-indigo-500" /> Contact Details
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
              Personal Phone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Smartphone size={18} className="text-gray-400" />
              </div>
              <input
                type="tel"
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="050..."
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
              Parent Phone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone size={18} className="text-gray-400" />
              </div>
              <input
                type="tel"
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800"
                value={formData.parentPhone}
                onChange={(e) =>
                  setFormData({ ...formData, parentPhone: e.target.value })
                }
                placeholder="Guardian..."
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
            Address / Landmark
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="House No, Street..."
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
            GPS (Lat, Lng)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-gray-800"
              value={formData.gpsCoordinates}
              onChange={(e) =>
                setFormData({ ...formData, gpsCoordinates: e.target.value })
              }
              placeholder="e.g. 5.6037, -0.1870"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 ml-1">
            Copy coordinates from Google Maps for exact location.
          </p>
        </div>
      </div>

      {/* Teacher specific system access fields */}
      {hubTab === "TEACHERS" && isAdmin && (
        <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
          <h4 className="font-bold text-indigo-700 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
            <Key size={16} /> System Access
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-700/70 mb-1.5 ml-1">
                Passcode (PIN)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-indigo-400" />
                </div>
                <input
                  type="text"
                  placeholder="0000"
                  className="w-full pl-10 p-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all font-mono tracking-widest text-indigo-900 font-bold"
                  value={formData.passcode}
                  onChange={(e) =>
                    setFormData({ ...formData, passcode: e.target.value })
                  }
                  maxLength={4}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-700/70 mb-1.5 ml-1">
                System Role
              </label>
              <div className="relative">
                <select
                  className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all font-medium text-indigo-900 appearance-none"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as Role })
                  }
                >
                  <option value="TEACHER">Teacher</option>
                  <option value="ADMIN">Admin</option>
                  <option value="NONE">None</option>
                  {currentUser.role === "SUPER_ADMIN" && (
                    <>
                      <option value="ZONAL_HEAD">Zone Head</option>
                      <option value="SUPER_ADMIN">
                        CMD Head (Super Admin)
                      </option>
                    </>
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown size={16} className="text-indigo-400" />
                </div>
              </div>
            </div>

            {/* Conditional Branch/Zone selector */}
            {(formData.role === "TEACHER" || formData.role === "ADMIN") &&
              (currentUser.role === "SUPER_ADMIN" ||
                currentUser.role === "ZONAL_HEAD") && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-indigo-700/70 mb-1.5 ml-1">
                    Assign to Branch
                  </label>
                  <select
                    className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all font-medium text-indigo-900"
                    value={formData.branchId || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, branchId: e.target.value })
                    }
                  >
                    <option value="">Select Branch...</option>
                    {data.settings.organization?.zones
                      ?.flatMap((z) => z.branches || [])
                      .map((b) => (
                        <option key={b.id || b.name} value={b.id || b.name}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

            {formData.role === "ZONAL_HEAD" &&
              currentUser.role === "SUPER_ADMIN" && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-indigo-700/70 mb-1.5 ml-1">
                    Assign to Zone
                  </label>
                  <select
                    className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all font-medium text-indigo-900"
                    value={formData.zoneId || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, zoneId: e.target.value })
                    }
                  >
                    <option value="">Select Zone...</option>
                    {data.settings.organization?.zones?.map((z) => (
                      <option key={z.id || z.name} value={z.id || z.name}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-200 cursor-pointer hover:bg-indigo-100/50 transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isAccessActive}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isAccessActive: e.target.checked,
                    })
                  }
                  className="w-5 h-5 border-2 border-indigo-300 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                />
              </div>
              <span className="text-sm font-bold text-indigo-900">
                Enable Login Access
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            People Hub: {activeChurch}
          </h2>
          <p className="text-sm text-gray-500">Manage teachers and members.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setHubTab("MEMBERS")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${hubTab === "MEMBERS" ? "bg-white shadow-sm text-indigo-600" : "text-gray-500"}`}
          >
            <span className="flex items-center gap-2">
              <User size={16} /> Members
            </span>
          </button>
          <button
            onClick={() => setHubTab("TEACHERS")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${hubTab === "TEACHERS" ? "bg-white shadow-sm text-purple-600" : "text-gray-500"}`}
          >
            <span className="flex items-center gap-2">
              <Briefcase size={16} /> Teachers
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Church Filter (Admin Only) */}
        {activeChurch === "CM" && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Building2 size={18} /> Church Filter
            </h3>

            {/* Desktop: Horizontal Scroll - Updated Order I, K, LJ, UJ */}
            <div className="hidden md:flex bg-gray-50 rounded-xl p-1 overflow-x-auto max-w-full w-full sm:w-auto no-scrollbar">
              {["All", ...availableChurches, "CM"].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setChurchFilter(c);
                    setSelectedIds(new Set());
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-1 sm:flex-none text-center ${churchFilter === c ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
                >
                  {c === "All" ? "All Branches" : `${c} Church`}
                </button>
              ))}
            </div>

            {/* Mobile: Dropdown - Updated Order I, K, LJ, UJ */}
            <div className="md:hidden w-full relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                <ChevronDown size={16} />
              </div>
              <select
                value={churchFilter}
                onChange={(e) => {
                  setChurchFilter(e.target.value as Church | "All");
                  setSelectedIds(new Set());
                }}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="All">All Branches</option>
                {[...availableChurches, "CM"].map((c) => (
                  <option key={c} value={c}>
                    {c} Church
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Type Filter */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <Filter size={18} /> {hubTab === "TEACHERS" ? "Role" : "Type"}{" "}
            Filter
          </h3>

          {/* Desktop: Horizontal Scroll */}
          <div className="hidden md:flex bg-gray-50 rounded-xl p-1 overflow-x-auto max-w-full w-full sm:w-auto no-scrollbar">
            {["CM", ...getCreationRoleOptions(), "ARCHIVED"].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setSelectedIds(new Set());
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-1 sm:flex-none text-center ${filter === f ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
              >
                {f === "CM" ? "All Active" : f}
              </button>
            ))}
          </div>

          {/* Mobile: Dropdown */}
          <div className="md:hidden w-full relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
              <ChevronDown size={16} />
            </div>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setSelectedIds(new Set());
              }}
              className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="CM">All Active</option>
              {getCreationRoleOptions().map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="w-full md:w-auto relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
              <ChevronDown size={16} />
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full md:w-48 appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold rounded-xl p-3 md:py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="A-Z">Sort: A-Z</option>
              <option value="ATTENDANCE_HIGH">
                Sort: Attendance (High-Low)
              </option>
              <option value="ATTENDANCE_LOW">
                Sort: Attendance (Low-High)
              </option>
            </select>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && filter !== "ARCHIVED" && canManage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-4 w-[90%] md:w-auto justify-between md:justify-start animate-in fade-in slide-in-from-bottom-4">
          <span className="font-bold whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-gray-700 hidden md:block"></div>
          <button
            onClick={handleBulkArchive}
            className="flex items-center gap-2 hover:text-red-300 transition-colors font-medium text-red-200 whitespace-nowrap"
          >
            <Archive size={18} /> Bulk Archive
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-2 p-1 hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {getFilteredContent()}

      {canManage && !isCreateModalOpen && !isEditModalOpen && (
        <button
          onClick={openCreateModal}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg shadow-indigo-300 transition-all hover:scale-110 z-40 active:scale-95 flex items-center justify-center"
          title="Create New Member/Teacher"
        >
          <Plus size={28} />
        </button>
      )}

      {/* UNIFIED SIDE DRAWER (CREATE & EDIT) */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-gray-50 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out border-l border-gray-200">
            {/* Drawer Header */}
            <div className="bg-white px-6 py-5 border-b border-gray-200 shrink-0 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${hubTab === "TEACHERS" ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600"}`}
                >
                  {hubTab === "TEACHERS" ? (
                    <Briefcase size={22} />
                  ) : (
                    <User size={22} />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    {isEditModalOpen ? "Edit" : "New"}{" "}
                    {hubTab === "TEACHERS" ? "Teacher" : "Member"}
                  </h3>
                  {isEditModalOpen && (
                    <p className="text-xs text-gray-400 font-mono font-bold uppercase mt-0.5 tracking-wider">
                      ID: {editingId?.substring(0, 8)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-gray-400 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
              {renderFormContent()}
            </div>

            {/* Drawer Footer */}
            <div className="bg-white p-6 border-t border-gray-200 shrink-0 flex gap-4 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="flex-1 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 p-3.5 rounded-xl font-bold transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold shadow-md shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {isEditModalOpen ? "Save Changes" : "Create Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] animate-in zoom-in-95 overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  Attendance History
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {data.members.find((m) => m.id === historyMemberId)?.name}
                </p>
              </div>
              <button
                onClick={() => setHistoryMemberId(null)}
                className="p-2 bg-white rounded-full hover:bg-slate-100 transition-colors shadow-sm"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-4 flex-1">
              {(() => {
                const member = data.members.find(
                  (m) => m.id === historyMemberId,
                );
                if (!member) return null;

                const history = data.attendance
                  .filter((r) => {
                    const recordDate = new Date(r.date);
                    const isPresent = r.presentMemberIds.includes(member.id);
                    if (isPresent) return true;

                    // Determine assigned church at recordDate
                    let assignedAtDate = member.assignedChurch;

                    if (
                      member.promotionHistory &&
                      member.promotionHistory.length > 0
                    ) {
                      const promoHistory = [...member.promotionHistory].sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      );
                      const activePromo = promoHistory.find(
                        (p) => recordDate >= new Date(p.date),
                      );

                      if (activePromo) {
                        assignedAtDate = activePromo.toChurch;
                      } else {
                        // Before first recorded promotion, use the 'from' of the earliest promotion
                        const earliest = promoHistory[promoHistory.length - 1];
                        assignedAtDate = earliest.fromChurch;
                      }
                    }

                    return r.churchId === assignedAtDate;
                  })
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  );

                // Calculate chart data (last 6 months)
                const chartData = [];
                const monthNames = [
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
                const today = new Date();

                // Simplified current church size (for average denominator)
                const currentChurchMembersCount =
                  data.members.filter(
                    (m) =>
                      m.assignedChurch === member.assignedChurch &&
                      ["Member", "FNF", "Visitor", "Inconsistent"].includes(
                        m.type,
                      ) &&
                      m.status === "Active",
                  ).length || 1;

                for (let i = 5; i >= 0; i--) {
                  const targetDate = new Date(
                    today.getFullYear(),
                    today.getMonth() - i,
                    1,
                  );
                  const targetMonth = targetDate.getMonth();
                  const targetYear = targetDate.getFullYear();

                  const recordsInMonth = history.filter((r) => {
                    const d = new Date(r.date);
                    return (
                      d.getMonth() === targetMonth &&
                      d.getFullYear() === targetYear
                    );
                  });

                  const attendedCount = recordsInMonth.filter((r) =>
                    r.presentMemberIds.includes(member.id),
                  ).length;

                  const churchRecordsInMonth = data.attendance.filter((r) => {
                    const d = new Date(r.date);
                    return (
                      r.churchId === member.assignedChurch &&
                      d.getMonth() === targetMonth &&
                      d.getFullYear() === targetYear
                    );
                  });

                  const totalAttendances = churchRecordsInMonth.reduce(
                    (acc, r) => {
                      return (
                        acc +
                        r.presentMemberIds.filter((id) => {
                          const m = data.members.find((x) => x.id === id);
                          return (
                            m &&
                            [
                              "Member",
                              "FNF",
                              "Visitor",
                              "Inconsistent",
                            ].includes(m.type)
                          );
                        }).length
                      );
                    },
                    0,
                  );

                  const avgAttended = parseFloat(
                    (totalAttendances / currentChurchMembersCount).toFixed(1),
                  );

                  chartData.push({
                    name: `${monthNames[targetMonth]}`,
                    personalFreq: attendedCount,
                    avgFreq: avgAttended,
                  });
                }

                return (
                  <>
                    <div className="mb-6 h-56 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                        6-Month Frequency vs Church Avg
                      </h4>
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 0, right: 0, left: -25, bottom: 0 }}
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
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#64748B" }}
                            dx={-10}
                            allowDecimals={false}
                          />
                          <RechartsTooltip
                            cursor={{ fill: "#F1F5F9" }}
                            contentStyle={{
                              borderRadius: "12px",
                              border: "1px solid #E2E8F0",
                              boxShadow:
                                "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "10px" }}
                            iconType="circle"
                          />
                          <Bar
                            dataKey="personalFreq"
                            name="This Member"
                            fill="#6366f1"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={20}
                          />
                          <Bar
                            dataKey="avgFreq"
                            name={`${member.assignedChurch} Avg`}
                            fill="#cbd5e1"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={20}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
                      Recent Records
                    </h4>
                    <div className="space-y-2">
                      {history.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          No attendance records found.
                        </div>
                      ) : (
                        history.slice(0, 20).map((record) => {
                          const isPresent = record.presentMemberIds.includes(
                            member.id,
                          );
                          const service = record.serviceMap?.[member.id];

                          return (
                            <div
                              key={record.date}
                              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${isPresent ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-300"}`}
                                >
                                  {isPresent ? (
                                    <Activity size={20} />
                                  ) : (
                                    <X size={20} />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-700">
                                    {formatDateDDMMYYYY(record.date)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">
                                    {isPresent ? "Present" : "Absent"}
                                  </div>
                                  {record.churchId !==
                                    member.assignedChurch && (
                                    <div className="text-[10px] text-indigo-400 font-bold uppercase mt-0.5">
                                      {record.churchId} Church
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isPresent && service && (
                                <div
                                  className={`px-2 py-1 rounded text-[10px] font-bold border uppercase flex items-center gap-1 ${service === "JOY" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-sky-50 text-sky-700 border-sky-100"}`}
                                >
                                  {service === "JOY" ? (
                                    <Sun size={10} />
                                  ) : (
                                    <Zap size={10} />
                                  )}{" "}
                                  {service}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG - ARCHIVE */}
      {(memberToArchive || isBulkArchiveConfirming) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4 mx-auto">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">
              Confirm Action
            </h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              {memberToArchive
                ? `Are you sure you want to archive ${memberToArchive.name}? This will move them to the archived list.`
                : `Are you sure you want to archive ${selectedIds.size} selected members?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMemberToArchive(null);
                  setIsBulkArchiveConfirming(false);
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={
                  memberToArchive ? confirmArchiveSingle : confirmBulkArchive
                }
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {transferMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-fuchsia-100 text-fuchsia-600 mb-4 mx-auto">
              <ArrowRightLeft size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">
              Transfer Member
            </h3>
            <p className="text-gray-500 text-center text-sm mb-4">
              Move {transferMember.name} to a different church branch.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Target Church
              </label>
              <select
                className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value as Church)}
              >
                <option value="">Select a branch</option>
                {availableChurches.map((c) => (
                  <option
                    key={c}
                    value={c}
                    disabled={c === transferMember.assignedChurch}
                  >
                    {c} {c === transferMember.assignedChurch ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTransferMember(null);
                  setTransferTarget("");
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransfer}
                disabled={
                  !transferTarget ||
                  transferTarget === transferMember.assignedChurch
                }
                className="flex-1 py-3 bg-fuchsia-600 text-white font-bold rounded-xl hover:bg-fuchsia-700 transition-colors shadow-lg shadow-fuchsia-200 disabled:opacity-50 disabled:pointer-events-none"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersList;
