import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Member, MemberType, MemberStatus, Church } from '../types';
import { getSundaysInYear } from '../constants';
import { Search, Plus, Check, Save, GraduationCap, User, Users, AlertCircle, HelpCircle, Clock, Trophy, X, Calendar, Heart, Hand, Briefcase, ArrowRightCircle, Medal, Crown } from 'lucide-react';
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
  const [filterType, setFilterType] = useState<string>('CM');
  const [newMemberName, setNewMemberName] = useState('');
  const [isAddingFNF, setIsAddingFNF] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'MONTH' | 'CM'>('MONTH');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Toggle for Admins to switch between taking Member Attendance (per church) vs Staff Attendance (all)
  const [attendanceMode, setAttendanceMode] = useState<'MEMBERS' | 'STAFF'>('MEMBERS');

  // Punctuality feature: Enabled for UJ Members AND Global Staff
  const enablePunctuality = (attendanceMode === 'MEMBERS' && activeChurch === 'UJ') || attendanceMode === 'STAFF';

  // Generate Sundays for 2026
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
  }, [sundays2026, activeChurch, attendanceMode]);

  useEffect(() => {
    if (selectedDate) {
      if (attendanceMode === 'STAFF') {
          const allPresent = new Set<string>();
          const allPunctual = new Set<string>();
          
          data.attendance.filter(r => r.date === selectedDate).forEach(record => {
              // Get Present Staff
              record.presentMemberIds.forEach(id => {
                  const m = data.members.find(mem => mem.id === id);
                  if (m && (m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER)) {
                      allPresent.add(id);
                  }
              });
              // Get Punctual Staff
              if (record.punctualMemberIds) {
                  record.punctualMemberIds.forEach(id => {
                      const m = data.members.find(mem => mem.id === id);
                      if (m && (m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER)) {
                          allPunctual.add(id);
                      }
                  });
              }
          });
          setPresentIds(allPresent);
          setPunctualIds(allPunctual);
      } else {
          // Normal Member Mode
          const record = data.attendance.find(r => r.date === selectedDate && r.churchId === activeChurch);
          if (record) {
            setPresentIds(new Set(record.presentMemberIds));
            setPunctualIds(new Set(record.punctualMemberIds || []));
          } else {
            setPresentIds(new Set());
            setPunctualIds(new Set());
          }
      }
    }
  }, [selectedDate, data.attendance, activeChurch, attendanceMode, data.members]);

  const handleToggle = (id: string) => {
    const newSet = new Set(presentIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      // If removed from present, remove from punctual too
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
      if (newPunctual.size >= 3) {
        return; // Limit reached
      }
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

    if (attendanceMode === 'STAFF') {
        const churches: Church[] = ['UJ', 'I', 'K', 'LJ'];
        
        churches.forEach(church => {
            const existingRecord = data.attendance.find(r => r.date === selectedDate && r.churchId === church);
            
            // 1. Preserve Existing MEMBERS (Non-Staff)
            const existingMembersPresent = existingRecord 
                ? existingRecord.presentMemberIds.filter(id => {
                    const m = data.members.find(mem => mem.id === id);
                    return m && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER;
                }) 
                : [];
            
            const existingMembersPunctual = existingRecord 
                ? (existingRecord.punctualMemberIds || []).filter(id => {
                    const m = data.members.find(mem => mem.id === id);
                    return m && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER;
                }) 
                : [];

            // 2. Get New STAFF for this church
            const staffPresentForThisChurch = Array.from(presentIds).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && m.assignedChurch === church;
            });

            const staffPunctualForThisChurch = Array.from(punctualIds).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && m.assignedChurch === church;
            });

            // 3. Merge
            const mergedPresent = [...existingMembersPresent, ...staffPresentForThisChurch];
            const mergedPunctual = [...existingMembersPunctual, ...staffPunctualForThisChurch];
            
            saveAttendance(selectedDate, church, mergedPresent, mergedPunctual);
        });

        setSuccessMsg(`Staff attendance & punctuality synced!`);
    } else {
        saveAttendance(selectedDate, activeChurch, Array.from(presentIds) as string[], Array.from(punctualIds) as string[]);
        setSuccessMsg(`Attendance for ${activeChurch} saved!`);
    }
    
    onUpdate();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddFNF = () => {
    if (!newMemberName.trim()) return;
    
    // Sanitize
    const cleanName = sanitizeInput(newMemberName);

    const newMember = addMember(cleanName, MemberType.FNF, activeChurch, '');
    const newSet = new Set(presentIds);
    newSet.add(newMember.id);
    setPresentIds(newSet);
    if (selectedDate && attendanceMode === 'MEMBERS') {
        saveAttendance(selectedDate, activeChurch, Array.from(newSet) as string[], Array.from(punctualIds) as string[]);
    }
    setNewMemberName('');
    setIsAddingFNF(false);
    onUpdate(); 
  };
  
  // --- LIST GENERATION ---
  
  let membersToList: Member[] = [];

  if (attendanceMode === 'STAFF') {
      membersToList = data.members.filter(m => 
          (m.status === MemberStatus.ACTIVE) &&
          (m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER)
      );
  } else {
      if (activeChurch === 'CM') {
          membersToList = [];
      } else {
          membersToList = data.members.filter(m => 
            (m.status === MemberStatus.ACTIVE || m.status === MemberStatus.NOT_ACTIVE) &&
            m.assignedChurch === activeChurch &&
            (m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER)
          );
      }
  }

  const filteredMembers = membersToList.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'CM' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    // Prioritize pending transfer at top
    if (a.transferPendingDate && !b.transferPendingDate) return -1;
    if (!a.transferPendingDate && b.transferPendingDate) return 1;

    if (enablePunctuality) {
        const aPunctual = punctualIds.has(a.id);
        const bPunctual = punctualIds.has(b.id);
        if (aPunctual !== bPunctual) return aPunctual ? -1 : 1;
    }
    const aPresent = presentIds.has(a.id);
    const bPresent = presentIds.has(b.id);
    if (aPresent !== bPresent) return aPresent ? -1 : 1;
    
    const priority = { [MemberType.TEACHER]: 0, [MemberType.HELPER]: 1, [MemberType.VOLUNTEER]: 2, [MemberType.MEMBER]: 3 };
    const aP = priority[a.type] ?? 9;
    const bP = priority[b.type] ?? 9;
    if (aP !== bP) return aP - bP;

    return a.name.localeCompare(b.name);
  });

  const getMemberIcon = (type: MemberType) => {
    switch (type) {
        case MemberType.TEACHER: return <GraduationCap size={14} />;
        case MemberType.HELPER: return <Heart size={14} />;
        case MemberType.VOLUNTEER: return <Hand size={14} />;
        case MemberType.FNF: return <Users size={14} />;
        case MemberType.INCONSISTENT: return <AlertCircle size={14} />;
        case MemberType.NOT_MEMBER: return <HelpCircle size={14} />;
        default: return <User size={14} />;
    }
  }

  const getMemberStyle = (type: MemberType) => {
    switch (type) {
        case MemberType.TEACHER: return 'bg-purple-100 text-purple-700';
        case MemberType.HELPER: return 'bg-pink-100 text-pink-700';
        case MemberType.VOLUNTEER: return 'bg-orange-100 text-orange-700';
        case MemberType.FNF: return 'bg-amber-100 text-amber-700';
        case MemberType.INCONSISTENT: return 'bg-rose-100 text-rose-700';
        case MemberType.NOT_MEMBER: return 'bg-slate-100 text-slate-700';
        default: return 'bg-indigo-100 text-indigo-700';
    }
  }

  // Count logic
  const displayCount = filteredMembers.filter(m => presentIds.has(m.id)).length;
  const graduatingMembers = sortedMembers.filter(m => m.transferPendingDate);
  
  // --- LEADERBOARD LOGIC ---
  const leaderboardData = useMemo(() => {
      // 1. Filter Records based on context (Member vs Staff) and Timeframe (Month vs All)
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let relevantRecords = data.attendance.filter(r => {
          const rDate = new Date(r.date);
          const isMonthMatch = leaderboardTimeframe === 'CM' || (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear);
          
          if (attendanceMode === 'STAFF') {
              // For staff, we look at all records from all churches
              return isMonthMatch;
          } else {
              // For members, only specific church
              return r.churchId === activeChurch && isMonthMatch;
          }
      });

      // 2. Count Punctuality
      const scores: Record<string, number> = {};
      relevantRecords.forEach(r => {
          if (r.punctualMemberIds) {
              r.punctualMemberIds.forEach(id => {
                  const m = data.members.find(mem => mem.id === id);
                  // Ensure we are only counting people relevant to current view mode
                  if (m) {
                      const isStaff = m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER;
                      const isModeMatch = attendanceMode === 'STAFF' ? isStaff : !isStaff;
                      
                      if (isModeMatch) {
                          scores[id] = (scores[id] || 0) + 1;
                      }
                  }
              });
          }
      });

      // 3. Sort and Format
      return Object.entries(scores)
          .sort(([, a], [, b]) => b - a)
          .map(([id, score], index) => {
              const m = data.members.find(mem => mem.id === id);
              return { 
                  rank: index + 1,
                  id, 
                  name: m?.name || 'Unknown', 
                  type: m?.type || 'Unknown',
                  count: score 
              };
          });
  }, [data.attendance, data.members, activeChurch, attendanceMode, leaderboardTimeframe]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-140px)] relative overflow-hidden">
      
      {/* ADMIN TOGGLE */}
      {isAdmin && (
          <div className="p-2 bg-gray-100 flex justify-center border-b border-gray-200">
             <div className="bg-white p-1 rounded-lg shadow-sm flex">
                 <button 
                    onClick={() => { setAttendanceMode('MEMBERS'); setFilterType('CM'); }}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${attendanceMode === 'MEMBERS' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                 >
                    <Users size={16}/> Members ({activeChurch})
                 </button>
                 <button 
                    onClick={() => { setAttendanceMode('STAFF'); setFilterType('CM'); }}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${attendanceMode === 'STAFF' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                 >
                    <Briefcase size={16}/> Staff (CM)
                 </button>
             </div>
          </div>
      )}

      {/* Header Controls */}
      <div className="p-3 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <label className="text-[10px] uppercase font-bold text-gray-400">Service Date</label>
          <select 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
          >
            {sundays2026.map(d => {
              const strDate = d.toISOString().split('T')[0];
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = strDate === todayStr;
              return <option key={strDate} value={strDate}>{isToday ? '👉 ' : ''}{d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'})}</option>
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
           {/* LEADERBOARD BUTTON */}
           {enablePunctuality && (
                <button 
                    onClick={() => setShowLeaderboard(true)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors flex-1 md:flex-none"
                    title="Punctuality Leaderboard"
                >
                    <Trophy size={18} />
                    <span className="hidden sm:inline">Leaderboard</span>
                </button>
           )}
           
           {attendanceMode === 'MEMBERS' && activeChurch !== 'CM' && (
               <button 
                onClick={() => setIsAddingFNF(!isAddingFNF)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors flex-1 md:flex-none whitespace-nowrap"
                >
                <Plus size={16} /> Add FNF
                </button>
           )}
          <button 
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex-1 md:flex-none whitespace-nowrap"
          >
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      {isAddingFNF && attendanceMode === 'MEMBERS' && (
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex flex-col md:flex-row gap-3 items-center animate-in fade-in slide-in-from-top-2">
          <input 
            type="text" 
            placeholder={`Enter Visitor Full Name`} 
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            className="w-full md:flex-1 p-2 border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddFNF()}
          />
          <button onClick={handleAddFNF} className="w-full md:w-auto px-4 py-2 bg-amber-500 text-white rounded-md">Add</button>
        </div>
      )}

      {/* Graduation / Transfer Notification Banner */}
      {graduatingMembers.length > 0 && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-start gap-3">
              <div className="p-1 bg-blue-100 text-blue-600 rounded-full mt-0.5">
                  <ArrowRightCircle size={16} />
              </div>
              <div className="text-sm text-blue-800">
                  <span className="font-bold">Heads up!</span> The following members have turned 13 and will transfer next Sunday: 
                  <span className="font-bold ml-1">
                      {graduatingMembers.map(m => m.name).join(', ')}
                  </span>.
              </div>
          </div>
      )}

      {successMsg && (
        <div className="px-6 py-2 bg-green-50 text-green-700 text-sm font-medium text-center border-b border-green-100 animate-in slide-in-from-top-2">
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="p-3 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
        <div className="relative mb-2">
           <Search className="absolute left-3 top-2 h-4 w-4 text-gray-400" />
           <input
            type="text"
            className="block w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            placeholder="Search name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
                onClick={() => setFilterType('CM')}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${filterType === 'CM' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}
            >
                All
            </button>
            {(attendanceMode === 'STAFF' 
                ? [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER] 
                : [MemberType.MEMBER, MemberType.FNF, MemberType.INCONSISTENT, MemberType.NOT_MEMBER]
            ).map(type => (
                <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${filterType === type ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
                >
                    {type}
                </button>
            ))}
        </div>
        
        {/* PUNCTUALITY COUNTER - SHOW FOR UJ & STAFF */}
        {enablePunctuality && (
             <div className="mt-3 flex items-center justify-between bg-orange-50 border border-orange-100 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-orange-600"/>
                    <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">
                        Punctual ({attendanceMode === 'STAFF' ? 'Staff' : 'Members'})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${punctualIds.size >= 3 ? 'text-red-600' : 'text-orange-700'}`}>
                        {punctualIds.size} / 3
                    </span>
                    {punctualIds.size >= 3 && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 rounded-sm font-bold">MAX</span>}
                </div>
             </div>
        )}
        
        <div className="text-[10px] text-gray-500 flex justify-between pt-1 mt-1 border-t border-gray-200">
            <span>{filteredMembers.length} records</span>
            <span className="font-semibold text-indigo-600 flex items-center gap-1">
                <Check size={10}/> 
                {displayCount} Present
            </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
        {activeChurch === 'CM' && attendanceMode === 'MEMBERS' && (
             <div className="flex items-center justify-center h-full text-gray-400 p-8 text-center">
                 <p>Select a specific church branch from the menu to take member attendance.</p>
             </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pb-20 md:pb-0">
          {sortedMembers.map(member => {
            const isPresent = presentIds.has(member.id);
            const isPunctual = punctualIds.has(member.id);
            const isTransferPending = !!member.transferPendingDate;
            
            // Auto Disable Punctual Button if limit reached and this user isn't one of them
            const disablePunctualBtn = !isPunctual && punctualIds.size >= 3;
            
            return (
              <div 
                key={member.id}
                onClick={() => handleToggle(member.id)}
                className={`
                  cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-all select-none
                  ${isTransferPending ? 'bg-blue-50 border-blue-200' : isPunctual ? 'bg-orange-50 border-orange-200' : isPresent ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${isPunctual ? 'bg-orange-100 text-orange-600' : getMemberStyle(member.type)}`}>
                    {isPunctual ? <Trophy size={14} /> : getMemberIcon(member.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isPresent ? 'text-indigo-900' : 'text-gray-900'}`}>{member.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{member.type}</p>
                      {attendanceMode === 'STAFF' && <span className="text-[10px] bg-gray-200 px-1 rounded">{member.assignedChurch}</span>}
                      {isTransferPending && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Graduating</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {enablePunctuality && (
                      <button
                        onClick={(e) => {
                            if (!disablePunctualBtn) handlePunctualToggle(e, member.id);
                            else e.stopPropagation();
                        }}
                        disabled={disablePunctualBtn}
                        className={`p-2 rounded-full transition-colors ${
                            isPunctual 
                            ? 'bg-orange-500 text-white shadow-sm' 
                            : disablePunctualBtn 
                                ? 'bg-gray-50 text-gray-200 cursor-not-allowed' 
                                : 'bg-gray-100 text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                        }`}
                      >
                        <Clock size={14} />
                      </button>
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPresent ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Check size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LEADERBOARD MODAL */}
      {showLeaderboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                  <div className="p-5 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                      <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                              <Trophy size={24} className="text-amber-500 fill-amber-500"/>
                              Early Birds
                          </h3>
                          <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-white/50 rounded-full text-gray-500"><X size={20}/></button>
                      </div>
                      <p className="text-xs text-amber-800 font-medium opacity-80 mb-3">
                          Ranking for {attendanceMode === 'STAFF' ? 'Staff' : `${activeChurch} Members`}
                      </p>
                      
                      <div className="flex bg-white/60 p-1 rounded-lg backdrop-blur-sm border border-amber-100">
                          <button 
                            onClick={() => setLeaderboardTimeframe('MONTH')}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${leaderboardTimeframe === 'MONTH' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}
                          >
                              This Month
                          </button>
                          <button 
                            onClick={() => setLeaderboardTimeframe('CM')}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${leaderboardTimeframe === 'CM' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                          >
                              All Time
                          </button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                      {leaderboardData.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                              <Calendar size={48} className="mb-2 opacity-20"/>
                              <p>No punctual records found for this period.</p>
                          </div>
                      ) : (
                          leaderboardData.map((item) => {
                              let rankBadge;
                              if (item.rank === 1) rankBadge = <div className="w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center font-bold shadow-sm ring-2 ring-white"><Crown size={14} className="fill-yellow-900"/></div>;
                              else if (item.rank === 2) rankBadge = <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-800 flex items-center justify-center font-bold shadow-sm ring-2 ring-white">2</div>;
                              else if (item.rank === 3) rankBadge = <div className="w-8 h-8 rounded-full bg-orange-300 text-orange-900 flex items-center justify-center font-bold shadow-sm ring-2 ring-white">3</div>;
                              else rankBadge = <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-xs">#{item.rank}</div>;

                              return (
                                  <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3 shadow-sm">
                                      {rankBadge}
                                      <div className="flex-1 min-w-0">
                                          <p className="font-bold text-gray-800 truncate">{item.name}</p>
                                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.type}</p>
                                      </div>
                                      <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold text-sm border border-amber-100">
                                          {item.count}x
                                      </div>
                                  </div>
                              );
                          })
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default AttendanceTaker;