import React, { useMemo } from 'react';
import { AppData, MemberType, MemberStatus, Church, Member } from '../types';
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
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Global Avg Attendance</p>
                        <div className="flex items-end gap-3">
                            <h2 className="text-3xl font-bold text-gray-800">{totalAvg}</h2>
                            <span className="text-sm text-green-600 font-medium mb-1 bg-green-50 px-2 py-0.5 rounded-full">
                                {totalPop ? Math.round((totalAvg/totalPop)*100) : 0}% Rate
                            </span>
                        </div>
                     </div>
                     <div>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Total Staff</p>
                        <h2 className="text-3xl font-bold text-gray-800">
                             {data.members.filter(m => (m.type === MemberType.TEACHER || m.type === MemberType.HELPER) && m.status === MemberStatus.ACTIVE).length}
                        </h2>
                     </div>
                     <div>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">New Members (FNF)</p>
                        <h2 className="text-3xl font-bold text-gray-800">
                            {data.members.filter(m => m.type === MemberType.FNF && m.status === MemberStatus.ACTIVE).length}
                        </h2>
                     </div>
                </div>
            </div>

            {/* CHURCH COMMAND CENTER GRID */}
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600"/> 
                Church Command Center
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {churchStats.map(stat => (
                    <div key={stat.church} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                        <div className={`h-2 w-full ${
                             stat.church === 'UJ' ? 'bg-indigo-500' : 
                             stat.church === 'I' ? 'bg-emerald-500' :
                             stat.church === 'K' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}></div>
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="text-xl font-bold text-gray-800">{stat.church} Church</h4>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${stat.growth >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {stat.growth > 0 ? '+' : ''}{stat.growth}%
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Population</p>
                                    <p className="text-xl font-bold text-gray-800">{stat.population}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Last Sunday</p>
                                    <p className="text-xl font-bold text-gray-800">{stat.lastAttendance}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                                <span>Avg: <strong>{stat.avg}</strong></span>
                                <span>Rate: <strong>{stat.rate}%</strong></span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Comparison Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Comparative Analytics</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={churchStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                            <XAxis dataKey="church" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}}/>
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}}/>
                            <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}/>
                            <Legend wrapperStyle={{paddingTop: '20px'}}/>
                            <Bar dataKey="population" name="Total Members" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="avg" name="Avg Attendance" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// --- SINGLE CHURCH DASHBOARD (For Teachers/Admins Context) ---
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
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Members" value={stats.totalMembers} icon={<Users size={24} />} color="bg-indigo-500" />
        <StatCard title="Avg. Attendance" value={stats.avgAttendance} icon={<Calendar size={24} />} color="bg-emerald-500" />
        <StatCard title="New (FNF)" value={stats.totalNew} icon={<UserPlus size={24} />} color="bg-amber-500" />
        <StatCard title="Growth Trend" value={`${stats.growth > 0 ? '+' : ''}${stats.growth}%`} icon={<TrendingUp size={24} />} color={stats.growth >= 0 ? "bg-green-500" : "bg-red-500"} subtext="vs last service" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Recent Attendance</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <Tooltip />
                        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Members" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Composition</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} fill="#8884d8" paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom"/>
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

  // Admin sees Aggregate Dashboard regardless of context, but can switch context in other views
  if (isAdmin) {
      return (
          <div className="space-y-4">
              <div className="mb-2 flex items-center gap-2">
                  <Target className="text-indigo-600"/>
                  <h2 className="text-xl font-bold text-gray-800">HQ Overview</h2>
              </div>
              <AdminDashboard data={data} />
          </div>
      )
  }

  return <ChurchDashboard data={data} activeChurch={activeChurch} />;
};

export default Dashboard;