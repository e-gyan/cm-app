import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Member, OutreachSession, PrayerSlot, MemberType, MemberStatus } from '../types';
import { generateOutreachSchedule, generatePrayerSchedule, saveOutreachSession, deleteOutreachSession, savePrayerSlot } from '../services/storageService';
import { Calendar, MapPin, Plus, Trash2, CheckCircle2, Clock, Heart, AlertCircle, ArrowRightLeft, BarChart2, ChevronUp, ChevronDown, Check, X, CalendarDays, RefreshCw, Zap, Loader2, User, Cloud, Save, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface OutreachHubProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getRelativeTime = (dateStr: string) => {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    
    const diff = (target.getTime() - today.getTime()) / (1000 * 3600 * 24);
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0 && diff < 7) return target.toLocaleDateString('en-US', { weekday: 'long' });
    return formatDateDDMMYYYY(dateStr);
};

const OutreachHub: React.FC<OutreachHubProps> = ({ data, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'VISIT' | 'PRAYER' | 'TRACK'>('VISIT');
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Visitation State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [moveModal, setMoveModal] = useState<{ show: boolean, memberId: string, currentSessionId: string } | null>(null);
  
  // UNIFIED LOCAL STATE FOR BATCH SAVING
  const [localSessions, setLocalSessions] = useState<OutreachSession[]>([]);
  const [localPrayerSlots, setLocalPrayerSlots] = useState<PrayerSlot[]>([]);
  
  // Track IDs of modified items
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set()); 
  const [changeCounts, setChangeCounts] = useState({ marked: 0, unmarked: 0 }); // Track interaction type
  const [isSaving, setIsSaving] = useState(false);

  // Completion Confirmation
  const [completionConfirm, setCompletionConfirm] = useState<{ show: boolean, sessionId: string } | null>(null);

  // Prayer State
  const [prayerWeek, setPrayerWeek] = useState(getStartOfWeek(new Date()));

  function getStartOfWeek(date: Date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
      return new Date(d.setDate(diff));
  }

  // --- SYNC LOCAL STATE ---
  useEffect(() => {
      // Sync sessions if not dirty
      const sessionIds = new Set(localSessions.map(s => s.id));
      const hasSessionChanges = Array.from(unsavedChanges).some(id => sessionIds.has(id));
      
      if (!hasSessionChanges && data.outreachSessions) {
          setLocalSessions(JSON.parse(JSON.stringify(data.outreachSessions)));
      }

      // Sync prayer if not dirty
      const prayerIds = new Set(localPrayerSlots.map(s => s.id));
      const hasPrayerChanges = Array.from(unsavedChanges).some(id => prayerIds.has(id));

      if (!hasPrayerChanges && data.prayerSchedule) {
          setLocalPrayerSlots(JSON.parse(JSON.stringify(data.prayerSchedule)));
      }
  }, [data.outreachSessions, data.prayerSchedule, unsavedChanges.size]);

  // --- ACTIONS ---

  const handleAddDate = () => {
      if(newDateInput) {
          if (selectedDates.includes(newDateInput)) {
             setNewDateInput('');
             return;
          }
          if (localSessions?.some(s => s.date === newDateInput)) {
              setErrorMsg('Date already scheduled.');
              setTimeout(() => setErrorMsg(''), 2000);
              return;
          }
          setSelectedDates([...selectedDates, newDateInput].sort());
          setNewDateInput('');
      }
  };

  const handleRemoveDate = (date: string) => {
      setSelectedDates(selectedDates.filter(d => d !== date));
  };

  const handleGenerateSchedule = () => {
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const res = generateOutreachSchedule(selectedDates, ujMembers);
      if (res.success) {
          setSelectedDates([]);
          setIsCreatorOpen(false);
          setUnsavedChanges(new Set()); // Reset local state
          onUpdate();
      } else {
          setErrorMsg(res.message);
          setTimeout(() => setErrorMsg(''), 4000);
      }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm('Are you sure you want to permanently delete this schedule?')) {
          setLoadingId(id);
          try {
              await deleteOutreachSession(id);
              setUnsavedChanges(prev => {
                  const n = new Set(prev);
                  n.delete(id);
                  return n;
              });
              onUpdate();
          } catch (err) {
              console.error(err);
          } finally {
              setLoadingId(null);
          }
      }
  };

  const toggleVisitForMember = (sessionId: string, memberId: string) => {
      const sessionIndex = localSessions.findIndex(s => s.id === sessionId);
      if (sessionIndex === -1) return;

      const session = { ...localSessions[sessionIndex] }; 
      const currentVisited = session.visitedMemberIds || [];
      let newVisited;
      let isMarking = false;
      
      if (currentVisited.includes(memberId)) {
          newVisited = currentVisited.filter(id => id !== memberId);
      } else {
          newVisited = [...currentVisited, memberId];
          isMarking = true;
      }

      session.visitedMemberIds = newVisited;
      
      // Update counts
      setChangeCounts(prev => ({
          marked: prev.marked + (isMarking ? 1 : 0),
          unmarked: prev.unmarked + (isMarking ? 0 : 1)
      }));

      // Check for full completion
      const allDone = session.assignedMemberIds.every(id => newVisited.includes(id));
      
      if (allDone && !session.status.includes('COMPLETED')) {
          // Trigger confirmation before marking session complete locally
          // We update the visited list but wait on status
          setCompletionConfirm({ show: true, sessionId });
      } else if (!allDone) {
          session.status = 'PENDING';
      }

      const newSessions = [...localSessions];
      newSessions[sessionIndex] = session;
      setLocalSessions(newSessions);
      setUnsavedChanges(prev => new Set(prev).add(sessionId));
  };

  const confirmCompletion = (confirm: boolean) => {
      if (!completionConfirm) return;
      const { sessionId } = completionConfirm;
      const sessionIndex = localSessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex !== -1) {
          const newSessions = [...localSessions];
          newSessions[sessionIndex].status = confirm ? 'COMPLETED' : 'PENDING';
          if (confirm) newSessions[sessionIndex].completedBy = currentUser.name;
          setLocalSessions(newSessions);
          // Already marked as dirty in toggle
      }
      setCompletionConfirm(null);
  };

  const handleMoveMember = (targetSessionId: string) => {
      if (!moveModal) return;
      const { memberId, currentSessionId } = moveModal;
      
      const currentIdx = localSessions.findIndex(s => s.id === currentSessionId);
      const targetIdx = localSessions.findIndex(s => s.id === targetSessionId);
      
      if (currentIdx !== -1 && targetIdx !== -1) {
          const currentSession = { ...localSessions[currentIdx] };
          const targetSession = { ...localSessions[targetIdx] };

          // Remove from old
          currentSession.assignedMemberIds = currentSession.assignedMemberIds.filter(id => id !== memberId);
          currentSession.visitedMemberIds = (currentSession.visitedMemberIds || []).filter(id => id !== memberId);
          
          // Add to new
          if (!targetSession.assignedMemberIds.includes(memberId)) {
              targetSession.assignedMemberIds.push(memberId);
          }
          
          const newSessions = [...localSessions];
          newSessions[currentIdx] = currentSession;
          newSessions[targetIdx] = targetSession;
          
          setLocalSessions(newSessions);
          setUnsavedChanges(prev => new Set(prev).add(currentSessionId).add(targetSessionId));
          setMoveModal(null);
      }
  };

  // --- PRAYER LOGIC ---

  const handleGeneratePrayer = () => {
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const res = generatePrayerSchedule(prayerWeek, ujMembers);
      
      if (res.success) {
          setGenMsg({ type: 'success', text: res.message });
          onUpdate();
      } else {
          setGenMsg({ type: 'error', text: res.message });
      }
      setTimeout(() => setGenMsg(null), 4000);
  };

  const togglePrayerComplete = (slotId: string) => {
      const slotIdx = localPrayerSlots.findIndex(s => s.id === slotId);
      if (slotIdx === -1) return;

      const slot = { ...localPrayerSlots[slotIdx] };
      const wasComplete = slot.isCompleted;
      slot.isCompleted = !wasComplete;

      setChangeCounts(prev => ({
          marked: prev.marked + (!wasComplete ? 1 : 0),
          unmarked: prev.unmarked + (wasComplete ? 1 : 0)
      }));

      const newSlots = [...localPrayerSlots];
      newSlots[slotIdx] = slot;
      setLocalPrayerSlots(newSlots);
      setUnsavedChanges(prev => new Set(prev).add(slotId));
  };

  // --- UNIFIED SAVE ---
  const saveBatchChanges = async () => {
      setIsSaving(true);
      try {
          const promises: Promise<any>[] = [];
          
          unsavedChanges.forEach(id => {
              // Check visits
              const session = localSessions.find(s => s.id === id);
              if (session) {
                  promises.push(saveOutreachSession(session));
                  return;
              }
              // Check prayers
              const slot = localPrayerSlots.find(s => s.id === id);
              if (slot) {
                  promises.push(savePrayerSlot(slot));
              }
          });

          await Promise.all(promises);
          
          setUnsavedChanges(new Set());
          setChangeCounts({ marked: 0, unmarked: 0 });
          onUpdate();
          setGenMsg({ type: 'success', text: 'All changes saved to cloud!' });
          setTimeout(() => setGenMsg(null), 3000);
      } catch (e) {
          console.error(e);
          setGenMsg({ type: 'error', text: 'Failed to save changes.' });
      } finally {
          setIsSaving(false);
      }
  };
  
  // --- DERIVED DATA ---

  const sortedVisits = useMemo(() => {
      const all = (localSessions || []);
      const pending = all.filter(s => s.status === 'PENDING').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const completed = all.filter(s => s.status === 'COMPLETED').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Separate "Next Up" from rest of pending
      const nextUp = pending.length > 0 ? pending[0] : null;
      const otherPending = pending.length > 0 ? pending.slice(1) : [];

      return { nextUp, otherPending, completed };
  }, [localSessions]);

  const weekSlots = useMemo(() => {
      if(localPrayerSlots.length === 0) return [];
      const start = new Date(prayerWeek).toISOString().split('T')[0];
      const end = new Date(prayerWeek);
      end.setDate(end.getDate() + 5);
      const endStr = end.toISOString().split('T')[0];
      
      return localPrayerSlots
        .filter(s => s.date >= start && s.date < endStr)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [localPrayerSlots, prayerWeek]);

  // --- PROGRESS METRICS ---
  const progressStats = useMemo(() => {
      const year = new Date().getFullYear();
      
      // 1. Visit Progress
      const eligibleKids = data.members.filter(m => m.assignedChurch === 'UJ' && ['Member','FNF','Inconsistent'].includes(m.type) && m.status === 'Active');
      const targetVisits = eligibleKids.length * 2; // 2 visits per year
      
      // Count unique visits per member
      const memberVisitCounts: Record<string, number> = {};
      const completedSessions = (data.outreachSessions || []).filter(s => s.status === 'COMPLETED' && new Date(s.date).getFullYear() === year);
      
      let actualVisits = 0;
      completedSessions.forEach(s => {
          s.visitedMemberIds?.forEach(id => {
              memberVisitCounts[id] = (memberVisitCounts[id] || 0) + 1;
              actualVisits++;
          });
      });

      // 2. Prayer Progress
      const prayers = (data.prayerSchedule || []).filter(s => new Date(s.date).getFullYear() === year);
      const weekPrayers = prayers.filter(s => {
          const d = new Date(s.date);
          const now = new Date();
          const oneWeek = 7 * 24 * 60 * 60 * 1000;
          return Math.abs(now.getTime() - d.getTime()) < oneWeek;
      });
      const monthPrayers = prayers.filter(s => new Date(s.date).getMonth() === new Date().getMonth());
      const quarterPrayers = prayers.filter(s => Math.floor(new Date(s.date).getMonth() / 3) === Math.floor(new Date().getMonth() / 3));

      const getPrayerStats = (list: PrayerSlot[]) => {
          const total = list.length * 5; // 5 kids per slot
          const done = list.filter(s => s.isCompleted).length * 5; // Approx
          return { total, done, pct: total > 0 ? Math.round((done/total)*100) : 0 };
      };

      return {
          visit: { target: targetVisits, actual: actualVisits, pct: targetVisits > 0 ? Math.round((actualVisits/targetVisits)*100) : 0 },
          prayer: {
              week: getPrayerStats(weekPrayers),
              month: getPrayerStats(monthPrayers),
              quarter: getPrayerStats(quarterPrayers),
              year: getPrayerStats(prayers)
          }
      };
  }, [data]);

  return (
    <div className="space-y-4 pb-24 relative min-h-screen">
      
      {/* HEADER TABS */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-1 sticky top-0 z-30">
          <button onClick={() => setActiveTab('VISIT')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'VISIT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <MapPin size={16}/> Visits
          </button>
          <button onClick={() => setActiveTab('PRAYER')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'PRAYER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Heart size={16}/> Prayer
          </button>
          <button onClick={() => setActiveTab('TRACK')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'TRACK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <BarChart2 size={16}/> Progress
          </button>
      </div>

      {/* VISIT TAB */}
      {activeTab === 'VISIT' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              
              {/* Creator Toggle */}
              <button 
                onClick={() => setIsCreatorOpen(!isCreatorOpen)}
                className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 font-bold hover:bg-indigo-100 transition-colors"
              >
                  <span className="flex items-center gap-2"><Calendar size={20}/> Plan New Visits</span>
                  {isCreatorOpen ? <ChevronUp size={20}/> : <Plus size={20}/>}
              </button>

              {/* Creator Drawer */}
              {isCreatorOpen && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex gap-2">
                          <input type="date" className="flex-1 p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" value={newDateInput} onChange={e => setNewDateInput(e.target.value)} />
                          <button onClick={handleAddDate} disabled={!newDateInput} className="px-4 bg-indigo-600 text-white rounded-xl"><Plus/></button>
                      </div>
                      
                      {selectedDates.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                              {selectedDates.map(d => (
                                  <span key={d} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-2">
                                      {formatDateDDMMYYYY(d)} <button onClick={() => handleRemoveDate(d)}><X size={14}/></button>
                                  </span>
                              ))}
                          </div>
                      )}
                      
                      <button onClick={handleGenerateSchedule} disabled={selectedDates.length === 0} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50">Generate Schedule</button>
                      {errorMsg && <p className="text-xs text-red-500 font-bold text-center">{errorMsg}</p>}
                  </div>
              )}

              {/* TIMELINE VIEW */}
              <div className="space-y-4">
                  
                  {/* NEXT UP CARD */}
                  {sortedVisits.nextUp && (
                      <div className="relative">
                          <div className="absolute -left-3 top-4 bottom-4 w-1 bg-gradient-to-b from-indigo-500 to-indigo-200 rounded-full hidden md:block"></div>
                          <div className={`bg-white rounded-3xl shadow-lg border overflow-hidden transition-all ${unsavedChanges.has(sortedVisits.nextUp.id) ? 'border-amber-400 shadow-amber-100' : 'border-indigo-100 shadow-indigo-100'}`}>
                              <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                                  <div>
                                      <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Up Next</div>
                                      <h3 className="text-2xl font-bold">{getRelativeTime(sortedVisits.nextUp.date)}</h3>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-3xl font-extrabold opacity-20"><CalendarDays size={40}/></div>
                                  </div>
                              </div>
                              
                              <div className="p-2">
                                  <SessionChildList 
                                    session={sortedVisits.nextUp} 
                                    data={data} 
                                    onToggle={toggleVisitForMember} 
                                    onMove={(mid, sid) => setMoveModal({show: true, memberId: mid, currentSessionId: sid})}
                                  />
                              </div>
                              
                              <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-400">{sortedVisits.nextUp.assignedMemberIds.length} Kids Assigned</span>
                                  <button 
                                    onClick={(e) => handleDeleteSession(sortedVisits.nextUp!.id, e)}
                                    disabled={loadingId === sortedVisits.nextUp.id}
                                    className="text-slate-300 hover:text-red-500 p-2 disabled:opacity-50"
                                  >
                                      {loadingId === sortedVisits.nextUp.id ? <Loader2 size={16} className="animate-spin text-indigo-500"/> : <Trash2 size={16}/>}
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* OTHER PENDING */}
                  {sortedVisits.otherPending.map(session => (
                      <div key={session.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden opacity-90 hover:opacity-100 transition-all ${unsavedChanges.has(session.id) ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                              <h4 className="font-bold text-slate-700">{formatDateDDMMYYYY(session.date)}</h4>
                              <button 
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                disabled={loadingId === session.id}
                                className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                              >
                                {loadingId === session.id ? <Loader2 size={16} className="animate-spin text-indigo-500"/> : <Trash2 size={16}/>}
                              </button>
                          </div>
                          <div className="p-2">
                              <SessionChildList 
                                session={session} 
                                data={data} 
                                onToggle={toggleVisitForMember} 
                                onMove={(mid, sid) => setMoveModal({show: true, memberId: mid, currentSessionId: sid})}
                              />
                          </div>
                      </div>
                  ))}

                  {/* EMPTY STATE */}
                  {!sortedVisits.nextUp && sortedVisits.otherPending.length === 0 && (
                      <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><Calendar size={32}/></div>
                          <h3 className="text-slate-500 font-bold mb-2">No Upcoming Visits</h3>
                          <p className="text-xs text-slate-400">Use "Plan New Visits" to create a schedule.</p>
                      </div>
                  )}

                  {/* HISTORY */}
                  {sortedVisits.completed.length > 0 && (
                      <div className="pt-6">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Completed History</h4>
                          <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                              {sortedVisits.completed.map(s => (
                                  <div key={s.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-green-100 text-green-600 rounded-full"><CheckCircle2 size={16}/></div>
                                          <div>
                                              <div className="font-bold text-slate-700 text-sm line-through">{formatDateDDMMYYYY(s.date)}</div>
                                              <div className="text-[10px] text-slate-400">By {s.completedBy || 'Teacher'}</div>
                                          </div>
                                      </div>
                                      <button 
                                        onClick={(e) => handleDeleteSession(s.id, e)}
                                        disabled={loadingId === s.id}
                                        className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                                      >
                                          {loadingId === s.id ? <Loader2 size={16} className="animate-spin text-indigo-500"/> : <Trash2 size={16}/>}
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* PRAYER TAB */}
      {activeTab === 'PRAYER' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                      <h3 className="text-2xl font-bold mb-1">Prayer Wall</h3>
                      <p className="text-indigo-100 text-sm opacity-90 mb-4">Interceding for 5 specific children daily.</p>
                      <button onClick={handleGeneratePrayer} className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow-sm hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-2">
                          <RefreshCw size={14}/> Generate This Week
                      </button>
                  </div>
                  <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                      <Heart size={120} />
                  </div>
              </div>
              
              {genMsg && (
                  <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${genMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {genMsg.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                      {genMsg.text}
                  </div>
              )}

              <div className="space-y-3">
                  {weekSlots.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                          Schedule is empty for this week. Click Generate above.
                      </div>
                  ) : (
                      weekSlots.map(slot => (
                          <div key={slot.id} className={`bg-white rounded-2xl border transition-all ${slot.isCompleted ? 'border-green-200 shadow-none' : 'border-slate-100 shadow-sm'} ${unsavedChanges.has(slot.id) ? 'ring-2 ring-amber-300' : ''}`}>
                              <div 
                                onClick={() => togglePrayerComplete(slot.id)}
                                className="p-4 cursor-pointer"
                              >
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold border ${slot.isCompleted ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                              <span>{slot.dayOfWeek.substring(0,3).toUpperCase()}</span>
                                          </div>
                                          <div>
                                              <h4 className={`font-bold text-sm ${slot.isCompleted ? 'text-green-800' : 'text-slate-800'}`}>{formatDateDDMMYYYY(slot.date)}</h4>
                                              <p className="text-[10px] text-slate-400 font-medium">{slot.assignedMemberIds.length} Children • 30 mins</p>
                                          </div>
                                      </div>
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${slot.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent'}`}>
                                          <Check size={14} strokeWidth={4}/>
                                      </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                      {slot.assignedMemberIds.map(id => {
                                          const m = data.members.find(mem => mem.id === id);
                                          if(!m) return null;
                                          let colorClass = 'bg-slate-50 text-slate-600 border-slate-100';
                                          
                                          if (m.type === MemberType.FNF) colorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                                          else if (m.type === MemberType.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE) colorClass = 'bg-rose-50 text-rose-700 border-rose-100';
                                          else colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';

                                          if (slot.isCompleted) colorClass = 'bg-green-50 text-green-700 border-green-100 opacity-80';

                                          return (
                                              <div key={id} className={`flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold border ${colorClass}`}>
                                                  <span>{m.name}</span>
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* TRACKING TAB (Visuals Enhanced) */}
      {activeTab === 'TRACK' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Target size={20}/></div>
                      <h3 className="font-bold text-lg text-slate-800">Annual Visitation Goal</h3>
                  </div>
                  
                  <div className="mb-2 flex justify-between text-sm font-bold">
                      <span className="text-slate-600">Actual Visits</span>
                      <span className="text-indigo-600">{progressStats.visit.actual} <span className="text-slate-400">/ {progressStats.visit.target}</span></span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, progressStats.visit.pct)}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-400">Target: 2 visits per eligible child (Active, FNF, Inconsistent) per year.</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Heart size={20}/></div>
                      <h3 className="font-bold text-lg text-slate-800">Prayer Coverage Outcomes</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      {(['week','month','quarter','year'] as const).map(period => (
                          <div key={period} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{period}</p>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold text-slate-800">{progressStats.prayer[period].done}</span>
                                  <span className="text-xs font-medium text-slate-400">/ {progressStats.prayer[period].total}</span>
                              </div>
                              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${progressStats.prayer[period].pct > 70 ? 'bg-green-500' : 'bg-amber-500'}`} style={{width: `${progressStats.prayer[period].pct}%`}}></div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* MOVE MODAL */}
      {moveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-1 text-slate-800">Reschedule</h3>
                  <p className="text-sm text-slate-500 mb-4">Choose a new date for this child:</p>
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {sortedVisits.nextUp && sortedVisits.nextUp.id !== moveModal.currentSessionId && (
                          <button onClick={() => handleMoveMember(sortedVisits.nextUp!.id)} className="w-full p-4 text-left border rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group">
                              <div className="font-bold text-slate-800 group-hover:text-indigo-700">{formatDateDDMMYYYY(sortedVisits.nextUp.date)}</div>
                              <div className="text-xs text-indigo-500 font-bold uppercase mt-1">Next Session</div>
                          </button>
                      )}
                      {sortedVisits.otherPending.filter(s => s.id !== moveModal.currentSessionId).map(s => (
                          <button key={s.id} onClick={() => handleMoveMember(s.id)} className="w-full p-4 text-left border rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                              <div className="font-bold text-slate-800">{formatDateDDMMYYYY(s.date)}</div>
                          </button>
                      ))}
                  </div>
                  <button onClick={() => setMoveModal(null)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancel</button>
              </div>
          </div>
      )}

      {/* CONFIRM COMPLETION MODAL */}
      {completionConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32}/></div>
                  <h3 className="font-bold text-xl mb-2 text-slate-800">All Visits Marked!</h3>
                  <p className="text-sm text-slate-500 mb-6">Do you want to mark this session as <b>Completed</b>?</p>
                  <div className="flex gap-3">
                      <button onClick={() => confirmCompletion(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Not Yet</button>
                      <button onClick={() => confirmCompletion(true)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200">Yes, Complete</button>
                  </div>
              </div>
          </div>
      )}

      {/* FLOATING SAVE BUTTON FOR BATCH ACTIONS */}
      {unsavedChanges.size > 0 && (activeTab === 'VISIT' || activeTab === 'PRAYER') && (
          <div className="fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
              <button 
                onClick={saveBatchChanges}
                disabled={isSaving}
                className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-xl shadow-indigo-300 hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95 disabled:opacity-80"
              >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  <div className="flex flex-col items-start leading-none">
                      <span className="text-sm">Save Changes</span>
                      <span className="text-[10px] font-medium opacity-80">
                          {changeCounts.marked > 0 ? `+${changeCounts.marked} marked` : ''} 
                          {changeCounts.marked > 0 && changeCounts.unmarked > 0 ? ', ' : ''}
                          {changeCounts.unmarked > 0 ? `-${changeCounts.unmarked} unmarked` : ''}
                      </span>
                  </div>
              </button>
          </div>
      )}
    </div>
  );
};

// --- SUB COMPONENTS ---

const SessionChildList = ({ session, data, onToggle, onMove }: { session: OutreachSession, data: AppData, onToggle: (sid: string, mid: string) => void, onMove: (mid: string, sid: string) => void }) => {
    return (
        <div className="divide-y divide-slate-50">
            {session.assignedMemberIds.map(id => {
                const m = data.members.find(mem => mem.id === id);
                if (!m) return null;
                const isVisited = session.visitedMemberIds?.includes(id);
                
                return (
                    <div key={id} onClick={() => onToggle(session.id, id)} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${isVisited ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {m.name.charAt(0)}
                            </div>
                            <div>
                                <div className={`font-bold text-sm transition-colors duration-300 ${isVisited ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{m.name}</div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${m.type === 'Member' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{m.type}</span>
                                    {m.address && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin size={8}/> {m.address.substring(0,15)}...</span>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {!isVisited && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onMove(id, session.id); }}
                                    className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <ArrowRightLeft size={16}/>
                                </button>
                            )}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isVisited ? 'bg-green-500 border-green-500 text-white scale-110' : 'border-slate-200 text-transparent hover:border-indigo-300'}`}>
                                <Check size={14} strokeWidth={4}/>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default OutreachHub;