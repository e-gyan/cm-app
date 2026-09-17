import { Member, MemberType, MemberStatus } from "../types";

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
      // 1. Fair share of FNF: distribute round-robin so each teacher gets an equal share
      fnfList.forEach((member, i) => {
        const teacherIndex = i % totalEligibleTeachers;
        assignments[teacherIndex].members.push(member);
      });

      // 2. Fair share of First Timers (Visitors): distribute round-robin with offset
      const visitorOffset = fnfList.length % totalEligibleTeachers;
      visitorList.forEach((member, i) => {
        const teacherIndex = (visitorOffset + i) % totalEligibleTeachers;
        assignments[teacherIndex].members.push(member);
      });

      // 3. Regular Members: distribute round-robin with offset to keep total count strictly balanced (diff <= 1)
      const memberOffset = (fnfList.length + visitorList.length) % totalEligibleTeachers;
      membersList.forEach((member, i) => {
        const teacherIndex = (memberOffset + i) % totalEligibleTeachers;
        assignments[teacherIndex].members.push(member);
      });

      // 4. Any other non-staff children
      const otherOffset = (fnfList.length + visitorList.length + membersList.length) % totalEligibleTeachers;
      otherList.forEach((member, i) => {
        const teacherIndex = (otherOffset + i) % totalEligibleTeachers;
        assignments[teacherIndex].members.push(member);
      });

      // Sort each teacher's assigned members alphabetically for clean display and sync count
      assignments.forEach((asg) => {
        asg.members.sort((a, b) => a.name.localeCompare(b.name));
        asg.count = asg.members.length;
      });
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
