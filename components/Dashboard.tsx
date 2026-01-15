import React, { useMemo } from 'react';
import { AppData, MemberType, MemberStatus, Church, Member } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { Users, TrendingUp, UserPlus, Calendar, Trophy, Clock, Target, Award, Users2, Building2 } from 'lucide-react';

interface DashboardProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorFrom: string; colorTo: string; subtext?: string; trend?: string }> = ({ title, value, icon, colorFrom, colorTo, subtext, trend }) => (
  <div className={`relative overflow-hidden bg-white p-6 rounded-3xl shadow-soft border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group`}>
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorFrom} ${colorTo} opacity-10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110`}></div>
    
    <div className="relative z-10 flex items-start justify-between">
        <div>
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorFrom} ${colorTo} text-white flex items-center justify-center shadow-lg shadow-indigo-100 mb-4`}>
                {icon}
            </div>
            <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</h3>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-1">{title}</p>
            
            {subtext && (
                <div className="flex items-center gap-2 mt-4 bg-gray-50 w-fit px-3 py-1 rounded-full">
                     <span className={`text-xs font-bold ${trend?.includes('+') ? 'text-green-600' : 'text-gray-500'}`}>{trend}</span>
                     <span className="text-[10px] text-gray-400 font-medium">{subtext}</span>
                </div>
            )}
        </div>
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

    return (
        <div className="space-y-8">
            {/* High Level Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 lg:col-span-1 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                    <p className="text-indigo-100 font-bold mb-2 uppercase tracking-wider text-xs">Total Population</p>
                    <h2 className="text-5xl font-extrabold tracking-tight">{totalPop}</h2>
                    <p className="text-sm text-indigo-200 mt-4 font-medium">Active Children across 4 churches</p>
                </div>
                <div className="bg-white rounded-3xl p-8 shadow-soft border border-gray-100 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-10">
                     <div className="flex flex-col justify-center">
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">Global Avg Attendance</p>
                        <div className="flex items-baseline gap-3">
                            <h2 className="text-4xl font-extrabold text-gray-800">{totalAvg}</h2>
                            <span className="text-sm text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                                {totalPop ? Math.round((totalAvg/totalPop)*100) : 0}% Rate
                            </span>
                        </div>
                     </div>
                     <div className="flex flex-col justify-center border-l border-gray-100 pl-8">
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">Total Staff</p>
                        <h2 className="text-4xl font-extrabold text-gray-800">
                             {data.members.filter(m => (m.type === MemberType.TEACHER || m.type === MemberType.HELPER) && m.status === MemberStatus.ACTIVE).length}
                        </h2>
                     </div>
                     <div className="flex flex-col justify-center border-l border-gray-100 pl-8">
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">New Members (FNF)</p>
                        <h2 className="text-4xl font-extrabold text-gray-800">
                            {data.members.filter(m => m.type === MemberType.FNF && m.status === MemberStatus.ACTIVE).length}
                        </h2>
                     </div>
                </div>
            </div>

            {/* CHURCH COMMAND CENTER GRID */}
            <div className="flex items-center gap-3 mb-4 mt-8">
                 <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Building2 size={20} className="text-indigo-600"/> 
                 </div>
                 <h3 className="text-xl font-extrabold text-gray-800">Church Command Center</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {churchStats.map(stat => (
                    <div key={stat.church} className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                        <div className={`h-1.5 w-full ${
                             stat.church === 'UJ' ? 'bg-indigo-500' : 
                             stat.church === 'I' ? 'bg-emerald-500' :
                             stat.church === 'K' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}></div>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <h4 className="text-2xl font-bold text-gray-900">{stat.church}</h4>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${stat.growth >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {stat.growth > 0 ? '+' : ''}{stat.growth}%
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Population</p>
                                    <p className="text-2xl font-extrabold text-gray-800">{stat.population}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Last Sun</p>
                                    <p className="text-2xl font-extrabold text-gray-800">{stat.lastAttendance}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs font-medium text-gray-500 border-t border-gray-100 pt-4">
                                <span>Avg: <strong className="text-gray-900">{stat.avg}</strong></span>
                                <span>Rate: <strong className="text-gray-900">{stat.rate}%</strong></span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Comparison Chart */}
            <div className="bg-white p-8 rounded-3xl shadow-soft border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-8">Comparative Analytics</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={churchStats} barSize={40} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="church" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10}/>
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}}/>
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontFamily: 'Inter'}}/>
                            <Legend wrapperStyle={{paddingTop: '20px'}}/>
                            <Bar dataKey="population" name="Total Members" fill="#e2e8f0" radius={[8, 8, 8, 8]} />
                            <Bar dataKey="avg" name="Avg Attendance" fill="#6366f1" radius={[8, 8, 8, 8]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// --- SINGLE CHURCH DASHBOARD ---
const ChurchDashboard: React.FC<{ data: AppData; activeChurch: Church }> = ({ data, activeChurch }) => {
  const churchMembers = useMemo(() => data.members.filter(m => m.assignedChurch === activeChurch), [data.members, activeChurch]);
  const churchAttendance = useMemo(() => data.attendance.filter(a => a.churchId === activeChurch), [data.attendance, activeChurch]);

  const stats = useMemo(() => {
    // Exclude Staff
    const activeMembers = churchMembers.filter(m => 
      m.status === MemberStatus.ACTIVE && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER
    );
    const staffIds = new Set(churchMembers.filter(m => m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER).map(m => m.id));

    const totalMembers = activeMembers.length;
    const totalNew = activeMembers.filter(m => m.type === MemberType.FNF).length;
    
    const countNonStaff = (ids: string[]) => ids.filter(id => !staffIds.has(id)).length;
    const totalAttendanceCount = churchAttendance.reduce((acc, curr) => acc + countNonStaff(curr.presentMemberIds), 0);
    const avgAttendance = churchAttendance.length > 0 ? Math.round(totalAttendanceCount / churchAttendance.length) : 0;

    // Growth
    const sortedAttendance = [...churchAttendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let growth = 0;
    if (sortedAttendance.length >= 2) {
      const last = countNonStaff(sortedAttendance[sortedAttendance.length - 1].presentMemberIds);
      const prev = countNonStaff(sortedAttendance[sortedAttendance.length - 2].presentMemberIds);
      if (prev === 0) growth = last > 0 ? 100 : 0;
      else growth = Math.round(((last - prev) / prev) * 100);
    }

    return { totalMembers, totalNew, avgAttendance, growth, sortedAttendance, activeMembers };
  }, [churchMembers, churchAttendance]);

  // Composition Data
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    stats.activeMembers.forEach(m => { counts[m.type] = (counts[m.type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [stats.activeMembers]);

  // Chart Data (Last 5 weeks)
  const chartData = useMemo(() => {
      return stats.sortedAttendance.slice(-5).map(r => {
          return {
              name: new Date(r.date).toLocaleDateString(undefined, {month:'short', day:'numeric'}),
              count: r.presentMemberIds.filter(id => {
                 const m = data.members.find(mem => mem.id === id);
                 return m && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER;
              }).length
          }
      });
  }, [stats.sortedAttendance, data.members]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Active Members" 
            value={stats.totalMembers} 
            icon={<Users size={24} />} 
            colorFrom="from-indigo-500" 
            colorTo="to-indigo-600"
            subtext="Registered"
            trend="" 
        />
        <StatCard 
            title="Avg. Attendance" 
            value={stats.avgAttendance} 
            icon={<Calendar size={24} />} 
            colorFrom="from-emerald-400" 
            colorTo="from-emerald-600"
            subtext="Per Sunday"
            trend=""
        />
        <StatCard 
            title="New (FNF)" 
            value={stats.totalNew} 
            icon={<UserPlus size={24} />} 
            colorFrom="from-amber-400" 
            colorTo="to-orange-500"
            subtext="Total Visitors"
            trend=""
        />
        <StatCard 
            title="Growth Trend" 
            value={`${stats.growth > 0 ? '+' : ''}${stats.growth}%`} 
            icon={<TrendingUp size={24} />} 
            colorFrom={stats.growth >= 0 ? "from-green-500" : "from-red-500"}
            colorTo={stats.growth >= 0 ? "to-green-600" : "to-red-600"}
            subtext="vs last service"
            trend={stats.growth > 0 ? "+" + stats.growth : stats.growth.toString()} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-soft border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-8">Recent Attendance Trend</h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} dy={10}/>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <Tooltip contentStyle={{borderRadius: '16px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontFamily: 'Inter'}}/>
                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-soft border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Composition</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={categoryData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    fill="#8884d8" 
                    paddingAngle={5} 
                    dataKey="value"
                    cornerRadius={6}
                  >
                    {categoryData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}/>
                  <Legend verticalAlign="bottom" wrapperStyle={{paddingTop: '20px', fontSize: '12px'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ data, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';

  if (isAdmin) {
      return (
          <div className="space-y-6">
              <AdminDashboard data={data} />
          </div>
      )
  }

  return <ChurchDashboard data={data} activeChurch={activeChurch} />;
};

export default Dashboard;