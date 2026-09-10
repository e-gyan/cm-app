const fs = require('fs');

let outreachPath = 'components/OutreachHub.tsx';
let outreachContent = fs.readFileSync(outreachPath, 'utf8');

const handleGenerateCode = `  const handleGeneratePrayer = async () => {
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
        !["Teacher", "Helper", "Volunteer"].includes(m.type),
    );

    if (!isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)) {
      const ujDiv = divisions["UJ"];
      if (ujDiv) {
        const assignment = ujDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          targetMembers = targetMembers.filter(m => assignedIds.has(m.id) || visitorFnfIds.has(m.id));
        }
      }
    }

    const res = await generatePrayerSchedule(prayerWeek, targetMembers);`;

outreachContent = outreachContent.replace(
  /  const handleGeneratePrayer = async \(\) => \{\n    let targetMembers = data\.members\.filter\(\n      \(m\) =>\n        isMemberInActiveChurch\(m\) &&\n        \!\["Teacher", "Helper", "Volunteer"\]\.includes\(m\.type\),\n    \);\n\n    if \(\!isAdmin && activeChurch === "UJ" && \(currentUser\.type === MemberType\.TEACHER \|\| currentUser\.role === "TEACHER" \|\| currentUser\.role === "BRANCH_COORDINATOR" \|\| currentUser\.type === MemberType\.HELPER\)\) \{\n      const ujDiv = divisions\["UJ"\];\n      if \(ujDiv\) \{\n        const assignment = ujDiv\.assignments\.find\(\(a\) => a\.teacher\.id === currentUser\.id\);\n        if \(assignment\) \{\n          const assignedIds = new Set\(assignment\.members\.map\(\(m\) => m\.id\)\);\n          targetMembers = targetMembers\.filter\(m => assignedIds\.has\(m\.id\) \|\| visitorFnfIds\.has\(m\.id\)\);\n        \}\n      \}\n    \}\n\n    const res = await generatePrayerSchedule\(prayerWeek, targetMembers\);/,
  handleGenerateCode
);

fs.writeFileSync(outreachPath, outreachContent);
