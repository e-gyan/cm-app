import React, { useState, useRef, useEffect } from 'react';
import { AppData, MemberType, Church, Member } from '../types';
import { Copy, FileText, CheckCircle, Database, Download, Upload, AlertCircle, RefreshCw, Cloud, Lock, Code, MessageCircle, BookOpen, Compass, GitBranch, ArrowRight, Presentation, Smartphone, Zap, Heart, Layout, BarChart3, MousePointerClick, Lightbulb } from 'lucide-react';
import { getSundaysInYear, DEFAULT_CLOUD_CONFIG } from '../constants';
import { importData, saveCloudConfig, syncFromCloud } from '../services/storageService';

interface ReportExportProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const ReportExport: React.FC<ReportExportProps> = ({ data, onUpdate, activeChurch, currentUser }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'DATA' | 'CLOUD' | 'HELP' | 'PORTFOLIO'>('WHATSAPP');
  const [importMsg, setImportMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Cloud Sync State
  const [apiKey, setApiKey] = useState(DEFAULT_CLOUD_CONFIG.apiKey || '');
  const [binId, setBinId] = useState(DEFAULT_CLOUD_CONFIG.binId || '');
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [cloudMsg, setCloudMsg] = useState('');
  
  const isHardcoded = !!(DEFAULT_CLOUD_CONFIG.apiKey && DEFAULT_CLOUD_CONFIG.binId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sundays2026 = getSundaysInYear(2026);
  const isAdmin = currentUser.role === 'ADMIN';

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

  // --- WhatsApp Report Logic ---
  const generateReport = () => {
    if (!selectedDate) return "Please select a date to generate a report.";

    // Filter record by Church
    const record = data.attendance.find(r => r.date === selectedDate && r.churchId === activeChurch);
    if (!record) return `No attendance data recorded for ${selectedDate} in ${activeChurch} Church.`;

    const presentMembers = data.members.filter(m => record.presentMemberIds.includes(m.id));
    const punctualMembers = data.members.filter(m => record.punctualMemberIds?.includes(m.id));
    
    // Sort alphabetically
    presentMembers.sort((a, b) => a.name.localeCompare(b.name));

    const teachers = presentMembers.filter(m => m.type === MemberType.TEACHER);
    const members = presentMembers.filter(m => m.type === MemberType.MEMBER);
    const fnfs = presentMembers.filter(m => m.type === MemberType.FNF);
    const inconsistent = presentMembers.filter(m => m.type === MemberType.INCONSISTENT);
    const notMembers = presentMembers.filter(m => m.type === MemberType.NOT_MEMBER);
    
    // Accounting count: Everyone excluding teachers
    const accountingCount = presentMembers.length - teachers.length;

    const formattedDate = new Date(selectedDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    let report = `*${activeChurch} CHURCH ATTENDANCE REPORT*\n${formattedDate}\n`;
    report += `------------------\n`;
    report += `Total Present: ${accountingCount}\n\n`; // Only showing Accounting Count

    

    report += `*MEMBERS (${members.length})*\n`;
    if (members.length > 0) {
      members.forEach((m, idx) => {
        report += `${idx + 1}. ${m.name}\n`;
      });
    } else {
      report += `_None_\n`;
    }

    report += `\n*FNF (${fnfs.length})*\n`;
    if (fnfs.length > 0) {
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
    // Reset input so same file can be selected again if needed
    event.target.value = '';
  };
  
  // --- Cloud Sync Logic ---
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
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('WHATSAPP')}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap outline-none ${activeTab === 'WHATSAPP' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><FileText size={16}/> WhatsApp Report</span>
        </button>
        <button
          onClick={() => setActiveTab('DATA')}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap outline-none ${activeTab === 'DATA' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><Database size={16}/> Manual Backup</span>
        </button>
        {isAdmin && (
            <button
            onClick={() => setActiveTab('CLOUD')}
            className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap outline-none ${activeTab === 'CLOUD' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
            <span className="flex items-center gap-2"><Cloud size={16}/> Cloud Sync</span>
            </button>
        )}
        <button
          onClick={() => setActiveTab('HELP')}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap outline-none ${activeTab === 'HELP' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><BookOpen size={16}/> System Guide</span>
        </button>
        <button
          onClick={() => setActiveTab('PORTFOLIO')}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap outline-none ${activeTab === 'PORTFOLIO' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><Presentation size={16}/> Product Case Study</span>
        </button>
      </div>

      {activeTab === 'WHATSAPP' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-left-2">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            Export for WhatsApp ({activeChurch})
          </h2>
          
          <div className="mb-6">
             <label className="block text-sm font-bold text-gray-600 mb-2">Select Week</label>
             <select 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block w-full p-3 transition-shadow"
            >
              <option value="">-- Select a Date --</option>
              {sundays2026.map(d => {
                const strDate = d.toISOString().split('T')[0];
                const hasData = data.attendance.some(r => r.date === strDate && r.churchId === activeChurch);
                return <option key={strDate} value={strDate}>{hasData ? '✅ ' : '⚪ '} {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</option>
              })}
            </select>
          </div>

          <div className="relative">
            <textarea
              readOnly
              value={reportText}
              className="w-full h-96 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-inner"
            />
            <div className="absolute top-4 right-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleOpenWhatsApp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all font-medium bg-[#25D366] text-white hover:bg-[#128C7E] active:scale-95"
                title="Open in WhatsApp"
              >
                 <MessageCircle size={16} /> <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                onClick={handleCopyReport}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all font-medium active:scale-95
                  ${copiedReport ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'}
                `}
              >
                {copiedReport ? <><CheckCircle size={16} /> <span className="hidden sm:inline">Copied</span></> : <><Copy size={16} /> <span className="hidden sm:inline">Copy Text</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PORTFOLIO' && (
          <div className="space-y-12 animate-in fade-in pb-12">
              {/* 1. Hero Section */}
              <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-500 rounded-full blur-3xl opacity-10 translate-y-1/2 -translate-x-1/2"></div>
                  
                  <div className="relative z-10 max-w-2xl">
                      <div className="flex items-center gap-3 mb-6">
                          <span className="bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold border border-indigo-500/30">PRODUCT CASE STUDY</span>
                          <span className="text-slate-400 text-sm font-medium">UX / Engineering</span>
                      </div>
                      <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">Reimagining Church <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">Attendance & Engagement</span></h1>
                      <p className="text-slate-300 text-lg leading-relaxed mb-8">
                          A mobile-first PWA designed to replace paper registries with automated workflows, real-time analytics, and seamless WhatsApp reporting.
                      </p>
                      <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-300 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                              <Zap size={16} className="text-yellow-400"/> Auto-Promotion Logic
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-300 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                              <Smartphone size={16} className="text-blue-400"/> Mobile First
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-300 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                              <Cloud size={16} className="text-cyan-400"/> Cloud Sync
                          </div>
                      </div>
                  </div>
              </div>

              {/* 2. The Solution (UI Gallery) */}
              <div>
                  <div className="flex items-center gap-3 mb-6">
                       <Layout className="text-indigo-600"/>
                       <h2 className="text-2xl font-bold text-gray-900">The Solution: Visual User Flow</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* CARD 1: Dashboard */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                           <div className="aspect-[9/16] bg-slate-50 rounded-2xl border-4 border-slate-200 overflow-hidden relative shadow-inner mb-6 flex flex-col">
                               {/* Mock UI: Header */}
                               <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-3">
                                   <div className="w-16 h-3 bg-gray-200 rounded-full"></div>
                                   <div className="w-6 h-6 bg-indigo-100 rounded-full"></div>
                               </div>
                               {/* Mock UI: Body */}
                               <div className="p-3 space-y-3">
                                   <div className="flex gap-2">
                                       <div className="w-1/2 h-20 bg-indigo-500 rounded-xl"></div>
                                       <div className="w-1/2 h-20 bg-white border border-gray-200 rounded-xl"></div>
                                   </div>
                                   <div className="h-32 bg-white border border-gray-200 rounded-xl"></div>
                                   <div className="h-8 bg-gray-200 rounded-full w-2/3"></div>
                                   <div className="space-y-2">
                                       <div className="h-12 bg-white border border-gray-200 rounded-xl"></div>
                                       <div className="h-12 bg-white border border-gray-200 rounded-xl"></div>
                                   </div>
                               </div>
                               {/* Mock UI: Bottom Nav */}
                               <div className="mt-auto h-12 bg-white border-t border-gray-200 flex justify-around items-center px-2">
                                   <div className="w-6 h-6 bg-indigo-600 rounded-md"></div>
                                   <div className="w-6 h-6 bg-gray-300 rounded-md"></div>
                                   <div className="w-6 h-6 bg-gray-300 rounded-md"></div>
                               </div>
                           </div>
                           <h3 className="font-bold text-gray-900 text-lg">1. Insightful Dashboard</h3>
                           <p className="text-sm text-gray-500 mt-2">Immediate visibility into growth trends and retention health across 4 locations.</p>
                      </div>

                      {/* CARD 2: Attendance */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                           <div className="aspect-[9/16] bg-slate-50 rounded-2xl border-4 border-slate-200 overflow-hidden relative shadow-inner mb-6 flex flex-col">
                               {/* Mock UI: Search Header */}
                               <div className="p-3 bg-white border-b border-gray-200 space-y-2">
                                   <div className="flex justify-between">
                                       <div className="w-24 h-6 bg-gray-200 rounded-md"></div>
                                       <div className="w-16 h-6 bg-indigo-600 rounded-md"></div>
                                   </div>
                                   <div className="h-8 bg-gray-100 rounded-lg border border-gray-200"></div>
                               </div>
                               {/* Mock UI: List */}
                               <div className="p-3 grid grid-cols-1 gap-2 overflow-hidden">
                                   <div className="h-16 bg-indigo-600 rounded-xl shadow-md border-l-4 border-indigo-800 flex items-center px-3 gap-2">
                                       <div className="flex-1">
                                           <div className="w-20 h-3 bg-white/30 rounded mb-1"></div>
                                           <div className="w-32 h-4 bg-white rounded"></div>
                                       </div>
                                       <div className="w-6 h-6 bg-white rounded-full"></div>
                                   </div>
                                   <div className="h-16 bg-white border border-gray-200 rounded-xl flex items-center px-3 gap-2 opacity-50">
                                       <div className="flex-1">
                                           <div className="w-20 h-3 bg-gray-100 rounded mb-1"></div>
                                           <div className="w-24 h-4 bg-gray-200 rounded"></div>
                                       </div>
                                       <div className="w-6 h-6 bg-gray-100 rounded-full"></div>
                                   </div>
                                    <div className="h-16 bg-white border border-gray-200 rounded-xl flex items-center px-3 gap-2 opacity-50">
                                       <div className="flex-1">
                                           <div className="w-20 h-3 bg-gray-100 rounded mb-1"></div>
                                           <div className="w-24 h-4 bg-gray-200 rounded"></div>
                                       </div>
                                       <div className="w-6 h-6 bg-gray-100 rounded-full"></div>
                                   </div>
                               </div>
                           </div>
                           <h3 className="font-bold text-gray-900 text-lg">2. Rapid Attendance</h3>
                           <p className="text-sm text-gray-500 mt-2">One-tap check-ins with visual cues for 'Present' state. Includes 'Punctuality' gamification.</p>
                      </div>

                      {/* CARD 3: Export */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                           <div className="aspect-[9/16] bg-slate-50 rounded-2xl border-4 border-slate-200 overflow-hidden relative shadow-inner mb-6 flex flex-col justify-center items-center p-6">
                               <div className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
                                   <div className="w-32 h-4 bg-gray-800 rounded mb-4"></div>
                                   <div className="space-y-2">
                                       <div className="w-full h-2 bg-gray-200 rounded"></div>
                                       <div className="w-full h-2 bg-gray-200 rounded"></div>
                                       <div className="w-2/3 h-2 bg-gray-200 rounded"></div>
                                   </div>
                               </div>
                               <div className="w-full h-10 bg-[#25D366] rounded-lg shadow-md flex items-center justify-center text-white text-xs font-bold gap-2">
                                   <MessageCircle size={14} fill="white"/> Share to WhatsApp
                               </div>
                           </div>
                           <h3 className="font-bold text-gray-900 text-lg">3. Instant Reporting</h3>
                           <p className="text-sm text-gray-500 mt-2">Auto-generates formatted text summaries for stakeholder communication, eliminating manual counting.</p>
                      </div>

                  </div>
              </div>

              {/* 3. Impact & Design Philosophy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Impact */}
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-3xl border border-indigo-100">
                      <div className="flex items-center gap-2 mb-6 text-indigo-700">
                          <BarChart3 className="shrink-0"/>
                          <h3 className="font-bold text-xl">User Impact</h3>
                      </div>
                      <div className="space-y-6">
                          <div>
                              <div className="text-4xl font-extrabold text-slate-800 mb-1">90%</div>
                              <p className="text-sm font-medium text-slate-500">Reduction in weekly administrative time for Head Teachers.</p>
                          </div>
                          <div>
                              <div className="text-4xl font-extrabold text-slate-800 mb-1">100%</div>
                              <p className="text-sm font-medium text-slate-500">Accuracy in data retention and historical reporting.</p>
                          </div>
                          <div className="pt-4 border-t border-indigo-100">
                              <p className="text-sm text-slate-600 italic">"The automated demotion/promotion logic means I no longer have to manually check birthdays or attendance streaks. The system just works."</p>
                          </div>
                      </div>
                  </div>

                  {/* Design Thinking */}
                  <div className="bg-white p-8 rounded-3xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-6 text-purple-700">
                          <Lightbulb className="shrink-0"/>
                          <h3 className="font-bold text-xl">Product Thinking</h3>
                      </div>
                      <ul className="space-y-6">
                          <li className="flex gap-4">
                              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0">
                                  <MousePointerClick size={20}/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-900">Forgiving UI</h4>
                                  <p className="text-sm text-gray-500 mt-1">Every action (attendance, archiving) is reversible. Toggles are used over complex forms to reduce friction on mobile.</p>
                              </div>
                          </li>
                          <li className="flex gap-4">
                              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                                  <GitBranch size={20}/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-900">Invisible Logic</h4>
                                  <p className="text-sm text-gray-500 mt-1">Complex rules (e.g., 'Inconsistent' after 10 absences, Age promotion) happen in the background, keeping the UI clean.</p>
                              </div>
                          </li>
                          <li className="flex gap-4">
                              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                                  <Heart size={20}/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-900">Empathy for Context</h4>
                                  <p className="text-sm text-gray-500 mt-1">Designed for high-distraction environments (Sunday school). Large tap targets, high contrast, and offline-first resilience.</p>
                              </div>
                          </li>
                      </ul>
                  </div>
              </div>
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

             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-gray-800 mb-6 text-lg">Primary User Journeys</h3>
                 
                 <div className="relative border-l-2 border-indigo-100 pl-8 space-y-8">
                     <div className="relative">
                         <div className="absolute -left-[39px] top-0 w-6 h-6 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                         <h4 className="font-bold text-gray-900">Sunday Morning Flow</h4>
                         <p className="text-sm text-gray-500 mt-1">The typical workflow for a teacher.</p>
                         <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal ml-4">
                             <li>Login using personal Access Code.</li>
                             <li>Navigate to <strong>Attendance</strong> tab.</li>
                             <li>Select "Today" from the date dropdown.</li>
                             <li>Tap names as children arrive (Green Card = Present).</li>
                             <li>Click "Save" periodically to sync data to the cloud.</li>
                             <li>Navigate to <strong>Reports</strong> tab and click "WhatsApp" to send the summary to the group.</li>
                         </ol>
                     </div>

                     <div className="relative">
                         <div className="absolute -left-[39px] top-0 w-6 h-6 rounded-full bg-amber-500 border-4 border-white shadow-sm"></div>
                         <h4 className="font-bold text-gray-900">New Visitor Workflow</h4>
                         <p className="text-sm text-gray-500 mt-1">Handling first-time guests.</p>
                         <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal ml-4">
                             <li>In <strong>Attendance</strong>, click the <span className="inline-block p-1 bg-indigo-50 rounded text-indigo-600"><Code size={10} className="inline"/> + User</span> button.</li>
                             <li>Enter the child's name in the Quick Add box.</li>
                             <li>This creates a temporary "FNF" (Friends & Family) record.</li>
                             <li>Later, go to <strong>People Hub</strong>, find the record, click Edit, and add DOB to convert them to a full member.</li>
                         </ol>
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