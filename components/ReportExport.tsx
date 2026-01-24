import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, MemberType, Church, Member, MemberStatus } from '../types';
import { Copy, FileText, CheckCircle, Database, Download, Upload, AlertCircle, RefreshCw, Cloud, Lock, Code, MessageCircle, BookOpen, Compass, GitBranch, ArrowRight, ChevronDown, Calendar, Target, TrendingUp, Save } from 'lucide-react';
import { getSundaysInYear, DEFAULT_CLOUD_CONFIG } from '../constants';
import { importData, saveCloudConfig, syncFromCloud, updateTargets } from '../services/storageService';

interface ReportExportProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const ReportExport: React.FC<ReportExportProps> = ({ data, onUpdate, activeChurch, currentUser }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'KPI' | 'DATA' | 'CLOUD' | 'HELP'>('WHATSAPP');
  const [importMsg, setImportMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // KPI/Target Edit State
  const [editTargets, setEditTargets] = useState<Record<string, number>>(data.targets || { UJ: 0, I: 0, K: 0, LJ: 0 });
  
  // Cloud Sync State
  const [apiKey, setApiKey] = useState(DEFAULT_CLOUD_CONFIG.apiKey || '');
  const [binId, setBinId] = useState(DEFAULT_CLOUD_CONFIG.binId || '');
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');
  
  const isHardcoded = !!(DEFAULT_CLOUD_CONFIG.apiKey && DEFAULT_CLOUD_CONFIG.binId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sundays2026 = getSundaysInYear(2026);
  const isAdmin = currentUser.role === 'ADMIN';

  // Auto-sync on mount to ensure report data is fresh from cloud
  useEffect(() => {
    const initSync = async () => {
        const savedConfig = localStorage.getItem('UJ_CLOUD_CONFIG_V1');
        const config = savedConfig ? JSON.parse(savedConfig) : null;
        const shouldSync = (config && config.enabled) || isHardcoded;

        if (shouldSync) {
            setIsRefreshing(true);
            try {
                const result = await syncFromCloud();
                if (result.success && result.message?.includes('New data')) {
                    onUpdate();
                    setImportMsg({ type: 'success', text: 'Report updated with latest cloud data' });
                    setTimeout(() => setImportMsg(null), 3000);
                }
            } catch (e) {
                console.error("Auto-sync failed", e);
            } finally {
                setIsRefreshing(false);
            }
        }
    };
    initSync();
  }, []);

  useEffect(() => {
    if (!selectedDate && sundays2026.length > 0) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const currentSunday = new Date(today);
        currentSunday.setDate(today.getDate() - dayOfWeek);
        const currentSundayStr = currentSunday.toISOString().split('T')[0];
        
        // Use current Sunday if in list, otherwise default to first in list (fallback)
        const exists = sundays2026.some(d => d.toISOString().split('T')[0] === currentSundayStr);
        if (exists) {
            setSelectedDate(currentSundayStr);
        } else {
            setSelectedDate(sundays2026[0].toISOString().split('T')[0]);
        }
    }
    
    // Load existing config
    const savedConfig = localStorage.getItem('UJ_CLOUD_CONFIG_V1');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (!isHardcoded) {
            setApiKey(config.apiKey);
            setBinId(config.binId);
        }
        setIsCloudEnabled(config.enabled);
    } else if (isHardcoded) {
        setIsCloudEnabled(true);
    }
  }, [sundays2026, selectedDate, isHardcoded]);

  // Update edit targets when data changes
  useEffect(() => {
      if (data.targets) {
          setEditTargets(data.targets);
      }
  }, [data.targets]);

  // --- KPI Calculation Logic ---
  const kpiStats = useMemo(() => {
    if (!isAdmin) return [];
    
    return (['UJ', 'I', 'K', 'LJ'] as Church[]).map(church => {
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
  }, [data, editTargets, isAdmin]);

  const handleSaveTargets = () => {
    updateTargets(editTargets);
    setImportMsg({ type: 'success', text: 'Targets updated successfully!' });
    setTimeout(() => setImportMsg(null), 3000);
    onUpdate();
  };

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      const result = await syncFromCloud();
      if (result.success) {
          onUpdate();
          setImportMsg({ type: 'success', text: 'Data refreshed' });
      } else {
          setImportMsg({ type: 'error', text: 'Sync failed' });
      }
      setTimeout(() => setImportMsg(null), 2000);
      setIsRefreshing(false);
  };

  // --- WhatsApp Report Logic ---
  const generateReport = () => {
    if (!selectedDate) return "Please select a date to generate a report.";

    const formattedDate = new Date(selectedDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // --- ADMIN GLOBAL REPORT (Figures Only) ---
    if (activeChurch === 'CM') {
         let report = `*CM ATTENDANCE SUMMARY*\n${formattedDate}\n`;
         report += `----------------------------\n`;

         // Added CM and All to the report loop to capture staff assigned to them
         const branches: Church[] = ['UJ', 'I', 'K', 'LJ', 'CM', 'All'];
         let ministryTotal = 0;
         let totalTeachers = 0;

         branches.forEach(branch => {
             const record = data.attendance.find(r => r.date === selectedDate && r.churchId === branch);
             if (!record) {
                 return;
             }

             // Filter members present in this record
             const presentMembers = data.members.filter(m => record.presentMemberIds.includes(m.id));
             
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
                 if (branchTotal > 0) {
                     report += `Members: ${membersCount} | FNF: ${fnfCount}\n`;
                 }
                 
                 const others = [];
                 if (inconsistentCount > 0) others.push(`Inc: ${inconsistentCount}`);
                 if (notMemberCount > 0) others.push(`Other: ${notMemberCount}`);
                 if (staffCount > 0) others.push(`Staff: ${staffCount}`);
                 
                 if (others.length > 0) {
                    report += `   • ${others.join(' | ')}\n`;
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

    // --- SINGLE BRANCH REPORT (Names included) ---
    const record = data.attendance.find(r => r.date === selectedDate && r.churchId === activeChurch);
    if (!record) return `No attendance data recorded for ${selectedDate} in ${activeChurch} Church.`;

    const presentMembers = data.members.filter(m => record.presentMemberIds.includes(m.id));
    
    // Sort alphabetically
    presentMembers.sort((a, b) => a.name.localeCompare(b.name));

    const teachers = presentMembers.filter(m => m.type === MemberType.TEACHER);
    const members = presentMembers.filter(m => m.type === MemberType.MEMBER);
    const fnfs = presentMembers.filter(m => m.type === MemberType.FNF);
    const inconsistent = presentMembers.filter(m => m.type === MemberType.INCONSISTENT);
    const notMembers = presentMembers.filter(m => m.type === MemberType.NOT_MEMBER);
    
    // Accounting count: Everyone excluding teachers
    const accountingCount = presentMembers.length - teachers.length;

    let report = `*${activeChurch} CHURCH ATTENDANCE REPORT*\n${formattedDate}\n`;
    report += `------------------\n`;
    report += `Total Present: ${accountingCount}\n\n`;

    report += `*MEMBERS (${members.length})*\n`;
    if (members.length > 0) {
      members.forEach((m, idx) => {
        report += `${idx + 1}. ${m.name}\n`;
      });
    } else {
      report += `_None_\n`;
    }

    if (fnfs.length > 0) {
        report += `\n*FNF (${fnfs.length})*\n`;
        fnfs.forEach((m, idx) => {
          report += `${idx + 1}. ${m.name}\n`;
        });
    }

    if (inconsistent.length > 0) {
        report += `\n*INCONSISTENT (${inconsistent.length})*\n`;
        inconsistent.forEach((m, idx) => {
          report += `${idx + 1}. ${m.name}\n`;
        });
    }

    if (notMembers.length > 0) {
        report += `\n*NOT A MEMBER (${notMembers.length})*\n`;
        notMembers.forEach((m, idx) => {
          report += `${idx + 1}. ${m.name}\n`;
        });
    }

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

  // --- Data Management Logic ---

  const handleDownloadBackup = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `church_attendance_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = importData(content);
      if (result.success) {
        setImportMsg({ type: 'success', text: result.message });
        onUpdate(); // Refresh app with new data
      } else {
        setImportMsg({ type: 'error', text: result.message });
      }
      setTimeout(() => setImportMsg(null), 3000);
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  
  const handleSaveCloudConfig = async () => {
      if (!apiKey || !binId) {
          setCloudMsg('Please enter both API Key and Bin ID');
          return;
      }
      
      saveCloudConfig({
          enabled: true,
          apiKey,
          binId,
          url: 'https://api.jsonbin.io/v3/b'
      });
      setIsCloudEnabled(true);
      setCloudMsg('Connecting...');
      
      const result = await syncFromCloud();
      if (result.success) {
          setCloudMsg('Connected! Data synchronized.');
          onUpdate();
      } else {
          setCloudMsg('Connection failed. Check credentials.');
      }
  };

  const handleDisableCloud = () => {
      saveCloudConfig({
          enabled: false,
          apiKey: '',
          binId: '',
          url: ''
      });
      setIsCloudEnabled(false);
      if (!isHardcoded) {
          setApiKey('');
          setBinId('');
      }
      setCloudMsg('Cloud sync disabled.');
  };

  const reportText = generateReport();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Tabs */}
      <div className="flex space-x-2 md:space-x-4 border-b border-gray-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('WHATSAPP')}
          className={`pb-2 px-3 md:px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap outline-none ${activeTab === 'WHATSAPP' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          <span className="flex items-center gap-2"><FileText size={16}/> Report</span>
        </button>
        {isAdmin && (
            <button
            onClick={() => setActiveTab('KPI')}
            className={`pb-2 px-3 md:px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap outline-none ${activeTab === 'KPI' ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
            <span className="flex items-center gap-2"><Target size={16}/> Targets & KPI</span>
            </button>
        )}
        <button
          onClick={() => setActiveTab('DATA')}
          className={`pb-2 px-3 md:px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap outline-none ${activeTab === 'DATA' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          <span className="flex items-center gap-2"><Database size={16}/> Backup</span>
        </button>
        {isAdmin && (
            <button
            onClick={() => setActiveTab('CLOUD')}
            className={`pb-2 px-3 md:px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap outline-none ${activeTab === 'CLOUD' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
            <span className="flex items-center gap-2"><Cloud size={16}/> Cloud</span>
            </button>
        )}
        <button
          onClick={() => setActiveTab('HELP')}
          className={`pb-2 px-3 md:px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap outline-none ${activeTab === 'HELP' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          <span className="flex items-center gap-2"><BookOpen size={16}/> Guide</span>
        </button>
      </div>

      {activeTab === 'WHATSAPP' && (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-left-2 relative">
          
          {importMsg && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                 <CheckCircle size={16} /> {importMsg.text}
             </div>
          )}

          {/* Header & Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
             <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    Export Report
                </h2>
                <p className="text-xs text-gray-500 mt-1">{activeChurch === 'CM' ? 'Global Ministry Summary' : `${activeChurch} Church Detailed Report`}</p>
             </div>
             
             {/* Action Buttons - Moved to top for Mobile */}
             <div className="flex gap-2 w-full md:w-auto">
                <button
                    onClick={handleOpenWhatsApp}
                    className="flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm transition-all font-bold bg-[#25D366] text-white hover:bg-[#128C7E] active:scale-95 text-sm"
                >
                    <MessageCircle size={18} /> Share
                </button>
                <button
                    onClick={handleCopyReport}
                    className={`
                    flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm transition-all font-bold active:scale-95 text-sm
                    ${copiedReport ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}
                    `}
                >
                    {copiedReport ? <><CheckCircle size={18} /> Copied</> : <><Copy size={18} /> Copy</>}
                </button>
             </div>
          </div>
          
          {/* Date Selector */}
          <div className="mb-4 flex gap-2">
             <div className="relative flex-1">
                 <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <Calendar size={18} />
                 </div>
                 <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                 </div>
                 <select 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block w-full pl-10 pr-10 p-3.5 appearance-none transition-shadow cursor-pointer"
                >
                  <option value="">-- Select Date --</option>
                  {sundays2026.map(d => {
                    const strDate = d.toISOString().split('T')[0];
                    const hasData = activeChurch === 'CM' 
                        ? data.attendance.some(r => r.date === strDate)
                        : data.attendance.some(r => r.date === strDate && r.churchId === activeChurch);
                    
                    return <option key={strDate} value={strDate}>{hasData ? '✅ ' : '⚪ '} {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</option>
                  })}
                </select>
             </div>
             
             {/* Manual Refresh Button */}
             <button 
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-3.5 bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
                title="Refresh Cloud Data"
             >
                 <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
             </button>
          </div>

          {/* Report Preview */}
          <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-inner">
            <textarea
                readOnly
                value={reportText}
                className="w-full h-[60vh] md:h-96 p-4 bg-gray-50/50 font-mono text-xs md:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
            />
          </div>
        </div>
      )}

      {activeTab === 'KPI' && isAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in">
              <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><Target size={20} className="text-rose-500"/> Membership Targets</h3>
                    <p className="text-sm text-gray-500">Set population goals (Active Members + FNF) for the current year.</p>
                  </div>
                  <button onClick={handleSaveTargets} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm active:scale-95">
                      <Save size={16}/> Save Targets
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {kpiStats.map(stat => (
                      <div key={stat.church} className="border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow relative overflow-hidden bg-white">
                          <div className={`absolute top-0 right-0 p-2 rounded-bl-2xl text-xs font-bold text-white
                            ${stat.church === 'UJ' ? 'bg-indigo-600' : 
                              stat.church === 'I' ? 'bg-emerald-500' :
                              stat.church === 'K' ? 'bg-rose-500' : 'bg-amber-500'}
                          `}>
                              {stat.church} Church
                          </div>

                          <div className="mt-4 flex flex-col gap-4">
                              <div className="flex justify-between items-end">
                                  <div>
                                      <p className="text-xs text-gray-400 font-bold uppercase">Current Members</p>
                                      <p className="text-3xl font-bold text-gray-800">{stat.population}</p>
                                      <p className="text-[10px] text-gray-400">Active + FNF</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-xs text-gray-400 font-bold uppercase">Avg (5 Wks)</p>
                                      <p className="text-xl font-bold text-gray-600">{stat.avg}</p>
                                  </div>
                              </div>
                              
                              <div>
                                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                      <span>Goal Progress</span>
                                      <span>{stat.target > 0 ? Math.round((stat.population/stat.target)*100) : 0}%</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                      <div className={`h-full rounded-full ${stat.church === 'UJ' ? 'bg-indigo-500' : stat.church === 'I' ? 'bg-emerald-500' : stat.church === 'K' ? 'bg-rose-500' : 'bg-amber-500'}`} style={{width: `${Math.min(100, (stat.population/(stat.target || 1))*100)}%`}}></div>
                                  </div>
                              </div>

                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Count</label>
                                  <input 
                                      type="number" 
                                      className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={editTargets[stat.church]}
                                      onChange={(e) => setEditTargets({...editTargets, [stat.church]: parseInt(e.target.value) || 0})}
                                  />
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
              
              {importMsg && (
                  <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
                      <CheckCircle size={18} className="text-green-400" />
                      <span className="font-bold">{importMsg.text}</span>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'HELP' && (
         <div className="space-y-8 animate-in fade-in">
             <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden">
                 <div className="relative z-10">
                     <h2 className="text-3xl font-bold mb-2">System Guide</h2>
                     <p className="text-indigo-100 max-w-lg">A comprehensive overview of the Children's Ministry Attendance System, designed for transparency and operational excellence.</p>
                 </div>
                 <BookOpen className="absolute -bottom-6 -right-6 text-white opacity-10" size={160} />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                         <Compass className="text-indigo-600" /> Core Modules
                     </h3>
                     <ul className="space-y-4">
                         <li>
                             <strong className="block text-gray-900 text-sm">Dashboard</strong>
                             <p className="text-xs text-gray-500 mt-1">
                                 The health monitor of the ministry. It displays real-time attendance percentages, growth trends, and retention rates. 
                                 <span className="block mt-1 text-indigo-600">Metric: Average Attendance over last 5 weeks.</span>
                             </p>
                         </li>
                         <li>
                             <strong className="block text-gray-900 text-sm">Attendance Taker</strong>
                             <p className="text-xs text-gray-500 mt-1">
                                 A streamlined interface for Sunday operations. Tap names to mark present. Toggle "Punctuality" (Trophy icon) to gamify early arrivals.
                             </p>
                         </li>
                         <li>
                             <strong className="block text-gray-900 text-sm">People Hub</strong>
                             <p className="text-xs text-gray-500 mt-1">
                                 The central CRM. Add new members, manage "Friends & Family" (FNF), and archive inactive records. Teachers have read-only access to specific branches.
                             </p>
                         </li>
                     </ul>
                 </div>

                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                         <GitBranch className="text-purple-600" /> Automation Logic
                     </h3>
                     <p className="text-xs text-gray-500 mb-4">The system performs several background tasks every time data is saved to keep the registry clean.</p>
                     
                     <div className="space-y-3">
                         <div className="p-3 bg-purple-50 rounded-xl">
                             <span className="text-xs font-bold text-purple-700 uppercase">Auto-Promotion</span>
                             <p className="text-xs text-gray-600 mt-1">
                                 Kids are automatically moved between branches based on Date of Birth.
                                 <br/>• Age 0-1 → I Church
                                 <br/>• Age 2-5 → K Church
                                 <br/>• Age 6-8 → LJ Church
                                 <br/>• Age 9-13 → UJ Church
                             </p>
                         </div>
                         <div className="p-3 bg-red-50 rounded-xl">
                             <span className="text-xs font-bold text-red-700 uppercase">Retention Logic</span>
                             <p className="text-xs text-gray-600 mt-1">
                                 If a member is absent for <strong>10 consecutive weeks</strong>, they are automatically demoted to "Inconsistent".
                                 Conversely, if an "Inconsistent" member attends <strong>7 weeks</strong> in a row, they are restored to "Active".
                             </p>
                         </div>
                     </div>
                 </div>
             </div>
         </div>
      )}

      {activeTab === 'CLOUD' && isAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><Cloud size={20} className="text-blue-500"/> Seamless Cloud Sync</h3>
                <p className="text-sm text-gray-500">
                  Connect to a shared JSON storage (like JSONBin.io) to automatically sync data between all users. 
                  <span className="block mt-1 font-medium text-amber-600 flex items-center gap-1"><Lock size={12}/> Admin Only Area</span>
                </p>
              </div>

              {isCloudEnabled ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <CheckCircle size={32} />
                      </div>
                      <h4 className="text-xl font-bold text-green-800 mb-2">Sync Active</h4>
                      <p className="text-green-700 mb-6">Your app is automatically syncing with the cloud.</p>
                      
                      <div className="flex gap-4 justify-center">
                          <button onClick={async () => { setCloudMsg('Syncing...'); await syncFromCloud(); onUpdate(); setCloudMsg('Synced!'); }} className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg font-medium hover:bg-green-100 flex items-center gap-2 shadow-sm">
                              <RefreshCw size={16}/> Sync Now
                          </button>
                          <button onClick={handleDisableCloud} className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-100 shadow-sm">
                              Disable Sync
                          </button>
                      </div>
                      <p className="mt-4 text-xs text-green-600 font-medium">{cloudMsg}</p>
                  </div>
              ) : (
                  <div className="space-y-4 max-w-md mx-auto">
                      {isHardcoded && (
                          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg flex items-center gap-2 text-sm mb-4">
                              <Code size={16}/>
                              <span>Keys loaded from <strong>constants.ts</strong></span>
                          </div>
                      )}

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">X-Master-Key (API Key)</label>
                          <input 
                            type="password" 
                            className="w-full p-3 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400" 
                            placeholder="$2a$10$..." 
                            value={apiKey} 
                            onChange={e => setApiKey(e.target.value)}
                            disabled={isHardcoded}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Bin ID</label>
                          <input 
                            type="text" 
                            className="w-full p-3 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400" 
                            placeholder="678..." 
                            value={binId} 
                            onChange={e => setBinId(e.target.value)}
                            disabled={isHardcoded}
                          />
                      </div>
                      {!isHardcoded && (
                          <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 mb-4 border border-blue-100">
                              <p><strong>Instructions:</strong></p>
                              <ol className="list-decimal ml-4 space-y-1 mt-1 text-blue-800">
                                  <li>Create a free account on <a href="https://jsonbin.io" target="_blank" className="underline font-bold">JSONBin.io</a>.</li>
                                  <li>Create a new public/private bin with `{}` inside. Copy the <strong>Bin ID</strong>.</li>
                                  <li>Go to API Keys, copy the <strong>Master Key</strong>.</li>
                                  <li>Paste them above and click Connect.</li>
                              </ol>
                          </div>
                      )}
                      <button 
                        onClick={handleSaveCloudConfig}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
                      >
                        Connect & Sync
                      </button>
                      {cloudMsg && <p className="text-center text-sm text-red-500 mt-2 font-medium bg-red-50 py-2 rounded-lg">{cloudMsg}</p>}
                  </div>
              )}
          </div>
      )}

      {activeTab === 'DATA' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-2">
          
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><Database size={20}/> Manual Backup</h3>
            <p className="text-sm text-gray-500">
              Legacy method: Download a file to transfer data manually if Cloud Sync is unavailable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Backup Section */}
            <div className="border border-indigo-100 bg-indigo-50 p-6 rounded-2xl flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Download size={24} />
              </div>
              <h4 className="font-bold text-gray-800 mb-2">Backup File</h4>
              <p className="text-xs text-gray-500 mb-6">
                Download a JSON file containing all members and attendance records.
              </p>
              <button 
                onClick={handleDownloadBackup}
                className="mt-auto w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Download size={18} /> Download
              </button>
            </div>

            {/* Restore Section */}
            <div className="border border-amber-100 bg-amber-50 p-6 rounded-2xl flex flex-col items-center text-center relative hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Upload size={24} />
              </div>
              <h4 className="font-bold text-gray-800 mb-2">Restore File</h4>
              <p className="text-xs text-gray-500 mb-6">
                Upload a JSON backup file to overwrite current data.
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="mt-auto w-full py-3 bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Upload size={18} /> Upload
              </button>

              {importMsg && (
                <div className={`absolute bottom-2 left-0 right-0 mx-4 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-sm
                  ${importMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                `}>
                  {importMsg.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                  {importMsg.text}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ReportExport;