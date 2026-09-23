import { Member, MemberType, MemberStatus, AppOrganization } from "../types";

export interface TeacherAssignment {
  teacher: Member;
  members: Member[];
  count: number;
}

export interface ChurchDivisionResult {
  church: string;
  churchName: string;
  totalMembers: number;
  totalEligibleTeachers: number;
  membersPerTeacherAvg: number;
  minMembersPerTeacher: number;
  maxMembersPerTeacher: number;
  omittedTeachers: Member[];
  eligibleTeachers: Member[];
  assignments: TeacherAssignment[];
  unassignedMembers: Member[];
}

export const CHURCH_NAMES: Record<string, string> = {
  UJ: "Upper Junior (UJ)",
  LJ: "Lower Junior (LJ)",
  K: "Kingdom (K)",
  I: "Infants (I)",
  N: "Nursery (N)",
};

export const isBranchHead = (m: Member): boolean => {
  const role = m.role || "";
  const name = (m.name || "").toLowerCase();
  return (
    role === "BRANCH_COORDINATOR" ||
    role === "DIRECTORATE_HEAD" ||
    role === "ZONAL_HEAD" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    name.includes("branch head") ||
    name.includes("coordinator")
  );
};

export const isStaffOrTeacher = (m: Member): boolean => {
  const isTypeTeacher =
    m.type === MemberType.TEACHER ||
    m.type === MemberType.HELPER ||
    m.type === MemberType.VOLUNTEER;
  const isRoleTeacher = m.role && m.role !== "NONE";
  return Boolean(isTypeTeacher || isRoleTeacher);
};

// Persistent teacher hook helper
export const getHookedTeacherId = (member: Member): string | undefined => {
  if (member.assignedTeacherId) return member.assignedTeacherId;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`cm_hooked_teacher_${member.id}`);
      if (stored) return stored;
    } catch {
      // ignore
    }
  }
  return undefined;
};

export const setHookedTeacherId = (member: Member, teacherId: string): void => {
  member.assignedTeacherId = teacherId;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`cm_hooked_teacher_${member.id}`, teacherId);
    } catch {
      // ignore
    }
  }
};

