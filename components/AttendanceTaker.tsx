import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Member, MemberType, MemberStatus, Church } from '../types';
import { getSundaysInYear } from '../constants';
import { Search, Plus, Check, Save, GraduationCap, User, Users, AlertCircle, HelpCircle, Clock, Trophy, History, X, Calendar, Heart, Hand, Briefcase, Building2 } from 'lucide-react';
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
  
  const [attendanceMode, setAttendanceMode] = useState<'MEMBERS' | 'STAFF'>('MEMBERS');
  const enablePunctuality = attendanceMode === 'MEMBERS' && activeChurch === 'UJ';
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
          setPunctualIds(new Set()); 
      } else {
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
    const newMember = addMember(newMemberName.trim(), MemberType.FNF, activeChurch, '');
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
      if (activeChurch === 'ALL') {
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
    return a.name.localeCompare(b.name);
  });

  const getMemberIcon = (type: MemberType) => {
    switch (type) {
        case MemberType.TEACHER: return <GraduationCap size={16} />;
        case MemberType.HELPER: return <Heart size={16} />;
        case MemberType.VOLUNTEER: return <Hand size={16} />;
        case MemberType.FNF: return <Users size={16} />;
        case MemberType.INCONSISTENT: return <AlertCircle size={16} />;
        case MemberType.NOT_MEMBER: return <HelpCircle size={16} />;
        default: return <User size={16} />;
    }
  }

  const getMemberStyle = (type: MemberType) => {
    switch (type) {
        case MemberType.TEACHER: return 'bg-purple-100 text-purple-600';
        case MemberType.HELPER: return 'bg-pink-100 text-pink-600';
        case MemberType.VOLUNTEER: return 'bg-orange-100 text-orange-600';
        case MemberType.FNF: return 'bg-amber-100 text-amber-600';
        case MemberType.INCONSISTENT: return 'bg-rose-100 text-rose-600';
        case MemberType.NOT_MEMBER: return 'bg-slate-100 text-slate-600';
        default: return 'bg-indigo-100 text-indigo-600';
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-soft border border-gray-100 flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-160px)] relative overflow-hidden">
      
      {/* ADMIN TOGGLE */}
      {isAdmin && (
          <div className="p-3 bg-gray-50/50 flex justify-center border-b border-gray-100">
             <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex">
                 <button 
                    onClick={() => { setAttendanceMode('MEMBERS'); setFilterType('ALL'); }}
                    className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${attendanceMode === 'MEMBERS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                 >
                    <Users size={16}/> Members ({activeChurch})
                 </button>
                 <button 
                    onClick={() => { setAttendanceMode('STAFF'); setFilterType('ALL'); }}
                    className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${attendanceMode === 'STAFF' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                 >
                    <Briefcase size={16}/> Staff (ALL)
                 </button>
             </div>
          </div>
      )}

      {/* Header Controls */}
      <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white/50 backdrop-blur-sm z-20">
        <div className="flex flex-col gap-1 w-full md:w-auto min-w-[240px]">
          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Service Date</label>
          <div className="relative">
              <select 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 block w-full p-3 shadow-sm appearance-none cursor-pointer"
              >
                {sundays2026.map(d => {
                  const strDate = d.toISOString().split('T')[0];
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isToday = strDate === todayStr;
                  return <option key={strDate} value={strDate}>{isToday ? '👉 ' : ''}{d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'})}</option>
                })}
              </select>
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16}/>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           {enablePunctuality && (
               <button 
                onClick={() => setShowHistory(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors flex-1 md:flex-none font-bold text-sm"
               >
                 <History size={18} />
                 <span className="hidden sm:inline">History</span>
               </button>
           )}
           {attendanceMode === 'MEMBERS' && activeChurch !== 'ALL' && (
               <button 
                onClick={() => setIsAddingFNF(!isAddingFNF)}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors flex-1 md:flex-none whitespace-nowrap"
                >
                <Plus size={18} /> New FNF
                </button>
           )}
          <button 
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 flex-1 md:flex-none whitespace-nowrap hover:-translate-y-0.5"
          >
            <Save size={18} /> Save Record
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
            className="w-full md:flex-1 p-3 border border-amber-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-100 text-sm font-medium"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddFNF()}
          />
          <button onClick={handleAddFNF} className="w-full md:w-auto px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-sm hover:bg-amber-600 transition-colors">Add Visitor</button>
        </div>
      )}

      {successMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-500 text-white text-sm font-bold rounded-full shadow-xl animate-in fade-in zoom-in-90 flex items-center gap-2">
          <Check size={16}/> {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="relative mb-3">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
           <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
            placeholder="Search member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
                onClick={() => setFilterType('ALL')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${filterType === 'ALL' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
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
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${filterType === type ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                >
                    {type}
                </button>
            ))}
        </div>
        
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex justify-between pt-2 mt-1 border-t border-gray-100">
            <span>{filteredMembers.length} records</span>
            <span className="text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 rounded-full"><Check size={12}/> {presentIds.size} Present</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30 scroll-smooth">
        {activeChurch === 'ALL' && attendanceMode === 'MEMBERS' && (
             <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center gap-4">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Building2 size={24} className="text-gray-300"/>
                 </div>
                 <p className="max-w-xs font-medium">Select a specific church branch from the menu to take member attendance.</p>
             </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-20 md:pb-0">
          {sortedMembers.map(member => {
            const isPresent = presentIds.has(member.id);
            const isPunctual = punctualIds.has(member.id);
            
            return (
              <div 
                key={member.id}
                onClick={() => handleToggle(member.id)}
                className={`
                  relative cursor-pointer p-4 rounded-2xl flex items-center justify-between transition-all duration-200 group select-none
                  ${isPunctual 
                    ? 'bg-gradient-to-r from-orange-50 to-white border border-orange-200 shadow-sm' 
                    : isPresent 
                        ? 'bg-gradient-to-r from-indigo-50 to-white border border-indigo-200 shadow-md translate-x-1' 
                        : 'bg-white border border-gray-100 hover:border-indigo-100 hover:shadow-md'}
                `}
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-all ${isPunctual ? 'bg-orange-100 text-orange-600' : getMemberStyle(member.type)}`}>
                    {isPunctual ? <Trophy size={18} /> : getMemberIcon(member.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate transition-colors ${isPresent ? 'text-indigo-900' : 'text-gray-700 group-hover:text-gray-900'}`}>{member.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{member.type}</p>
                      {attendanceMode === 'STAFF' && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{member.assignedChurch}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {enablePunctuality && (
                      <button
                        onClick={(e) => handlePunctualToggle(e, member.id)}
                        className={`p-2 rounded-full transition-all ${isPunctual ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-50 text-gray-300 hover:bg-orange-50 hover:text-orange-400'}`}
                        title="Mark Punctual"
                      >
                        <Clock size={16} />
                      </button>
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isPresent ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'bg-gray-100 text-gray-300 group-hover:bg-gray-200'}`}>
                    <Check size={16} strokeWidth={3} />
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