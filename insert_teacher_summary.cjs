const fs = require('fs');
let content = fs.readFileSync('components/Dashboard.tsx', 'utf8');

const teacherSummaryCode = `  const isTeacherUser = currentUser.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(currentUser.type) || (currentUser.role && currentUser.role !== "NONE");
  
  const teacherSummary = useMemo(() => {
    let completedPrayers = 0;
    let completedVisits = 0;
    let divisionTarget = 0;
    
    if (isTeacherUser) {
      const divisions = calculateChurchDivisions(data.members, [activeChurch]);
      const myDiv = divisions[activeChurch];
      if (myDiv) {
        const myAssignment = myDiv.assignments.find(a => a.teacher.id === currentUser.id);
        if (myAssignment) {
          divisionTarget = myAssignment.members.length;
          const assignedIds = new Set(myAssignment.members.map(m => m.id));
          const todayStr = new Date().toISOString().split("T")[0];
          
          completedPrayers = (data.prayerSchedule || []).filter(s => 
            s.isCompleted && 
            s.date === todayStr && 
            s.assignedMemberIds?.some(id => assignedIds.has(id))
          ).length;

          completedVisits = (data.outreachSessions || []).filter(s => 
            s.status === "COMPLETED" && 
            (s.sessionType === "VISIT" || !s.sessionType) && 
            s.date === todayStr && 
            s.assignedMemberIds?.some(id => assignedIds.has(id))
          ).length;
        }
      }
    }
    return { completedPrayers, completedVisits, divisionTarget };
  }, [data.members, data.prayerSchedule, data.outreachSessions, activeChurch, currentUser, isTeacherUser]);

`;

// Find where to insert in ChurchDashboard
content = content.replace(
  'const stats = useMemo(() => {',
  teacherSummaryCode + '  const stats = useMemo(() => {'
);

const renderSummaryCode = `
      {isTeacherUser && teacherSummary.divisionTarget > 0 && (
        <motion.div variants={itemVariants} className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-50">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Today's Prayers</h3>
                <p className="text-3xl font-black text-slate-800 mt-1">{teacherSummary.completedPrayers} <span className="text-lg text-slate-400 font-bold">/ {teacherSummary.divisionTarget}</span></p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center">
                <Heart size={24} strokeWidth={2.5} />
              </div>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                style={{ width: \`\${Math.min(100, (teacherSummary.completedPrayers / teacherSummary.divisionTarget) * 100)}%\` }}
              />
            </div>
            <p className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-1">
              <Target size={12} /> Division Target: {teacherSummary.divisionTarget} Members
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-50">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Today's Visits</h3>
                <p className="text-3xl font-black text-slate-800 mt-1">{teacherSummary.completedVisits} <span className="text-lg text-slate-400 font-bold">/ {teacherSummary.divisionTarget}</span></p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                <MapPin size={24} strokeWidth={2.5} />
              </div>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: \`\${Math.min(100, (teacherSummary.completedVisits / teacherSummary.divisionTarget) * 100)}%\` }}
              />
            </div>
            <p className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-1">
              <Target size={12} /> Division Target: {teacherSummary.divisionTarget} Members
            </p>
          </div>
        </motion.div>
      )}
`;

content = content.replace(
  '<motion.div variants={containerVariants}',
  renderSummaryCode + '\n      <motion.div variants={containerVariants}'
);

fs.writeFileSync('components/Dashboard.tsx', content);
