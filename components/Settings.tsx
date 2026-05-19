
import React, { useState } from 'react';
import { AppData, Member, AppSettings } from '../types';
import { updateSettings, syncFromCloud } from '../services/storageService';
import { Settings as SettingsIcon, Cloud, List, Save, RefreshCw, AlertCircle, CheckCircle, Database } from 'lucide-react';

interface SettingsProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
}

const Settings: React.FC<SettingsProps> = ({ data, onUpdate, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'CHURCHES' | 'CLOUD'>('GENERAL');
  
  // Local state for editing
  const [localSettings, setLocalSettings] = useState<AppSettings>(data.settings);
  const [newChurch, setNewChurch] = useState('');
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const saveConfig = () => {
      updateSettings(localSettings);
      setStatusMsg({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setStatusMsg(null), 3000);
      onUpdate();
  };

  const handleAddChurch = () => {
      if (newChurch && !localSettings.churches.includes(newChurch)) {
          setLocalSettings({
              ...localSettings,
              churches: [...localSettings.churches, newChurch]
          });
          setNewChurch('');
      }
  };

  const handleRemoveChurch = (church: string) => {
      if (window.confirm(`Remove ${church} from active list? Historic data will remain.`)) {
          setLocalSettings({
              ...localSettings,
              churches: localSettings.churches.filter(c => c !== church)
          });
      }
  };

  const handleManualSync = async () => {
      if (!window.confirm("WARNING: This will overwrite any unsaved local changes with what is on the cloud. Proceed?")) return;
      setIsSyncing(true);
      const res = await syncFromCloud(true);
      if (res.success) {
          setStatusMsg({ type: 'success', text: 'Cloud pull successful' });
          onUpdate();
      } else {
          setStatusMsg({ type: 'error', text: res.message || 'Sync failed' });
      }
      setIsSyncing(false);
  };

  const handleForcePush = async () => {
      setIsSyncing(true);
      try {
          const { syncToCloud } = await import('../services/storageService');
          await syncToCloud(true);
          setStatusMsg({ type: 'success', text: 'Cloud push successful' });
      } catch (err: any) {
          setStatusMsg({ type: 'error', text: err.message || 'Push failed' });
      }
      setIsSyncing(false);
  };

  return (
    <div className="pb-20 space-y-6 animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                    <SettingsIcon size={24} className="text-slate-400"/> Settings & Config
                </h2>
                <p className="text-xs text-slate-500 font-medium">Manage application preferences.</p>
            </div>
            {statusMsg && (
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {statusMsg.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                    {statusMsg.text}
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="md:col-span-1 space-y-2">
                <button onClick={() => setActiveTab('GENERAL')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'GENERAL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    General
                </button>
                <button onClick={() => setActiveTab('CHURCHES')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'CHURCHES' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    Church Branches
                </button>
                <button onClick={() => setActiveTab('CLOUD')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'CLOUD' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    Cloud Sync
                </button>
            </div>

            {/* Content Area */}
            <div className="md:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
                
                {/* GENERAL TAB */}
                {activeTab === 'GENERAL' && (
                    <div className="space-y-6">
                        <h3 className="font-bold text-lg text-slate-800">Feature Toggles</h3>
                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                                <span className="font-medium text-slate-700">Enable Punctuality Tracking</span>
                                <input 
                                    type="checkbox" 
                                    checked={localSettings.features.punctuality} 
                                    onChange={e => setLocalSettings({...localSettings, features: {...localSettings.features, punctuality: e.target.checked}})}
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                            </label>
                            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                                <span className="font-medium text-slate-700">Enable Outreach Module</span>
                                <input 
                                    type="checkbox" 
                                    checked={localSettings.features.outreach} 
                                    onChange={e => setLocalSettings({...localSettings, features: {...localSettings.features, outreach: e.target.checked}})}
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {/* CHURCHES TAB */}
                {activeTab === 'CHURCHES' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Manage Branches</h3>
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Drag & drop support coming soon</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="New Branch Name (e.g. North Legon)" 
                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newChurch}
                                onChange={e => setNewChurch(e.target.value)}
                            />
                            <button onClick={handleAddChurch} className="px-4 bg-indigo-600 text-white rounded-xl font-bold"><Save size={18}/></button>
                        </div>

                        <div className="space-y-2">
                            {localSettings.churches.map((church, idx) => (
                                <div key={church} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                        <span className="font-bold text-slate-700">{church}</span>
                                    </div>
                                    <button onClick={() => handleRemoveChurch(church)} className="text-slate-400 hover:text-red-500 transition-colors"><AlertCircle size={18}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CLOUD TAB */}
                {activeTab === 'CLOUD' && (
                    <div className="space-y-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Cloud size={20} className="text-indigo-600"/> Firebase Sync Configuration</h3>
                        
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm">
                            <p>Data is synchronized securely with Firebase. Ensure you are signed in with the authorized Google Account.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3 pt-4">
                                <button 
                                    onClick={async () => {
                                        try {
                                            const { loginWithGoogle } = await import('../services/firebase');
                                            await loginWithGoogle();
                                            setStatusMsg({ type: 'success', text: 'Firebase signed in successfully!' });
                                        } catch (e: any) {
                                            setStatusMsg({ type: 'error', text: 'Firebase Sign in failed' });
                                        }
                                    }} 
                                    className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600"
                                >
                                    Sign In with Google
                                </button>
                                <button 
                                    onClick={handleForcePush}
                                    disabled={isSyncing}
                                    className="px-6 py-3 bg-green-100 text-green-700 font-bold rounded-xl hover:bg-green-200 flex items-center gap-2"
                                >
                                    <Cloud size={18} className={isSyncing ? 'animate-pulse' : ''}/> Force Push
                                </button>
                                <button 
                                    onClick={handleManualSync}
                                    disabled={isSyncing}
                                    className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 flex items-center gap-2"
                                >
                                    <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''}/> Force Pull
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>

        {/* Global Save Button (if not in cloud tab) */}
        {activeTab !== 'CLOUD' && (
            <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8">
                <button 
                    onClick={saveConfig}
                    className="bg-green-600 text-white px-6 py-4 rounded-full shadow-xl shadow-green-200 font-bold text-lg hover:bg-green-700 hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Save size={20}/> Save Changes
                </button>
            </div>
        )}
    </div>
  );
};

export default Settings;
