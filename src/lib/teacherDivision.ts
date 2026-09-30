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
  UJ: "UJ",
  LJ: "LJ",
  K: "K",
  I: "I",
  N: "N",
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

export const isFnfOrVisitor = (m: Member): boolean => {
  const typeStr = (m.type as unknown as string) || "";
  return (
    m.type === MemberType.FNF ||
    m.type === MemberType.VISITOR ||
    typeStr === "FNF" ||
    typeStr === "Visitor"
  );
};

// Persistent teacher hook helper
export const getHookedTeacherId = (member: Member): string | undefined => {
  return member.assignedTeacherId || undefined;
};

export const setHookedTeacherId = (member: Member, teacherId?: string): void => {
  member.assignedTeacherId = teacherId || undefined;
  if (typeof window !== "undefined") {
    try {
      if (teacherId) {
        localStorage.setItem(`cm_hooked_teacher_${member.id}`, teacherId);
      } else {
        localStorage.removeItem(`cm_hooked_teacher_${member.id}`);
      }
    } catch {
      // ignore
    }
  }
};

// Normalizes name string for comparison
export const normalizeName = (name: string): string =>
  (name || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");

// Extracts surname/last name
export const extractSurname = (name: string): string => {
  const parts = normalizeName(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return "";
};

// Helper to check if member was explicitly separated from family grouping
export const isExplicitlySolo = (member: Member): boolean => {
  return !!member.householdId && member.householdId.startsWith("SOLO");
};

// Helper to check if member has an explicit custom family link
export const isExplicitlyLinkedFamily = (member: Member): boolean => {
  return !!member.householdId && !member.householdId.startsWith("SOLO");
};

// Determines whether two members share a household (explicit user override, surname, parent phone, or linked siblings)
export const areMembersInSameHousehold = (a: Member, b: Member): boolean => {
  // 0. Explicit User Decisions / Overrides
  // If either child was explicitly marked as SOLO ("Not a family"), they are strictly individual
  if (isExplicitlySolo(a) || isExplicitlySolo(b)) {
    return false;
  }

  // If both have an explicit custom householdId
  if (a.householdId && b.householdId) {
    return a.householdId === b.householdId;
  }

  // If one has an explicit custom householdId and the other does not:
  // Custom families are closed and do not auto-absorb other non-tagged members
  if (a.householdId || b.householdId) {
    return false;
  }

  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);

  // 1. Explicit known linked sibling / household pairs
  const isSandraKelvin =
    (nameA.includes("sandra omari") && nameB.includes("kelvin asante")) ||
    (nameB.includes("sandra omari") && nameA.includes("kelvin asante"));
  if (isSandraKelvin) return true;

  const isEstherMaeeva =
    (nameA.includes("esther") && nameB.includes("maeeva")) ||
    (nameB.includes("esther") && nameA.includes("maeeva"));
  if (isEstherMaeeva) return true;

  // 2. Parent phone match (if 7+ digits)
  const phoneA = (a.parentPhone || a.phone || "").replace(/\D/g, "");
  const phoneB = (b.parentPhone || b.phone || "").replace(/\D/g, "");
  if (phoneA.length >= 7 && phoneA === phoneB) return true;

  // 3. Surname match (e.g. Mensah, Zong, Opoku, etc.)
  const surnameA = extractSurname(a.name);
  const surnameB = extractSurname(b.name);
  if (surnameA && surnameB && surnameA === surnameB && surnameA.length >= 3) {
    return true;
  }

  return false;
};

// Groups members into connected household/family clusters
export const groupMembersIntoHouseholds = (members: Member[]): Member[][] => {
  const clusters: Member[][] = [];
  const visited = new Set<string>();

  members.forEach((m) => {
    if (visited.has(m.id)) return;
    const currentCluster: Member[] = [m];
    visited.add(m.id);

    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      for (const other of members) {
        if (!visited.has(other.id)) {
          const matchesAny = currentCluster.some((clusterMember) =>
            areMembersInSameHousehold(clusterMember, other)
          );
          if (matchesAny) {
            currentCluster.push(other);
            visited.add(other.id);
            addedMore = true;
          }
        }
      }
    }
    clusters.push(currentCluster);
  });

  return clusters;
};

