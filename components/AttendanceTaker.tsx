import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Member, MemberType, MemberStatus, Church } from '../types';
import { getSundaysInYear } from '../constants';
import { Search, Plus, Check, Save, GraduationCap, User, Users, AlertCircle, HelpCircle, Clock, Trophy, History, X, Calendar, Heart, Hand, Briefcase } from 'lucide-react';
import { addMember, saveAttendance } from '../services/storageService';

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
  const [filterType, setFilterType] = useState<string>('ALL');
  const [newMemberName, setNewMemberName] = useState('');
  const [isAddingFNF, setIsAddingFNF] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Toggle for Admins to switch between taking Member Attendance (per church) vs Staff Attendance (all)
  const [attendanceMode, setAttendanceMode] = useState<'MEMBERS' | 'STAFF'>('MEMBERS');

  // Punctuality feature is ONLY for UJ (Member Mode only)
  const enablePunctuality = attendanceMode === 'MEMBERS' && activeChurch === 'UJ';

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
  }, [sundays2026, selectedDate, activeChurch, attendanceMode]);

  useEffect(() => {
    if (selectedDate) {
      if (attendanceMode === 'STAFF') {
          const allPresent = new Set<string>();
          data.attendance.filter(r => r.date === selectedDate).forEach(record => {
              record.presentMemberIds.forEach(id => {
                  const m = data.members.find(mem => mem.id === id);
                  if (m && (m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER)) {
                      allPresent.add(id);
                  }
              });
          });
          setPresentIds(allPresent);
          setPunctualIds(new Set()); // No punctuality for staff currently
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
      if (attendanceMode === 'MEMBERS') {
          const newPunctual = new Set(punctualIds);
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
        alert("You can only select top 3 punctual members.");
        return;
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
            const existingMembersPresent = existingRecord 
                ? existingRecord.presentMemberIds.filter(id => {
                    const m = data.members.find(mem => mem.id === id);
                    return m && m.type !== MemberType.TEACHER && m.type !== MemberType.HELPER && m.type !== MemberType.VOLUNTEER;
                }) 
                : [];
            
            const staffPresentForThisChurch = Array.from(presentIds).filter(id => {
                const m = data.members.find(mem => mem.id === id);
                return m && m.assignedChurch === church;
            });

            const mergedPresent = [...existingMembersPresent, ...staffPresentForThisChurch];
            
            saveAttendance(selectedDate, church, mergedPresent, existingRecord?.punctualMemberIds || []);
        });

        setSuccessMsg(`Staff attendance synced across all churches!`);
    } else {
        saveAttendance(selectedDate, activeChurch, Array.from(presentIds) as string[], Array.from(punctualIds) as string[]);
        setSuccessMsg(`Attendance for ${activeChurch} saved!`);
    }
    
    onUpdate();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddFNF = () => {
    if (!newMemberName.trim()) return;
    const newMember = addMember(newMemberName, MemberType.FNF, activeChurch, '');
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
      // Show ALL Teachers, Helpers, Volunteers from ALL churches
      membersToList = data.members.filter(m => 
          (m.status === MemberStatus.ACTIVE) &&
          (m.type === MemberType.TEACHER || m.type === MemberType.HELPER || m.type === MemberType.VOLUNTEER)
      );
  } else {
      // Show Members/FNF/etc for ACTIVE church only
      // If Admin has activeChurch='ALL', maybe show empty state or force selection? 
      // User prompt says: "away from the dashboard section, the option to switch btn church should be there for the admin."
      // So if activeChurch is ALL, maybe we shouldn't show member attendance unless they pick one.
      // But let's assume activeChurch state in App tracks the selection.
      if (activeChurch === 'ALL') {
          // Fallback or empty if Admin hasn't picked a context
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
    const matchesType = filterType === 'ALL' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-140px)] relative overflow-hidden">
      
      {/* ADMIN TOGGLE */}
      {isAdmin && (
          <div className="p-2 bg-gray-100 flex justify-center border-b border-gray-200">
             <div className="bg-white p-1 rounded-lg shadow-sm flex">
                 <button 
                    onClick={() => { setAttendanceMode('MEMBERS'); setFilterType('ALL'); }}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${attendanceMode === 'MEMBERS' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                 >
                    <Users size={16}/> Members ({activeChurch})
                 </button>
                 <button 
                    onClick={() => { setAttendanceMode('STAFF'); setFilterType('ALL'); }}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${attendanceMode === 'STAFF' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                 >
                    <Briefcase size={16}/> Staff (ALL)
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
           {enablePunctuality && (
               <button 
                onClick={() => setShowHistory(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors flex-1 md:flex-none"
               >
                 <History size={18} />
                 <span className="hidden sm:inline">History</span>
               </button>
           )}
           {attendanceMode === 'MEMBERS' && activeChurch !== 'ALL' && (
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
            placeholder="Search member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${filterType === 'ALL' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}
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
        
        <div className="text-[10px] text-gray-500 flex justify-between pt-1 mt-1 border-t border-gray-200">
            <span>{filteredMembers.length} records</span>
            <span className="font-semibold text-indigo-600 flex items-center gap-1"><Check size={10}/> {presentIds.size} Present</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
        {activeChurch === 'ALL' && attendanceMode === 'MEMBERS' && (
             <div className="flex items-center justify-center h-full text-gray-400 p-8 text-center">
                 <p>Select a specific church branch from the menu to take member attendance.</p>
             </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pb-20 md:pb-0">
          {sortedMembers.map(member => {
            const isPresent = presentIds.has(member.id);
            const isPunctual = punctualIds.has(member.id);
            
            return (
              <div 
                key={member.id}
                onClick={() => handleToggle(member.id)}
                className={`
                  cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-all select-none
                  ${isPunctual ? 'bg-orange-50 border-orange-200' : isPresent ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50'}
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
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {enablePunctuality && (
                      <button
                        onClick={(e) => handlePunctualToggle(e, member.id)}
                        className={`p-2 rounded-full ${isPunctual ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400 hover:text-orange-500'}`}
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
    </div>
  );
};

export default AttendanceTaker;