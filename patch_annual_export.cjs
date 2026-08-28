const fs = require('fs');
const file = './components/ReportExport.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `          churchRecords.forEach((rec: any) => {
             const presentMembers = data.members.filter((m: any) => rec.presentMemberIds.includes(m.id));
             presentMembers.sort((a: any, b: any) => a.name.localeCompare(b.name));
             if (presentMembers.length > 0) {
                dateHasRecords = true;
                dateContent += \`*\${churchName} CHURCH (\${presentMembers.length} present)*\\n\`;
                presentMembers.forEach((m: any, idx: number) => {
                   dateContent += \`\${idx + 1}. \${m.name}\\n\`;
                });
                dateContent += \`\\n\`;
             }
          });`;

const newLogic = `          churchRecords.forEach((rec: any) => {
             const presentMembers = data.members.filter((m: any) => rec.presentMemberIds.includes(m.id));
             presentMembers.sort((a: any, b: any) => a.name.localeCompare(b.name));
             if (presentMembers.length > 0) {
                dateHasRecords = true;
                
                const teachers = presentMembers.filter(
                  (m: any) =>
                    ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
                    m.type === "Teacher"
                );
                const allChildren = presentMembers.filter(
                  (m: any) =>
                    !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
                    m.type !== "Teacher"
                );

                const getService = (id: string) => rec.serviceMap?.[id] || "JOY";
                const totalJoy = allChildren.filter((m: any) => getService(m.id) === "JOY").length;
                const totalEnlargement = allChildren.filter((m: any) => getService(m.id) === "ENLARGEMENT").length;
                const totalSpecial = allChildren.filter((m: any) => getService(m.id) === "SPECIAL").length;
                
                const teachersCount = teachers.length;
                const totalCount = allChildren.length + teachersCount;
                
                const eventNameToUse = rec.eventName || "";
                
                let report = \`*\${churchName} CHURCH ATTENDANCE REPORT*\\n\`;
                if (eventNameToUse) report += \`*\${eventNameToUse}*\\n\`;
                report += \`------------------\\n\`;
                report += \`*TOTAL PRESENT: \${totalCount}*\\n\`;

                const splits = [];
                if (eventNameToUse === "Joint Service") {
                    const totalChildren = totalJoy + totalEnlargement + totalSpecial;
                    if (totalChildren > 0) splits.push(\`Joint Service: \${totalChildren}\`);
                } else {
                    if (totalJoy > 0) splits.push(\`Joy Service: \${totalJoy}\`);
                    if (totalEnlargement > 0) splits.push(\`Enlargement Service: \${totalEnlargement}\`);
                    if (totalSpecial > 0) splits.push(\`\${eventNameToUse || "Special"}: \${totalSpecial}\`);
                }
                
                if (teachersCount > 0) splits.push(\`Teachers: \${teachersCount}\`);
                
                if (splits.length > 0) {
                  report += \`(\${splits.join(" | ")})\\n\\n\`;
                } else {
                  report += \`\\n\`;
                }

                const renderList = (membersList: any[], title: string) => {
                  let out = \`*\${title} (\${membersList.length})*\\n\`;
                  membersList.forEach((m: any, idx: number) => {
                    out += \`\${idx + 1}. \${m.name}\\n\`;
                  });
                  return out + \`\\n\`;
                };

                const members = allChildren.filter((m: any) => m.type === "Member");
                const fnfs = allChildren.filter((m: any) => m.type === "FNF");
                const visitors = allChildren.filter((m: any) => m.type === "Visitor");
                const notMembers = allChildren.filter((m: any) => m.type === "Not Member");

                if (members.length > 0) report += renderList(members, "MEMBERS");
                else report += \`*MEMBERS (0)*\\n_None_\\n\\n\`;

                if (fnfs.length > 0) report += renderList(fnfs, "FNF");
                if (visitors.length > 0) report += renderList(visitors, "VISITORS");
                if (notMembers.length > 0) report += renderList(notMembers, "NOT A MEMBER");

                if (teachers.length > 0) {
                  report += \`*TEACHERS (\${teachers.length})*\\n\`;
                  teachers.forEach((m: any, i: number) => (report += \`\${i + 1}. \${m.name}\\n\`));
                  report += \`\\n\`;
                }

                dateContent += report + \`\\n\`;
             }
          });`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content);