// Gets eligible shepherds for a specific church department
export const getEligibleShepherdsForChurch = (
  church: string,
  allMembers: Member[],
  branchFilter?: string,
): Member[] => {
  const teachersInChurch = allMembers.filter((m) => {
    if (m.status === MemberStatus.ARCHIVED || m.status === MemberStatus.TRANSFERRED) return false;
    const matchChurch =
      m.assignedChurch === church ||
      (m.assignedChurch === "All" && isStaffOrTeacher(m));
    const matchBranch =
      !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
    return matchChurch && matchBranch && isStaffOrTeacher(m);
  });

  const uniqueTeachersMap = new Map<string, Member>();
  teachersInChurch.forEach((t) => uniqueTeachersMap.set(t.id, t));
  const allTeachers = Array.from(uniqueTeachersMap.values());

  const eligibleTeachers: Member[] = [];
  allTeachers.forEach((t) => {
    if (church === "UJ" && isBranchHead(t)) {
      // omit branch head for UJ division
    } else if (
      (t.role === "ADMIN" || t.role === "SUPER_ADMIN") &&
      t.name.toLowerCase() === "admin"
    ) {
      // omit system admin
    } else {
      eligibleTeachers.push(t);
    }
  });

  return eligibleTeachers.sort((a, b) => a.name.localeCompare(b.name));
};

// Auto-allocates children to shepherds equally while keeping households intact
export const autoAllocateChildrenForChurch = (
  church: string,
  allMembers: Member[],
  branchFilter?: string,
): { updatedMembers: Member[]; assignments: TeacherAssignment[] } => {
  const eligibleShepherds = getEligibleShepherdsForChurch(church, allMembers, branchFilter);
  const pureMembers = allMembers.filter((m) => {
    const matchChurch = m.assignedChurch === church;
    const matchBranch =
      !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
    return (
      matchChurch &&
      matchBranch &&
      m.status !== MemberStatus.ARCHIVED &&
      m.status !== MemberStatus.TRANSFERRED &&
      !isStaffOrTeacher(m) &&
      !isFnfOrVisitor(m)
    );
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (eligibleShepherds.length === 0 || pureMembers.length === 0) {
    return {
      updatedMembers: allMembers,
      assignments: eligibleShepherds.map((s) => ({ teacher: s, members: [], count: 0 })),
    };
  }

  const assignments: TeacherAssignment[] = eligibleShepherds.map((s) => ({
    teacher: s,
    members: [],
    count: 0,
  }));

  const clusters = groupMembersIntoHouseholds(pureMembers);
  // Sort largest clusters first for optimal balanced distribution
  clusters.sort((a, b) => b.length - a.length);

  clusters.forEach((cluster) => {
    // Pick shepherd with lowest member count
    assignments.sort(
      (a, b) =>
        a.members.length - b.members.length ||
        a.teacher.name.localeCompare(b.teacher.name)
    );
    const targetAsg = assignments[0];
    cluster.forEach((child) => {
      targetAsg.members.push(child);
    });
  });

  assignments.forEach((asg) => {
    asg.members.sort((a, b) => a.name.localeCompare(b.name));
    asg.count = asg.members.length;
  });
  assignments.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name));

  // Build map of new child assignments
  const childToShepherdMap = new Map<string, string>();
  assignments.forEach((asg) => {
    asg.members.forEach((child) => {
      childToShepherdMap.set(child.id, asg.teacher.id);
    });
  });

  const updatedMembers = allMembers.map((m) => {
    // Unassign FNFs and Visitors if they currently have an assigned shepherd
    if (isFnfOrVisitor(m) && m.assignedTeacherId) {
      const up = { ...m };
      delete up.assignedTeacherId;
      up.assignedTeacherId = undefined;
      setHookedTeacherId(up, undefined);
      return up;
    }
    if (childToShepherdMap.has(m.id)) {
      const assignedTeacherId = childToShepherdMap.get(m.id);
      setHookedTeacherId(m, assignedTeacherId!);
      return { ...m, assignedTeacherId };
    }
    return m;
  });

  return { updatedMembers, assignments };
};

