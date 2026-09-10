const fs = require('fs');
let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

const replacement = `      if (!hasSlots) {
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

        if (targetMembers.length > 0) {`;

content = content.replace(
  /      if \(\!hasSlots\) \{\n        const targetMembers = data\.members\.filter\(\n          \(m\) =>\n            isMemberInActiveChurch\(m\) &&\n            \!\["Teacher", "Helper", "Volunteer"\]\.includes\(m\.type\),\n        \);\n        if \(targetMembers\.length > 0\) \{/g,
  replacement
);

fs.writeFileSync('components/OutreachHub.tsx', content);
