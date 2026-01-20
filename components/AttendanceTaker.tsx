import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Member, MemberType, MemberStatus, Church } from '../types';
import { getSundaysInYear } from '../constants';
import { Search, Save, Check, Clock, Trophy, X, Calendar, UserPlus, Users2, Filter, Crown } from 'lucide-react';
import { addMember, saveAttendance } from '../services/storageService';
import { sanitizeInput } from '../services/securityService';

interface AttendanceTakerProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({ data, onUpdate, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [punctualIds, setPunctualIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  
  // Internal Church Filter for Admins when activeChurch is 'CM'
  const [internalChurchFilter, setInternalChurchFilter] = useState<Church>('UJ');

  const [newMemberName, setNewMemberName] = useState('');
  const [isAddingFNF, setIsAddingFNF] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'MONTH' | 'CM'>('MONTH');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [attendanceMode, setAttendanceMode] = useState<'MEMBERS' | 'STAFF'>('MEMBERS');

  // Determine the effective church context
  // If Admin (CM), use the internal filter. If Teacher, use their fixed activeChurch.
  const effectiveChurch: Church = activeChurch === 'CM' ? internalChurchFilter : activeChurch;

  const enablePunctuality = (attendanceMode === 'MEMBERS' && effectiveChurch === 'UJ') || attendanceMode === 'STAFF';
  const sundays2026 = useMemo(() => getSundaysInYear(2026), []);

  useEffect(() => {
    setPresentIds(new Set());
    setPunctualIds(new Set());

    if (sundays2026.length > 0) {
        if (!selectedDate) {
            const today = new Date();
            const dayOfWeek = today.getDay(); 
            const currentSunday = new Date(today);
            currentSunday.setDate(today.getDate() - dayOfWeek);
            const currentSundayStr = currentSunday.toISOString().split('T')[0];
            const exists = sundays2026.some(d => d.toISOString().split('T')[0] === currentSundayStr);

            if (exists) setSelectedDate(currentSundayStr);
            else setSelectedDate(sundays2026[0].toISOString().split('T')[0]);
        }
    }
  }, [sundays2026]);

  // Load attendance data when context changes
  useEffect(() => {
    if (selectedDate) {
      if (attendanceMode === 'STAFF') {
          // If Staff mode, load staff attendance for the effective church
          const record = data.attendance.find(r => r.date === selectedDate && r.churchId === effectiveChurch);
          
          if (record) {
             const staffPresent = record.presentMemberIds.filter(id => {
                 const m = data.members.find(mem => mem.id === id);
                 return m && ['Teacher','Helper','Volunteer'].includes(m.type);
             });
             const staffPunctual = (record.punctualMemberIds || []).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && ['Teacher','Helper','Volunteer'].includes(m.type);
            });
             setPresentIds(new Set(staffPresent));
             setPunctualIds(new Set(staffPunctual));
          } else {
             setPresentIds(new Set());
             setPunctualIds(new Set());
          }
      } else {
          // Member Mode
          const record = data.attendance.find(r => r.date === selectedDate && r.churchId === effectiveChurch);
          if (record) {
            const membersPresent = record.presentMemberIds.filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && !['Teacher','Helper','Volunteer'].includes(m.type);
            });
            const membersPunctual = (record.punctualMemberIds || []).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && !['Teacher','Helper','Volunteer'].includes(m.type);
            });

            setPresentIds(new Set(membersPresent));
            setPunctualIds(new Set(membersPunctual));
          } else {
            setPresentIds(new Set<string>());
            setPunctualIds(new Set<string>());
          }
      }
    }
  }, [selectedDate, data.attendance, effectiveChurch, attendanceMode, data.members]);

  const handleToggle = (id: string) => {
    const newSet = new Set(presentIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      const newPunctual = new Set(punctualIds);
      if (newPunctual.has(id)) {
          newPunctual.delete(id);
          setPunctualIds(newPunctual);
      }
    } else {
      newSet.add(id);
    }
    setPresentIds(newSet);
  };

  const handlePunctualToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!enablePunctuality) return;
    const newPunctual = new Set(punctualIds);
    if (newPunctual.has(id)) {
      newPunctual.delete(id);
    } else {
      if (newPunctual.size >= 3) return;
      newPunctual.add(id);
      if (!presentIds.has(id)) {
        const newPresent = new Set(presentIds);
        newPresent.add(id);
        setPresentIds(newPresent);
      }
    }
    setPunctualIds(newPunctual);
  };

  const handleSave = () => {
    if (!selectedDate) return;

    // Load existing record for this date/church to preserve the "other" group (e.g. if we are editing Staff, don't wipe Members)
    const existingRecord = data.attendance.find(r => r.date === selectedDate && r.churchId === effectiveChurch);
    
    let finalPresent: string[] = [];
    let finalPunctual: string[] = [];

    if (existingRecord) {
        if (attendanceMode === 'STAFF') {
            // Preserve existing Members
            const existingMembers = existingRecord.presentMemberIds.filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && !['Teacher','Helper','Volunteer'].includes(m.type);
            });
            const existingMembersPunctual = (existingRecord.punctualMemberIds || []).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && !['Teacher','Helper','Volunteer'].includes(m.type);
            });
            finalPresent = [...existingMembers, ...Array.from(presentIds)];
            finalPunctual = [...existingMembersPunctual, ...Array.from(punctualIds)];
        } else {
            // Preserve existing Staff
            const existingStaff = existingRecord.presentMemberIds.filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && ['Teacher','Helper','Volunteer'].includes(m.type);
            });
            const existingStaffPunctual = (existingRecord.punctualMemberIds || []).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && ['Teacher','Helper','Volunteer'].includes(m.type);
            });
            finalPresent = [...existingStaff, ...Array.from(presentIds)];
            finalPunctual = [...existingStaffPunctual, ...Array.from(punctualIds)];
        }
    } else {
        finalPresent = Array.from(presentIds);
        finalPunctual = Array.from(punctualIds);
    }

    saveAttendance(selectedDate, effectiveChurch, finalPresent, finalPunctual);
    setSuccessMsg(`Saved for ${effectiveChurch}!`);
    onUpdate();
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleAddFNF = () => {
    if (!newMemberName.trim()) return;
    const cleanName = sanitizeInput(newMemberName);
    const newMember = addMember(cleanName, MemberType.FNF, effectiveChurch, '');
    const newSet = new Set(presentIds);
    newSet.add(newMember.id);
    setPresentIds(newSet);
    
    setNewMemberName('');
    setIsAddingFNF(false);
    onUpdate(); 
  };
  
  // --- LIST GENERATION ---
  let membersToList: Member[] = [];
  if (attendanceMode === 'STAFF') {
      membersToList = data.members.filter(m => m.status === MemberStatus.ACTIVE && m.assignedChurch === effectiveChurch && ['Teacher','Helper','Volunteer'].includes(m.type));
  } else {
      membersToList = data.members.filter(m => ['Active','Not Active'].includes(m.status) && m.assignedChurch === effectiveChurch && !['Teacher','Helper','Volunteer'].includes(m.type));
  }

  const filteredMembers = membersToList.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (a.transferPendingDate && !b.transferPendingDate) return -1;
    if (!a.transferPendingDate && b.transferPendingDate) return 1;
    
    // Sort logic: Punctual > Present > Type > Name
    if (enablePunctuality) {
        const aP = punctualIds.has(a.id);
        const bP = punctualIds.has(b.id);
        if (aP !== bP) return aP ? -1 : 1;
    }
    const aP = presentIds.has(a.id);
    const bP = presentIds.has(b.id);
    if (aP !== bP) return aP ? -1 : 1;
    
    return a.name.localeCompare(b.name);
  });

  const displayCount = filteredMembers.filter(m => presentIds.has(m.id)).length;
  const graduatingMembers = sortedMembers.filter(m => m.transferPendingDate);
  
  // Leaderboard Calc
  const leaderboardData = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let relevantRecords = data.attendance.filter(r => {
          const rDate = new Date(r.date);
          const isMonthMatch = leaderboardTimeframe === 'CM' || (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear);
          return r.churchId === effectiveChurch && isMonthMatch;
      });

      const scores: Record<string, number> = {};
      relevantRecords.forEach(r => {
          r.punctualMemberIds?.forEach(id => {
              const m = data.members.find(mem => mem.id === id);
              if (m) {
                  const isStaff = ['Teacher','Helper','Volunteer'].includes(m.type);
                  if ((attendanceMode === 'STAFF' && isStaff) || (attendanceMode === 'MEMBERS' && !isStaff)) {
                      scores[id] = (scores[id] || 0) + 1;
                  }
              }
          });
      });

      return Object.entries(scores)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10) // Top 10
          .map(([id, score], index) => ({ rank: index + 1, id, name: data.members.find(mem => mem.id === id)?.name || 'Unknown', count: score }));
  }, [data.attendance, effectiveChurch, attendanceMode, leaderboardTimeframe, data.members]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      
      {/* 1. TOP BAR: Date & Save & Mode */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-20">
        
        {/* Top Row: Date & Main Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             {/* Date Selector */}
             <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Calendar size={18} />
                </div>
                <select 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none block w-full pl-10 p-3 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                >
                    {sundays2026.map(d => {
                    const strDate = d.toISOString().split('T')[0];
                    const isToday = strDate === new Date().toISOString().split('T')[0];
                    return <option key={strDate} value={strDate}>{isToday ? 'Today, ' : ''}{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</option>
                    })}
                </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto">
                {isAdmin && (
                    <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                        <button onClick={() => { setAttendanceMode('MEMBERS'); setFilterType('All'); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${attendanceMode === 'MEMBERS' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>Members</button>
                        <button onClick={() => { setAttendanceMode('STAFF'); setFilterType('All'); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${attendanceMode === 'STAFF' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500'}`}>Staff</button>
                    </div>
                )}

                {enablePunctuality && (
                        <button onClick={() => setShowLeaderboard(true)} className="p-3 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors border border-amber-100" title="Leaderboard">
                            <Trophy size={20} />
                        </button>
                )}
                
                {attendanceMode === 'MEMBERS' && (
                    <button onClick={() => setIsAddingFNF(!isAddingFNF)} className="p-3 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100" title="Add FNF">
                            <UserPlus size={20} />
                    </button>
                )}
                
                <button 
                    onClick={handleSave}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95"
                >
                    <Save size={18} /> <span>Save</span>
                </button>
            </div>
        </div>

        {/* Admin Church Filters (Only if ActiveChurch is CM) */}
        {activeChurch === 'CM' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 border-t border-slate-100 pt-3">
                 <span className="flex items-center text-xs font-bold text-slate-400 uppercase mr-1 whitespace-nowrap">Target:</span>
                 {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(church => (
                     <button
                        key={church}
                        onClick={() => setInternalChurchFilter(church)}
                        className={`
                            px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                            ${internalChurchFilter === church 
                                ? 'bg-slate-800 text-white shadow-md' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}
                        `}
                     >
                         {church} Church
                     </button>
                 ))}
            </div>
        )}
      </div>

      {/* 2. SECOND BAR: Filters & Search */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-2 shadow-sm border border-slate-100 sticky top-0 z-10 shrink-0">
         <div className="flex flex-col gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400"
                    placeholder={`Search ${filteredMembers.length} names...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            {/* Horizontal Filter Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
                <button onClick={() => setFilterType('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filterType === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All</button>
                {(attendanceMode === 'STAFF' ? [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER] : [MemberType.MEMBER, MemberType.FNF, MemberType.INCONSISTENT]).map(type => (
                    <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>{type}</button>
                ))}
            </div>

            {/* Stats Row */}
            <div className="flex justify-between items-center px-3 pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-400">{filteredMembers.length} List • {effectiveChurch}</div>
                <div className="flex gap-4">
                     {enablePunctuality && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <Clock size={12}/> {punctualIds.size}/3
                        </div>
                     )}
                     <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                        <Check size={12}/> {displayCount} Present
                     </div>
                </div>
            </div>
         </div>
      </div>

      {isAddingFNF && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex gap-2 animate-in slide-in-from-top-2">
          <input type="text" placeholder="Visitor Name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} className="flex-1 p-2 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddFNF()}/>
          <button onClick={handleAddFNF} className="px-4 bg-amber-500 text-white rounded-xl font-bold">Add</button>
        </div>
      )}

      {/* 3. MAIN GRID (Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1 pb-10">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                 {sortedMembers.map(member => {
                    const isPresent = presentIds.has(member.id);
                    const isPunctual = punctualIds.has(member.id);
                    const isGraduating = !!member.transferPendingDate;
                    
                    return (
                        <div 
                            key={member.id}
                            onClick={() => handleToggle(member.id)}
                            className={`
                                relative p-4 rounded-2xl cursor-pointer transition-all duration-200 select-none group border
                                ${isPresent 
                                    ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200 transform scale-[1.01]' 
                                    : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                                }
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className={`font-bold text-lg leading-tight ${isPresent ? 'text-white' : 'text-slate-800'}`}>{member.name}</h4>
                                    <p className={`text-xs font-medium mt-1 uppercase tracking-wider ${isPresent ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {member.type} {isGraduating && '• Graduating'}
                                    </p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isPresent ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                                    <Check size={14} strokeWidth={4} />
                                </div>
                            </div>
                            
                            {/* Actions / Badges */}
                            <div className="mt-4 flex items-center gap-2">
                                {enablePunctuality && (
                                    <button 
                                        onClick={(e) => handlePunctualToggle(e, member.id)}
                                        disabled={!isPunctual && punctualIds.size >= 3}
                                        className={`p-1.5 rounded-lg transition-all ${
                                            isPunctual 
                                                ? 'bg-amber-400 text-white shadow-sm' 
                                                : isPresent 
                                                    ? 'bg-indigo-500 text-indigo-300 hover:bg-indigo-400 hover:text-white' 
                                                    : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500'
                                        } ${(!isPunctual && punctualIds.size >= 3) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    >
                                        <Trophy size={16} fill={isPunctual ? "currentColor" : "none"} />
                                    </button>
                                )}
                                {isGraduating && (
                                    <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${isPresent ? 'bg-indigo-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                        MOVING UP
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                 })}
             </div>
      </div>

      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
            <Check size={18} className="text-green-400" />
            <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
                  <div className="p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white relative overflow-hidden">
                       <div className="relative z-10 flex justify-between items-center">
                           <h3 className="text-2xl font-bold flex items-center gap-2"><Crown size={24}/> {effectiveChurch} Leaderboard</h3>
                           <button onClick={() => setShowLeaderboard(false)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><X size={20}/></button>
                       </div>
                       <p className="relative z-10 text-amber-100 text-sm mt-1">Celebrating our most punctual stars!</p>
                       <div className="absolute -bottom-10 -right-10 text-white/10 rotate-12"><Trophy size={140} /></div>
                  </div>
                  
                  <div className="p-2 flex gap-2 bg-slate-50 border-b border-slate-100">
                      {(['MONTH', 'CM'] as const).map(t => (
                          <button key={t} onClick={() => setLeaderboardTimeframe(t)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${leaderboardTimeframe === t ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400 hover:bg-white'}`}>{t === 'MONTH' ? 'This Month' : 'All Time'}</button>
                      ))}
                  </div>

                  <div className="overflow-y-auto p-4 space-y-3 flex-1">
                      {leaderboardData.length === 0 ? (
                          <div className="text-center py-10 text-slate-400"><p>No data yet.</p></div>
                      ) : (
                          leaderboardData.map((item, idx) => (
                              <div key={item.id} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx===0 ? 'bg-yellow-100 text-yellow-700' : idx===1 ? 'bg-slate-200 text-slate-700' : idx===2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'}`}>#{item.rank}</div>
                                  <div className="flex-1 font-bold text-slate-800">{item.name}</div>
                                  <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold text-xs">{item.count}x</div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AttendanceTaker;