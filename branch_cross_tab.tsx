import { Activity } from "lucide-react";
const BranchCrossTabulation = ({ attendance }: { attendance: any[] }) => {
  // We want last 12 months data
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  
  // Initialize data structure
  const months: string[] = [];
  const branches = ["UJ", "LJ", "K", "I", "N"];
  const matrix: Record<string, Record<string, number>> = {}; // month -> branch -> avg attendance

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const mStr = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    months.push(mStr);
    matrix[mStr] = {};
    branches.forEach(b => matrix[mStr][b] = 0);
  }

  // Aggregate attendance
  const monthlyCounts: Record<string, Record<string, { total: number; sessions: number }>> = {};
  
  months.forEach(m => {
    monthlyCounts[m] = {};
    branches.forEach(b => {
      monthlyCounts[m][b] = { total: 0, sessions: 0 };
    });
  });

  attendance.forEach(record => {
    const d = new Date(record.date);
    if (d >= twelveMonthsAgo) {
      const mStr = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (monthlyCounts[mStr] && branches.includes(record.churchId)) {
         monthlyCounts[mStr][record.churchId].total += (record.presentMemberIds?.length || 0);
         monthlyCounts[mStr][record.churchId].sessions += 1;
      }
    }
  });

  months.forEach(m => {
    branches.forEach(b => {
      const { total, sessions } = monthlyCounts[m][b];
      matrix[m][b] = sessions > 0 ? Math.round(total / sessions) : 0;
    });
  });

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mt-6 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Activity size={20} />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">Branch Performance Matrix</h3>
          <p className="text-xs text-slate-500 font-medium">Average weekly attendance per month (Last 12 Months)</p>
        </div>
      </div>
      
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-3 border-b-2 border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 rounded-tl-xl">Month</th>
              {branches.map(b => (
                <th key={b} className="p-3 border-b-2 border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 text-center">{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={m} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 border-b border-slate-100 text-sm font-bold text-slate-700 whitespace-nowrap">{m}</td>
                {branches.map(b => {
                  const val = matrix[m][b];
                  // Simple heat logic: compare to other branches in same month
                  const maxInMonth = Math.max(...branches.map(br => matrix[m][br]));
                  const intensity = maxInMonth > 0 ? (val / maxInMonth) : 0;
                  
                  return (
                    <td key={b} className="p-3 border-b border-slate-100 text-center">
                      <div 
                        className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${val > 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-300'}`}
                        style={{ 
                          backgroundColor: val > 0 ? `rgba(79, 70, 229, ${0.05 + (intensity * 0.2)})` : undefined,
                          color: val > 0 ? `rgba(67, 56, 202, ${0.6 + (intensity * 0.4)})` : undefined
                        }}
                      >
                        {val > 0 ? val : '-'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
