import React, { useMemo, useState } from 'react';
import { AppData, MemberType, MemberStatus, Church, Member } from '../types';
import { updateTargets } from '../services/storageService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Users, TrendingUp, TrendingDown, Calendar, Trophy, Clock, ArrowUpRight, ArrowDownRight, Activity, Target, X, Save, Percent } from 'lucide-react';

interface DashboardProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string; trend?: number; subtitle?: string; target?: number; progressValue?: number }> = ({ title, value, icon, colorClass, trend, subtitle, target, progressValue }) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-full hover:shadow-md transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
        <div className={`p-3.5 rounded-2xl ${colorClass} text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
            {icon}
        </div>
        {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{Math.abs(trend)}%</span>
            </div>
        )}
    </div>
    <div>
      <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{value} {target ? <span className="text-sm font-medium text-slate-400">/ {target}</span> : ''}</h3>
      <p className="text-sm text-slate-500 font-medium mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</p>}
      
      {target && typeof progressValue === 'number' && (
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${colorClass.replace('text-white', '')}`} style={{ width: `${Math.min(100, (progressValue / target) * 100)}%` }}></div>
          </div>
      )}
    </div>
  </div>
);

const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
          <p className="text-slate-500 text-xs font-bold mb-2 uppercase tracking-wider">{label}</p>
          <div className="flex items-center gap-3">
              <div className="flex flex-col">
                   <span className="text-2xl font-extrabold text-indigo-600 leading-none">{data.count}</span>
                   <span className="text-[10px] font-bold text-slate-400">Attendees</span>
              </div>
              {data.growth !== 0 && (
                  <div className={`flex flex-col items-end pl-3 border-l border-slate-100 ${data.growth > 0 ? 'text-green-600' : 'text-rose-500'}`}>
                      <div className="flex items-center gap-0.5">
                          {data.growth > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          <span className="text-sm font-bold">{Math.abs(data.growth)}%</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">vs prev</span>
                  </div>
              )}
          </div>
        </div>
      );
    }
    return null;
};

