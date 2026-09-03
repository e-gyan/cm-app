const fs = require('fs');
let code = fs.readFileSync('components/AnalyticsHub.tsx', 'utf8');

const hookBlock = `
  const branchGrowthData = useMemo(() => {
    if (!hasManagementView) return [];
    
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mObj = {
        label: d.toLocaleString('default', { month: 'short' }) + " " + d.getFullYear().toString().substring(2),
        month: d.getMonth(),
        year: d.getFullYear(),
      };
      availableChurches.forEach(c => mObj[c] = 0);
      months.push(mObj);
    }

    data.attendance.forEach((r) => {
      const d = new Date(r.date);
      const recordMonth = d.getMonth();
      const recordYear = d.getFullYear();
      
      const monthObj = months.find(m => m.month === recordMonth && m.year === recordYear);
      if (monthObj && availableChurches.includes(r.churchId)) {
        monthObj[r.churchId] += r.presentMemberIds.length;
      }
    });

    return months;
  }, [data.attendance, hasManagementView, availableChurches]);

  // --- AI GENERATION ---`;

code = code.replace('  // --- AI GENERATION ---', hookBlock);

const renderBlock = `
        {hasManagementView && branchGrowthData.length > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col overflow-hidden">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                Branch Growth Comparison (Last 12 Months)
              </h3>
              <div className="text-xs text-slate-400">
                Cross-tabulation of attendance
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={branchGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUJ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLJ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorK" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorN" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  />
                  {availableChurches.includes("UJ") && <Area type="monotone" dataKey="UJ" stroke="#6366f1" fillOpacity={1} fill="url(#colorUJ)" strokeWidth={2} />}
                  {availableChurches.includes("LJ") && <Area type="monotone" dataKey="LJ" stroke="#ec4899" fillOpacity={1} fill="url(#colorLJ)" strokeWidth={2} />}
                  {availableChurches.includes("K") && <Area type="monotone" dataKey="K" stroke="#f59e0b" fillOpacity={1} fill="url(#colorK)" strokeWidth={2} />}
                  {availableChurches.includes("I") && <Area type="monotone" dataKey="I" stroke="#10b981" fillOpacity={1} fill="url(#colorI)" strokeWidth={2} />}
                  {availableChurches.includes("N") && <Area type="monotone" dataKey="N" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorN)" strokeWidth={2} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {hasManagementView && managementOverview && (`;

code = code.replace('        {hasManagementView && managementOverview && (', renderBlock);

fs.writeFileSync('components/AnalyticsHub.tsx', code);
