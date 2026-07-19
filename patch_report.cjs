const fs = require('fs');

let content = fs.readFileSync('components/ReportExport.tsx', 'utf-8');

const regex = /let allowedChurches = \[\.\.\.availableChurches\];[\s\S]*?function renderSingleChurch\(churchId: string\) \{/m;

const replacement = `      let allowedBranches: { id?: string; name: string; churches: string[] }[] = [];

      if (currentUser.role === "ZONAL_HEAD" && currentUser.zoneId) {
        const zone = data.settings.organization?.zones?.find(
          (z) => z.id === currentUser.zoneId || z.name === currentUser.zoneId
        );
        if (zone && zone.branches) {
          allowedBranches = zone.branches.map(b => ({ id: b.id, name: b.name, churches: b.churches || [] }));
        }
      } else if (currentUser.role === "BRANCH_COORDINATOR" && currentUser.branchId) {
        const branch = data.settings.organization?.zones?.flatMap(z => z.branches || [])?.find(
          (b) => b.id === currentUser.branchId || b.name === currentUser.branchId
        );
        if (branch) {
          allowedBranches = [{ id: branch.id, name: branch.name, churches: branch.churches || [] }];
        }
      } else {
        // ADMIN / SUPER_ADMIN or others
        const allBranches = data.settings.organization?.zones?.flatMap(z => z.branches || []) || [];
        if (allBranches.length > 0) {
           allowedBranches = allBranches.map(b => ({ id: b.id, name: b.name, churches: b.churches || [] }));
        } else {
           allowedBranches = [{ name: "Main", churches: availableChurches }];
        }
      }

      let grandTotal = 0;
      let grandTotalJoy = 0;
      let grandTotalEnlargement = 0;
      let grandTotalSpecial = 0;
      let grandTotalTeachers = 0;

      allowedBranches.forEach((branch) => {
        let branchHasData = false;
        let branchReport = \`*BRANCH: \${branch.name.toUpperCase()}*\\n\`;
        
        branch.churches.forEach((church) => {
          const record = data.attendance.find(
            (r) => r.date === selectedDate && r.churchId === church && (r.branchId === branch.id || r.branchId === branch.name || (!r.branchId && allowedBranches.length === 1))
          );
          if (!record) return;

          const presentMembers = data.members.filter((m) =>
            record.presentMemberIds.includes(m.id),
          );

          const staff = presentMembers.filter(
            (m) =>
              ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
              m.type === "TEACHER",
          );
          const children = presentMembers.filter(
            (m) =>
              !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
              m.type !== "TEACHER",
          );

          const getService = (id: string) => record?.serviceMap?.[id] || "JOY";
          const joyCount = children.filter(m => getService(m.id) === "JOY").length;
          const enlargementCount = children.filter(m => getService(m.id) === "ENLARGEMENT").length;
          const specialCount = children.filter(m => getService(m.id) === "SPECIAL").length;

          const teachersCount = staff.length;
          const membersCount = children.length;
          const classTotal = membersCount + teachersCount;

          if (classTotal > 0) {
            branchHasData = true;
            branchReport += \`*\${church} Church*\n\`;
            if (joyCount > 0) branchReport += \`Joy Service : \${joyCount}\\n\`;
            if (enlargementCount > 0) branchReport += \`Enlargement Service : \${enlargementCount}\\n\`;
            if (specialCount > 0) branchReport += \`\${eventName || "Special Service"} : \${specialCount}\\n\`;
            if (teachersCount > 0) branchReport += \`Teachers : \${teachersCount}\\n\`;
            branchReport += \`Total : \${classTotal}\\n\\n\`;

            grandTotal += classTotal;
            grandTotalJoy += joyCount;
            grandTotalEnlargement += enlargementCount;
            grandTotalSpecial += specialCount;
            grandTotalTeachers += teachersCount;
          }
        });
        
        if (branchHasData) {
           report += branchReport;
        }
      });

      report += \`----------------------------\\n\`;
      report += \`*OVERALL TOTALS*\\n\`;
      if (grandTotalJoy > 0) report += \`Joy Service : \${grandTotalJoy}\\n\`;
      if (grandTotalEnlargement > 0) report += \`Enlargement Service : \${grandTotalEnlargement}\\n\`;
      if (grandTotalSpecial > 0) report += \`\${eventName || "Special Service"} : \${grandTotalSpecial}\\n\`;
      if (grandTotalTeachers > 0) report += \`Teachers : \${grandTotalTeachers}\\n\`;
      report += \`*GRAND TOTAL: \${grandTotal}*\\n\`;

      if (grandTotal === 0) {
        report += \`\\n_No attendance data recorded yet for this date._\`;
      } else {
        report += \`\\n============================\\n\\n\`;
        report += \`*DETAILED BREAKDOWN*\\n\\n\`;

        allowedBranches.forEach((branch) => {
          let branchDetailHasData = false;
          let branchDetailReport = \`*\\u25A0 \${branch.name.toUpperCase()} BRANCH*\\n\\n\`;
          
          branch.churches.forEach((church) => {
            const churchReport = renderSingleChurch(church, branch);
            if (churchReport) {
               branchDetailHasData = true;
               branchDetailReport += churchReport + \`\\n----------------------------\\n\\n\`;
            }
          });
          
          if (branchDetailHasData) {
             report += branchDetailReport;
          }
        });
      }

      return report;
    }

    // --- Helper for Single Branch Report (Names included with Service Split) ---
    function renderSingleChurch(churchId: string, branchObj?: { id?: string, name: string }) {`;

content = content.replace(regex, replacement);

fs.writeFileSync('components/ReportExport.tsx', content);
