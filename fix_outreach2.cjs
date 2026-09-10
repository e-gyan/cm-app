const fs = require('fs');
let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

if (!content.includes('calculateChurchDivisions')) {
  content = content.replace(
    'import {',
    'import { calculateChurchDivisions } from "../lib/teacherDivision";\nimport {'
  );
}

const newConnectList = `  const divisions = useMemo(() => {
    return calculateChurchDivisions(data.members, ["UJ"]);
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

  const connectList = useMemo(() => {
    let list = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        m.type === MemberType.MEMBER &&
        m.status !== MemberStatus.ARCHIVED,
    );

    if (!isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)) {
      const ujDiv = divisions["UJ"];
      if (ujDiv) {
        const assignment = ujDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          list = list.filter((m) => assignedIds.has(m.id));
        } else {
          list = [];
        }
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.members, activeChurch, filterChurch, isAdmin, currentUser, divisions]);`;

content = content.replace(/const connectList = useMemo\(\(\) => \{[\s\S]*?\}, \[data\.members, activeChurch, filterChurch, isAdmin\]\);/, newConnectList);

const filteredSessionsStr = `  const filteredLocalSessions = useMemo(() => {
    let sessions = localSessions || [];
    if (!isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)) {
      const ujDiv = divisions["UJ"];
      if (ujDiv) {
        const assignment = ujDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          sessions = sessions.filter(s => 
            s.assignedMemberIds.some(id => assignedIds.has(id) || visitorFnfIds.has(id))
          );
        } else {
          sessions = sessions.filter(s => 
            s.assignedMemberIds.some(id => visitorFnfIds.has(id))
          );
        }
      }
    }
    return sessions;
  }, [localSessions, isAdmin, activeChurch, currentUser, divisions, visitorFnfIds]);

  const sortedVisits = useMemo(() => {
    const all = filteredLocalSessions || [];`;

content = content.replace(/const sortedVisits = useMemo\(\(\) => \{\n\s*const all = localSessions \|\| \[\];/g, filteredSessionsStr);
content = content.replace(/\(localSessions \|\| \[\]\)\.forEach\(\(session\) => \{/g, '(filteredLocalSessions || []).forEach((session) => {');

// The array dependencies at the end of useMemos
content = content.replace(/  \}, \[localSessions\]\);/g, '  }, [filteredLocalSessions]);'); 
content = content.replace(/currentSessionMembers=\{\n\s*localSessions\.find/g, 'currentSessionMembers={\n            filteredLocalSessions.find');

const filteredPrayersStr = `  const filteredLocalPrayerSlots = useMemo(() => {
    let slots = localPrayerSlots || [];
    if (!isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)) {
      const ujDiv = divisions["UJ"];
      if (ujDiv) {
        const assignment = ujDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          slots = slots.filter(s => assignedIds.has(s.memberId) || visitorFnfIds.has(s.memberId));
        } else {
          slots = slots.filter(s => visitorFnfIds.has(s.memberId));
        }
      }
    }
    return slots;
  }, [localPrayerSlots, isAdmin, activeChurch, currentUser, divisions, visitorFnfIds]);

  const prayerData = useMemo(() => {
    if (filteredLocalPrayerSlots.length === 0)
      return { active: [], expired: [], completed: [] };
    const today = new Date().toISOString().split("T")[0];

    const all = [...filteredLocalPrayerSlots].sort(`;

content = content.replace(/const prayerData = useMemo\(\(\) => \{\n\s*if \(localPrayerSlots\.length === 0\)\n\s*return \{ active: \[\], expired: \[\], completed: \[\] \};\n\s*const today = new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\];\n\n\s*const all = \[\.\.\.localPrayerSlots\]\.sort\(/g, filteredPrayersStr);
content = content.replace(/  \}, \[localPrayerSlots\]\);/g, '  }, [filteredLocalPrayerSlots]);');

// For AddMemberModal, we want it to only show accessible members.
content = content.replace(/members=\{data\.members\}/g, `members={
              !isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)
                ? data.members.filter(m => connectList.some(cl => cl.id === m.id) || visitorFnfIds.has(m.id))
                : data.members
            }`);


fs.writeFileSync('components/OutreachHub.tsx', content);
