const fs = require('fs');
const reportFile = './components/ReportExport.tsx';
let content = fs.readFileSync(reportFile, 'utf8');

const detailedExportFunction = `
  const [copiedDetailedAnnual, setCopiedDetailedAnnual] = React.useState(false);

  const handleCopyDetailedAnnual = () => {
    let result = \`*\${year} DETAILED ATTENDANCE RECORD*\\n\\n\`;
    
    const recordsForYear = data.attendance.filter((r: any) => r.date.startsWith(String(year)));
    const uniqueDates = Array.from(new Set(recordsForYear.map((r: any) => r.date))).sort();

    if (uniqueDates.length === 0) {
      result += \`No attendance records found for \${year}.\`;
    } else {
      const availableChurches = ["UJ", "LJ", "K", "I", "N"];
      const churchesToCheck = activeChurch === "CM" ? availableChurches : [activeChurch];

      uniqueDates.forEach(dateStr => {
        const displayDate = new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" });
        
        let dateHasRecords = false;
        let dateContent = \`============================\\n\`;
        dateContent += \`*\${displayDate.toUpperCase()}*\\n\`;
        dateContent += \`============================\\n\\n\`;

        churchesToCheck.forEach((church: any) => {
          const churchRecords = recordsForYear.filter((r: any) => r.date === dateStr && r.churchId === church);
          const churchName = CHURCH_NAMES[church] || church;

          churchRecords.forEach((rec: any) => {
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
          });
        });
        
        if (dateHasRecords) {
           result += dateContent;
        }
      });
    }

    navigator.clipboard.writeText(result.trim());
    setCopiedDetailedAnnual(true);
    setTimeout(() => setCopiedDetailedAnnual(false), 2000);
  };
`;

const replace1 = `const [copiedAnnual, setCopiedAnnual] = React.useState(false);`;
content = content.replace(replace1, replace1 + '\n' + detailedExportFunction);

const buttonsHtml = `
        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
          <button
            onClick={handleCopyAnnual}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedAnnual ? <CheckCircle size={18} /> : <Copy size={18} />}
            {copiedAnnual ? "Copied" : "Summary"}
          </button>
          <button
            onClick={handleCopyDetailedAnnual}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedDetailedAnnual ? <CheckCircle size={18} /> : <FileText size={18} />}
            {copiedDetailedAnnual ? "Copied Detailed" : "Detailed Export"}
          </button>
        </div>
`;

const replace2 = `<div className="p-4 bg-white border-t border-slate-100">
          <button
            onClick={handleCopyAnnual}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedAnnual ? <CheckCircle size={18} /> : <Copy size={18} />}
            {copiedAnnual ? "Copied" : "Copy Annual Record"}
          </button>
        </div>`;

content = content.replace(replace2, buttonsHtml);

// Need to make sure FileText is imported from lucide-react if not already.
if (!content.includes('FileText')) {
    content = content.replace('MessageCircle,', 'MessageCircle, FileText,');
}

fs.writeFileSync(reportFile, content);