export const calculateChurchDivisions = (
  allMembers: Member[],
  targetChurches: string[] = ["UJ", "LJ", "K", "I", "N"],
  branchFilter?: string,
): Record<string, ChurchDivisionResult> => {
  const results: Record<string, ChurchDivisionResult> = {};

  for (const church of targetChurches) {
    const pureMembers = allMembers.filter((m) => {
      const matchChurch = m.assignedChurch === church;
      const matchBranch =
        !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
      return (
        matchChurch &&
        matchBranch &&
        m.status !== MemberStatus.ARCHIVED &&
        m.status !== MemberStatus.TRANSFERRED &&
        !isStaffOrTeacher(m) &&
        !isFnfOrVisitor(m)
      );
    }).sort((a, b) => a.name.localeCompare(b.name));

    const eligibleTeachers = getEligibleShepherdsForChurch(church, allMembers, branchFilter);
    const totalMembers = pureMembers.length;
    const totalEligibleTeachers = eligibleTeachers.length;

    const omittedTeachers = allMembers.filter((m) => {
      if (m.status === MemberStatus.ARCHIVED || m.status === MemberStatus.TRANSFERRED) return false;
      const matchChurch =
        m.assignedChurch === church ||
        (m.assignedChurch === "All" && isStaffOrTeacher(m));
      const matchBranch =
        !branchFilter || branchFilter === "ALL" || m.branchId === branchFilter;
      return matchChurch && matchBranch && isStaffOrTeacher(m) && !eligibleTeachers.some((et) => et.id === m.id);
    });

    const assignments: TeacherAssignment[] = eligibleTeachers.map((t) => ({
      teacher: t,
      members: [],
      count: 0,
    }));

    const unassignedMembers: Member[] = [];

    if (totalEligibleTeachers > 0) {
      const teacherMap = new Map<string, TeacherAssignment>();
      assignments.forEach((asg) => teacherMap.set(asg.teacher.id, asg));

      const clusters = groupMembersIntoHouseholds(pureMembers);

      // 2. Assign clusters:
      // First, handle clusters where at least one member already has a valid hooked teacher
      const unassignedClusters: Member[][] = [];

      clusters.forEach((cluster) => {
        let existingTeacherId: string | undefined = undefined;
        for (const m of cluster) {
          const hooked = getHookedTeacherId(m);
          if (hooked && teacherMap.has(hooked)) {
            existingTeacherId = hooked;
            break;
          }
        }

        if (existingTeacherId) {
          const targetAsg = teacherMap.get(existingTeacherId)!;
          cluster.forEach((m) => {
            targetAsg.members.push(m);
          });
        } else {
          unassignedMembers.push(...cluster);
        }
      });

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
  let text = `📊 *EQUAL MEMBER ALLOCATION & SHEPHERD DIVISION*\n`;
  text += `_Divided equally per active shepherds for UJ, LJ, K, I_\n`;
  text += `────────────────────────────\n\n`;

  Object.values(divisions).forEach((div) => {
    text += `🏛️ *${div.churchName.toUpperCase()}*\n`;
    text += `• Total Members: *${div.totalMembers}*\n`;
    text += `• Active Shepherds for Allocation: *${div.totalEligibleTeachers}*\n`;
    if (div.church === "UJ" && div.omittedTeachers.length > 0) {
      const omittedNames = div.omittedTeachers.map((t) => t.name).join(", ");
      text += `• _(Branch Head omitted from division: ${omittedNames})_\n`;
    }
    text += `• Allocation Ratio: *~${div.membersPerTeacherAvg} members / shepherd* (Range: ${div.minMembersPerTeacher} - ${div.maxMembersPerTeacher})\n\n`;

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
      text += `  ⚠️ _No eligible shepherds assigned to this church yet._\n\n`;
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
    "Church,Shepherd Name,Shepherd Role,Member Name,Gender,Status,Parent Phone,Phone,Address,GPS Coordinates",
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
