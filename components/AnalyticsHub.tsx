import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Church, Member, MemberType, MemberStatus } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { Calendar, ChevronDown, TrendingUp, TrendingDown, Users, Target, Activity, MessageCircle, Share2, MapPin, Heart, HeartHandshake, Sparkles, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { motion } from "motion/react";

interface AnalyticsHubProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

type TimeRange = '2W' | '1M' | '3M' | 'YTD' | '1Y';

const AnalyticsHub: React.FC<AnalyticsHubProps> = ({ data, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const isUJTeacher = currentUser.role === 'TEACHER' && activeChurch === 'UJ';
  
  // Use dynamic list from settings
  const availableChurches = data.settings.churches;

  // --- STATE ---
  const [selectedYear, setSelectedYear] = useState<number>(() => {
      const saved = localStorage.getItem('analytics_year');
      return saved ? parseInt(saved) : new Date().getFullYear();
  });
  const [timeRange, setTimeRange] = useState<TimeRange>(() => (localStorage.getItem('analytics_timeRange') as TimeRange) || '1M');
  const [adminFilterChurch, setAdminFilterChurch] = useState<Church | 'All'>(() => (localStorage.getItem('analytics_churchFilter') as Church | 'All') || 'All');
  
  // Persist State
  useEffect(() => { localStorage.setItem('analytics_year', selectedYear.toString()); }, [selectedYear]);
  useEffect(() => { localStorage.setItem('analytics_timeRange', timeRange); }, [timeRange]);
  useEffect(() => { localStorage.setItem('analytics_churchFilter', adminFilterChurch); }, [adminFilterChurch]);
  
  // AI State
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // --- HELPERS ---
  const effectiveChurch = isAdmin ? adminFilterChurch : activeChurch;

  const getAvailableYears = () => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      data.attendance.forEach(r => years.add(new Date(r.date).getFullYear()));
      return Array.from(years).sort((a,b) => b-a);
  };

  const getDateRange = () => {
      const end = new Date(); // Today default
      // If selected year is previous, end date is Dec 31 of that year
      if (selectedYear !== new Date().getFullYear()) {
          end.setFullYear(selectedYear, 11, 31);
      }
      end.setHours(23, 59, 59, 999); // End of day inclusive
      
      const start = new Date(end);
      
      switch(timeRange) {
          case '2W': 
              start.setDate(end.getDate() - 14); 
              break;
          case '1M': 
              start.setMonth(end.getMonth() - 1); 
              break;
          case '3M': 
              start.setMonth(end.getMonth() - 3); 
              break;
          case 'YTD': 
              start.setFullYear(selectedYear, 0, 1); 
              break; 
          case '1Y': 
              start.setFullYear(end.getFullYear() - 1); 
              break;
      }
      start.setHours(0, 0, 0, 0); // Start of day inclusive

      return { start, end };
  };

  // --- DATA PROCESSING ---

  // 1. Attendance Data for Charts
  const chartData = useMemo(() => {
      const { start, end } = getDateRange();
      
      // Filter records strictly within range
      let records = data.attendance.filter(r => {
          const d = new Date(r.date);
          const churchMatch = effectiveChurch === 'All' ? true : r.churchId === effectiveChurch;
          return d >= start && d <= end && churchMatch;
      });

      // Sort chronological
      records.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Group by Date (handles combined view having multiple records per date)
      const groupedByDate = new Map<string, { date: string, dateObj: Date, Member: number, FNF: number, Inconsistent: number, Total: number }>();

      records.forEach(r => {
          // Normalize date string to ensure grouping by day
          const dateKey = r.date; 
          
          if (!groupedByDate.has(dateKey)) {
              groupedByDate.set(dateKey, { 
                  date: new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), 
                  dateObj: new Date(r.date),
                  Member: 0, FNF: 0, Inconsistent: 0, Total: 0 
                });
          }
          
          const entry = groupedByDate.get(dateKey)!;
          
          // Count attendees excluding staff
          r.presentMemberIds.forEach(id => {
              const m = data.members.find(mem => mem.id === id);
              if (m && !['Teacher','Helper','Volunteer'].includes(m.type)) {
                  entry.Total++;
                  if (m.type === MemberType.MEMBER) entry.Member++;
                  else if (m.type === MemberType.FNF) entry.FNF++;
                  else entry.Inconsistent++;
              }
          });
      });

      return Array.from(groupedByDate.values());
  }, [data.attendance, effectiveChurch, timeRange, selectedYear, data.members]);

  // 2. High Level KPI
  const stats = useMemo(() => {
      if (chartData.length === 0) return { avg: 0, growth: 0, retention: 0, newFaces: 0 };

      const totalAtt = chartData.reduce((acc, d) => acc + d.Total, 0);
      const avg = Math.round(totalAtt / chartData.length);

      // Growth (Compare first half vs second half of period roughly)
      const mid = Math.floor(chartData.length / 2);
      const firstHalf = chartData.slice(0, mid);
      const secondHalf = chartData.slice(mid);
      
      const avg1 = firstHalf.length ? firstHalf.reduce((a,b)=>a+b.Total,0)/firstHalf.length : 0;
      const avg2 = secondHalf.length ? secondHalf.reduce((a,b)=>a+b.Total,0)/secondHalf.length : 0;
      
      const growth = avg1 === 0 ? (avg2 > 0 ? 100 : 0) : Math.round(((avg2 - avg1) / avg1) * 100);

      // Simple Retention Proxy: Active Members vs Total
      const totalMembersAttended = chartData.reduce((acc, d) => acc + d.Member, 0);
      const retention = totalAtt > 0 ? Math.round((totalMembersAttended / totalAtt) * 100) : 0;

      // New Faces Proxy (Average FNF count)
      const newFaces = Math.round(chartData.reduce((acc, d) => acc + d.FNF, 0) / chartData.length);

      return { avg, growth, retention, newFaces };
  }, [chartData]);

  // --- AI GENERATION ---
  const generateInsight = async () => {
      if (chartData.length < 2) {
          setAiInsight("Not enough data points in this period to generate a trend analysis.");
          return;
      }

      setIsGenerating(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Act as a senior data analyst for a children's ministry.
        Analyze this attendance data for the period "${timeRange}":
        - Average Attendance: ${stats.avg}
        - Growth vs previous half of period: ${stats.growth}%
        - Retention Rate (Regular Members / Total): ${stats.retention}%
        - New Visitors (FNF) avg per week: ${stats.newFaces}
        - Data Points (Chronological): ${JSON.stringify(chartData.map(d => ({ date: d.date, total: d.Total })))}

        Instructions:
        1. Provide a "Brutal and Honest" inference. Do not use corporate fluff.
        2. If growth is negative, explicitly point it out as a problem.
        3. If retention is low (<60%), warn about member bleed.
        4. If new faces are low, warn about lack of outreach.
        5. Keep it under 2 sentences. Be direct.
      `;

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview', 
                contents: prompt,
            });
            
            setAiInsight(response.text || "Could not generate insight.");
            break; // Success, exit loop
        } catch (e: any) {
            console.error(`AI Gen Attempt ${retryCount + 1} Error:`, e);
            retryCount++;
            
            // Check for 503 or 429 errors (High Demand / Rate Limit)
            const isOverloaded = e.status === 503 || e.message?.includes('503') || e.status === 429 || e.message?.includes('429');
            
            if (isOverloaded && retryCount < maxRetries) {
                // Exponential backoff: 1s, 2s...
                await new Promise(res => setTimeout(res, 1000 * retryCount));
                continue;
            }

            if (retryCount === maxRetries) {
                 if (isOverloaded) {
                     setAiInsight("System is currently experiencing high traffic. Please try again in a minute.");
                 } else {
                     setAiInsight("AI Analysis unavailable at the moment.");
                 }
            }
        }
      }
      setIsGenerating(false);
  };

  // Debounced Effect to trigger AI when stats change
  useEffect(() => {
      const timer = setTimeout(() => {
          generateInsight();
      }, 800); // 800ms debounce to prevent call spam while switching tabs
      return () => clearTimeout(timer);
  }, [stats, timeRange, effectiveChurch]);


  // 3. UJ Outreach Intelligence
  const outreachIntel = useMemo(() => {
      if (!isUJTeacher && effectiveChurch !== 'UJ') return null;
      
      const { start, end } = getDateRange();
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && ['Member','FNF','Inconsistent'].includes(m.type) && m.status === MemberStatus.ACTIVE);
      const totalEligible = ujMembers.length;

      // Visits in period
      const visits = (data.outreachSessions || []).filter(s => {
          const d = new Date(s.date);
          return d >= start && d <= end && s.status === 'COMPLETED';
      });
      
      const visitedIds = new Set<string>();
      visits.forEach(s => s.visitedMemberIds?.forEach(id => visitedIds.add(id)));
      
      const visitCoverage = totalEligible > 0 ? Math.round((visitedIds.size / totalEligible) * 100) : 0;

      // Prayers in period
      const prayers = (data.prayerSchedule || []).filter(s => {
          const d = new Date(s.date);
          return d >= start && d <= end && s.isCompleted;
      });

      const prayedIds = new Set<string>();
      prayers.forEach(s => s.assignedMemberIds.forEach(id => prayedIds.add(id)));
      
      const prayerCoverage = totalEligible > 0 ? Math.round((prayedIds.size / totalEligible) * 100) : 0;

      // Insights
      const notVisited = ujMembers.filter(m => !visitedIds.has(m.id)).length;
      const notPrayed = ujMembers.filter(m => !prayedIds.has(m.id)).length;

      return { visitCoverage, prayerCoverage, notVisited, notPrayed, totalEligible };
  }, [data, isUJTeacher, effectiveChurch, timeRange, selectedYear]);

  // 4. Financial Intelligence
  const financialIntel = useMemo(() => {
      const { start, end } = getDateRange();
      
      let txns = data.transactions || [];
      
      // Filter by Church and Date
      txns = txns.filter(t => {
          const d = new Date(t.date);
          const churchMatch = effectiveChurch === 'All' ? true : t.churchId === effectiveChurch;
          return d >= start && d <= end && churchMatch;
      });

      let totalIncome = 0;
      let totalExpense = 0;
      
      // Group by Date for chart
      const groupedByDate = new Map<string, { date: string, income: number, expense: number }>();

      txns.forEach(t => {
          if (t.type === 'INCOME') totalIncome += t.amount;
          else totalExpense += t.amount;

          const dateKey = t.date;
          if (!groupedByDate.has(dateKey)) {
              groupedByDate.set(dateKey, { 
                  date: new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), 
                  income: 0, 
                  expense: 0 
              });
          }
          const entry = groupedByDate.get(dateKey)!;
          if (t.type === 'INCOME') entry.income += t.amount;
          else entry.expense += t.amount;
      });

      // Sort chronological
      const chartData = Array.from(groupedByDate.values()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return { totalIncome, totalExpense, balance: totalIncome - totalExpense, chartData };
  }, [data.transactions, effectiveChurch, timeRange, selectedYear]);


  // --- EXPORT LOGIC (Grouped) ---
  const handleExport = (church: Church) => {
      // Get all active people for this church, sorted by name
      const allActive = data.members
        .filter(m => m.assignedChurch === church && m.status === MemberStatus.ACTIVE)
        .sort((a,b) => a.name.localeCompare(b.name));

      // Separate into Groups
      const members = allActive.filter(m => m.type === MemberType.MEMBER);
      const fnf = allActive.filter(m => m.type === MemberType.FNF);

      if (members.length === 0 && fnf.length === 0) {
          alert(`No active members or FNF found for ${church}.`);
          return;
      }

      let text = `*${church} CHURCH MEMBERS LIST*\n\n`;
      
      if (members.length > 0) {
          text += `*MEMBERS (${members.length})*\n`;
          members.forEach((m, i) => {
              text += `${i + 1}. ${m.name}\n`;
          });
          text += `\n`;
      }

      if (fnf.length > 0) {
          text += `*FNF (${fnf.length})*\n`;
          fnf.forEach((m, i) => {
              text += `${i + 1}. ${m.name}\n`;
          });
      }

      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4">
        
        {/* TOP BAR: Controls */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-xl font-extrabold text-slate-800">Analytics Hub</h2>
                <p className="text-xs text-slate-500 font-medium">Deep dive into data & trends.</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
                {/* Church Filter (Admin Only) */}
                {isAdmin && (
                    <div className="relative">
                        <select 
                            className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={adminFilterChurch}
                            onChange={(e) => setAdminFilterChurch(e.target.value as Church | 'All')}
                        >
                            <option value="All">All Churches</option>
                            {availableChurches.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>
                )}

                {/* Year Selector */}
                <div className="relative">
                    <select 
                        className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    >
                        {getAvailableYears().map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <Calendar size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                </div>

                {/* Period Selector */}
                <div className="bg-slate-100 p-1 rounded-xl flex">
                    {(['2W', '1M', '3M', 'YTD'] as TimeRange[]).map(range => (
                        <button 
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* SECTION A: ATTENDANCE INTELLIGENCE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* KPI Cards */}
            <div className="space-y-4 lg:col-span-1">
                <motion.div 
                    key={`avg-${stats.avg}`}
                    initial={{ opacity: 0.8, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={20}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Avg Attendance</span>
                    </div>
                    <div className="flex items-end gap-3">
                        <motion.span 
                            key={`avg-val-${stats.avg}`}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-4xl font-extrabold text-slate-800"
                        >
                            {stats.avg}
                        </motion.span>
                        {stats.growth !== 0 && (
                            <motion.div 
                                key={`growth-${stats.growth}`}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className={`flex items-center text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full ${stats.growth > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                            >
                                {stats.growth > 0 ? <TrendingUp size={12} className="mr-1"/> : <TrendingDown size={12} className="mr-1"/>}
                                {Math.abs(stats.growth)}%
                            </motion.div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">vs previous period</p>
                </motion.div>

                <div className="grid grid-cols-2 gap-4">
                    <motion.div 
                        key={`retention-${stats.retention}`}
                        initial={{ opacity: 0.8, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"
                    >
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Retention</div>
                        <motion.div 
                            key={`retention-val-${stats.retention}`}
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="text-2xl font-bold text-slate-800"
                        >
                            {stats.retention}%
                        </motion.div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.retention}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="bg-purple-500 h-full rounded-full" 
                            />
                        </div>
                    </motion.div>
                    <motion.div 
                        key={`newfaces-${stats.newFaces}`}
                        initial={{ opacity: 0.8, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"
                    >
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">New Faces</div>
                        <div className="text-2xl font-bold text-slate-800 flex items-center gap-1">
                            <motion.span
                                key={`newfaces-val-${stats.newFaces}`}
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                            >
                                +{stats.newFaces}
                            </motion.span>
                            <span className="text-xs text-slate-400 font-normal">/wk</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Avg FNF attendees</p>
                    </motion.div>
                </div>
                
                {/* AI Insight Card */}
                <div className="bg-indigo-900 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full blur-2xl -translate-y-4 translate-x-4"></div>
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-sm flex items-center gap-2"><Sparkles size={16} className="text-indigo-300"/> AI Insight</h4>
                            <button onClick={generateInsight} disabled={isGenerating} className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50">
                                <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''}/>
                            </button>
                        </div>
                        {isGenerating ? (
                            <div className="flex items-center gap-2 text-indigo-300 text-xs py-2">
                                <Loader2 size={14} className="animate-spin"/>
                                <span>Analyzing trends...</span>
                            </div>
                        ) : (
                            <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                                {aiInsight || "Select a range to analyze."}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Attendance Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
                <div className="mb-6 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Attendance Breakdown</h3>
                    <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wide">
                        <div className="flex items-center gap-1 text-indigo-600"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Member</div>
                        <div className="flex items-center gap-1 text-amber-600"><div className="w-2 h-2 rounded-full bg-amber-500"></div> FNF</div>
                        <div className="flex items-center gap-1 text-rose-600"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Other</div>
                    </div>
                </div>
                
                <div className="flex-1 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorFnf" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10}/>
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}}/>
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area type="monotone" dataKey="Member" stackId="1" stroke="#6366f1" fill="url(#colorMem)" />
                            <Area type="monotone" dataKey="FNF" stackId="1" stroke="#f59e0b" fill="url(#colorFnf)" />
                            <Area type="monotone" dataKey="Inconsistent" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.6} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* SECTION B: OUTREACH INTELLIGENCE (UJ Only) */}
        {outreachIntel && (
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 px-1">
                    <HeartHandshake size={20} className="text-indigo-600"/> Outreach Intelligence
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Visits Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <h4 className="font-bold text-slate-700">Visitation Coverage</h4>
                                <p className="text-xs text-slate-400">Unique kids visited in period</p>
                            </div>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><MapPin size={20}/></div>
                        </div>
                        
                        <div className="flex items-end gap-2 relative z-10">
                            <span className="text-4xl font-extrabold text-slate-800">{outreachIntel.visitCoverage}%</span>
                            <span className="text-sm text-slate-400 mb-1.5 font-medium">of {outreachIntel.totalEligible} kids</span>
                        </div>

                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 relative z-10">
                            <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg"><Target size={14}/></div>
                            <p className="text-xs text-slate-600">
                                <b>{outreachIntel.notVisited} children</b> have not been visited in this period.
                            </p>
                        </div>
                        
                        {/* Background Decor */}
                        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-50 rounded-full opacity-50 pointer-events-none"></div>
                    </div>

                    {/* Prayer Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <h4 className="font-bold text-slate-700">Prayer Coverage</h4>
                                <p className="text-xs text-slate-400">Unique kids prayed for in period</p>
                            </div>
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Heart size={20}/></div>
                        </div>
                        
                        <div className="flex items-end gap-2 relative z-10">
                            <span className="text-4xl font-extrabold text-slate-800">{outreachIntel.prayerCoverage}%</span>
                            <span className="text-sm text-slate-400 mb-1.5 font-medium">of {outreachIntel.totalEligible} kids</span>
                        </div>

                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 relative z-10">
                            <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg"><Target size={14}/></div>
                            <p className="text-xs text-slate-600">
                                <b>{outreachIntel.notPrayed} children</b> pending prayer coverage.
                            </p>
                        </div>

                        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-purple-50 rounded-full opacity-50 pointer-events-none"></div>
                    </div>
                </div>
            </div>
        )}

        {/* SECTION C: FINANCIAL INTELLIGENCE */}
        <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 px-1">
                <Wallet size={20} className="text-emerald-600"/> Financial Intelligence
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4 lg:col-span-1">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20}/></div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Total Income</span>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-800">GH₵ {financialIntel.totalIncome.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={20}/></div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Total Expense</span>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-800">GH₵ {financialIntel.totalExpense.toLocaleString()}</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/10 text-white rounded-xl"><Wallet size={20}/></div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Net Balance</span>
                        </div>
                        <div className="text-3xl font-extrabold">GH₵ {financialIntel.balance.toLocaleString()}</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
                    <div className="mb-6 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Financial Trend</h3>
                    </div>
                    <div className="flex-1 min-h-[250px]">
                        {financialIntel.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={financialIntel.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10}/>
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}}/>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">No financial data for this period</div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION D: MEMBER EXPORT */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <MessageCircle size={20} className="text-green-600"/> WhatsApp Export
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Export active member lists directly to WhatsApp.</p>
                </div>
            </div>

            {isAdmin ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {availableChurches.map(church => (
                        <button 
                            key={church}
                            onClick={() => handleExport(church)}
                            className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-200 rounded-2xl transition-all group"
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm mb-2 group-hover:scale-110 transition-transform
                                ${church === 'UJ' ? 'bg-indigo-500' : church === 'I' ? 'bg-emerald-500' : church === 'K' ? 'bg-rose-500' : 'bg-amber-500'}
                            `}>
                                {church.substring(0,2)}
                            </div>
                            <span className="text-sm font-bold text-slate-700 group-hover:text-green-700">Export {church}</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-green-600 flex items-center gap-1 mt-1">
                                <Share2 size={10}/> Share List
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                <button 
                    onClick={() => handleExport(activeChurch)}
                    className="w-full py-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-green-100 transition-all shadow-sm active:scale-[0.99]"
                >
                    <Share2 size={20}/>
                    <span>Export {activeChurch} Members List</span>
                </button>
            )}
        </div>

    </div>
  );
};

export default AnalyticsHub;