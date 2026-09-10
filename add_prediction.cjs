const fs = require('fs');
let content = fs.readFileSync('components/AnalyticsHub.tsx', 'utf8');

const predictionCode = `  const predictionModel = useMemo(() => {
    const today = new Date();
    const sortedDates = [...new Set(data.attendance.map(a => a.date))]
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .filter(d => new Date(d) <= today);
    
    const recent4Dates = sortedDates.slice(0, 4);
    if (recent4Dates.length === 0) return null;

    const relevantAttendance = data.attendance.filter(a => 
      effectiveChurch === "All" ? true : a.churchId === effectiveChurch
    );

    const dateStats = recent4Dates.map(dateStr => {
      const records = relevantAttendance.filter(a => a.date === dateStr);
      let membersCount = 0;
      let fnfCount = 0;
      let visitorsCount = 0;
      let teachersCount = 0;

      records.forEach(r => {
        r.presentMemberIds.forEach(id => {
          const m = data.members.find(mem => mem.id === id);
          if (m) {
            const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
            if (isTeacher) teachersCount++;
            else if (m.type === MemberType.FNF) fnfCount++;
            else if (m.type === MemberType.VISITOR) visitorsCount++;
            else membersCount++;
          }
        });
      });

      return {
        dateStr,
        membersCount,
        fnfCount,
        visitorsCount,
        teachersCount,
        total: membersCount + fnfCount + visitorsCount + teachersCount
      };
    });

    const latest2 = dateStats.slice(0, 2);
    const latest4 = dateStats;

    const avg2W = {
      members: Math.round(latest2.reduce((acc, s) => acc + s.membersCount, 0) / (latest2.length || 1)),
      fnf: Math.round(latest2.reduce((acc, s) => acc + s.fnfCount, 0) / (latest2.length || 1)),
      visitors: Math.round(latest2.reduce((acc, s) => acc + s.visitorsCount, 0) / (latest2.length || 1)),
      teachers: Math.round(latest2.reduce((acc, s) => acc + s.teachersCount, 0) / (latest2.length || 1)),
    };

    const avg1M = {
      members: Math.round(latest4.reduce((acc, s) => acc + s.membersCount, 0) / (latest4.length || 1)),
      fnf: Math.round(latest4.reduce((acc, s) => acc + s.fnfCount, 0) / (latest4.length || 1)),
      visitors: Math.round(latest4.reduce((acc, s) => acc + s.visitorsCount, 0) / (latest4.length || 1)),
      teachers: Math.round(latest4.reduce((acc, s) => acc + s.teachersCount, 0) / (latest4.length || 1)),
    };

    const predict = {
      members: Math.round(avg2W.members * 0.6 + avg1M.members * 0.4),
      fnf: Math.round(avg2W.fnf * 0.6 + avg1M.fnf * 0.4),
      visitors: Math.round(avg2W.visitors * 0.6 + avg1M.visitors * 0.4),
      teachers: Math.round(avg2W.teachers * 0.6 + avg1M.teachers * 0.4),
    };
    predict.total = predict.members + predict.fnf + predict.visitors + predict.teachers;

    const trend = predict.total >= (dateStats[0]?.total || 0) ? "UP" : "DOWN";
    const growthRate = dateStats[0]?.total ? ((predict.total - dateStats[0].total) / dateStats[0].total) * 100 : 0;

    return {
      avg2W,
      avg1M,
      predict,
      trend,
      growthRate,
      baseCount: dateStats.length
    };
  }, [data.attendance, data.members, effectiveChurch]);
`;

content = content.replace(
  '  return (\n    <div className="space-y-6 pb-20',
  predictionCode + '\n  return (\n    <div className="space-y-6 pb-20'
);

const predictionUI = `      {/* PREDICTION WIDGET */}
      {predictionModel && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles size={160} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
            <div className="max-w-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-300" /> AI Forecast
                </div>
                <span className="text-xs font-medium text-indigo-200">Next Sunday Projection</span>
              </div>
              <h3 className="text-3xl font-extrabold mb-2">
                Expected: {predictionModel.predict.total} Attendees
              </h3>
              <p className="text-sm text-indigo-200 leading-relaxed">
                Based on a weighted blend of your last 2 weeks and 1 month data, 
                we project a <strong className={predictionModel.trend === "UP" ? "text-emerald-400" : "text-rose-400"}>{Math.abs(predictionModel.growthRate).toFixed(1)}% {predictionModel.trend === "UP" ? "increase" : "decrease"}</strong> compared to your most recent gathering.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-1">Members</div>
                <div className="text-2xl font-bold">{predictionModel.predict.members}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-1">FNF</div>
                <div className="text-2xl font-bold">{predictionModel.predict.fnf}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-1">Visitors</div>
                <div className="text-2xl font-bold">{predictionModel.predict.visitors}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mb-1">Teachers</div>
                <div className="text-2xl font-bold text-emerald-300">{predictionModel.predict.teachers}</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
`;

content = content.replace(
  '      {/* SECTION A: ATTENDANCE INTELLIGENCE */}',
  predictionUI + '\n      {/* SECTION A: ATTENDANCE INTELLIGENCE */}'
);

fs.writeFileSync('components/AnalyticsHub.tsx', content);
