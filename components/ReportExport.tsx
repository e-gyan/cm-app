import React, { useState, useRef, useEffect } from 'react';
import { AppData, MemberType, Church, Member } from '../types';
import { Copy, FileText, CheckCircle, Database, Download, Upload, AlertCircle, RefreshCw, Cloud, Lock, Code, MessageCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'DATA' | 'CLOUD'>('WHATSAPP');
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
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 pb-2 overflow-x-auto">
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