const fs = require('fs');

let file = fs.readFileSync('components/ReportExport.tsx', 'utf8');
// Look for handleExportAnnual
file = file.replace(/const handleExportAnnual = \(\) => {[\s\S]*?};/g, `
  const handleExportAnnual = () => {
    let report = \`ANNUAL ATTENDANCE EXPORT - \${selectedYear}\\n\`;
    report += \`========================================\\n\\n\`;

    const recordsForYear = data.attendance.filter((r) => r.date.startsWith(selectedYear));
    
    if (recordsForYear.length === 0) {
      report += \`No records found for \${selectedYear}.\`;
    } else {
      // Group by date
      const groupedByDate: Record<string, AttendanceRecord[]> = {};
      recordsForYear.forEach(r => {
        if (!groupedByDate[r.date]) groupedByDate[r.date] = [];
        groupedByDate[r.date].push(r);
      });
      
      const dates = Object.keys(groupedByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      
      dates.forEach(date => {
        const parsedDate = new Date(date);
        const formattedDate = parsedDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        
        report += \`=== \${formattedDate} ===\\n\\n\`;
        
        const dateRecords = groupedByDate[date];
        
        // Group by church
        const groupedByChurch: Record<string, AttendanceRecord[]> = {};
        dateRecords.forEach(r => {
          if (!groupedByChurch[r.churchId]) groupedByChurch[r.churchId] = [];
          groupedByChurch[r.churchId].push(r);
        });
        
        Object.keys(groupedByChurch).forEach(churchId => {
           report += \`CHURCH: \${churchId}\\n------------------\\n\`;
           const churchRecords = groupedByChurch[churchId];
           
           churchRecords.forEach(record => {
              const presentMembers = data.members.filter(m => record.presentMemberIds.includes(m.id));
              presentMembers.sort((a, b) => a.name.localeCompare(b.name));
              
              const teachers = presentMembers.filter(
                (m) =>
                  ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
                  m.type === MemberType.TEACHER,
              );
              const allChildren = presentMembers.filter(
                (m) =>
                  !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
                  m.type !== MemberType.TEACHER,
              );
              
              const membersList = allChildren.filter(m => m.type === MemberType.MEMBER);
              const fnfList = allChildren.filter(m => m.type === MemberType.FNF);
              const visitorsList = allChildren.filter(m => m.type === MemberType.VISITOR);
              const notMembersList = allChildren.filter(m => m.type === MemberType.NOT_MEMBER);
              
              const renderList = (mList: Member[], title: string) => {
                let out = \`*\${title} (\${mList.length})*\\n\`;
                mList.forEach((m, idx) => {
                  const s = record.serviceMap?.[m.id] || "JOY";
                  out += \`\${idx + 1}. \${m.name} (\${s})\\n\`;
                });
                return out + '\\n';
              };
              
              if (membersList.length > 0) report += renderList(membersList, "MEMBERS");
              if (fnfList.length > 0) report += renderList(fnfList, "FNF");
              if (visitorsList.length > 0) report += renderList(visitorsList, "VISITORS");
              if (notMembersList.length > 0) report += renderList(notMembersList, "NOT A MEMBER");
              if (teachers.length > 0) report += renderList(teachers, "TEACHERS");
              
              report += \`\\n\`;
           });
        });
        report += \`\\n============================\\n\\n\`;
      });
    }

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = \`Annual_Report_\${selectedYear}.txt\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
`);

fs.writeFileSync('components/ReportExport.tsx', file);
