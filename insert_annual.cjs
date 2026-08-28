const fs = require('fs');
const reportFile = './components/ReportExport.tsx';
let reportContent = fs.readFileSync(reportFile, 'utf8');

if (!reportContent.includes('function AnnualViewTab')) {
    const annualViewComponent = `
function AnnualViewTab({ selectedDate, data, activeChurch, CHURCH_NAMES }: any) {
  const year = new Date(selectedDate || new Date()).getFullYear();
  const [annualContent, setAnnualContent] = React.useState("");
  const [copiedAnnual, setCopiedAnnual] = React.useState(false);

  React.useEffect(() => {
    let result = \`*\${year} ATTENDANCE RECORD*\\n\\n\`;
    
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const sundays = [];
    
    let d = new Date(startDate);
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() + 1);
    }
    
    while (d <= endDate) {
      sundays.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
    
    const availableChurches = ["UJ", "LJ", "K", "I", "N"];
    const churchesToCheck = activeChurch === "CM" ? availableChurches : [activeChurch];

    sundays.forEach((sunday: any) => {
      const y = sunday.getFullYear();
      const m = String(sunday.getMonth() + 1).padStart(2, '0');
      const dStr = String(sunday.getDate()).padStart(2, '0');
      const dateStr = \`\${y}-\${m}-\${dStr}\`;
      
      const displayDate = sunday.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" });
      
      let hasAnyRecord = false;
      let dayReport = \`*\${displayDate}*\\n\`;
      
      churchesToCheck.forEach((church: any) => {
        const rec = data.attendance.find((r: any) => r.date === dateStr && r.churchId === church);
        const churchName = CHURCH_NAMES[church] || church;
        if (rec) {
          dayReport += \`\${churchName}: ✅ Record exists (\${rec.presentMemberIds.length} present)\\n\`;
          hasAnyRecord = true;
        } else {
          dayReport += \`\${churchName}: ❌ No Record\\n\`;
        }
      });
      
      if (hasAnyRecord || churchesToCheck.length === 1) {
          result += dayReport + \`\\n\`;
      } else {
          result += \`*\${displayDate}*\\n❌ No CM Records\\n\\n\`;
      }
    });
    
    setAnnualContent(result.trim());
  }, [year, data.attendance, activeChurch, CHURCH_NAMES]);

  const handleCopyAnnual = () => {
    navigator.clipboard.writeText(annualContent);
    setCopiedAnnual(true);
    setTimeout(() => setCopiedAnnual(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 text-sm">{year} Annual Record Tracking</h3>
        </div>
        <div className="flex-1 p-4 bg-slate-50/50 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
            {annualContent}
          </pre>
        </div>
        <div className="p-4 bg-white border-t border-slate-100">
          <button
            onClick={handleCopyAnnual}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedAnnual ? <CheckCircle size={18} /> : <Copy size={18} />}
            {copiedAnnual ? "Copied" : "Copy Annual Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
    // Insert it before export default ReportExport;
    const exportIndex = reportContent.indexOf("export default ReportExport;");
    if (exportIndex !== -1) {
        reportContent = reportContent.slice(0, exportIndex) + annualViewComponent + '\n' + reportContent.slice(exportIndex);
        fs.writeFileSync(reportFile, reportContent);
    }
}
