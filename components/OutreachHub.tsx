import React, { useState, useMemo } from 'react';
import { AppData, Member, OutreachSession, PrayerSlot, MemberType } from '../types';
import { generateOutreachSchedule, saveOutreachSession, deleteOutreachSession, savePrayerSlot, updateMember } from '../services/storageService';
import { Calendar, MapPin, Phone, MessageSquare, Plus, Trash2, CheckCircle2, Clock, User, Heart, AlertCircle, Save, ArrowRightLeft, Target, BarChart2, ChevronUp, ChevronDown, FolderOpen, Folder, Users } from 'lucide-react';

interface OutreachHubProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
};

const OutreachHub: React.FC<OutreachHubProps> = ({ data, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'VISIT' | 'PRAYER' | 'CONTACTS' | 'TRACK'>('VISIT');
  
  // Visitation State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [moveModal, setMoveModal] = useState<{ show: boolean, memberId: string, currentSessionId: string } | null>(null);
  
  // Collapsible States
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [trackOpenStates, setTrackOpenStates] = useState<Record<string, boolean>>({
      'MEMBER': true,
      'FNF': true,
      'INCONSISTENT': true
  });
  
  // Prayer State
  const [prayerWeek, setPrayerWeek] = useState(getStartOfWeek(new Date()));

  function getStartOfWeek(date: Date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      return new Date(d.setDate(diff));
  }

  // --- SORTING HELPER ---
  const sortMembersByType = (a: Member, b: Member) => {
      const order = { [MemberType.MEMBER]: 1, [MemberType.FNF]: 2, [MemberType.INCONSISTENT]: 3, [MemberType.NOT_MEMBER]: 4 };
      const rankA = order[a.type as any] || 99;
      const rankB = order[b.type as any] || 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
  };

  // --- LOGIC: VISITATION ---
  const handleAddDate = () => {
      if(newDateInput && !selectedDates.includes(newDateInput)) {
          // Check if exists in DB
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
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const res = generateOutreachSchedule(selectedDates, ujMembers);
      if (res.success) {
          setSelectedDates([]);
          onUpdate();
      } else {
          setErrorMsg(res.message);
          setTimeout(() => setErrorMsg(''), 4000);
      }
  };

  const handleDeleteSession = (id: string) => {
      if(window.confirm('Are you sure you want to delete this visit schedule?')) {
          deleteOutreachSession(id);
          onUpdate();
      }
  };

  const pendingVisits = useMemo(() => {
      return (data.outreachSessions || [])
        .filter(s => s.status === 'PENDING')
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data.outreachSessions]);
  
  const completedVisits = useMemo(() => {
      return (data.outreachSessions || [])
        .filter(s => s.status === 'COMPLETED')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.outreachSessions]);

  const toggleVisitForMember = (session: OutreachSession, memberId: string) => {
      const currentVisited = session.visitedMemberIds || [];
      let newVisited;
      
      if (currentVisited.includes(memberId)) {
          newVisited = currentVisited.filter(id => id !== memberId);
      } else {
          newVisited = [...currentVisited, memberId];
      }

      // Check if all assigned are now visited
      const allDone = session.assignedMemberIds.every(id => newVisited.includes(id));
      
      saveOutreachSession({ 
          ...session, 
          visitedMemberIds: newVisited,
          status: allDone ? 'COMPLETED' : 'PENDING',
          completedBy: allDone ? currentUser.name : undefined
      });
      onUpdate();
  };

  const handleMoveMember = (targetSessionId: string) => {
      if (!moveModal) return;
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
      }
  };

  const openMap = (member: Member) => {
      if (member.gpsCoordinates) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${member.gpsCoordinates}`, '_blank');
      } else if (member.address) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(member.address)}`, '_blank');
      } else {
          alert('No location data available for this member.');
      }
  };

  // --- LOGIC: PRAYER ---
  const generatePrayerWeek = () => {
      const start = new Date(prayerWeek);
      const slots: PrayerSlot[] = [];
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      
      // Shuffle
      const pool = [...ujMembers].sort(() => 0.5 - Math.random());
      
      for (let i=0; i<5; i++) { // Mon-Fri
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          
          const existing = data.prayerSchedule?.find(s => s.date === dateStr);
          if (!existing) {
              const targetMembers = pool.splice(0, 4).map(m => m.id); // 4 members per day
              if (targetMembers.length > 0) {
                  slots.push({
                      id: crypto.randomUUID(),
                      date: dateStr,
                      dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long'}),
                      assignedMemberIds: targetMembers,
                      isCompleted: false,
                      durationMins: 30
                  });
              }
          }
      }
      
      slots.forEach(s => savePrayerSlot(s));
      onUpdate();
  };

  const togglePrayerComplete = (slot: PrayerSlot) => {
      savePrayerSlot({ ...slot, isCompleted: !slot.isCompleted });
      onUpdate();
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

  // --- LOGIC: TRACKING ---
  const trackingGroups = useMemo(() => {
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const sorted = ujMembers.sort(sortMembersByType);
      
      const groups: Record<string, { member: Member, visitCount: number, prayerStats: any }[]> = {
          'MEMBER': [],
          'FNF': [],
          'INCONSISTENT': []
      };

      sorted.forEach(m => {
          // Visits
          const visitCount = (data.outreachSessions || []).filter(s => s.visitedMemberIds?.includes(m.id)).length;
          
          // Prayers
          const prayers = (data.prayerSchedule || []).filter(s => s.assignedMemberIds.includes(m.id) && s.isCompleted);
          const now = new Date();
          const startOfWeek = getStartOfWeek(now);
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
          const startOfYear = new Date(now.getFullYear(), 0, 1);

          const prayerStats = {
              week: prayers.filter(p => new Date(p.date) >= startOfWeek).length,
              month: prayers.filter(p => new Date(p.date) >= startOfMonth).length,
              quarter: prayers.filter(p => new Date(p.date) >= startOfQuarter).length,
              year: prayers.filter(p => new Date(p.date) >= startOfYear).length,
          };

          const key = m.type === MemberType.MEMBER ? 'MEMBER' : m.type === MemberType.FNF ? 'FNF' : 'INCONSISTENT';
          if (groups[key]) groups[key].push({ member: m, visitCount, prayerStats });
          else {
              // Handle outliers or new types safely if needed, for now skip or add to inconsistent
              groups['INCONSISTENT'].push({ member: m, visitCount, prayerStats }); 
          }
      });
      return groups;
  }, [data.members, data.outreachSessions, data.prayerSchedule]);


  return (
    <div className="space-y-6 pb-20">
      
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto no-scrollbar gap-2">
          <button onClick={() => setActiveTab('VISIT')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'VISIT' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <MapPin size={18}/> Arrows Visits
          </button>
          <button onClick={() => setActiveTab('PRAYER')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'PRAYER' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Heart size={18}/> Arrows Prayers
          </button>
          <button onClick={() => setActiveTab('CONTACTS')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'CONTACTS' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Phone size={18}/> Contact Mgmt
          </button>
          <button onClick={() => setActiveTab('TRACK')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'TRACK' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <BarChart2 size={18}/> Track Progress
          </button>
      </div>

      {/* VISITATION TAB */}
      {activeTab === 'VISIT' && (
          <div className="space-y-6">
              
              {/* SCHEDULER CARD */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Calendar size={20}/> Schedule Visits</h3>
                  
                  {errorMsg && (
                      <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-center gap-2">
                          <AlertCircle size={16}/> {errorMsg}
                      </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-400 uppercase">Add Date (Saturday 10am-3pm)</label>
                          <div className="flex gap-2 mt-1">
                              <input type="date" className="flex-1 p-2 border rounded-xl" value={newDateInput} onChange={e => setNewDateInput(e.target.value)} />
                              <button onClick={handleAddDate} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Plus size={20}/></button>
                          </div>
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-400 uppercase">Selected Dates</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                              {selectedDates.length === 0 && <span className="text-sm text-slate-400 italic">None selected</span>}
                              {selectedDates.map(d => (
                                  <div key={d} className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                                      {formatDateDDMMYYYY(d)} <button onClick={() => handleRemoveDate(d)}><Trash2 size={12}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <button 
                    onClick={handleGenerateSchedule}
                    disabled={selectedDates.length === 0}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                      Generate Fair Schedule
                  </button>
              </div>

              {/* UPCOMING VISITS */}
              <div className="space-y-4">
                  <button 
                    onClick={() => setIsUpcomingOpen(!isUpcomingOpen)}
                    className="flex items-center justify-between w-full px-2 py-2 text-left"
                  >
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><FolderOpen size={20} className="text-indigo-500"/> Upcoming Visits</h3>
                      {isUpcomingOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                  </button>
                  
                  {isUpcomingOpen && (
                      pendingVisits.length === 0 ? (
                          <div className="text-center p-8 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">No pending visits scheduled.</div>
                      ) : (
                          pendingVisits.map(session => (
                              <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden transition-all hover:shadow-md">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                  <div className="flex justify-between items-start mb-4 pl-3">
                                      <div>
                                          <h4 className="font-bold text-lg text-slate-800">{formatDateDDMMYYYY(session.date)}</h4>
                                          <p className="text-xs text-slate-500 font-medium flex items-center gap-1"><Clock size={12}/> {session.startTime} - {session.endTime}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <div className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
                                              {session.assignedMemberIds.length} Kids
                                          </div>
                                          <button onClick={() => handleDeleteSession(session.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                                  
                                  <div className="space-y-3 pl-3">
                                      {session.assignedMemberIds
                                        .sort((a,b) => {
                                            // Sort visited to bottom
                                            const aVisited = session.visitedMemberIds?.includes(a) ? 1 : 0;
                                            const bVisited = session.visitedMemberIds?.includes(b) ? 1 : 0;
                                            return aVisited - bVisited;
                                        })
                                        .map(id => {
                                          const m = data.members.find(mem => mem.id === id);
                                          if(!m) return null;
                                          const isVisited = session.visitedMemberIds?.includes(id);

                                          return (
                                              <div key={id} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${isVisited ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100'}`}>
                                                  <div className="flex items-center gap-3">
                                                      <button 
                                                        onClick={() => toggleVisitForMember(session, id)}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${isVisited ? 'bg-green-500 border-green-500 text-white scale-110' : 'bg-white border-slate-300 text-transparent hover:border-indigo-400'}`}
                                                      >
                                                          <CheckCircle2 size={16} fill={isVisited ? "currentColor" : "none"}/>
                                                      </button>
                                                      <div className={isVisited ? 'line-through text-slate-400' : ''}>
                                                          <p className="font-bold text-sm text-slate-700">{m.name}</p>
                                                          {!isVisited && (
                                                              <div className="flex items-center gap-2 mt-0.5">
                                                                  <span className={`text-[10px] px-1.5 rounded font-bold ${m.type === 'Member' ? 'bg-indigo-100 text-indigo-700' : m.type === 'FNF' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{m.type}</span>
                                                                  <p className="text-[10px] text-slate-400 truncate w-32">{m.address || 'No Address'}</p>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                                  <div className="flex gap-2">
                                                      <button onClick={() => openMap(m)} className="p-2 bg-white rounded-full shadow-sm text-blue-500 hover:bg-blue-50 border border-slate-100" title="Map"><MapPin size={16}/></button>
                                                      {!isVisited && <button onClick={() => setMoveModal({ show: true, memberId: id, currentSessionId: session.id })} className="p-2 bg-white rounded-full shadow-sm text-slate-500 hover:text-orange-500 hover:bg-orange-50 border border-slate-100" title="Reschedule"><ArrowRightLeft size={16}/></button>}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))
                      )
                  )}
              </div>

              {/* COMPLETED VISITS */}
              <div className="space-y-4">
                  <button 
                    onClick={() => setIsCompletedOpen(!isCompletedOpen)}
                    className="flex items-center justify-between w-full px-2 py-2 text-left"
                  >
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Folder size={20} className="text-green-600"/> Visit Completed History</h3>
                      {isCompletedOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                  </button>

                  {isCompletedOpen && (
                      completedVisits.length === 0 ? (
                          <div className="text-center p-8 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">No completed visits history.</div>
                      ) : (
                          completedVisits.map(session => (
                              <div key={session.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                                  <div className="flex justify-between items-start mb-4">
                                      <div>
                                          <h4 className="font-bold text-lg text-slate-600 strike-through">{formatDateDDMMYYYY(session.date)}</h4>
                                          <p className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Completed by {session.completedBy || 'Teacher'}</p>
                                      </div>
                                      <button onClick={() => handleDeleteSession(session.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                                  <div className="space-y-1">
                                      {session.assignedMemberIds.map(id => {
                                          const m = data.members.find(mem => mem.id === id);
                                          return m ? (
                                              <div key={id} className="flex items-center gap-2 text-xs text-slate-500">
                                                  <CheckCircle2 size={12} className="text-green-500"/>
                                                  <span>{m.name}</span>
                                              </div>
                                          ) : null;
                                      })}
                                  </div>
                              </div>
                          ))
                      )
                  )}
              </div>
          </div>
      )}

      {/* TRACKING TAB */}
      {activeTab === 'TRACK' && (
          <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Target size={20}/> Progress Tracker</h3>
                  <div className="text-xs font-bold text-slate-400">Target: 2 Visits / Year</div>
              </div>
              
              {/* MEMBER SECTION */}
              {(['MEMBER', 'FNF', 'INCONSISTENT'] as const).map(type => (
                  <div key={type} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                      <button 
                        onClick={() => setTrackOpenStates({...trackOpenStates, [type]: !trackOpenStates[type]})}
                        className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-100 transition-colors"
                      >
                          <h4 className={`font-bold text-sm flex items-center gap-2 ${type === 'MEMBER' ? 'text-indigo-600' : type === 'FNF' ? 'text-amber-600' : 'text-rose-600'}`}>
                              {type === 'MEMBER' ? <User size={18}/> : type === 'FNF' ? <Users size={18}/> : <AlertCircle size={18}/>}
                              {type === 'MEMBER' ? 'Members' : type === 'FNF' ? 'Friends & Family' : 'Inconsistent'} 
                              <span className="text-slate-400 font-normal">({trackingGroups[type]?.length || 0})</span>
                          </h4>
                          {trackOpenStates[type] ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                      </button>
                      
                      {trackOpenStates[type] && (
                          <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                                      <tr>
                                          <th className="p-4">Name</th>
                                          <th className="p-4 text-center">Visits (Yr)</th>
                                          <th className="p-4 text-center">Pray (Wk)</th>
                                          <th className="p-4 text-center">Pray (Mo)</th>
                                          <th className="p-4 text-center">Pray (Yr)</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {trackingGroups[type].map(({ member, visitCount, prayerStats }) => (
                                          <tr key={member.id} className="hover:bg-slate-50">
                                              <td className="p-4 font-bold text-slate-700">{member.name}</td>
                                              <td className="p-4 text-center">
                                                  <div className="flex justify-center items-center gap-1">
                                                      <span className={`font-bold ${visitCount >= 2 ? 'text-green-600' : 'text-slate-600'}`}>{visitCount}</span>
                                                      <span className="text-slate-300 text-xs">/ 2</span>
                                                      {visitCount >= 2 && <CheckCircle2 size={12} className="text-green-500"/>}
                                                  </div>
                                                  <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">
                                                      <div className={`h-full ${visitCount >= 2 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{width: `${Math.min(100, (visitCount/2)*100)}%`}}></div>
                                                  </div>
                                              </td>
                                              <td className="p-4 text-center font-medium text-slate-500">{prayerStats.week}</td>
                                              <td className="p-4 text-center font-medium text-slate-500">{prayerStats.month}</td>
                                              <td className="p-4 text-center font-bold text-indigo-600">{prayerStats.year}</td>
                                          </tr>
                                      ))}
                                      {trackingGroups[type].length === 0 && (
                                          <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">No members in this category.</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}

      {/* PRAYER TAB */}
      {activeTab === 'PRAYER' && (
          <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-lg">Prayer Schedule</h3>
                  <button onClick={generatePrayerWeek} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm">Generate This Week</button>
              </div>

              <div className="space-y-4">
                  {weekSlots.length === 0 ? (
                      <div className="text-center p-10 text-slate-400">No prayer slots generated for this week.</div>
                  ) : (
                      weekSlots.map(slot => (
                          <div key={slot.id} className={`p-4 rounded-2xl border transition-all ${slot.isCompleted ? 'bg-green-50 border-green-100 opacity-70' : 'bg-white border-slate-100 shadow-sm'}`}>
                              <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2">
                                      <div className={`p-2 rounded-lg ${slot.isCompleted ? 'bg-green-200 text-green-700' : 'bg-indigo-100 text-indigo-600'}`}>
                                          <Clock size={20}/>
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-800">{slot.dayOfWeek}</h4>
                                          <p className="text-xs text-slate-500">{formatDateDDMMYYYY(slot.date)} • {slot.durationMins} mins</p>
                                      </div>
                                  </div>
                                  <button onClick={() => togglePrayerComplete(slot)} className={`w-8 h-8 rounded-full flex items-center justify-center border ${slot.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-slate-300 hover:border-green-500 hover:text-green-500'}`}>
                                      <CheckCircle2 size={18}/>
                                  </button>
                              </div>
                              
                              <div className="flex flex-col gap-2 pl-2 border-l-2 border-slate-100">
                                  {slot.assignedMemberIds.map(id => {
                                      const m = data.members.find(mem => mem.id === id);
                                      return m ? (
                                          <div key={id} className="flex items-center justify-between text-xs">
                                              <div className="flex items-center gap-2">
                                                  <span className={`w-2 h-2 rounded-full ${m.type === 'Member' ? 'bg-indigo-400' : m.type === 'FNF' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                                                  <span className="font-medium text-slate-700">{m.name}</span>
                                              </div>
                                              <span className="text-slate-400 italic text-[10px]">{m.type}</span>
                                          </div>
                                      ) : null;
                                  })}
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* CONTACTS TAB */}
      {activeTab === 'CONTACTS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                      <tr>
                          <th className="p-4">Name</th>
                          <th className="p-4">Contact Info</th>
                          <th className="p-4">Location</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper'].includes(m.type)).sort(sortMembersByType).map(m => (
                          <ContactRow key={m.id} member={m} onUpdate={onUpdate} />
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* MOVE MODAL */}
      {moveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                  <h3 className="font-bold text-lg mb-4">Reschedule Visit</h3>
                  <p className="text-sm text-slate-500 mb-4">Move child to another existing session:</p>
                  
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {pendingVisits
                        .filter(s => s.id !== moveModal.currentSessionId)
                        .map(s => (
                          <button 
                            key={s.id} 
                            onClick={() => handleMoveMember(s.id)}
                            className="w-full p-3 text-left border rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                          >
                              <div className="font-bold text-slate-800">{formatDateDDMMYYYY(s.date)}</div>
                              <div className="text-xs text-slate-500">{s.assignedMemberIds.length} kids assigned</div>
                          </button>
                      ))}
                      {pendingVisits.filter(s => s.id !== moveModal.currentSessionId).length === 0 && (
                          <p className="text-center text-slate-400 italic">No other pending sessions available.</p>
                      )}
                  </div>
                  <button onClick={() => setMoveModal(null)} className="w-full py-2 text-slate-500 font-bold">Cancel</button>
              </div>
          </div>
      )}
    </div>
  );
};

// Sub-component for editing contacts inline
const ContactRow = ({ member, onUpdate }: { member: Member, onUpdate: () => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ 
        parentPhone: member.parentPhone || '', 
        address: member.address || '',
        gpsCoordinates: member.gpsCoordinates || ''
    });

    const handleSave = async () => {
        await updateMember({ ...member, ...editData });
        setIsEditing(false);
        onUpdate();
    };

    if (isEditing) {
        return (
            <tr className="bg-slate-50">
                <td className="p-4 font-bold">
                    {member.name}
                    <div className={`text-[10px] px-1.5 w-fit rounded font-bold mt-1 ${member.type === 'Member' ? 'bg-indigo-100 text-indigo-700' : member.type === 'FNF' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{member.type}</div>
                </td>
                <td className="p-4">
                    <input className="w-full p-2 border rounded-lg text-xs" placeholder="Phone" value={editData.parentPhone} onChange={e => setEditData({...editData, parentPhone: e.target.value})} />
                </td>
                <td className="p-4 space-y-2">
                    <input className="w-full p-2 border rounded-lg text-xs" placeholder="Address" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                    <input className="w-full p-2 border rounded-lg text-xs" placeholder="GPS (e.g. 5.6,-0.1)" value={editData.gpsCoordinates} onChange={e => setEditData({...editData, gpsCoordinates: e.target.value})} />
                    <button onClick={handleSave} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"><Save size={12}/> Save</button>
                </td>
            </tr>
        );
    }

    return (
        <tr className="hover:bg-slate-50 group">
            <td className="p-4 font-bold text-slate-700">
                {member.name}
                <div className={`text-[10px] px-1.5 w-fit rounded font-bold mt-1 ${member.type === 'Member' ? 'bg-indigo-100 text-indigo-700' : member.type === 'FNF' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{member.type}</div>
            </td>
            <td className="p-4 text-slate-500">
                {member.parentPhone ? (
                    <div className="flex items-center gap-2">
                        <Phone size={14}/> {member.parentPhone}
                    </div>
                ) : <span className="text-slate-300 italic">No phone</span>}
            </td>
            <td className="p-4 text-slate-500">
                <div className="flex justify-between items-center">
                    <span>{member.address || <span className="text-slate-300 italic">No Address</span>}</span>
                    <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 p-2 text-indigo-600 bg-indigo-50 rounded-lg"><User size={14}/></button>
                </div>
            </td>
        </tr>
    );
};

export default OutreachHub;