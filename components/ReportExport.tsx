import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, MemberType, Church, Member, MemberStatus, ServiceType } from '../types';
import { Copy, FileText, CheckCircle, Database, Download, Upload, AlertCircle, RefreshCw, Cloud, Lock, Code, MessageCircle, BookOpen, Compass, GitBranch, ArrowRight, ChevronDown, Calendar, Target, TrendingUp, Save, Briefcase, Sparkles, Edit3 } from 'lucide-react';
import { getSundaysInYear } from '../constants';
import { importData, syncFromCloud, updateTargets } from '../services/storageService';
import { GoogleGenAI } from "@google/genai";

interface ReportExportProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReportExport: React.FC<ReportExportProps> = ({ data, onUpdate, activeChurch, currentUser }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'KPI' | 'DATA' | 'EXECUTIVE'>('WHATSAPP');
  const [importMsg, setImportMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Executive Report State
  const [execTimeframe, setExecTimeframe] = useState<'1M' | '3M' | '1Y'>('1M');
  const [execReportContent, setExecReportContent] = useState('');
  const [isGeneratingExec, setIsGeneratingExec] = useState(false);
  
  // KPI/Target Edit State
  const [editTargets, setEditTargets] = useState<Record<string, number>>(data.targets || {});
  
  // Get active churches from settings
  const availableChurches = data.settings.churches;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sundays2026 = getSundaysInYear(2026);
  const isAdmin = currentUser.role === 'ADMIN';

  // Get all unique dates from attendance records + Sundays
  const availableDates = useMemo(() => {
      const recordedDates = data.attendance.map(r => r.date);
      const sundayDates = sundays2026.map(d => d.toISOString().split('T')[0]);
      const allDates = Array.from(new Set([...recordedDates, ...sundayDates]));
      return allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [data.attendance, sundays2026]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        if (availableDates.includes(today)) {
            setSelectedDate(today);
        } else {
            // Find closest past date or just first available
            const pastDates = availableDates.filter(d => d <= today);
            setSelectedDate(pastDates.length > 0 ? pastDates[0] : availableDates[0]);
        }
    }
  }, [availableDates, selectedDate]);

  // Update edit targets when data changes
  useEffect(() => {
      if (data.targets) {
          setEditTargets(data.targets);
      }
  }, [data.targets]);

  // --- KPI Calculation Logic ---
  const kpiStats = useMemo(() => {
    if (!isAdmin) return [];
    
    // Dynamic order based on settings
    return availableChurches.map(church => {
        // Calculate Avg Attendance (Last 5 weeks)
        const attendance = data.attendance.filter(r => r.churchId === church);
        const sortedAttendance = [...attendance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const last5 = sortedAttendance.slice(-5);
        
        // Avg Weekly
        let totalAtt = 0;
        last5.forEach(r => {
             const kids = r.presentMemberIds.filter(id => {
                 const m = data.members.find(mem => mem.id === id);
                 return m && !['Teacher','Helper','Volunteer'].includes(m.type);
             }).length;
             totalAtt += kids;
        });
        const avg = last5.length ? Math.round(totalAtt / last5.length) : 0;
        
        // Current Population (Active + FNF)
        const population = data.members.filter(m => 
            m.assignedChurch === church && 
            m.status === MemberStatus.ACTIVE && 
            (m.type === MemberType.MEMBER || m.type === MemberType.FNF)
        ).length;

        return {
            church,
            avg,
            population,
            target: editTargets[church] || 0
        };
    });
  }, [data, editTargets, isAdmin, availableChurches]);

  // --- Executive Report Logic ---
  const generateExecutiveReport = async () => {
      if (!process.env.GEMINI_API_KEY) {
          setExecReportContent("Error: AI API Key not configured.");
          return;
      }

      setIsGeneratingExec(true);
      setExecReportContent('');

      try {
          const now = new Date();
          let startDate = new Date();
          
          if (execTimeframe === '1M') startDate.setMonth(now.getMonth() - 1);
          if (execTimeframe === '3M') startDate.setMonth(now.getMonth() - 3);
          if (execTimeframe === '1Y') startDate.setFullYear(now.getFullYear() - 1);

          // 1. Gather Data
          const relevantAttendance = data.attendance.filter(r => new Date(r.date) >= startDate && (activeChurch === 'CM' || r.churchId === activeChurch));
          const relevantOutreach = (data.outreachSessions || []).filter(s => new Date(s.date) >= startDate);
          
          // Calculate Stats
          const totalAttendance = relevantAttendance.reduce((acc, r) => acc + r.presentMemberIds.length, 0);
          const avgAttendance = relevantAttendance.length ? Math.round(totalAttendance / relevantAttendance.length) : 0;
          
          const newMembers = data.members.filter(m => new Date(m.joinedDate) >= startDate && (activeChurch === 'CM' || m.assignedChurch === activeChurch)).length;
          const activeMembers = data.members.filter(m => m.status === MemberStatus.ACTIVE && (activeChurch === 'CM' || m.assignedChurch === activeChurch)).length;
          
          // Outreach Stats
          const totalVisits = relevantOutreach.reduce((acc, s) => acc + (s.visitedMemberIds?.length || 0), 0);
          const completedSessions = relevantOutreach.filter(s => s.status === 'COMPLETED').length;

          // Prepare Prompt
          const prompt = `
            Act as a high-level executive consultant for a church organization. 
            Write a clear, simple, and professional executive summary report for the period of the last ${execTimeframe === '1M' ? 'Month' : execTimeframe === '3M' ? 'Quarter' : 'Year'}.
            
            Context:
            - Branch: ${activeChurch === 'CM' ? 'All Branches (Combined Ministry)' : activeChurch + ' Branch'}
            - Total Attendance Volume: ${totalAttendance}
            - Average Weekly Attendance: ${avgAttendance}
            - New Members Joined: ${newMembers}
            - Currently Active Members: ${activeMembers}
            - Outreach Sessions Completed: ${completedSessions}
            - Total Outreach Visits Made: ${totalVisits}

            Structure the report with these sections:
            1. **Executive Summary**: A brief 2-3 sentence overview of the health of the branch/ministry.
            2. **Attendance & Engagement**: Analysis of the attendance numbers. Are we growing?
            3. **People & Retention**: Insights on new members and active base.
            4. **Outreach Impact**: Evaluation of the outreach efforts (prayers, visits).
            5. **Strategic Recommendations**: 2-3 actionable bullet points for the next period.

            Tone: Professional, encouraging, data-driven, yet simple to understand. Avoid jargon.
          `;

          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
          });

          setExecReportContent(response.text || "Failed to generate report.");

      } catch (e) {
          console.error("AI Report Gen Error", e);
          setExecReportContent("Error generating report. Please try again.");
      } finally {
          setIsGeneratingExec(false);
      }
  };

  const handleCopyExecReport = () => {
    navigator.clipboard.writeText(execReportContent);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const renderExecutiveView = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Briefcase size={20}/> Executive Summary</h3>
                      <p className="text-slate-500 text-xs">AI-powered insights for leadership.</p>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                      {(['1M', '3M', '1Y'] as const).map(t => (
                          <button 
                            key={t} 
                            onClick={() => setExecTimeframe(t)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${execTimeframe === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              {t === '1M' ? 'Month' : t === '3M' ? 'Quarter' : 'Year'}
                          </button>
                      ))}
                  </div>
              </div>

              {!execReportContent && !isGeneratingExec ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Sparkles className="mx-auto text-indigo-300 mb-3" size={40} />
                      <h4 className="font-bold text-slate-700 mb-1">Ready to Generate</h4>
                      <p className="text-xs text-slate-400 mb-4">Create a high-level report for the last {execTimeframe === '1M' ? 'month' : execTimeframe === '3M' ? 'quarter' : 'year'}.</p>
                      <button 
                        onClick={generateExecutiveReport}
                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                      >
                          Generate Report
                      </button>
                  </div>
              ) : (
                  <div className="relative">
                      {isGeneratingExec && (
                          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                              <RefreshCw size={32} className="text-indigo-600 animate-spin mb-2"/>
                              <span className="text-xs font-bold text-indigo-600">Analyzing Data...</span>
                          </div>
                      )}
                      
                      <div className="relative">
                          <textarea 
                            value={execReportContent}
                            onChange={(e) => setExecReportContent(e.target.value)}
                            className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-sans text-sm text-slate-700 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                            placeholder="Report will appear here..."
                          />
                          <div className="absolute top-2 right-2 flex gap-1">
                              <button onClick={generateExecutiveReport} className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm border border-slate-100" title="Regenerate">
                                  <RefreshCw size={14}/>
                              </button>
                          </div>
                      </div>

                      <div className="flex gap-3 mt-4">
                          <button 
                              onClick={handleCopyExecReport}
                              className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${copiedReport ? 'bg-green-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                          >
                              {copiedReport ? <CheckCircle size={18}/> : <Copy size={18}/>}
                              {copiedReport ? 'Copied' : 'Copy Report'}
                          </button>
                          <button 
                              onClick={() => {
                                  const url = `mailto:?subject=Executive Report - ${activeChurch}&body=${encodeURIComponent(execReportContent)}`;
                                  window.open(url);
                              }}
                              className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
                          >
                              <ArrowRight size={18}/> Share via Email
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );

  // --- WhatsApp Report Logic ---
  const generateReport = () => {
    if (!selectedDate) return "Please select a date to generate a report.";

    const formattedDate = new Date(selectedDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // --- Helper to render list with Joy/Enlargement/Special split ---
    const renderListWithServices = (list: Member[], title: string, record: any) => {
        if (list.length === 0) return '';
        
        const getService = (id: string) => record?.serviceMap?.[id] || 'JOY';
        
        const joyAttendees = list.filter(m => getService(m.id) === 'JOY');
        const enlargementAttendees = list.filter(m => getService(m.id) === 'ENLARGEMENT');
        const specialAttendees = list.filter(m => getService(m.id) === 'SPECIAL');

        let section = `*${title} (${list.length})*\n`;
        
        if (joyAttendees.length > 0) {
            section += `_Joy Service:_\n`;
            joyAttendees.forEach((m, i) => section += `${i + 1}. ${m.name}\n`);
        }

        if (enlargementAttendees.length > 0) {
            if (joyAttendees.length > 0) section += `\n`; // Spacer
            section += `_Enlargement Service:_\n`;
            enlargementAttendees.forEach((m, i) => section += `${i + 1}. ${m.name}\n`);
        }

        if (specialAttendees.length > 0) {
            if (joyAttendees.length > 0 || enlargementAttendees.length > 0) section += `\n`; // Spacer
            section += `_Special Event:_\n`;
            specialAttendees.forEach((m, i) => section += `${i + 1}. ${m.name}\n`);
        }
        
        return section + `\n`;
    };

    // --- ADMIN GLOBAL REPORT (Figures + Names) ---
    if (activeChurch === 'CM') {
         // Check for special event name across records
         const eventName = data.attendance.find(r => r.date === selectedDate && r.eventName)?.eventName;
         let report = `*CM ATTENDANCE SUMMARY*\n${formattedDate}\n`;
         if (eventName) report += `*Event: ${eventName}*\n`;
         report += `----------------------------\n`;

         // Use dynamic church list + CM for summary
         const branches = [...availableChurches, 'CM'];
         let ministryTotal = 0;
         let totalTeachers = 0;

         branches.forEach(branch => {
             const record = data.attendance.find(r => r.date === selectedDate && r.churchId === branch);
             if (!record) {
                 return;
             }

             // Filter members present in this record
             const presentMembers = data.members.filter(m => record.presentMemberIds.includes(m.id));
             presentMembers.sort((a, b) => a.name.localeCompare(b.name));
             
             // Split Categories
             const staff = presentMembers.filter(m => ['Teacher','Helper','Volunteer'].includes(m.type));
             const children = presentMembers.filter(m => !['Teacher','Helper','Volunteer'].includes(m.type));

             const staffCount = staff.length;
             totalTeachers += staffCount;

             const membersCount = children.filter(m => m.type === MemberType.MEMBER).length;
             const fnfCount = children.filter(m => m.type === MemberType.FNF).length;
             const inconsistentCount = children.filter(m => m.type === MemberType.INCONSISTENT).length;
             const notMemberCount = children.filter(m => m.type === MemberType.NOT_MEMBER).length;

             const branchTotal = children.length;
             ministryTotal += branchTotal;

             if (branchTotal > 0 || staffCount > 0) {
                 report += `\n*${branch} CHURCH* (${branchTotal})\n`;
                 
                 if (branch === 'CM') {
                     report += `Staff Present: ${staffCount}\n`;
                     if (staffCount > 0) {
                         staff.forEach((m, i) => report += `${i + 1}. ${m.name}\n`);
                     }
                 } else {
                     const getService = (id: string) => record?.serviceMap?.[id] || 'JOY';
                     const totalJoy = children.filter(m => getService(m.id) === 'JOY').length;
                     const totalEnlargement = children.filter(m => getService(m.id) === 'ENLARGEMENT').length;
                     const totalSpecial = children.filter(m => getService(m.id) === 'SPECIAL').length;
                     
                     const splits = [];
                     if (totalJoy > 0) splits.push(`Joy: ${totalJoy}`);
                     if (totalEnlargement > 0) splits.push(`Enlargement: ${totalEnlargement}`);
                     if (totalSpecial > 0) splits.push(`Special: ${totalSpecial}`);
                     
                     if (splits.length > 0) {
                         report += `(${splits.join(' | ')})\n\n`;
                     } else {
                         report += `\n`;
                     }

                     // Render lists
                     const members = children.filter(m => m.type === MemberType.MEMBER);
                     const fnfs = children.filter(m => m.type === MemberType.FNF);
                     const inconsistent = children.filter(m => m.type === MemberType.INCONSISTENT);
                     const notMembers = children.filter(m => m.type === MemberType.NOT_MEMBER);

                     if (members.length > 0) report += renderListWithServices(members, 'MEMBERS', record);
                     else report += `*MEMBERS (0)*\n_None_\n\n`;

                     if (fnfs.length > 0) report += renderListWithServices(fnfs, 'FNF', record);
                     if (inconsistent.length > 0) report += renderListWithServices(inconsistent, 'INCONSISTENT', record);
                     if (notMembers.length > 0) report += renderListWithServices(notMembers, 'NOT A MEMBER', record);
                     
                     if (staffCount > 0) {
                         report += `*STAFF (${staffCount})*\n`;
                         staff.forEach((m, i) => report += `${i + 1}. ${m.name}\n`);
                         report += `\n`;
                     }
                 }
             }
         });

         report += `\n----------------------------\n`;
         report += `*GRAND TOTAL: ${ministryTotal}*\n`;
         report += `*TOTAL TEACHERS: ${totalTeachers}*\n`;
         
         if (ministryTotal === 0 && totalTeachers === 0) {
             report += `\n_No attendance data recorded yet for this date._`;
         }

         return report;
    }

    // --- SINGLE BRANCH REPORT (Names included with Service Split) ---
    const record = data.attendance.find(r => r.date === selectedDate && r.churchId === activeChurch);
    if (!record) return `No attendance data recorded for ${selectedDate} in ${activeChurch} Church.`;

    const presentMembers = record ? data.members.filter(m => record.presentMemberIds.includes(m.id)) : [];
    
    // Sort alphabetically
    presentMembers.sort((a, b) => a.name.localeCompare(b.name));

    const teachers = presentMembers.filter(m => m.type === MemberType.TEACHER);
    
    // Helper to get service
    const getService = (id: string) => record?.serviceMap?.[id] || 'JOY'; // Default to Joy if legacy

    // Punctual Lists
    const punctualIds = record?.punctualMemberIds || [];
    const joyPunctual = punctualIds.filter(id => getService(id) === 'JOY').map(id => data.members.find(m => m.id === id)).filter(Boolean);
    const enlargePunctual = punctualIds.filter(id => getService(id) === 'ENLARGEMENT').map(id => data.members.find(m => m.id === id)).filter(Boolean);

    // Accounting count: Everyone excluding teachers
    const allChildren = presentMembers.filter(m => !['Teacher', 'Helper', 'Volunteer'].includes(m.type));
    const totalCount = allChildren.length;
    
    // Calculate Split
    const totalJoy = allChildren.filter(m => getService(m.id) === 'JOY').length;
    const totalEnlargement = allChildren.filter(m => getService(m.id) === 'ENLARGEMENT').length;
    const totalSpecial = allChildren.filter(m => getService(m.id) === 'SPECIAL').length;

    let report = `*${activeChurch} CHURCH ATTENDANCE REPORT*\n${formattedDate}\n`;
    if (record.eventName) report += `*Event: ${record.eventName}*\n`;
    report += `------------------\n`;
    report += `*TOTAL PRESENT: ${totalCount}*\n`;
    
    const splits = [];
    if (totalJoy > 0) splits.push(`Joy: ${totalJoy}`);
    if (totalEnlargement > 0) splits.push(`Enlargement: ${totalEnlargement}`);
    if (totalSpecial > 0) splits.push(`Special: ${totalSpecial}`);
    
    if (splits.length > 0) {
        report += `(${splits.join(' | ')})\n\n`;
    } else {
        report += `\n`;
    }

    // Filter categories
    const members = allChildren.filter(m => m.type === MemberType.MEMBER);
    const fnfs = allChildren.filter(m => m.type === MemberType.FNF);
    const inconsistent = allChildren.filter(m => m.type === MemberType.INCONSISTENT);
    const notMembers = allChildren.filter(m => m.type === MemberType.NOT_MEMBER);

    if (members.length > 0) report += renderListWithServices(members, 'MEMBERS', record);
    else report += `*MEMBERS (0)*\n_None_\n\n`;

    if (fnfs.length > 0) report += renderListWithServices(fnfs, 'FNF', record);
    if (inconsistent.length > 0) report += renderListWithServices(inconsistent, 'INCONSISTENT', record);
    if (notMembers.length > 0) report += renderListWithServices(notMembers, 'NOT A MEMBER', record);

    return report;
  };

  const handleCopyReport = () => {
    const text = generateReport();
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleOpenWhatsApp = () => {
      const text = generateReport();
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `cm_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
            const result = importData(content);
            if (result.success) {
                setImportMsg({ type: 'success', text: result.message });
                onUpdate();
            } else {
                setImportMsg({ type: 'error', text: result.message });
            }
            setTimeout(() => setImportMsg(null), 3000);
        }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Render Functions ---

  const renderKPIView = () => (
      <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-lg">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Target size={24}/> Ministry Targets</h3>
              <p className="text-slate-300 text-sm mb-4">Set growth goals for each branch.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {kpiStats.map(stat => (
                      <div key={stat.church} className="bg-white/10 rounded-xl p-4 border border-white/10">
                          <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-lg">{stat.church}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${stat.population >= stat.target ? 'bg-green-500 text-white' : 'bg-white/20 text-slate-300'}`}>
                                  {stat.target > 0 ? Math.round((stat.population / stat.target) * 100) : 0}%
                              </span>
                          </div>
                          <div className="text-2xl font-bold">{stat.population} <span className="text-sm text-slate-400 font-normal">/ {stat.target}</span></div>
                          <div className="w-full bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full" style={{width: `${Math.min(100, (stat.population / (stat.target || 1)) * 100)}%`}}></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {isAdmin && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={18}/> Edit Targets</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {availableChurches.map(c => (
                          <div key={c}>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{c} Target</label>
                              <input 
                                type="number" 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                                value={editTargets[c] || 0}
                                onChange={(e) => setEditTargets({...editTargets, [c]: parseInt(e.target.value) || 0})}
                              />
                          </div>
                      ))}
                  </div>
                  <button onClick={handleSaveTargets} className="mt-4 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                      <Save size={18}/> Save New Targets
                  </button>
              </div>
          )}
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
        
        {/* Header Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Reports & Insights</h2>
                    <p className="text-slate-500 font-medium">Generate updates and manage system data.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                    {[
                        { id: 'WHATSAPP', icon: MessageCircle, label: 'Report' },
                        { id: 'KPI', icon: Target, label: 'KPIs' },
                        { id: 'EXECUTIVE', icon: Briefcase, label: 'Executive' },
                        { id: 'DATA', icon: Database, label: 'Data' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <tab.icon size={16}/> <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Notification Area */}
            {importMsg && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${importMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {importMsg.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                    <span className="font-bold text-sm">{importMsg.text}</span>
                </div>
            )}

            {/* TAB CONTENT */}
            
            {/* 1. WHATSAPP REPORT */}
            {activeTab === 'WHATSAPP' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Report Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <select 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {availableDates.map(d => {
                                    const record = data.attendance.find(r => r.date === d && r.churchId === activeChurch);
                                    const label = record?.eventName ? `${formatDateDDMMYYYY(d)} - ${record.eventName}` : formatDateDDMMYYYY(d);
                                    return (
                                        <option key={d} value={d}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 font-mono text-xs text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto mb-6 shadow-inner">
                        {generateReport()}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleCopyReport}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${copiedReport ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                        >
                            {copiedReport ? <CheckCircle size={18}/> : <Copy size={18}/>}
                            {copiedReport ? 'Copied!' : 'Copy Text'}
                        </button>
                        <button 
                            onClick={handleOpenWhatsApp}
                            className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#20bd5a] shadow-lg shadow-green-100 transition-all active:scale-95"
                        >
                            <MessageCircle size={18}/> WhatsApp
                        </button>
                    </div>
                </div>
            )}

            {/* 2. KPI VIEW */}
            {activeTab === 'KPI' && renderKPIView()}

            {/* 3. EXECUTIVE VIEW */}
            {activeTab === 'EXECUTIVE' && renderExecutiveView()}

            {/* 4. DATA MANAGEMENT */}
            {activeTab === 'DATA' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <button 
                        onClick={handleDownloadBackup}
                        className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform"><Download size={20}/></div>
                            <div className="text-left">
                                <h4 className="font-bold text-slate-800">Backup Data</h4>
                                <p className="text-xs text-slate-500">Download JSON file</p>
                            </div>
                        </div>
                        <ArrowRight size={18} className="text-slate-300 group-hover:text-indigo-600"/>
                    </button>

                    <div className="relative group">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".json"
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform"><Upload size={20}/></div>
                                <div className="text-left">
                                    <h4 className="font-bold text-slate-800">Restore Data</h4>
                                    <p className="text-xs text-slate-500">Upload backup file</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-slate-300 group-hover:text-indigo-600"/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default ReportExport;