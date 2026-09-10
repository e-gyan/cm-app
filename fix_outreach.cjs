const fs = require('fs');

let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

const targetFunctionStr = `  const handleGenerateSchedule = async () => {
    const ujMembers = data.members.filter(
      (m) =>
        m.assignedChurch === "UJ" &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
            m.status !== MemberStatus.ARCHIVED,
    );
    const res = await generateOutreachSchedule(ujMembers, selectedDates);`;

const newFunctionStr = `  const handleGenerateSchedule = async () => {
    let targetMembers = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
        m.status !== MemberStatus.ARCHIVED
    );

    if (!isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)) {
      const ujDiv = divisions["UJ"];
      if (ujDiv) {
        const assignment = ujDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          targetMembers = targetMembers.filter(m => assignedIds.has(m.id) || visitorFnfIds.has(m.id));
        } else {
          targetMembers = targetMembers.filter(m => visitorFnfIds.has(m.id));
        }
      }
    }

    const res = await generateOutreachSchedule(targetMembers, selectedDates);`;

if (content.includes(targetFunctionStr)) {
  content = content.split(targetFunctionStr).join(newFunctionStr);
  fs.writeFileSync('components/OutreachHub.tsx', content);
  console.log("components/OutreachHub.tsx updated");
} else {
  console.log("Could not find the target string in components/OutreachHub.tsx");
}
