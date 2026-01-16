import React, { useMemo } from 'react';
import { AppData, MemberType, MemberStatus, Church, Member, AttendanceRecord } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, TrendingUp, UserPlus, Calendar, Trophy, Clock, Target, Award, Users2, Building2 } from 'lucide-react';

interface DashboardProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; subtext?: string }> = ({ title, value, icon, color, subtext }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-xl ${color} text-white shadow-sm`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

// --- ADMIN AGGREGATE DASHBOARD ---
const AdminDashboard: React.FC<{ data: AppData }> = ({ data }) => {
    const churches: Church[] = ['UJ', 'I', 'K', 'LJ'];

    const churchStats = useMemo(() => {
        return churches.map(church => {
            const members = data.members.filter(m => m.assignedChurch === church && m.status === MemberStatus.ACTIVE && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER);
            const attendance = data.attendance.filter(r => r.churchId === church);
            const sortedAttendance = [...attendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // Calc avg attendance
            const totalAtt = attendance.reduce((sum, r) => {
                 const memberCount = r.presentMemberIds.filter(id => {
                     const m = data.members.find(mem => mem.id === id);
                     return m && m.type !== MemberType.TEACHER;
                 }).length;
                 return sum + memberCount;
            }, 0);
            
            const avg = attendance.length ? Math.round(totalAtt / attendance.length) : 0;
            const population = members.length;
            const rate = population ? Math.round((avg / population) * 100) : 0;
            
            // Last Sunday Stats
            let lastAttendance = 0;
            let growth = 0;
            if (sortedAttendance.length > 0) {
                const lastRec = sortedAttendance[sortedAttendance.length - 1];
                lastAttendance = lastRec.presentMemberIds.filter(id => {
                    const m = data.members.find(mem => mem.id === id);
                    return m && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER;
                }).length;
                
                if (sortedAttendance.length >= 2) {
                    const prevRec = sortedAttendance[sortedAttendance.length - 2];
                    const prevAtt = prevRec.presentMemberIds.filter(id => {
                        const m = data.members.find(mem => mem.id === id);
                        return m && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER;
                    }).length;
                    
                    if (prevAtt === 0) growth = lastAttendance > 0 ? 100 : 0;
                    else growth = Math.round(((lastAttendance - prevAtt) / prevAtt) * 100);
                }
            }

            return { church, population, avg, rate, lastAttendance, growth };
        });
    }, [data]);

    const totalPop = churchStats.reduce((acc, curr) => acc + curr.population, 0);
    const totalAvg = churchStats.reduce((acc, curr) => acc + curr.avg, 0);
    const totalStaff = data.members.filter(m => m.status === MemberStatus.ACTIVE && (m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER)).length;

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* High Level Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg lg:col-span-1">
                    <p className="text-indigo-100 font-medium mb-1">Total Population</p>
                    <h2 className="text-4xl font-bold">{totalPop}</h2>
                    <p className="text-sm text-indigo-200 mt-2">Active Children across 4 churches</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Overall Avg Attendance</p>
                        <div className="flex items-end gap-3">
                            <h2 className="text-3xl font-bold text-gray-800">{totalAvg}</h2>
                            <span className="text-sm text-green-600 font-medium mb-1 bg-green-50 px-2 py-0.5 rounded-full">
                                {totalPop ? Math.round((totalAvg/totalPop)*100) : 0}% Rate
                            </span>
                        </div>
                     </div>
                     <div>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Total Staff</p>
                        <h2 className="text-3xl font-bold text-gray-800">{totalStaff}</h2>
                     </div>
                     <div>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Churches Active</p>
                        <h2 className="text-3xl font-bold text-gray-800">4</h2>
                     </div>
                </div>
            </div>

            {/* Church Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {churchStats.map(stat => (
                    <div key={stat.church} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold
                                    ${stat.church === 'UJ' ? 'bg-indigo-600' : 
                                      stat.church === 'I' ? 'bg-emerald-600' :
                                      stat.church === 'K' ? 'bg-rose-600' : 'bg-amber-600'}
                                `}>
                                    {stat.church}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{stat.church} Church</h3>
                                    <p className="text-xs text-gray-500">Population: {stat.population}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">{stat.lastAttendance} Present</p>
                                <p className={`text-xs font-medium ${stat.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stat.growth >= 0 ? '+' : ''}{stat.growth}% vs prev
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500 font-medium">Avg Attendance</span>
                                    <span className="text-gray-900 font-bold">{stat.avg}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, (stat.avg / (stat.population || 1)) * 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500 font-medium">Retention Rate</span>
                                    <span className="text-gray-900 font-bold">{stat.rate}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, stat.rate)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- SINGLE CHURCH DASHBOARD (For Teachers) ---

const ChurchDashboard: React.FC<{ data: AppData, activeChurch: Church }> = ({ data, activeChurch }) => {
    
    // Compute Church Stats
    const stats = useMemo(() => {
        const members = data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE);
        const kids = members.filter(m => m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER);
        const attendance = data.attendance
            .filter(r => r.churchId === activeChurch)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Punctuality Leaderboard Logic (Current Month)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyRecords = attendance.filter(r => {
            const d = new Date(r.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const punctualityScores: Record<string, number> = {};
        monthlyRecords.forEach(r => {
            r.punctualMemberIds?.forEach(id => {
                punctualityScores[id] = (punctualityScores[id] || 0) + 1;
            });
        });

        const punctualityLeaders = Object.entries(punctualityScores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([id, score]) => {
                const m = data.members.find(mem => mem.id === id);
                return { name: m?.name || 'Unknown', score, id, type: m?.type };
            });


        // Trend Data
        const last5 = attendance.slice(-5).map(r => {
            const count = r.presentMemberIds.filter(id => {
                 const m = data.members.find(mem => mem.id === id);
                 return m && m.type !== MemberType.TEACHER;
            }).length;
            const date = new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return { name: date, count };
        });

        const avg = last5.length ? Math.round(last5.reduce((acc, curr) => acc + curr.count, 0) / last5.length) : 0;
        const totalKids = kids.length;
        const lastAtt = last5.length > 0 ? last5[last5.length - 1].count : 0;

        return { 
            totalMembers: totalKids, 
            avgAttendance: avg, 
            lastAttendance: lastAtt,
            trendData: last5,
            punctualityLeaders
        };
    }, [data, activeChurch]);

    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Active Members" 
                    value={stats.totalMembers} 
                    icon={<Users2 size={24} />} 
                    color="bg-indigo-500"
                    subtext="Registered Children"
                />
                <StatCard 
                    title="Last Attendance" 
                    value={stats.lastAttendance} 
                    icon={<Calendar size={24} />} 
                    color="bg-green-500"
                    subtext={stats.trendData.length > 0 ? `vs ${stats.avgAttendance} avg` : 'No data yet'}
                />
                 <StatCard 
                    title="Growth Trend" 
                    value={stats.trendData.length > 0 ? `${stats.lastAttendance >= stats.avgAttendance ? '+' : ''}${stats.lastAttendance - stats.avgAttendance}` : '0'} 
                    icon={<TrendingUp size={24} />} 
                    color="bg-amber-500"
                    subtext="Last session vs Average"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CHART */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <ActivityIcon /> Attendance Trend (Last 5 Sessions)
                    </h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* PUNCTUALITY LEADERBOARD - UJ ONLY (or all if desired, but request specified UJ) */}
                {activeChurch === 'UJ' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                            <Trophy size={20} className="text-yellow-500" /> Early Birds
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">Top Punctual Stars (This Month)</p>

                        <div className="flex-1 space-y-4">
                            {stats.punctualityLeaders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center p-4">
                                    <Clock size={32} className="mb-2 opacity-20"/>
                                    <p className="text-sm">No punctual records yet this month.</p>
                                </div>
                            ) : (
                                stats.punctualityLeaders.map((leader, index) => (
                                    <div key={leader.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                                            ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-700'}
                                        `}>
                                            #{index + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-gray-800 text-sm truncate">{leader.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase">{leader.type}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-indigo-600">{leader.score}x</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
                
                {activeChurch !== 'UJ' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center text-gray-400">
                        <Building2 size={48} className="mb-4 opacity-10" />
                        <p>Additional metrics for {activeChurch} coming soon.</p>
                    </div>
                )}

            </div>
        </div>
    );
}

const ActivityIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
)

const Dashboard: React.FC<DashboardProps> = ({ data, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const showAdminView = isAdmin && activeChurch === 'CM';

  return (
    <div className="pb-20">
      {showAdminView ? (
          <AdminDashboard data={data} />
      ) : (
          <ChurchDashboard data={data} activeChurch={activeChurch} />
      )}
    </div>
  );
};

export default Dashboard;