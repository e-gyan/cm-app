import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Member, OutreachSession, PrayerSlot, MemberType } from '../types';
import { generateOutreachSchedule, generatePrayerSchedule, saveOutreachSession, deleteOutreachSession, savePrayerSlot } from '../services/storageService';
import { Calendar, MapPin, Phone, MessageSquare, Plus, Trash2, CheckCircle2, Clock, User, Heart, AlertCircle, Save, ArrowRightLeft, Target, BarChart2, ChevronUp, ChevronDown, FolderOpen, Folder, Users, Cloud, Check } from 'lucide-react';

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

const OutreachHub: React.FC<OutreachHubProps> = ({ data, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'VISIT' | 'PRAYER' | 'CONTACTS' | 'TRACK'>('VISIT');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Visitation State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [moveModal, setMoveModal] = useState<{ show: boolean, memberId: string, currentSessionId: string } | null>(null);
  
  // Prayer State
  const [prayerWeek, setPrayerWeek] = useState(getStartOfWeek(new Date()));

  function getStartOfWeek(date: Date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
      return new Date(d.setDate(diff));
  }

  // --- LOGIC: VISITATION ---
  const handleAddDate = () => {
      if(newDateInput) {
          if (selectedDates.includes(newDateInput)) {
             setNewDateInput('');
             return;
          }
          if (data.outreachSessions?.some(s => s.date === newDateInput)) {
              setErrorMsg(`Date ${formatDateDDMMYYYY(newDateInput)} already has a schedule.`);
              setTimeout(() => setErrorMsg(''), 3000);
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
      setIsSyncing(true);
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const res = generateOutreachSchedule(selectedDates, ujMembers);
      if (res.success) {
          setSelectedDates([]);
          onUpdate();
          setTimeout(() => setIsSyncing(false), 800);
      } else {
          setErrorMsg(res.message);
          setIsSyncing(false);
          setTimeout(() => setErrorMsg(''), 4000);
      }
  };

  const handleDeleteSession = (id: string) => {
      if(window.confirm('Are you sure you want to permanently delete this schedule from the cloud?')) {
          setIsSyncing(true);
          deleteOutreachSession(id);
          onUpdate();
          setTimeout(() => setIsSyncing(false), 800);
      }
  };

  const toggleVisitForMember = (session: OutreachSession, memberId: string) => {
      setIsSyncing(true);
      const currentVisited = session.visitedMemberIds || [];
      let newVisited;
      
      if (currentVisited.includes(memberId)) {
          newVisited = currentVisited.filter(id => id !== memberId);
      } else {
          newVisited = [...currentVisited, memberId];
      }

      const allDone = session.assignedMemberIds.every(id => newVisited.includes(id));
      
      saveOutreachSession({ 
          ...session, 
          visitedMemberIds: newVisited,
          status: allDone ? 'COMPLETED' : 'PENDING',
          completedBy: allDone ? currentUser.name : undefined
      });
      onUpdate();
      setTimeout(() => setIsSyncing(false), 800);
  };

  const handleMoveMember = (targetSessionId: string) => {
      if (!moveModal) return;
      setIsSyncing(true);
      const { memberId, currentSessionId } = moveModal;
      
      const currentSession = data.outreachSessions?.find(s => s.id === currentSessionId);
      const targetSession = data.outreachSessions?.find(s => s.id === targetSessionId);
      
      if (currentSession && targetSession) {
          // Remove from current
          currentSession.assignedMemberIds = currentSession.assignedMemberIds.filter(id => id !== memberId);
          currentSession.visitedMemberIds = (currentSession.visitedMemberIds || []).filter(id => id !== memberId);
          
          // Add to target
          if (!targetSession.assignedMemberIds.includes(memberId)) {
              targetSession.assignedMemberIds.push(memberId);
          }
          
          saveOutreachSession(currentSession);
          saveOutreachSession(targetSession);
          onUpdate();
          setMoveModal(null);
          setTimeout(() => setIsSyncing(false), 800);
      }
  };

  // --- LOGIC: PRAYER ---
  const handleGeneratePrayer = () => {
      setIsSyncing(true);
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const res = generatePrayerSchedule(prayerWeek, ujMembers);
      if (res.success) {
          onUpdate();
          setTimeout(() => setIsSyncing(false), 800);
      }
  };

  const togglePrayerComplete = (slot: PrayerSlot) => {
      setIsSyncing(true);
      savePrayerSlot({ ...slot, isCompleted: !slot.isCompleted });
      onUpdate();
      setTimeout(() => setIsSyncing(false), 800);
  };
  
  const weekSlots = useMemo(() => {
      if(!data.prayerSchedule) return [];
      const start = new Date(prayerWeek).toISOString().split('T')[0];
      const end = new Date(prayerWeek);
      end.setDate(end.getDate() + 5);
      const endStr = end.toISOString().split('T')[0];
      
      return data.prayerSchedule
        .filter(s => s.date >= start && s.date < endStr)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data.prayerSchedule, prayerWeek]);


  const sortedVisits = useMemo(() => {
      const pending = (data.outreachSessions || []).filter(s => s.status === 'PENDING').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const completed = (data.outreachSessions || []).filter(s => s.status === 'COMPLETED').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { pending, completed };
  }, [data.outreachSessions]);

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Sync Indicator */}
      {isSyncing && (
          <div className="fixed top-24 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-top-4">
              <Cloud size={14} className="animate-pulse" /> Saving to Cloud...
          </div>
      )}

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto no-scrollbar gap-1">
          <button onClick={() => setActiveTab('VISIT')} className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'VISIT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <MapPin size={18}/> Arrows Visits
          </button>
          <button onClick={() => setActiveTab('PRAYER')} className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'PRAYER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Heart size={18}/> Arrows Prayers
          </button>
          <button onClick={() => setActiveTab('TRACK')} className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'TRACK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <BarChart2 size={18}/> Progress
          </button>
      </div>

      {/* VISITATION TAB */}
      {activeTab === 'VISIT' && (
          <div className="space-y-6">
              
              {/* DATE PICKER & GENERATOR */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Calendar size={20}/> Schedule Visits</h3>
                    {selectedDates.length > 0 && (
                        <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">{selectedDates.length} selected</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                      {/* Date Input Row */}
                      <div className="flex gap-2">
                          <input 
                            type="date" 
                            className="flex-1 p-3 border border-slate-200 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                            value={newDateInput} 
                            onChange={e => setNewDateInput(e.target.value)} 
                          />
                          <button 
                            onClick={handleAddDate} 
                            disabled={!newDateInput}
                            className="px-4 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 disabled:opacity-50"
                          >
                            <Plus size={24}/>
                          </button>
                      </div>

                      {/* Selected Chips */}
                      {selectedDates.length > 0 && (
                          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              {selectedDates.map(d => (
                                  <div key={d} className="flex items-center gap-2 px-3 py-1.5 bg-white shadow-sm text-indigo-700 rounded-lg text-xs font-bold border border-slate-100 animate-in zoom-in">
                                      {formatDateDDMMYYYY(d)} 
                                      <button onClick={() => handleRemoveDate(d)} className="text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* Error Msg */}
                      {errorMsg && (
                          <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
                              <AlertCircle size={14}/> {errorMsg}
                          </div>
                      )}

                      <button 
                        onClick={handleGenerateSchedule}
                        disabled={selectedDates.length === 0}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                      >
                          Generate Batch Schedule
                      </button>
                  </div>
              </div>

              {/* SESSIONS LIST */}
              <div className="space-y-6">
                   {sortedVisits.pending.map(session => (
                       <div key={session.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                           {/* Header */}
                           <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex justify-between items-center">
                               <div>
                                   <h4 className="font-bold text-lg text-slate-800">{formatDateDDMMYYYY(session.date)}</h4>
                                   <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">{session.assignedMemberIds.length} Children Assigned</p>
                               </div>
                               <button onClick={() => handleDeleteSession(session.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                   <Trash2 size={18}/>
                               </button>
                           </div>

                           {/* Grid of Children */}
                           <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                               {session.assignedMemberIds.map(id => {
                                   const m = data.members.find(mem => mem.id === id);
                                   if (!m) return null;
                                   const isVisited = session.visitedMemberIds?.includes(id);

                                   return (
                                       <div 
                                        key={id} 
                                        onClick={() => toggleVisitForMember(session, id)}
                                        className={`
                                            relative p-3 rounded-2xl border cursor-pointer transition-all duration-200 select-none group
                                            ${isVisited 
                                                ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200 transform scale-[1.01]' 
                                                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                                            }
                                        `}
                                       >
                                           <div className="flex justify-between items-start">
                                               <div>
                                                   <h5 className={`font-bold text-sm ${isVisited ? 'text-white' : 'text-slate-800'}`}>{m.name}</h5>
                                                   <div className="flex gap-1 mt-1">
                                                       <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${isVisited ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{m.type}</span>
                                                       {m.address && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[80px] ${isVisited ? 'text-indigo-200' : 'text-slate-400'}`}>{m.address}</span>}
                                                   </div>
                                               </div>
                                               <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isVisited ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                                                   <Check size={12} strokeWidth={4}/>
                                               </div>
                                           </div>
                                           
                                           {/* Actions for this child */}
                                           {!isVisited && (
                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setMoveModal({ show: true, memberId: id, currentSessionId: session.id }); }}
                                                        className="p-1.5 bg-white text-slate-400 hover:text-orange-500 border border-slate-100 rounded-lg shadow-sm"
                                                    >
                                                        <ArrowRightLeft size={12}/>
                                                    </button>
                                                </div>
                                           )}
                                       </div>
                                   );
                               })}
                           </div>
                       </div>
                   ))}

                   {/* Completed Section */}
                   {sortedVisits.completed.length > 0 && (
                       <div className="mt-8">
                           <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Completed History</h4>
                           <div className="space-y-4">
                               {sortedVisits.completed.map(session => (
                                   <div key={session.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 opacity-75 hover:opacity-100 transition-opacity">
                                       <div className="flex justify-between items-center mb-2">
                                           <div className="flex items-center gap-2">
                                               <CheckCircle2 size={16} className="text-green-500"/>
                                               <span className="font-bold text-slate-700 line-through">{formatDateDDMMYYYY(session.date)}</span>
                                           </div>
                                           <button onClick={() => handleDeleteSession(session.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                       </div>
                                       <div className="text-xs text-slate-500 pl-6">
                                           {session.assignedMemberIds.length} children visited by {session.completedBy || 'Teacher'}
                                       </div>
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
          <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100">
                  <div>
                      <h3 className="font-bold text-lg text-slate-800">Weekly Prayer</h3>
                      <p className="text-xs text-slate-500 font-medium">3 Members • 1 FNF • 1 Inconsistent</p>
                  </div>
                  <button onClick={handleGeneratePrayer} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200">
                      Generate Week
                  </button>
              </div>

              <div className="space-y-4">
                  {weekSlots.length === 0 ? (
                      <div className="text-center p-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                          <p>No prayer schedule for this week.</p>
                          <button onClick={handleGeneratePrayer} className="mt-2 text-indigo-600 font-bold hover:underline">Generate Now</button>
                      </div>
                  ) : (
                      weekSlots.map(slot => (
                          <div key={slot.id} className={`bg-white rounded-3xl border transition-all overflow-hidden ${slot.isCompleted ? 'border-green-200 shadow-sm' : 'border-slate-100 shadow-sm'}`}>
                              <div className={`p-4 flex justify-between items-center ${slot.isCompleted ? 'bg-green-50' : 'bg-slate-50'}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg ${slot.isCompleted ? 'bg-green-200 text-green-700' : 'bg-white border border-slate-200 text-slate-600'}`}>
                                          {slot.dayOfWeek.substring(0,3)}
                                      </div>
                                      <div>
                                          <h4 className={`font-bold text-sm ${slot.isCompleted ? 'text-green-800' : 'text-slate-800'}`}>{formatDateDDMMYYYY(slot.date)}</h4>
                                          <p className={`text-xs ${slot.isCompleted ? 'text-green-600' : 'text-slate-400'} font-medium`}>{slot.assignedMemberIds.length} Children Targeted</p>
                                      </div>
                                  </div>
                                  
                                  <button 
                                    onClick={() => togglePrayerComplete(slot)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${slot.isCompleted ? 'bg-green-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                  >
                                      {slot.isCompleted ? <><CheckCircle2 size={14}/> Completed</> : "Mark Done"}
                                  </button>
                              </div>

                              <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
                                  {slot.assignedMemberIds.map(id => {
                                      const m = data.members.find(mem => mem.id === id);
                                      if (!m) return null;
                                      // Determine badge color based on role
                                      const isMem = m.type === 'Member';
                                      const isFnf = m.type === 'FNF';
                                      
                                      return (
                                          <div key={id} className={`p-3 rounded-xl border flex flex-col justify-center items-center text-center transition-opacity ${slot.isCompleted ? 'opacity-60 bg-green-50/50 border-green-100' : 'bg-white border-slate-100'}`}>
                                              <span className={`w-2 h-2 rounded-full mb-2 ${isMem ? 'bg-indigo-400' : isFnf ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                                              <p className="font-bold text-xs text-slate-700 leading-tight">{m.name}</p>
                                              <span className="text-[10px] text-slate-400 mt-1 font-medium bg-slate-50 px-1.5 py-0.5 rounded">{m.type}</span>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* MOVE MODAL */}
      {moveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                  <h3 className="font-bold text-lg mb-4 text-slate-800">Reschedule Visit</h3>
                  <p className="text-sm text-slate-500 mb-4">Select a new date for this child:</p>
                  
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {sortedVisits.pending
                        .filter(s => s.id !== moveModal.currentSessionId)
                        .map(s => (
                          <button 
                            key={s.id} 
                            onClick={() => handleMoveMember(s.id)}
                            className="w-full p-3 text-left border rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                          >
                              <div className="font-bold text-slate-800 group-hover:text-indigo-700">{formatDateDDMMYYYY(s.date)}</div>
                              <div className="text-xs text-slate-500 group-hover:text-indigo-500">{s.assignedMemberIds.length} kids assigned</div>
                          </button>
                      ))}
                      {sortedVisits.pending.filter(s => s.id !== moveModal.currentSessionId).length === 0 && (
                          <p className="text-center text-slate-400 italic text-sm p-4 bg-slate-50 rounded-xl">No other pending sessions found. Create a new schedule first.</p>
                      )}
                  </div>
                  <button onClick={() => setMoveModal(null)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors">Cancel</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default OutreachHub;