import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { AppData, MemberType, MemberStatus, Church, Member } from "../types";
import { updateTargets } from "../services/storageService";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Trophy,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  X,
  Save,
  Percent,
  Heart,
  MapPin,
  Hourglass,
  Phone,
  PartyPopper,
  Gift,
} from "lucide-react";

interface DashboardProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const isBirthdayThisWeek = (birthDateString?: string) => {
  if (!birthDateString) return false;
  const parts = birthDateString.includes("-")
    ? birthDateString.split("-")
    : birthDateString.split("/");
  let month, day;
  if (birthDateString.includes("-")) {
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  }

  if (isNaN(day) || isNaN(month)) return false;

  const today = new Date();
  const currentYear = today.getFullYear();
  const bdayThisYear = new Date(currentYear, month - 1, day);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));

  return bdayThisYear >= startOfWeek && bdayThisYear <= endOfWeek;
};

const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  trend?: number;
  subtitle?: React.ReactNode;
  target?: number;
  progressValue?: number;
}> = ({
  title,
  value,
  icon,
  colorClass,
  trend,
  subtitle,
  target,
  progressValue,
}) => (
  <motion.div
    variants={itemVariants}
    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-full hover:shadow-md transition-all duration-300 group"
  >
    <div className="flex justify-between items-start mb-4">
      <div
        className={`p-3.5 rounded-2xl ${colorClass} text-white shadow-md group-hover:scale-110 transition-transform duration-300`}
      >
        {icon}
      </div>
      {trend !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {trend >= 0 ? (
            <ArrowUpRight size={12} />
          ) : (
            <ArrowDownRight size={12} />
          )}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
    <div>
      <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">
        {value}{" "}
        {target ? (
          <span className="text-sm font-medium text-slate-400">/ {target}</span>
        ) : (
          ""
        )}
      </h3>
      <p className="text-sm text-slate-500 font-medium mt-1">{title}</p>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</div>
      )}

      {target && typeof progressValue === "number" && (
        <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colorClass.replace("text-white", "")}`}
            style={{
              width: `${Math.min(100, (progressValue / target) * 100)}%`,
            }}
          ></div>
        </div>
      )}
    </div>
  </motion.div>
);

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
        <p className="text-slate-500 text-xs font-bold mb-2 uppercase tracking-wider">
          {label}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-2xl font-extrabold text-indigo-600 leading-none">
              {data.count}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              Attendees
            </span>
          </div>
          {data.growth !== 0 && (
            <div
              className={`flex flex-col items-end pl-3 border-l border-slate-100 ${data.growth > 0 ? "text-green-600" : "text-rose-500"}`}
            >
              <div className="flex items-center gap-0.5">
                {data.growth > 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                <span className="text-sm font-bold">
                  {Math.abs(data.growth)}%
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-400">
                vs prev
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// --- ADMIN DASHBOARD ---
const AdminDashboard: React.FC<{
  data: AppData;
  onUpdateTargets?: () => void;
}> = ({ data, onUpdateTargets }) => {
  // Dynamic church list from settings
  const churches: Church[] = data.settings.churches;
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Local state for target editing
  const [editTargets, setEditTargets] = useState<Record<string, number>>(
    data.targets || {},
  );

  const handleSaveTargets = () => {
    updateTargets(editTargets);
    setIsTargetModalOpen(false);
    if (onUpdateTargets) onUpdateTargets();
  };

  const churchStats = useMemo(() => {
    return churches.map((church) => {
      // New "Membership Goal" Logic: Active Members + FNF
      const membersInChurch = data.members.filter(
        (m) =>
          m.assignedChurch === church &&
          m.status === MemberStatus.ACTIVE &&
          (m.type === MemberType.MEMBER ||
            m.type === MemberType.FNF ||
            ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
            m.type === MemberType.TEACHER),
      );
      
      const population = membersInChurch.length;
      
      let memberPop = 0;
      let teacherPop = 0;
      membersInChurch.forEach(m => {
        if (m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE")) {
          teacherPop++;
        } else {
          memberPop++;
        }
      });

      const attendance = data.attendance.filter((r) => r.churchId === church);
      const sortedAttendance = [...attendance].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Average (Last 5 weeks)
      const totalAtt = attendance.reduce((sum, r) => {
        return (
          sum +
          r.presentMemberIds.filter((id) => {
            const m = data.members.find((mem) => mem.id === id);
            return !!m;
          }).length
        );
      }, 0);

      const avg = attendance.length
        ? Math.round(totalAtt / attendance.length)
        : 0;
      const retention = population ? Math.round((avg / population) * 100) : 0;

      let lastAttendance = 0;
      let prevAttendance = 0;
      let growth = 0;
      let lastMemberAttendance = 0;
      let lastTeacherAttendance = 0;
      if (sortedAttendance.length > 0) {
        const lastRec = sortedAttendance[sortedAttendance.length - 1];
        lastRec.presentMemberIds.forEach((id) => {
          const m = data.members.find((mem) => mem.id === id);
          if (m) {
            lastAttendance++;
            if (m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE")) {
              lastTeacherAttendance++;
            } else {
              lastMemberAttendance++;
            }
          }
        });

        if (sortedAttendance.length >= 2) {
          const prevRec = sortedAttendance[sortedAttendance.length - 2];
          prevAttendance = prevRec.presentMemberIds.filter((id) => {
            const m = data.members.find((mem) => mem.id === id);
            return !!m;
          }).length;
          growth =
            prevAttendance === 0
              ? lastAttendance > 0
                ? 100
                : 0
              : Math.round(
                  ((lastAttendance - prevAttendance) / prevAttendance) * 100,
                );
        }
      }

      const target = data.targets?.[church] || 0;
      const targetAchievement =
        target > 0 ? Math.round((population / target) * 100) : 0;
        
      let male = 0;
      let female = 0;
      let unassigned = 0;
      data.members.filter(m => m.assignedChurch === church && m.status === MemberStatus.ACTIVE).forEach(m => {
        if (m.gender === "MALE") male++;
        else if (m.gender === "FEMALE") female++;
        else unassigned++;
      });
      const genderData = [
        { name: "Male", value: male },
        { name: "Female", value: female },
        { name: "Unassigned", value: unassigned }
      ];

      return {
        church,
        population,
        memberPop,
        teacherPop,
        avg,
        retention,
        lastAttendance,
        lastMemberAttendance,
        lastTeacherAttendance,
        prevAttendance,
        growth,
        target,
        targetAchievement,
        genderData,
      };
    });
  }, [data, churches]);

  const totalPop = churchStats.reduce((acc, curr) => acc + curr.population, 0);
  const totalMemberPop = churchStats.reduce((acc, curr) => acc + curr.memberPop, 0);
  const totalTeacherPop = churchStats.reduce((acc, curr) => acc + curr.teacherPop, 0);
  const totalAvg = churchStats.reduce((acc, curr) => acc + curr.avg, 0);

  const { globalGenderBreakdown, globalAttendanceBreakdown } = useMemo(() => {
    let maleMembers = 0, femaleMembers = 0;
    let maleTeachers = 0, femaleTeachers = 0;
    
    data.members.forEach(m => {
      if (m.status === MemberStatus.ACTIVE) {
        const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
        if (isTeacher) {
          if (m.gender === "MALE") maleTeachers++;
          else if (m.gender === "FEMALE") femaleTeachers++;
        } else {
          if (m.gender === "MALE") maleMembers++;
          else if (m.gender === "FEMALE") femaleMembers++;
        }
      }
    });

    let memberAttendance = 0;
    let teacherAttendance = 0;
    let prevMemberAttendance = 0;
    let prevTeacherAttendance = 0;
    let latestDateStr = "";
    let prevDateStr = "";
    
    const sortedAttendance = [...data.attendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Group by unique dates
    const uniqueDates = Array.from(new Set(sortedAttendance.map(a => a.date)));
    
    if (uniqueDates.length > 0) {
      latestDateStr = uniqueDates[uniqueDates.length - 1];
      const latestRecords = sortedAttendance.filter(r => r.date === latestDateStr);
      latestRecords.forEach(r => {
        r.presentMemberIds.forEach(id => {
          const m = data.members.find(mem => mem.id === id);
          if (m) {
            const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
            if (isTeacher) teacherAttendance++;
            else memberAttendance++;
          }
        });
      });
      
      if (uniqueDates.length > 1) {
        prevDateStr = uniqueDates[uniqueDates.length - 2];
        const prevRecords = sortedAttendance.filter(r => r.date === prevDateStr);
        prevRecords.forEach(r => {
          r.presentMemberIds.forEach(id => {
            const m = data.members.find(mem => mem.id === id);
            if (m) {
              const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
              if (isTeacher) prevTeacherAttendance++;
              else prevMemberAttendance++;
            }
          });
        });
      }
    }

    return {
      globalGenderBreakdown: {
        members: { male: maleMembers, female: femaleMembers },
        teachers: { male: maleTeachers, female: femaleTeachers }
      },
      globalAttendanceBreakdown: {
        members: memberAttendance,
        teachers: teacherAttendance,
        prevMembers: prevMemberAttendance,
        prevTeachers: prevTeacherAttendance,
        latestDateStr,
        prevDateStr,
      }
    };
  }, [data.members, data.attendance]);

  const totalTarget = churchStats.reduce(
    (acc, curr) => acc + (curr.target > 0 ? curr.target : 0),
    0,
  );
  const totalTargetPop = churchStats.reduce(
    (acc, curr) => acc + (curr.target > 0 ? curr.population : 0),
    0,
  );

  const globalRetention =
    totalPop > 0 ? Math.round((totalAvg / totalPop) * 100) : 0;

  const totalLastAtt = churchStats.reduce(
    (acc, curr) => acc + curr.lastAttendance,
    0,
  );
  const totalPrevAtt = churchStats.reduce(
    (acc, curr) => acc + curr.prevAttendance,
    0,
  );
  const globalGrowth =
    totalPrevAtt === 0
      ? totalLastAtt > 0
        ? 100
        : 0
      : Math.round(((totalLastAtt - totalPrevAtt) / totalPrevAtt) * 100);

  const globalOutreachStats = useMemo(() => {
    const isOutreachEnabled = Object.values(data.settings.features || {}).some(f => f.outreach);
    if (!isOutreachEnabled) return null;

    const eligibleMembers = data.members.filter(
      (m) =>
        ["Member", "FNF", "Inconsistent"].includes(m.type) &&
        m.status === "Active",
    );
    const eligibleKids = eligibleMembers.length;
    const eligibleKidIds = new Set(eligibleMembers.map((m) => m.id));

    const visitTarget = eligibleKids * 2;
    const callTarget = eligibleKids * 4;
    const prayerTargetMins = eligibleKids * 5 * 52 * 30;

    const totalVisitsDone = (data.outreachSessions || [])
      .filter(
        (s) =>
          s.status === "COMPLETED" &&
          s.sessionType !== "CALL" &&
          new Date(s.date).getFullYear() === new Date().getFullYear(),
      )
      .reduce((acc, s) => {
        const validVisits = (s.visitedMemberIds || []).filter((id) =>
          eligibleKidIds.has(id),
        ).length;
        return acc + validVisits;
      }, 0);

    const totalCallsDone = (data.outreachSessions || [])
      .filter(
        (s) =>
          s.status === "COMPLETED" &&
          s.sessionType === "CALL" &&
          s.outcome === "REACHED" &&
          new Date(s.date).getFullYear() === new Date().getFullYear(),
      )
      .reduce((acc, s) => {
        const validCalls = (s.visitedMemberIds || []).filter((id) =>
          eligibleKidIds.has(id),
        ).length;
        return acc + validCalls;
      }, 0);

    const totalPrayerMins = (data.prayerSchedule || [])
      .filter(
        (s) =>
          s.isCompleted &&
          new Date(s.date).getFullYear() === new Date().getFullYear(),
      )
      .reduce((acc, s) => {
        const validPrayers = (s.assignedMemberIds || []).filter((id) =>
          eligibleKidIds.has(id),
        ).length;
        return (
          acc +
          validPrayers * (s.durationMins !== undefined ? s.durationMins : 30)
        );
      }, 0);

    return {
      visitTarget,
      totalVisitsDone,
      callTarget,
      totalCallsDone,
      prayerTargetMins,
      totalPrayerMins,
    };
  }, [data]);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 lg:col-span-1 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500"></div>
          <Users className="mb-4 text-indigo-200" size={32} />
          <h2 className="text-5xl font-extrabold mb-2 tracking-tight">
            {totalPop}
          </h2>
          <p className="text-indigo-100 font-medium text-lg mb-2">
            Total Membership
          </p>
          <div className="flex items-center gap-3 text-xs font-medium text-indigo-200">
            <span className="bg-white/10 px-2 py-1 rounded-md">{totalMemberPop} Members</span>
            <span className="bg-white/10 px-2 py-1 rounded-md">{totalTeacherPop} Teachers</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-3 flex flex-col justify-center relative">
          <button
            onClick={() => {
              setEditTargets(data.targets || {});
              setIsTargetModalOpen(true);
            }}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
            title="Set Annual Targets"
          >
            <Target size={20} />
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Ministry Overview
              </h3>
              <p className="text-slate-500 text-sm">
                Combined metrics ({new Date().getFullYear()})
              </p>
            </div>
            <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold mr-10 md:mr-0">
              Live Data
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="px-4">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Avg Attendance
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-4xl font-bold text-slate-800">
                  {totalAvg}
                </h2>
                <span className="text-sm text-slate-400 font-medium">
                  / week
                </span>
              </div>
            </div>
            <div className="px-4 pt-4 md:pt-0">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                WoW Change
              </p>
              <div className="flex items-baseline gap-2">
                <h2
                  className={`text-4xl font-bold flex items-center gap-2 ${globalGrowth >= 0 ? "text-green-600" : "text-rose-500"}`}
                >
                  {globalGrowth > 0 ? "+" : ""}
                  {globalGrowth}%
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">vs prev Sunday</p>
            </div>
            <div className="px-4 pt-4 md:pt-0">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Retention Rate
              </p>
              <div className="flex items-baseline gap-2">
                <h2
                  className={`text-4xl font-bold ${globalRetention >= 70 ? "text-green-600" : "text-amber-600"}`}
                >
                  {globalRetention}%
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">Avg vs Total Active</p>
            </div>
            <div className="px-4 pt-4 md:pt-0">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Membership Goal
              </p>
              <div className="flex items-center gap-3">
                <h2 className="text-4xl font-bold text-slate-800">
                  {totalTarget > 0
                    ? Math.round((totalTargetPop / totalTarget) * 100)
                    : 0}
                  %
                </h2>
                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (totalTargetPop / (totalTarget || 1)) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cumulative Target: {totalTarget}
              </p>
            </div>
            <div className="px-4 pt-4 md:pt-0">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                Churches
              </p>
              <div className="flex items-center gap-2">
                {churches.map((c) => (
                  <div
                    key={c}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${c === "UJ" ? "bg-indigo-500" : c === "I" ? "bg-emerald-500" : c === "K" ? "bg-rose-500" : "bg-amber-500"}`}
                  >
                    {c.substring(0, 2)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {globalOutreachStats && (
        <motion.div
          variants={itemVariants}
          className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
        >
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Heart size={20} className="text-pink-500" /> Outreach Impact (YTD)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase">
                  Visits Done
                </p>
                <h4 className="text-2xl font-bold text-slate-800">
                  {globalOutreachStats.totalVisitsDone}{" "}
                  <span className="text-sm text-slate-400 font-medium">
                    / {globalOutreachStats.visitTarget}
                  </span>
                </h4>
              </div>
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                <MapPin size={20} />
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase">
                  Calls Reached
                </p>
                <h4 className="text-2xl font-bold text-slate-800">
                  {globalOutreachStats.totalCallsDone}{" "}
                  <span className="text-sm text-slate-400 font-medium">
                    / {globalOutreachStats.callTarget}
                  </span>
                </h4>
              </div>
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-sm">
                <Phone size={20} />
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase">
                  Prayer Time
                </p>
                <h4 className="text-2xl font-bold text-slate-800">
                  {formatDuration(globalOutreachStats.totalPrayerMins)}{" "}
                  <span className="text-sm text-slate-400 font-medium">
                    / {formatDuration(globalOutreachStats.prayerTargetMins)}
                  </span>
                </h4>
              </div>
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-sm">
                <Hourglass size={20} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Global Gender Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-sm uppercase tracking-wider">
            <Users size={16} className="text-indigo-500" /> Global Demographics
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Members</p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Male</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{globalGenderBreakdown.members.male}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Female</span>
                  <span className="font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">{globalGenderBreakdown.members.female}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Teachers/Staff</p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Male</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{globalGenderBreakdown.teachers.male}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Female</span>
                  <span className="font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">{globalGenderBreakdown.teachers.female}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <h3 className="font-bold text-slate-800 flex items-center justify-between gap-2 mb-4 text-sm tracking-tight">
            <div className="flex items-center gap-2 uppercase tracking-wider">
              <Calendar size={16} className="text-emerald-500" /> Recent Attendance
            </div>
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">This Sunday {globalAttendanceBreakdown.latestDateStr ? `(${formatDateDDMMYYYY(globalAttendanceBreakdown.latestDateStr)})` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-indigo-600">{globalAttendanceBreakdown.members}</span>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase mt-0.5">Members</span>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-emerald-600">{globalAttendanceBreakdown.teachers}</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase mt-0.5">Teachers</span>
                </div>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Last Sunday {globalAttendanceBreakdown.prevDateStr ? `(${formatDateDDMMYYYY(globalAttendanceBreakdown.prevDateStr)})` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 opacity-70 grayscale-[0.5]">
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 flex justify-between items-center px-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Members</span>
                  <span className="text-lg font-black text-slate-600">{globalAttendanceBreakdown.prevMembers}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 flex justify-between items-center px-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Teachers</span>
                  <span className="text-lg font-black text-slate-600">{globalAttendanceBreakdown.prevTeachers}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {churchStats.map((stat) => (
          <div
            key={stat.church}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform
                                    ${
                                      stat.church === "UJ"
                                        ? "bg-indigo-600 shadow-indigo-200"
                                        : stat.church === "I"
                                          ? "bg-emerald-500 shadow-emerald-200"
                                          : stat.church === "K"
                                            ? "bg-rose-500 shadow-rose-200"
                                            : "bg-amber-500 shadow-amber-200"
                                    }
                                `}
                >
                  {stat.church.substring(0, 2)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {stat.church} Church
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    {stat.population} Active Members
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                    {stat.memberPop} M • {stat.teacherPop} T
                  </p>
                </div>
              </div>
              <div
                className={`flex flex-col items-end ${stat.growth >= 0 ? "text-green-600" : "text-rose-600"}`}
              >
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-bold uppercase block">
                    This Sunday
                  </span>
                  <span className="text-2xl font-bold">
                    {stat.lastAttendance}
                  </span>
                  <div className="text-[10px] font-medium text-slate-400 uppercase mt-1">
                    {stat.lastMemberAttendance} M • {stat.lastTeacherAttendance} T
                  </div>
                </div>
              </div>
            </div>

            {/* Target Progress Bar */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                  <span>Membership Goal</span>
                  <span>
                    {stat.population} / {stat.target}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stat.church === "UJ" ? "bg-indigo-500" : stat.church === "I" ? "bg-emerald-500" : stat.church === "K" ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{
                      width: `${Math.min(100, (stat.population / (stat.target || 1)) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Gender Breakdown */}
              {stat.genderData && (
                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs font-bold">
                  {stat.genderData.map(g => {
                    const total = stat.genderData.reduce((a, b) => a + b.value, 0);
                    const percent = total > 0 ? Math.round((g.value / total) * 100) : 0;
                    return (
                      <div key={g.name} className="flex flex-col items-center">
                        <span className="text-slate-400 mb-0.5">{g.name === "Unassigned" ? "Un" : g.name}</span>
                        <span className={`px-2 py-0.5 rounded-md ${g.name === "Male" ? "bg-blue-50 text-blue-600" : g.name === "Female" ? "bg-pink-50 text-pink-600" : "bg-slate-100 text-slate-600"}`}>
                          {g.value} ({percent}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Target Modal code remains same... */}
      {isTargetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                Set Membership Targets
              </h3>
              <button
                onClick={() => setIsTargetModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Enter the target number of ACTIVE members + FNF for each church.
            </p>
            <div className="space-y-4">
              {churches.map((c) => (
                <div key={c} className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm
                                        ${
                                          c === "UJ"
                                            ? "bg-indigo-600"
                                            : c === "I"
                                              ? "bg-emerald-500"
                                              : c === "K"
                                                ? "bg-rose-500"
                                                : "bg-amber-500"
                                        }
                                    `}
                  >
                    {c.substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      {c} Target
                    </label>
                    <input
                      type="number"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editTargets[c] || 0}
                      onChange={(e) =>
                        setEditTargets({
                          ...editTargets,
                          [c]: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveTargets}
              className="w-full mt-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Save size={18} /> Save Targets
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const UpcomingBirthdays: React.FC<{ members: Member[] }> = ({ members }) => {
  const birthdaysThisWeek = useMemo(() => {
    return members.filter(m => isBirthdayThisWeek(m.birthDate)).sort((a, b) => {
      if (!a.birthDate || !b.birthDate) return 0;
      const getDayMonth = (d: string) => {
        const parts = d.includes("-") ? d.split("-") : d.split("/");
        return d.includes("-") ? { d: parseInt(parts[2], 10), m: parseInt(parts[1], 10) } : { d: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
      };
      const dateA = getDayMonth(a.birthDate);
      const dateB = getDayMonth(b.birthDate);
      if (dateA.m !== dateB.m) return dateA.m - dateB.m;
      return dateA.d - dateB.d;
    });
  }, [members]);

  if (birthdaysThisWeek.length === 0) return null;

  return (
    <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-sm uppercase tracking-wider">
        <PartyPopper size={16} className="text-pink-500" /> Upcoming Birthdays (This Week)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {birthdaysThisWeek.map((member) => (
          <div key={member.id} className="flex items-center gap-4 p-4 rounded-2xl bg-pink-50/50 border border-pink-100/50">
            <div className="h-10 w-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center shrink-0">
              <Gift size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 truncate">{member.name}</h4>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <Calendar size={12} />
                {member.birthDate} 
                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-pink-100 text-pink-500 uppercase tracking-wider font-bold">
                  {member.type}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// --- CHURCH DASHBOARD ---
const ChurchDashboard: React.FC<{ data: AppData; activeChurch: Church }> = ({
  data,
  activeChurch,
}) => {
  // ... existing stats calculation ...
  const stats = useMemo(() => {
    // ... (existing code for population, members, attendance) ...
    const membersInChurch = data.members.filter(
      (m) =>
        m.assignedChurch === activeChurch &&
        m.status === MemberStatus.ACTIVE &&
        (m.type === MemberType.MEMBER ||
          m.type === MemberType.FNF ||
          ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
          m.type === MemberType.TEACHER),
    );
    const population = membersInChurch.length;
    
    let memberPop = 0;
    let teacherPop = 0;
    membersInChurch.forEach(m => {
      if (m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE")) {
        teacherPop++;
      } else {
        memberPop++;
      }
    });

    const members = data.members.filter(
      (m) =>
        m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE,
    );
    const kids = members;
    const attendance = data.attendance
      .filter((r) => r.churchId === activeChurch)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const getCount = (r: any) =>
      r.presentMemberIds.filter((id: string) => {
        const m = data.members.find((mem) => mem.id === id);
        return !!m;
      }).length;

    const last5 = attendance.slice(-5).map((r, i) => {
      const count = getCount(r);
      const date = formatDateDDMMYYYY(r.date);
      let growth = 0;
      const originalIndex = attendance.indexOf(r);
      if (originalIndex > 0) {
        const prevRecord = attendance[originalIndex - 1];
        const prevCount = getCount(prevRecord);
        growth =
          prevCount === 0
            ? count > 0
              ? 100
              : 0
            : Math.round(((count - prevCount) / prevCount) * 100);
      }
      return { name: date, count, growth };
    });

    const avg = last5.length
      ? Math.round(
          last5.reduce((acc, curr) => acc + curr.count, 0) / last5.length,
        )
      : 0;
    const lastAtt = last5.length > 0 ? last5[last5.length - 1].count : 0;
    
    let lastMemberAttendance = 0;
    let lastTeacherAttendance = 0;
    if (attendance.length > 0) {
      const lastRec = attendance[attendance.length - 1];
      lastRec.presentMemberIds.forEach(id => {
        const m = data.members.find(mem => mem.id === id);
        if (m) {
          if (m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE")) {
            lastTeacherAttendance++;
          } else {
            lastMemberAttendance++;
          }
        }
      });
    }

    const trend = avg > 0 ? Math.round(((lastAtt - avg) / avg) * 100) : 0;
    const target = data.targets?.[activeChurch] || 0;
    const retention = population > 0 ? Math.round((avg / population) * 100) : 0;

    return {
      totalMembers: population,
      memberPop,
      teacherPop,
      avgAttendance: avg,
      lastAttendance: lastAtt,
      lastMemberAttendance,
      lastTeacherAttendance,
      trendData: last5,
      trend,
      target,
      retention,
    };
  }, [data, activeChurch]);

  // Active Church Specific Outreach Stats
  const outreachStats = useMemo(() => {
    const isOutreachEnabled = data.settings.features?.[activeChurch]?.outreach ?? false;
    if (!isOutreachEnabled) return null;

    const eligibleMembers = data.members.filter(
      (m) =>
        m.assignedChurch === activeChurch &&
        ["Member", "FNF", "Inconsistent"].includes(m.type) &&
        m.status === "Active",
    );
    const eligibleKids = eligibleMembers.length;
    const eligibleKidIds = new Set(eligibleMembers.map((m) => m.id));

    const visitTarget = eligibleKids * 2; // Annual Target: 2 visits per kid
    const callTarget = eligibleKids * 4; // Annual Target: 4 calls per kid

    // Prayer Time Logic: Dynamic based on eligible kids
    // 5 days * 52 weeks * 30 mins = 7,800 mins per kid per year
    const prayerTargetMins = eligibleKids * 5 * 52 * 30;

    // Actual Visits Count (Only counting visits for currently eligible kids)
    const totalVisitsDone = (data.outreachSessions || [])
      .filter(
        (s) =>
          s.status === "COMPLETED" &&
          s.sessionType !== "CALL" && // Explicitly excluding calls
          new Date(s.date).getFullYear() === new Date().getFullYear(),
      )
      .reduce((acc, s) => {
        const validVisits = (s.visitedMemberIds || []).filter((id) =>
          eligibleKidIds.has(id),
        ).length;
        return acc + validVisits;
      }, 0);

    // Actual Calls Count
    const totalCallsDone = (data.outreachSessions || [])
      .filter(
        (s) =>
          s.status === "COMPLETED" &&
          s.sessionType === "CALL" &&
          s.outcome === "REACHED" &&
          new Date(s.date).getFullYear() === new Date().getFullYear(),
      )
      .reduce((acc, s) => {
        const validCalls = (s.visitedMemberIds || []).filter((id) =>
          eligibleKidIds.has(id),
        ).length;
        return acc + validCalls;
      }, 0);

    // Actual Prayer Time (Only counting prayer time for currently eligible kids)
    const totalPrayerMins = (data.prayerSchedule || [])
      .filter(
        (s) =>
          s.isCompleted &&
          new Date(s.date).getFullYear() === new Date().getFullYear(),
      )
      .reduce((acc, s) => {
        const validPrayers = (s.assignedMemberIds || []).filter((id) =>
          eligibleKidIds.has(id),
        ).length;
        return (
          acc +
          validPrayers * (s.durationMins !== undefined ? s.durationMins : 30)
        );
      }, 0);

    return {
      visitTarget,
      totalVisitsDone,
      callTarget,
      totalCallsDone,
      prayerTargetMins,
      totalPrayerMins,
    };
  }, [data, activeChurch]);

  const { churchGenderBreakdown, churchAttendanceBreakdown } = useMemo(() => {
    let maleMembers = 0, femaleMembers = 0;
    let maleTeachers = 0, femaleTeachers = 0;
    
    data.members.forEach(m => {
      if (m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE) {
        const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
        if (isTeacher) {
          if (m.gender === "MALE") maleTeachers++;
          else if (m.gender === "FEMALE") femaleTeachers++;
        } else {
          if (m.gender === "MALE") maleMembers++;
          else if (m.gender === "FEMALE") femaleMembers++;
        }
      }
    });

    let memberAttendance = 0;
    let teacherAttendance = 0;
    let prevMemberAttendance = 0;
    let prevTeacherAttendance = 0;
    let latestDateStr = "";
    let prevDateStr = "";
    
    const churchAttendance = data.attendance.filter(r => r.churchId === activeChurch);
    const sortedAttendance = [...churchAttendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const uniqueDates = Array.from(new Set(sortedAttendance.map(a => a.date)));
    
    if (uniqueDates.length > 0) {
      latestDateStr = uniqueDates[uniqueDates.length - 1];
      const latestRecords = sortedAttendance.filter(r => r.date === latestDateStr);
      latestRecords.forEach(r => {
        r.presentMemberIds.forEach(id => {
          const m = data.members.find(mem => mem.id === id);
          if (m) {
            const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
            if (isTeacher) teacherAttendance++;
            else memberAttendance++;
          }
        });
      });
      
      if (uniqueDates.length > 1) {
        prevDateStr = uniqueDates[uniqueDates.length - 2];
        const prevRecords = sortedAttendance.filter(r => r.date === prevDateStr);
        prevRecords.forEach(r => {
          r.presentMemberIds.forEach(id => {
            const m = data.members.find(mem => mem.id === id);
            if (m) {
              const isTeacher = m.type === MemberType.TEACHER || ["Teacher", "Helper", "Volunteer"].includes(m.type) || (m.role && m.role !== "NONE");
              if (isTeacher) prevTeacherAttendance++;
              else prevMemberAttendance++;
            }
          });
        });
      }
    }

    return {
      churchGenderBreakdown: {
        members: { male: maleMembers, female: femaleMembers },
        teachers: { male: maleTeachers, female: femaleTeachers }
      },
      churchAttendanceBreakdown: {
        members: memberAttendance,
        teachers: teacherAttendance,
        prevMembers: prevMemberAttendance,
        prevTeachers: prevTeacherAttendance,
        latestDateStr,
        prevDateStr,
      }
    };
  }, [data.members, data.attendance, activeChurch]);

  const dynamicTips = useMemo(() => {
    const tips: { id: number; text: string; action?: string; icon?: any }[] = [];
    
    // 1. Inconsistent Members
    const inconsistentCount = data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE && m.type === MemberType.INCONSISTENT).length;
    if (inconsistentCount > 0) {
      tips.push({
        id: 1,
        text: `You have ${inconsistentCount} active member${inconsistentCount > 1 ? 's' : ''} marked as Inconsistent.`,
        action: "Check the People Hub to follow up with them."
      });
    }

    // 2. Birthdays This Week
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const isBirthdayThisWeek = (birthDateString?: string) => {
      if (!birthDateString) return false;
      const parts = birthDateString.includes("-") ? birthDateString.split("-") : birthDateString.split("/");
      let month, day;
      if (birthDateString.includes("-")) {
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }
      if (isNaN(month) || isNaN(day)) return false;
      const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
      return bdayThisYear >= startOfWeek && bdayThisYear <= endOfWeek;
    };

    const bdayCount = data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE && isBirthdayThisWeek(m.birthDate)).length;
    if (bdayCount > 0) {
      tips.push({
        id: tips.length + 1,
        text: `${bdayCount} member${bdayCount > 1 ? 's have' : ' has a'} birthday this week!`,
        action: "Head over to the People Hub to see who they are."
      });
    }

    // 3. FNF/Visitors to convert
    const fnfCount = data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE && (m.type === MemberType.FNF || m.type === MemberType.VISITOR)).length;
    if (fnfCount > 0) {
      tips.push({
        id: tips.length + 1,
        text: `You have ${fnfCount} recent visitor${fnfCount > 1 ? 's' : ''} or FNF.`,
        action: "Review their attendance in the People Hub to help them transition to full members."
      });
    }

    // Fallbacks if not enough tips
    if (tips.length === 0) {
      tips.push({ id: 1, text: "Great job! All your members are active.", action: "Use the Punctual toggle for early arrivals to gamify the experience." });
    }
    if (tips.length < 2) {
      tips.push({ id: tips.length + 1, text: "Ensure accurate tracking.", action: "Mark new visitors as FNF to track outreach separately." });
    }
    if (tips.length < 3) {
      tips.push({ id: tips.length + 1, text: "Keep members engaged.", action: "Regularly check the Outreach Hub to schedule follow-ups." });
    }

    return tips.slice(0, 3);
  }, [data.members, activeChurch]);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-sm uppercase tracking-wider">
            <Users size={16} className="text-indigo-500" /> Demographics ({activeChurch})
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Members</p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Male</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{churchGenderBreakdown.members.male}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Female</span>
                  <span className="font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">{churchGenderBreakdown.members.female}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Teachers/Staff</p>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Male</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{churchGenderBreakdown.teachers.male}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Female</span>
                  <span className="font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">{churchGenderBreakdown.teachers.female}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <h3 className="font-bold text-slate-800 flex items-center justify-between gap-2 mb-4 text-sm tracking-tight">
            <div className="flex items-center gap-2 uppercase tracking-wider">
              <Calendar size={16} className="text-emerald-500" /> Recent Attendance
            </div>
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">This Sunday {churchAttendanceBreakdown.latestDateStr ? `(${formatDateDDMMYYYY(churchAttendanceBreakdown.latestDateStr)})` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-indigo-600">{churchAttendanceBreakdown.members}</span>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase mt-0.5">Members</span>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-emerald-600">{churchAttendanceBreakdown.teachers}</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase mt-0.5">Teachers</span>
                </div>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Last Sunday {churchAttendanceBreakdown.prevDateStr ? `(${formatDateDDMMYYYY(churchAttendanceBreakdown.prevDateStr)})` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 opacity-70 grayscale-[0.5]">
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 flex justify-between items-center px-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Members</span>
                  <span className="text-lg font-black text-slate-600">{churchAttendanceBreakdown.prevMembers}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 flex justify-between items-center px-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Teachers</span>
                  <span className="text-lg font-black text-slate-600">{churchAttendanceBreakdown.prevTeachers}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Existing Stats Cards */}
        <StatCard
          title="Total Membership"
          value={stats.totalMembers}
          icon={<Users size={24} />}
          colorClass="bg-indigo-600"
          subtitle={
            <div className="flex items-center gap-2 mt-1">
              <span>{stats.memberPop} Members</span>
              <span>•</span>
              <span>{stats.teacherPop} Teachers</span>
            </div>
          }
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
          subtitle={
            <div className="flex flex-col gap-1 mt-1">
              <span>{stats.lastMemberAttendance} Members • {stats.lastTeacherAttendance} Teachers</span>
              <span>vs Avg ({stats.avgAttendance})</span>
            </div>
          }
        />
        <StatCard
          title="WoW Change"
          value={
            stats.trendData.length > 0
              ? (stats.trendData[stats.trendData.length - 1].growth > 0
                  ? "+"
                  : "") +
                stats.trendData[stats.trendData.length - 1].growth +
                "%"
              : "0%"
          }
          icon={<TrendingUp size={24} />}
          colorClass="bg-sky-500"
          subtitle="vs Previous Sunday"
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

      <UpcomingBirthdays members={data.members.filter(m => m.assignedChurch === activeChurch && m.status === MemberStatus.ACTIVE)} />

      {/* Outreach Section */}
      {outreachStats && (
        <motion.div
          variants={itemVariants}
          className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
        >
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Heart size={20} className="text-pink-500" /> Outreach Impact (YTD)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase">
                  Visits Done
                </p>
                <h4 className="text-2xl font-bold text-slate-800">
                  {outreachStats.totalVisitsDone}{" "}
                  <span className="text-sm text-slate-400 font-medium">
                    / {outreachStats.visitTarget}
                  </span>
                </h4>
              </div>
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                <MapPin size={20} />
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase">
                  Calls Reached
                </p>
                <h4 className="text-2xl font-bold text-slate-800">
                  {outreachStats.totalCallsDone}{" "}
                  <span className="text-sm text-slate-400 font-medium">
                    / {outreachStats.callTarget}
                  </span>
                </h4>
              </div>
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-sm">
                <Phone size={20} />
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase">
                  Prayer Time
                </p>
                <h4 className="text-2xl font-bold text-slate-800">
                  {formatDuration(outreachStats.totalPrayerMins)}{" "}
                  <span className="text-sm text-slate-400 font-medium">
                    / {formatDuration(outreachStats.prayerTargetMins)}
                  </span>
                </h4>
              </div>
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-sm">
                <Hourglass size={20} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"
      >
        {/* CHART */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
          {/* ... Existing Chart Code ... */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                Attendance Trend
              </h3>
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
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip
                  content={<CustomChartTooltip />}
                  cursor={{
                    stroke: "#4f46e5",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions / Tips */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
          {/* ... Existing Tips Code ... */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
          <h3 className="text-xl font-bold mb-4 relative z-10">Sunday Tips</h3>
          <ul className="space-y-4 relative z-10">
            {dynamicTips.map((tip, index) => (
              <li key={tip.id} className="flex gap-3 items-start">
                <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <div className="text-sm">
                  <p className="text-white font-medium mb-1">{tip.text}</p>
                  <p className="text-slate-300 font-medium">{tip.action}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SundayWeeklySummary: React.FC<{ data: AppData; currentUser: Member }> = ({
  data,
  currentUser,
}) => {
  if (
    currentUser.role !== "ZONAL_HEAD" &&
    currentUser.role !== "BRANCH_COORDINATOR"
  ) {
    return null;
  }

  let relevantMembers = data.members;
  let relevantAttendance = data.attendance;

  if (currentUser.role === "BRANCH_COORDINATOR" && currentUser.branchId) {
    relevantMembers = relevantMembers.filter(
      (m) => m.branchId === currentUser.branchId,
    );
    relevantAttendance = relevantAttendance.filter(
      (a) => a.branchId === currentUser.branchId,
    );
  } else if (currentUser.role === "ZONAL_HEAD" && currentUser.zoneId) {
    const zoneBranches =
      data.settings.organization?.zones
        ?.find(
          (z) => z.id === currentUser.zoneId || z.name === currentUser.zoneId,
        )
        ?.branches?.map((b) => b.id || b.name) || [];
    relevantMembers = relevantMembers.filter(
      (m) => m.branchId && zoneBranches.includes(m.branchId),
    );
    relevantAttendance = relevantAttendance.filter(
      (a) => a.branchId && zoneBranches.includes(a.branchId),
    );
  }

  const dateMap: Record<string, { members: number; teachers: number }> = {};

  relevantAttendance.forEach((r) => {
    if (!dateMap[r.date]) dateMap[r.date] = { members: 0, teachers: 0 };
    r.presentMemberIds.forEach((id) => {
      const m = relevantMembers.find((mem) => mem.id === id);
      if (m) {
        if (
          m.type === MemberType.TEACHER ||
          (m.role && m.role !== "NONE") ||
          ["Teacher", "Helper", "Volunteer"].includes(m.type)
        ) {
          dateMap[r.date].teachers++;
        } else {
          dateMap[r.date].members++;
        }
      }
    });
  });

  const sortedDates = Object.keys(dateMap).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  if (sortedDates.length < 2) return null;

  const thisWeekDate = sortedDates[sortedDates.length - 1];
  const lastWeekDate = sortedDates[sortedDates.length - 2];

  const thisWeek = dateMap[thisWeekDate];
  const lastWeek = dateMap[lastWeekDate];

  const memberGrowth = lastWeek.members
    ? Math.round(
        ((thisWeek.members - lastWeek.members) / lastWeek.members) * 100,
      )
    : thisWeek.members > 0
      ? 100
      : 0;
  const teacherGrowth = lastWeek.teachers
    ? Math.round(
        ((thisWeek.teachers - lastWeek.teachers) / lastWeek.teachers) * 100,
      )
    : thisWeek.teachers > 0
      ? 100
      : 0;

  return (
    <motion.div variants={itemVariants} className="mb-8">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-lg tracking-tight">
          <Calendar size={20} className="text-indigo-500" />
          Sunday Weekly Summary
          <span className="text-xs text-slate-400 font-medium ml-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            {formatDateDDMMYYYY(lastWeekDate)} vs {formatDateDDMMYYYY(thisWeekDate)}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase mb-1 tracking-wider">
                Members Growth
              </p>
              <div className="flex items-end gap-2">
                <h4 className="text-3xl font-black text-slate-800">
                  {thisWeek.members}
                </h4>
                <p className="text-sm text-slate-500 mb-1 font-medium">
                  vs {lastWeek.members} prev
                </p>
              </div>
            </div>
            <div
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 ${memberGrowth >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
            >
              {memberGrowth >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              {Math.abs(memberGrowth)}%
            </div>
          </div>

          <div className="p-5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-fuchsia-600 uppercase mb-1 tracking-wider">
                Teachers Growth
              </p>
              <div className="flex items-end gap-2">
                <h4 className="text-3xl font-black text-slate-800">
                  {thisWeek.teachers}
                </h4>
                <p className="text-sm text-slate-500 mb-1 font-medium">
                  vs {lastWeek.teachers} prev
                </p>
              </div>
            </div>
            <div
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 ${teacherGrowth >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
            >
              {teacherGrowth >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              {Math.abs(teacherGrowth)}%
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({
  data,
  activeChurch,
  currentUser,
}) => {
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );
  const showAdminView = isAdmin && activeChurch === "CM";

  return (
    <div className="pb-10">
      <SundayWeeklySummary data={data} currentUser={currentUser} />
      {showAdminView ? (
        <AdminDashboard data={data} />
      ) : (
        <ChurchDashboard data={data} activeChurch={activeChurch} />
      )}
    </div>
  );
};

export default Dashboard;
