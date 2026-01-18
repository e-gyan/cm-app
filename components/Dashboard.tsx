import React, { useMemo } from 'react';
import { AppData, MemberType, MemberStatus, Church, Member } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Users, TrendingUp, Calendar, Trophy, Clock, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface DashboardProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string; trend?: number; subtitle?: string }> = ({ title, value, icon, colorClass, trend, subtitle }) => (
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
      <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{value}</h3>
      <p className="text-sm text-slate-500 font-medium mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</p>}
    </div>
  </div>
);

// --- ADMIN DASHBOARD ---
const AdminDashboard: React.FC<{ data: AppData }> = ({ data }) => {
    const churches: Church[] = ['UJ', 'I', 'K', 'LJ'];

    const churchStats = useMemo(() => {
        return churches.map(church => {
            const members = data.members.filter(m => m.assignedChurch === church && m.status === MemberStatus.ACTIVE && !['Teacher','Helper','Volunteer'].includes(m.type));
            const attendance = data.attendance.filter(r => r.churchId === church);
            const sortedAttendance = [...attendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const totalAtt = attendance.reduce((sum, r) => {
                 return sum + r.presentMemberIds.filter(id => {
                     const m = data.members.find(mem => mem.id === id);
                     return m && !['Teacher','Helper','Volunteer'].includes(m.type);
                 }).length;
            }, 0);
            
            const avg = attendance.length ? Math.round(totalAtt / attendance.length) : 0;
            const population = members.length;
            const rate = population ? Math.round((avg / population) * 100) : 0;
            
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

            return { church, population, avg, rate, lastAttendance, growth };
        });
    }, [data]);

    const totalPop = churchStats.reduce((acc, curr) => acc + curr.population, 0);
    const totalAvg = churchStats.reduce((acc, curr) => acc + curr.avg, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 lg:col-span-1 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500"></div>
                    <Users className="mb-4 text-indigo-200" size={32} />
                    <h2 className="text-5xl font-extrabold mb-2 tracking-tight">{totalPop}</h2>
                    <p className="text-indigo-100 font-medium text-lg">Active Children</p>
                    <p className="text-indigo-200 text-sm mt-1 opacity-80">Across 4 Locations</p>
                </div>
                
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-3 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                             <h3 className="text-lg font-bold text-slate-800">Ministry Overview</h3>
                             <p className="text-slate-500 text-sm">Combined performance metrics</p>
                        </div>
                        <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold">Live Data</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                         <div className="px-4">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Avg Attendance</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-slate-800">{totalAvg}</h2>
                                <span className="text-sm text-slate-400 font-medium">/ week</span>
                            </div>
                         </div>
                         <div className="px-4 pt-4 md:pt-0">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Retention Rate</p>
                            <div className="flex items-center gap-3">
                                <h2 className="text-4xl font-bold text-slate-800">{totalPop ? Math.round((totalAvg/totalPop)*100) : 0}%</h2>
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{width: `${Math.min(100, (totalAvg/totalPop)*100)}%`}}></div>
                                </div>
                            </div>
                         </div>
                         <div className="px-4 pt-4 md:pt-0">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Active Branches</p>
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
                                    <p className="text-sm text-slate-500 font-medium">{stat.population} Members</p>
                                </div>
                            </div>
                            <div className={`flex flex-col items-end ${stat.growth >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                                <span className="text-2xl font-bold">{stat.lastAttendance}</span>
                                <span className="text-xs font-bold bg-slate-50 px-2 py-0.5 rounded-md mt-1">
                                    {stat.growth >= 0 ? '↑' : '↓'} {Math.abs(stat.growth)}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${stat.church === 'UJ' ? 'bg-indigo-500' : stat.church === 'I' ? 'bg-emerald-500' : stat.church === 'K' ? 'bg-rose-500' : 'bg-amber-500'}`} 
                                style={{ width: `${Math.min(100, stat.rate)}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-medium text-slate-400">
                            <span>Attendance Rate</span>
                            <span>{stat.rate}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- CHURCH DASHBOARD ---
const ChurchDashboard: React.FC<{ data: AppData, activeChurch: Church }> = ({ data, activeChurch }) => {
    
    const stats = useMemo(() => {
        const members = data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE);
        const kids = members.filter(m => !['Teacher','Helper','Volunteer'].includes(m.type));
        const attendance = data.attendance
            .filter(r => r.churchId === activeChurch)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Trend Data
        const last5 = attendance.slice(-5).map(r => {
            const count = r.presentMemberIds.filter(id => {
                 const m = data.members.find(mem => mem.id === id);
                 return m && !['Teacher','Helper','Volunteer'].includes(m.type);
            }).length;
            const date = new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return { name: date, count };
        });

        const avg = last5.length ? Math.round(last5.reduce((acc, curr) => acc + curr.count, 0) / last5.length) : 0;
        const lastAtt = last5.length > 0 ? last5[last5.length - 1].count : 0;
        const trend = avg > 0 ? Math.round(((lastAtt - avg) / avg) * 100) : 0;

        return { 
            totalMembers: kids.length, 
            avgAttendance: avg, 
            lastAttendance: lastAtt,
            trendData: last5,
            trend
        };
    }, [data, activeChurch]);

    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Active Members" 
                    value={stats.totalMembers} 
                    icon={<Users size={24} />} 
                    colorClass="bg-indigo-600"
                    subtitle="Registered Children"
                />
                <StatCard 
                    title="Last Attendance" 
                    value={stats.lastAttendance} 
                    icon={<Calendar size={24} />} 
                    colorClass="bg-emerald-500"
                    trend={stats.trend}
                    subtitle={`vs ${stats.avgAttendance} average`}
                />
                 <StatCard 
                    title="Avg Attendance" 
                    value={stats.avgAttendance} 
                    icon={<Activity size={24} />} 
                    colorClass="bg-amber-500"
                    subtitle="Last 5 sessions"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* CHART */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Attendance Trend</h3>
                            <p className="text-slate-500 text-sm">Last 5 Sessions Performance</p>
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
                                <Tooltip 
                                    cursor={{stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4'}} 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                                />
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
                            <p className="text-sm text-slate-300 font-medium">Use the "Punctual" toggle for early arrivals to gamify the experience.</p>
                        </li>
                        <li className="flex gap-3 items-start">
                            <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</div>
                            <p className="text-sm text-slate-300 font-medium">Mark visitors as "FNF" to track outreach separately.</p>
                        </li>
                        <li className="flex gap-3 items-start">
                            <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</div>
                            <p className="text-sm text-slate-300 font-medium">Review the "Inconsistent" list in People Hub to reach out.</p>
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