export const calculateChurchDivisions = (
  allMembers: Member[],
  targetChurches: string[] = ["UJ", "LJ", "K", "I", "N"],
  branchFilter?: string,
): Record<string, ChurchDivisionResult> => {
  const results: Record<string, ChurchDivisionResult> = {};

  for (const church of targetChurches) {
    // 1. Filter members belonging to this church and optional branch
    const churchMembers = allMembers.filter((m) => {
      const matchChurch = m.assignedChurch === church;
      const matchBranch =
        !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
      return matchChurch && matchBranch;
    });

    // 2. Separate people into categories so that each teacher receives a fair share of fnf and first timers
    const fnfList = churchMembers
      .filter(
        (m) =>
          m.type === MemberType.FNF &&
          m.status !== MemberStatus.ARCHIVED &&
          m.status !== MemberStatus.TRANSFERRED &&
          !isStaffOrTeacher(m)
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const visitorList = churchMembers
      .filter(
        (m) =>
          (m.type === MemberType.VISITOR || m.type === MemberType.NOT_MEMBER) &&
          m.status !== MemberStatus.ARCHIVED &&
          m.status !== MemberStatus.TRANSFERRED &&
          !isStaffOrTeacher(m)
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const membersList = churchMembers
      .filter(
        (m) =>
          m.type === MemberType.MEMBER &&
          m.status !== MemberStatus.ARCHIVED &&
          m.status !== MemberStatus.TRANSFERRED &&
          !isStaffOrTeacher(m)
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const otherList = churchMembers
      .filter(
        (m) =>
          m.type !== MemberType.FNF &&
          m.type !== MemberType.VISITOR &&
          m.type !== MemberType.NOT_MEMBER &&
          m.type !== MemberType.MEMBER &&
          !isStaffOrTeacher(m) &&
          m.status !== MemberStatus.ARCHIVED &&
          m.status !== MemberStatus.TRANSFERRED
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const pureMembers = [...fnfList, ...visitorList, ...membersList, ...otherList];

    // 3. Find teachers for this church
    const teachersInChurch = allMembers.filter((m) => {
      if (m.status === MemberStatus.ARCHIVED || m.status === MemberStatus.TRANSFERRED) return false;
      const matchChurch =
        m.assignedChurch === church ||
        (m.assignedChurch === "All" && isStaffOrTeacher(m));
      const matchBranch =
        !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
      return matchChurch && matchBranch && isStaffOrTeacher(m);
    });

    // Deduplicate teachers by ID
    const uniqueTeachersMap = new Map<string, Member>();
    teachersInChurch.forEach((t) => uniqueTeachersMap.set(t.id, t));
    const allTeachers = Array.from(uniqueTeachersMap.values());

    const omittedTeachers: Member[] = [];
    const eligibleTeachers: Member[] = [];

    allTeachers.forEach((t) => {
      // For UJ church: omit Branch Head as part of this division
      if (church === "UJ" && isBranchHead(t)) {
        omittedTeachers.push(t);
      } else if (
        (t.role === "ADMIN" || t.role === "SUPER_ADMIN") &&
        t.name.toLowerCase() === "admin"
      ) {
        // System admin account omitted
        omittedTeachers.push(t);
      } else {
        eligibleTeachers.push(t);
      }
    });

    eligibleTeachers.sort((a, b) => a.name.localeCompare(b.name));

    const totalMembers = pureMembers.length;
    const totalEligibleTeachers = eligibleTeachers.length;

    const assignments: TeacherAssignment[] = eligibleTeachers.map((t) => ({
      teacher: t,
      members: [],
      count: 0,
    }));

    const unassignedMembers: Member[] = [];

    if (totalEligibleTeachers > 0) {
      const teacherMap = new Map<string, TeacherAssignment>();
      assignments.forEach((asg) => teacherMap.set(asg.teacher.id, asg));

      // 1. Separate hooked members vs unhooked members
      const unhookedFnf: Member[] = [];
      const unhookedVisitor: Member[] = [];
      const unhookedRegular: Member[] = [];
      const unhookedOther: Member[] = [];

      pureMembers.forEach((member) => {
        const hookedId = getHookedTeacherId(member);
        if (hookedId && teacherMap.has(hookedId)) {
          // Permanently hooked to this teacher
          member.assignedTeacherId = hookedId;
          teacherMap.get(hookedId)!.members.push(member);
        } else {
          if (member.type === MemberType.FNF) unhookedFnf.push(member);
          else if (member.type === MemberType.VISITOR || member.type === MemberType.NOT_MEMBER) unhookedVisitor.push(member);
          else if (member.type === MemberType.MEMBER) unhookedRegular.push(member);
          else unhookedOther.push(member);
        }
      });

      // Helper to assign a member to the teacher with the least members (keeping strictly balanced)
      // and hook them permanently
      const assignAndHook = (member: Member) => {
        // Sort teachers by current member count ascending, then by name for deterministic stability
        assignments.sort(
          (a, b) => a.members.length - b.members.length || a.teacher.name.localeCompare(b.teacher.name)
        );
        const targetAsg = assignments[0];
        setHookedTeacherId(member, targetAsg.teacher.id);
        targetAsg.members.push(member);
      };

      // Assign remaining unhooked members in priority order so new teachers get a fair share
      unhookedFnf.forEach(assignAndHook);
      unhookedVisitor.forEach(assignAndHook);
      unhookedRegular.forEach(assignAndHook);
      unhookedOther.forEach(assignAndHook);

      // Sort each teacher's assigned members alphabetically for clean display and sync count
      assignments.forEach((asg) => {
        asg.members.sort((a, b) => a.name.localeCompare(b.name));
        asg.count = asg.members.length;
      });
      // Ensure stable display order of teachers by name
      assignments.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name));
    } else {
      unassignedMembers.push(...pureMembers);
    }

    const counts = assignments.map((a) => a.count);
    const minMembersPerTeacher = counts.length > 0 ? Math.min(...counts) : 0;
    const maxMembersPerTeacher = counts.length > 0 ? Math.max(...counts) : 0;
    const membersPerTeacherAvg =
      totalEligibleTeachers > 0
        ? parseFloat((totalMembers / totalEligibleTeachers).toFixed(1))
        : 0;

    results[church] = {
      church,
      churchName: CHURCH_NAMES[church] || `${church} Church`,
      totalMembers,
      totalEligibleTeachers,
      membersPerTeacherAvg,
      minMembersPerTeacher,
      maxMembersPerTeacher,
      omittedTeachers,
      eligibleTeachers,
      assignments,
      unassignedMembers,
    };
  }

  return results;
};

export const formatDivisionReportText = (
  divisions: Record<string, ChurchDivisionResult>,
): string => {
  let text = `📊 *EQUAL MEMBER ALLOCATION & TEACHER DIVISION*\n`;
  text += `_Divided equally per active teachers for UJ, LJ, K, I_\n`;
  text += `────────────────────────────\n\n`;

  Object.values(divisions).forEach((div) => {
    text += `🏛️ *${div.churchName.toUpperCase()}*\n`;
    text += `• Total Members: *${div.totalMembers}*\n`;
    text += `• Active Teachers for Allocation: *${div.totalEligibleTeachers}*\n`;
    if (div.church === "UJ" && div.omittedTeachers.length > 0) {
      const omittedNames = div.omittedTeachers.map((t) => t.name).join(", ");
      text += `• _(Branch Head omitted from division: ${omittedNames})_\n`;
    }
    text += `• Allocation Ratio: *~${div.membersPerTeacherAvg} members / teacher* (Range: ${div.minMembersPerTeacher} - ${div.maxMembersPerTeacher})\n\n`;

    if (div.assignments.length > 0) {
      div.assignments.forEach((asg, idx) => {
        text += `  👤 *${idx + 1}. ${asg.teacher.name}* (${asg.count} Members):\n`;
        asg.members.forEach((m, mIdx) => {
          const phoneStr = m.parentPhone || m.phone ? ` - 📞 ${m.parentPhone || m.phone}` : "";
          text += `     ${mIdx + 1}. ${m.name}${phoneStr}\n`;
        });
        text += `\n`;
      });
    } else {
      text += `  ⚠️ _No eligible teachers assigned to this church yet._\n\n`;
    }

    if (div.unassignedMembers.length > 0) {
      text += `  ⚠️ *Unassigned Members (${div.unassignedMembers.length})*:\n`;
      div.unassignedMembers.forEach((m, mIdx) => {
        text += `     ${mIdx + 1}. ${m.name}\n`;
      });
      text += `\n`;
    }

    text += `────────────────────────────\n\n`;
  });

  return text;
};

export const formatDivisionCSV = (
  divisions: Record<string, ChurchDivisionResult>,
): string => {
  const rows: string[] = [
    "Church,Teacher Name,Teacher Role,Member Name,Gender,Status,Parent Phone,Phone,Address,GPS Coordinates",
  ];

  Object.values(divisions).forEach((div) => {
    div.assignments.forEach((asg) => {
      asg.members.forEach((m) => {
        const clean = (str?: string) =>
          `"${(str || "").replace(/"/g, '""')}"`;
        rows.push(
          [
            clean(div.church),
            clean(asg.teacher.name),
            clean(asg.teacher.role || asg.teacher.type),
            clean(m.name),
            clean(m.gender || ""),
            clean(m.status),
            clean(m.parentPhone || ""),
            clean(m.phone || ""),
            clean(m.address || ""),
            clean(m.gpsCoordinates || ""),
          ].join(","),
        );
      });
    });

    div.unassignedMembers.forEach((m) => {
      const clean = (str?: string) =>
        `"${(str || "").replace(/"/g, '""')}"`;
      rows.push(
        [
          clean(div.church),
          clean("UNASSIGNED"),
          clean("NONE"),
          clean(m.name),
          clean(m.gender || ""),
          clean(m.status),
          clean(m.parentPhone || ""),
          clean(m.phone || ""),
          clean(m.address || ""),
          clean(m.gpsCoordinates || ""),
        ].join(","),
      );
    });
  });

  return rows.join("\n");
};

/**
 * Robust hierarchy matching for filtering items (members, attendance, sessions, etc.)
 * by active branch or active zone.
 */
export const matchesScope = (
  item: { branchId?: string; zoneId?: string; presentMemberIds?: string[] },
  activeBranchId: string | undefined,
  organization?: AppOrganization,
  allMembers?: Member[]
): boolean => {
  if (!activeBranchId || activeBranchId === "ALL") return true;

  // 1. Zone Scope: e.g. "ZONE:zone-central"
  if (activeBranchId.startsWith("ZONE:")) {
    const targetZoneId = activeBranchId.replace("ZONE:", "");
    if (item.zoneId && item.zoneId === targetZoneId) return true;
    const zone = organization?.zones?.find((z) => z.id === targetZoneId);
    if (!zone) return true;
    const branchIds = (zone.branches || []).flatMap((b) => [b.id, b.name].filter(Boolean) as string[]);
    if (item.branchId && branchIds.includes(item.branchId)) return true;
    return false;
  }

  // 2. Branch Scope: activeBranchId is a specific branch ID or name
  if (item.branchId) {
    if (item.branchId === activeBranchId) return true;
    if (item.branchId.trim().toLowerCase() === activeBranchId.trim().toLowerCase()) return true;

    // Seamlessly match Thesaurus and Thesaurus HQ aliases
    const itemNorm = item.branchId.trim().toLowerCase().replace(/\s+hq$/i, "");
    const activeNorm = activeBranchId.trim().toLowerCase().replace(/\s+hq$/i, "");
    if (itemNorm === activeNorm && itemNorm.length > 0) return true;

    // Cross-match branch ID with branch Name in organization
    const branch = organization?.zones
      ?.flatMap((z) => z.branches || [])
      .find((b) => b.id === activeBranchId || b.name === activeBranchId);
    if (branch) {
      if (item.branchId === branch.id || item.branchId === branch.name) return true;
      if (item.branchId.trim().toLowerCase() === branch.name.trim().toLowerCase()) return true;
      const bNorm = branch.name.trim().toLowerCase().replace(/\s+hq$/i, "");
      if (itemNorm === bNorm && itemNorm.length > 0) return true;
    }
    return false;
  }

  // 3. Attendance Record or items with presentMemberIds:
  // If item has presentMemberIds, check if any present member belongs to this branch
  if (item.presentMemberIds && Array.isArray(item.presentMemberIds)) {
    if (allMembers && allMembers.length > 0 && item.presentMemberIds.length > 0) {
      const hasBranchMember = item.presentMemberIds.some((id) => {
        const m = allMembers.find((mem) => mem.id === id);
        return m && matchesScope(m, activeBranchId, organization);
      });
      if (hasBranchMember) return true;
    }
    // If no explicit branchId is set on the attendance record, allow it so coordinators can see it
    return true;
  }

  // 4. If item has no branchId set (legacy record):
  // Associate with the primary/main branch so legacy records are not lost
  const allBranches = organization?.zones?.flatMap((z) => z.branches || []) || [];
  const primaryBranch = allBranches[0];
  if (
    primaryBranch &&
    (activeBranchId === primaryBranch.id ||
      activeBranchId === primaryBranch.name ||
      activeBranchId === "Main" ||
      activeBranchId === "branch-main")
  ) {
    return true;
  }

  if (allBranches.length <= 1) {
    return true;
  }

  return false;
};

/**
 * Get human-friendly label for current active scope
 */
export const getScopeDisplayLabel = (
  activeBranchId: string | undefined,
  organization?: AppOrganization
): string => {
  if (!activeBranchId || activeBranchId === "ALL") return "All Zones and Branches";
  if (activeBranchId.startsWith("ZONE:")) {
    const targetZoneId = activeBranchId.replace("ZONE:", "");
    const zone = organization?.zones?.find((z) => z.id === targetZoneId);
    return zone ? `${zone.name} (All Branches)` : "Zone Scope";
  }
  const branch = organization?.zones
    ?.flatMap((z) => z.branches || [])
    .find((b) => b.id === activeBranchId || b.name === activeBranchId);
  if (branch) return branch.name;
  if (/^thesaurus\s*hq$/i.test(activeBranchId.trim())) return "Thesaurus";
  return activeBranchId;
};
