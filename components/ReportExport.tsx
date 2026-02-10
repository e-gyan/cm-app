import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, MemberType, Church, Member, MemberStatus, ServiceType } from '../types';
import { Copy, FileText, CheckCircle, Database, Download, Upload, AlertCircle, RefreshCw, Cloud, Lock, Code, MessageCircle, BookOpen, Compass, GitBranch, ArrowRight, ChevronDown, Calendar, Target, TrendingUp, Save } from 'lucide-react';
import { getSundaysInYear, DEFAULT_CLOUD_CONFIG } from '../constants';
import { importData, saveCloudConfig, syncFromCloud, updateTargets } from '../services/storageService';

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
                 
                 if (branch === 'CM') {
                     report += `Staff Present: ${staffCount}\n`;
                 } else {
                     if (branchTotal > 0) {
                         report += `Members: ${membersCount} | FNF: ${fnfCount}\n`;
                     }
                     
                     const others = [];
                     if (inconsistentCount > 0) others.push(`Inc: ${inconsistentCount}`);
                     if (notMemberCount > 0) others.push(`Other: ${notMemberCount}`);
                     
                     if (others.length > 0) {
                        report += `   • ${others.join(' | ')}\n`;
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

    let report = `*${activeChurch} CHURCH ATTENDANCE REPORT*\n${formattedDate}\n`;
    report += `------------------\n`;
    report += `*TOTAL PRESENT: ${totalCount}*\n`;
    if (totalJoy > 0 || totalEnlargement > 0) {
        report += `(Joy: ${totalJoy} | Enlargement: ${totalEnlargement})\n\n`;
    } else {
        report += `\n`;
    }

    // --- Helper to render list with Joy/Enlargement split ---
    const renderListWithServices = (list: Member[], title: string) => {
        if (list.length === 0) return '';
        
        const joyAttendees = list.filter(m => getService(m.id) === 'JOY');
        const enlargementAttendees = list.filter(m => getService(m.id) === 'ENLARGEMENT');

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
        
        return section + `\n`;
    };

    // Filter categories
    const members = allChildren.filter(m => m.type === MemberType.MEMBER);
    const fnfs = allChildren.filter(m => m.type === MemberType.FNF);
    const inconsistent = allChildren.filter(m => m.type === MemberType.INCONSISTENT);
    const notMembers = allChildren.filter(m => m.type === MemberType.NOT_MEMBER);

    if (members.length > 0) report += renderListWithServices(members, 'MEMBERS');
    else report += `*MEMBERS (0)*\n_None_\n\n`;

    if (fnfs.length > 0) report += renderListWithServices(fnfs, 'FNF');
    if (inconsistent.length > 0) report += renderListWithServices(inconsistent, 'INCONSISTENT');
    if (notMembers.length > 0) report += renderListWithServices(notMembers, 'NOT A MEMBER');

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
                      {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(c => (
                          <div key={c}>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{c} Target</label>
                              <input 
                                type="number" 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                                value={editTargets[c]}
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
                        { id: 'DATA', icon: Database, label: 'Data' },
                        { id: 'CLOUD', icon: Cloud, label: 'Sync' }
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
                                {sundays2026.map(d => (
                                    <option key={d.toISOString()} value={d.toISOString().split('T')[0]}>
                                        {formatDateDDMMYYYY(d.toISOString().split('T')[0])}
                                    </option>
                                ))}
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

            {/* 3. DATA MANAGEMENT */}
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

            {/* 4. CLOUD CONFIG */}
            {activeTab === 'CLOUD' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    {isHardcoded ? (
                        <div className="p-6 bg-green-50 border border-green-100 rounded-2xl text-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Lock size={24}/>
                            </div>
                            <h3 className="font-bold text-green-800 mb-1">Managed Cloud Config</h3>
                            <p className="text-xs text-green-700 opacity-80 mb-4">Your cloud settings are securely managed by the application code.</p>
                            <button 
                                onClick={handleManualRefresh}
                                disabled={isRefreshing}
                                className="px-6 py-2 bg-white text-green-700 font-bold rounded-lg shadow-sm border border-green-200 text-sm flex items-center justify-center gap-2 mx-auto hover:bg-green-50"
                            >
                                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/>
                                {isRefreshing ? 'Syncing...' : 'Test Connection'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Master Key</label>
                                <input 
                                    type="password" 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder="$2b$10$..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bin ID</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                                    value={binId}
                                    onChange={e => setBinId(e.target.value)}
                                    placeholder="65a..."
                                />
                            </div>
                            {cloudMsg && <p className="text-xs text-red-500 font-bold">{cloudMsg}</p>}
                            <div className="flex gap-2 mt-4">
                                <button 
                                    onClick={() => handleSaveCloudConfig()}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                                >
                                    Save Config
                                </button>
                                {isCloudEnabled && (
                                    <button 
                                        onClick={handleManualRefresh}
                                        className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                                        disabled={isRefreshing}
                                    >
                                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
  
  // Helper for saving cloud config (defined inside render but better if extracted or properly typed above)
  async function handleSaveCloudConfig() {
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
      setCloudMsg('');
      setImportMsg({ type: 'success', text: 'Cloud configured successfully!' });
      
      setIsRefreshing(true);
      await syncFromCloud();
      setIsRefreshing(false);
      onUpdate();
      
      setTimeout(() => setImportMsg(null), 3000);
  }
};

export default ReportExport;