// --- ADMIN DASHBOARD ---
const AdminDashboard: React.FC<{ data: AppData; onUpdateTargets?: () => void }> = ({ data, onUpdateTargets }) => {
    const churches: Church[] = ['UJ', 'I', 'K', 'LJ'];
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    
    // Local state for target editing
    const [editTargets, setEditTargets] = useState<Record<string, number>>(data.targets || { UJ: 0, I: 0, K: 0, LJ: 0 });

    const handleSaveTargets = () => {
        updateTargets(editTargets);
        setIsTargetModalOpen(false);
        if (onUpdateTargets) onUpdateTargets();
    };

    const churchStats = useMemo(() => {
        return churches.map(church => {
            // New "Membership Goal" Logic: Active Members + FNF
            const population = data.members.filter(m => 
                m.assignedChurch === church && 
                m.status === MemberStatus.ACTIVE && 
                (m.type === MemberType.MEMBER || m.type === MemberType.FNF)
            ).length;

            const attendance = data.attendance.filter(r => r.churchId === church);
            const sortedAttendance = [...attendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // Average (Last 5 weeks)
            const totalAtt = attendance.reduce((sum, r) => {
                 return sum + r.presentMemberIds.filter(id => {
                     const m = data.members.find(mem => mem.id === id);
                     return m && !['Teacher','Helper','Volunteer'].includes(m.type);
                 }).length;
            }, 0);
            
            const avg = attendance.length ? Math.round(totalAtt / attendance.length) : 0;
            const retention = population ? Math.round((avg / population) * 100) : 0;
            
            let lastAttendance = 0;
            let growth = 0;
            if (sortedAttendance.length > 0) {
                const lastRec = sortedAttendance[sortedAttendance.length - 1];
                lastAttendance = lastRec.presentMemberIds.filter(id => {
                    const m = data.members.find(mem => mem.id === id);
                    return m && !['Teacher','Helper','Volunteer'].includes(m.type);
                }).length;
                
                if (sortedAttendance.length >= 2) {
                    const prevRec = sortedAttendance[sortedAttendance.length - 2];
                    const prevAtt = prevRec.presentMemberIds.filter(id => {
                        const m = data.members.find(mem => mem.id === id);
                        return m && !['Teacher','Helper','Volunteer'].includes(m.type);
                    }).length;
                    growth = prevAtt === 0 ? (lastAttendance > 0 ? 100 : 0) : Math.round(((lastAttendance - prevAtt) / prevAtt) * 100);
                }
            }

            const target = data.targets?.[church] || 0;
            // Target Achievement is now Population vs Target
            const targetAchievement = target > 0 ? Math.round((population / target) * 100) : 0;

            return { church, population, avg, retention, lastAttendance, growth, target, targetAchievement };
        });
    }, [data]);

    const totalPop = churchStats.reduce((acc, curr) => acc + curr.population, 0);
    const totalAvg = churchStats.reduce((acc, curr) => acc + curr.avg, 0);
    const totalTarget = churchStats.reduce((acc, curr) => acc + curr.target, 0);
    
    // Global Retention Rate (Avg Attendance / Total Population)
    const globalRetention = totalPop > 0 ? Math.round((totalAvg / totalPop) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 lg:col-span-1 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500"></div>
                    <Users className="mb-4 text-indigo-200" size={32} />
                    <h2 className="text-5xl font-extrabold mb-2 tracking-tight">{totalPop}</h2>
                    <p className="text-indigo-100 font-medium text-lg">Total Membership</p>
                    <p className="text-indigo-200 text-sm mt-1 opacity-80">Active & FNF</p>
                </div>
                
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-3 flex flex-col justify-center relative">
                    <button 
                        onClick={() => { setEditTargets(data.targets || { UJ: 0, I: 0, K: 0, LJ: 0 }); setIsTargetModalOpen(true); }}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Set Annual Targets"
                    >
                        <Target size={20} />
                    </button>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                             <h3 className="text-lg font-bold text-slate-800">Ministry Overview</h3>
                             <p className="text-slate-500 text-sm">Combined metrics ({new Date().getFullYear()})</p>
                        </div>
                        <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold mr-10 md:mr-0">Live Data</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                         <div className="px-4">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Avg Attendance</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-slate-800">{totalAvg}</h2>
                                <span className="text-sm text-slate-400 font-medium">/ week</span>
                            </div>
                         </div>
                         <div className="px-4 pt-4 md:pt-0">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Retention Rate</p>
                             <div className="flex items-baseline gap-2">
                                <h2 className={`text-4xl font-bold ${globalRetention >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{globalRetention}%</h2>
                             </div>
                             <p className="text-xs text-slate-400 mt-1">Avg vs Total Active</p>
                         </div>
                         <div className="px-4 pt-4 md:pt-0">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Membership Goal</p>
                            <div className="flex items-center gap-3">
                                <h2 className="text-4xl font-bold text-slate-800">{totalTarget > 0 ? Math.round((totalPop/totalTarget)*100) : 0}%</h2>
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min(100, (totalPop/totalTarget)*100)}%`}}></div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Current: {totalPop}</p>
                         </div>
                         <div className="px-4 pt-4 md:pt-0">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Churches</p>
                             <div className="flex items-center gap-2">
                                {churches.map(c => (
                                    <div key={c} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${c==='UJ'?'bg-indigo-500':c==='I'?'bg-emerald-500':c==='K'?'bg-rose-500':'bg-amber-500'}`}>{c}</div>
                                ))}
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {churchStats.map(stat => (
                    <div key={stat.church} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform
                                    ${stat.church === 'UJ' ? 'bg-indigo-600 shadow-indigo-200' : 
                                      stat.church === 'I' ? 'bg-emerald-500 shadow-emerald-200' :
                                      stat.church === 'K' ? 'bg-rose-500 shadow-rose-200' : 'bg-amber-500 shadow-amber-200'}
                                `}>
                                    {stat.church}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{stat.church} Church</h3>
                                    <p className="text-sm text-slate-500 font-medium">{stat.population} Active Members</p>
                                </div>
                            </div>
                            <div className={`flex flex-col items-end ${stat.growth >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 font-bold uppercase block">Last Sunday</span>
                                    <span className="text-2xl font-bold">{stat.lastAttendance}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Target Progress Bar */}
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                    <span>Membership Goal</span>
                                    <span>{stat.population} / {stat.target}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${stat.church === 'UJ' ? 'bg-indigo-500' : stat.church === 'I' ? 'bg-emerald-500' : stat.church === 'K' ? 'bg-rose-500' : 'bg-amber-500'}`} 
                                        style={{ width: `${Math.min(100, (stat.population / (stat.target || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Target Modal */}
            {isTargetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Set Membership Targets</h3>
                            <button onClick={() => setIsTargetModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Enter the target number of ACTIVE members + FNF for each church.</p>
                        <div className="space-y-4">
                            {churches.map(c => (
                                <div key={c} className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm
                                        ${c === 'UJ' ? 'bg-indigo-600' : 
                                        c === 'I' ? 'bg-emerald-500' :
                                        c === 'K' ? 'bg-rose-500' : 'bg-amber-500'}
                                    `}>
                                        {c}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{c} Target</label>
                                        <input 
                                            type="number" 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" 
                                            value={editTargets[c]} 
                                            onChange={(e) => setEditTargets({...editTargets, [c]: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleSaveTargets} className="w-full mt-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                            <Save size={18}/> Save Targets
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- CHURCH DASHBOARD ---
const ChurchDashboard: React.FC<{ data: AppData, activeChurch: Church }> = ({ data, activeChurch }) => {
    
    const stats = useMemo(() => {
        // New Population Logic: Members + FNF only
        const population = data.members.filter(m => 
            m.assignedChurch === activeChurch && 
            m.status === MemberStatus.ACTIVE &&
            (m.type === MemberType.MEMBER || m.type === MemberType.FNF)
        ).length;

        const members = data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE);
        const kids = members.filter(m => !['Teacher','Helper','Volunteer'].includes(m.type)); // Used for retention base
        const attendance = data.attendance
            .filter(r => r.churchId === activeChurch)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Helper to get count from a record
        const getCount = (r: any) => r.presentMemberIds.filter((id: string) => {
             const m = data.members.find(mem => mem.id === id);
             return m && !['Teacher','Helper','Volunteer'].includes(m.type);
        }).length;

        // Trend Data with Growth Calculation
        const last5 = attendance.slice(-5).map((r, i) => {
            const count = getCount(r);
            const date = new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            // Calculate growth compared to previous Sunday in the sorted list
            let growth = 0;
            const originalIndex = attendance.indexOf(r);
            
            if (originalIndex > 0) {
                const prevRecord = attendance[originalIndex - 1];
                const prevCount = getCount(prevRecord);
                growth = prevCount === 0 ? (count > 0 ? 100 : 0) : Math.round(((count - prevCount) / prevCount) * 100);
            }

            return { name: date, count, growth };
        });

        const avg = last5.length ? Math.round(last5.reduce((acc, curr) => acc + curr.count, 0) / last5.length) : 0;
        const lastAtt = last5.length > 0 ? last5[last5.length - 1].count : 0;
        const trend = avg > 0 ? Math.round(((lastAtt - avg) / avg) * 100) : 0;
        
        const target = data.targets?.[activeChurch] || 0;
        
        // Retention Rate
        const retention = kids.length > 0 ? Math.round((avg / kids.length) * 100) : 0;

        return { 
            totalMembers: population, 
            avgAttendance: avg, 
            lastAttendance: lastAtt,
            trendData: last5,
            trend,
            target,
            retention
        };
    }, [data, activeChurch]);

    return (
        <div className="space-y-6">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard 
                    title="Active + FNF" 
                    value={stats.totalMembers} 
                    icon={<Users size={24} />} 
                    colorClass="bg-indigo-600"
                    subtitle="Current Pop."
                />
                 <StatCard 
                    title="Retention Rate" 
                    value={`${stats.retention}%`}
                    icon={<Percent size={24} />} 
                    colorClass="bg-purple-600"
                    subtitle="Avg / Active"
                />
                <StatCard 
                    title="Last Attendance" 
                    value={stats.lastAttendance} 
                    icon={<Calendar size={24} />} 
                    colorClass="bg-emerald-500"
                    trend={stats.trend}
                    subtitle={`vs Avg (${stats.avgAttendance})`}
                />
                 <StatCard 
                    title="Membership Goal" 
                    value={stats.totalMembers}
                    target={stats.target}
                    progressValue={stats.totalMembers}
                    icon={<Target size={24} />} 
                    colorClass="bg-rose-500"
                    subtitle="Population vs Target"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* CHART */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Attendance Trend</h3>
                            <p className="text-slate-500 text-sm">Last 5 Sessions</p>
                        </div>
                        <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                            <TrendingUp size={14} /> Analysis
                        </div>
                    </div>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.trendData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <Tooltip content={<CustomChartTooltip />} cursor={{stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4'}} />
                                <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions / Tips */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
                     <h3 className="text-xl font-bold mb-4 relative z-10">Sunday Tips</h3>
                     <ul className="space-y-4 relative z-10">
                        <li className="flex gap-3 items-start">
                            <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</div>
                            <p className="text-sm text-slate-300 font-medium">Use the Punctual toggle for early arrivals to gamify the experience.</p>
                        </li>
                        <li className="flex gap-3 items-start">
                            <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                            <p className="text-sm text-slate-300 font-medium">Mark visitors as FNF to track outreach separately.</p>
                        </li>
                        <li className="flex gap-3 items-start">
                            <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                            <p className="text-sm text-slate-300 font-medium">Review the Inconsistent list in People Hub to reach out.</p>
                        </li>
                     </ul>
                </div>
            </div>
        </div>
    );
}

const Dashboard: React.FC<DashboardProps> = ({ data, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const showAdminView = isAdmin && activeChurch === 'CM';

  return (
    <div className="pb-10">
      {showAdminView ? (
          <AdminDashboard data={data} />
      ) : (
          <ChurchDashboard data={data} activeChurch={activeChurch} />
      )}
    </div>
  );
};

export default Dashboard;