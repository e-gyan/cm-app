import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Member, OutreachSession, PrayerSlot, MemberType, MemberStatus } from '../types';
import { generateOutreachSchedule, generatePrayerSchedule, saveOutreachSession, deleteOutreachSession, savePrayerSlot } from '../services/storageService';
import { Calendar, MapPin, Plus, Trash2, CheckCircle2, Clock, Heart, AlertCircle, ArrowRightLeft, BarChart2, ChevronUp, ChevronDown, Check, X, CalendarDays, RefreshCw, Zap, Loader2, User, Cloud, Save, Target, Phone, MessageSquare, Map as MapIcon, CalendarPlus, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface OutreachHubProps {
  data: AppData;
  onUpdate: () => void;
  currentUser: Member;
}

const GOOGLE_CALENDAR_ID = 'b7a17362d923e887199867f0fedff992c6e2d2ff6bb206fc0c9cd900d476ec8c@group.calendar.google.com';

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

const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
};

const addToGoogleCalendar = (title: string, dateStr: string, description: string, durationMins: number = 30, isVisit: boolean = false) => {
    const start = new Date(dateStr);
    // Set default times (Visit: 10am, Prayer: 6am)
    start.setHours(isVisit ? 10 : 6, 0, 0, 0);
    
    const end = new Date(start.getTime() + durationMins * 60000);

    // Format for Google: YYYYMMDDTHHMMSSZ
    const format = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', title);
    url.searchParams.append('dates', `${format(start)}/${format(end)}`);
    url.searchParams.append('details', description);
    url.searchParams.append('src', GOOGLE_CALENDAR_ID);
    
    window.open(url.toString(), '_blank');
};

const downloadICS = (filename: string, events: { title: string, start: Date, end: Date, description: string }[]) => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Childrens Ministry//Attendance App//EN\n";
    
    const formatICSDate = (date: Date) => {
        // Format to floating time YYYYMMDDTHHMMSS (No Z) so it stays absolute to user's selected calendar timezone
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // Actually, let's use UTC 'Z' for consistency if we set UTC hours correctly
    };

    events.forEach(evt => {
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `UID:${crypto.randomUUID()}\n`;
        icsContent += `DTSTAMP:${formatICSDate(new Date())}\n`;
        icsContent += `DTSTART:${formatICSDate(evt.start)}\n`;
        icsContent += `DTEND:${formatICSDate(evt.end)}\n`;
        icsContent += `SUMMARY:${evt.title}\n`;
        icsContent += `DESCRIPTION:${evt.description}\n`;
        icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const OutreachHub: React.FC<OutreachHubProps> = ({ data, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'VISIT' | 'PRAYER' | 'CONNECT' | 'TRACK'>(() => (localStorage.getItem('outreach_activeTab') as any) || 'VISIT');
  
  useEffect(() => {
    localStorage.setItem('outreach_activeTab', activeTab);
  }, [activeTab]);

  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Visitation State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [moveModal, setMoveModal] = useState<{ show: boolean, memberId: string, currentSessionId: string } | null>(null);
  const [addMemberModal, setAddMemberModal] = useState<{ show: boolean, sessionId: string } | null>(null);
  
  // UNIFIED LOCAL STATE FOR BATCH SAVING
  const [localSessions, setLocalSessions] = useState<OutreachSession[]>([]);
  const [localPrayerSlots, setLocalPrayerSlots] = useState<PrayerSlot[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set()); 
  const [changeCounts, setChangeCounts] = useState({ marked: 0, unmarked: 0 }); 
  const [isSaving, setIsSaving] = useState(false);
  const [completionConfirm, setCompletionConfirm] = useState<{ show: boolean, sessionId: string } | null>(null);

  // Prayer UI State
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

  // --- AUTO GENERATION FOR CURRENT WEEK ---
  useEffect(() => {
      const checkAndAutoGenerate = () => {
          if (!data.members || data.members.length === 0) return;
          
          const today = new Date();
          const startOfCurrentWeek = getStartOfWeek(today);
          const startStr = startOfCurrentWeek.toISOString().split('T')[0];
          
          // Check if we have *any* slots for this week (Mon-Fri)
          let hasSlots = false;
          for(let i=0; i<5; i++) {
              const checkDate = new Date(startOfCurrentWeek);
              checkDate.setDate(startOfCurrentWeek.getDate() + i);
              const dateStr = checkDate.toISOString().split('T')[0];
              if (data.prayerSchedule?.some(s => s.date === dateStr)) {
                  hasSlots = true;
                  break;
              }
          }

          if (!hasSlots) {
              const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
              if (ujMembers.length > 0) {
                  const res = generatePrayerSchedule(startOfCurrentWeek, ujMembers);
                  if (res.success) {
                      if (res.data) {
                          setLocalPrayerSlots(JSON.parse(JSON.stringify(res.data)));
                      }
                      onUpdate();
                      setGenMsg({ type: 'success', text: "New weekly prayer schedule ready! Don't forget to add it to your calendar." });
                      setTimeout(() => setGenMsg(null), 5000);
                  }
              }
          }
      };
      
      // Short delay to ensure data is loaded
      const timer = setTimeout(checkAndAutoGenerate, 1000);
      return () => clearTimeout(timer);
  }, [data.prayerSchedule?.length]);

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
          if (res.data) {
              setLocalSessions(JSON.parse(JSON.stringify(res.data)));
          }
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
      setChangeCounts(prev => ({
          marked: prev.marked + (isMarking ? 1 : 0),
          unmarked: prev.unmarked + (isMarking ? 0 : 1)
      }));

      const allDone = session.assignedMemberIds.every(id => newVisited.includes(id));
      if (allDone && !session.status.includes('COMPLETED')) {
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
      }
      setCompletionConfirm(null);
  };

  const handleMoveMember = (targetSessionId: string | 'REMOVE') => {
      if (!moveModal) return;
      const { memberId, currentSessionId } = moveModal;
      
      const currentIdx = localSessions.findIndex(s => s.id === currentSessionId);
      
      if (currentIdx !== -1) {
          const currentSession = { ...localSessions[currentIdx] };
          
          // Remove from current
          currentSession.assignedMemberIds = currentSession.assignedMemberIds.filter(id => id !== memberId);
          currentSession.visitedMemberIds = (currentSession.visitedMemberIds || []).filter(id => id !== memberId);
          
          const newSessions = [...localSessions];
          newSessions[currentIdx] = currentSession;

          if (targetSessionId !== 'REMOVE') {
              const targetIdx = localSessions.findIndex(s => s.id === targetSessionId);
              if (targetIdx !== -1) {
                  const targetSession = { ...localSessions[targetIdx] };
                  if (!targetSession.assignedMemberIds.includes(memberId)) {
                      targetSession.assignedMemberIds.push(memberId);
                  }
                  newSessions[targetIdx] = targetSession;
                  setUnsavedChanges(prev => new Set(prev).add(targetSessionId));
              }
          }
          
          setLocalSessions(newSessions);
          setUnsavedChanges(prev => new Set(prev).add(currentSessionId));
          setMoveModal(null);
      }
  };

  const handleAutoFill = (sessionId: string) => {
      const sessionIdx = localSessions.findIndex(s => s.id === sessionId);
      if (sessionIdx === -1) return;
      
      const session = { ...localSessions[sessionIdx] };
      const currentMemberIds = session.assignedMemberIds;
      
      // 1. Analyze Composition
      const currentMembers = currentMemberIds.map(id => data.members.find(m => m.id === id)).filter(Boolean) as Member[];
      const activeCount = currentMembers.filter(m => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE).length;
      const fnfCount = currentMembers.filter(m => m.type === MemberType.FNF).length;
      const inconsistentCount = currentMembers.filter(m => m.type === MemberType.INCONSISTENT).length;
      
      // 2. Determine Need
      let neededType: MemberType | 'ANY' = 'ANY';
      if (inconsistentCount < 1) neededType = MemberType.INCONSISTENT;
      else if (fnfCount < 1) neededType = MemberType.FNF;
      else if (activeCount < 2) neededType = MemberType.MEMBER;
      
      // 3. Find Candidate
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      
      const recentlyVisited = new Set<string>();
      localSessions.forEach(s => {
          if (new Date(s.date) >= twoMonthsAgo && s.visitedMemberIds) {
              s.visitedMemberIds.forEach(id => recentlyVisited.add(id));
          }
      });
      
      const assignedInPending = new Set<string>();
      localSessions.filter(s => s.status === 'PENDING' && s.id !== sessionId).forEach(s => {
          s.assignedMemberIds.forEach(id => assignedInPending.add(id));
      });

      const candidates = data.members.filter(m => 
          m.assignedChurch === 'UJ' &&
          !currentMemberIds.includes(m.id) &&
          !recentlyVisited.has(m.id) &&
          !assignedInPending.has(m.id) &&
          !['Teacher','Helper','Volunteer'].includes(m.type) &&
          (neededType === 'ANY' || m.type === neededType)
      );
      
      let candidate = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
      
      // Fallback to ANY if specific type not found
      if (!candidate && neededType !== 'ANY') {
           const anyCandidates = data.members.filter(m => 
              m.assignedChurch === 'UJ' &&
              !currentMemberIds.includes(m.id) &&
              !recentlyVisited.has(m.id) &&
              !assignedInPending.has(m.id) &&
              !['Teacher','Helper','Volunteer'].includes(m.type)
          );
          if (anyCandidates.length > 0) candidate = anyCandidates[Math.floor(Math.random() * anyCandidates.length)];
      }

      if (candidate) {
          session.assignedMemberIds = [...session.assignedMemberIds, candidate.id];
          const newSessions = [...localSessions];
          newSessions[sessionIdx] = session;
          setLocalSessions(newSessions);
          setUnsavedChanges(prev => new Set(prev).add(sessionId));
          setGenMsg({ type: 'success', text: `Auto-added ${candidate.name}` });
      } else {
          setGenMsg({ type: 'error', text: 'No suitable candidates found.' });
      }
      setTimeout(() => setGenMsg(null), 3000);
  };

  const handleAddMember = (sessionId: string, memberId: string) => {
      const sessionIdx = localSessions.findIndex(s => s.id === sessionId);
      if (sessionIdx === -1) return;
      
      const session = { ...localSessions[sessionIdx] };
      if (!session.assignedMemberIds.includes(memberId)) {
          session.assignedMemberIds = [...session.assignedMemberIds, memberId];
          const newSessions = [...localSessions];
          newSessions[sessionIdx] = session;
          setLocalSessions(newSessions);
          setUnsavedChanges(prev => new Set(prev).add(sessionId));
          setAddMemberModal(null);
      }
  };

  // --- PRAYER LOGIC ---

  const handleGeneratePrayer = () => {
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      const res = generatePrayerSchedule(prayerWeek, ujMembers);
      
      if (res.success) {
          if (res.data) {
              setLocalPrayerSlots(JSON.parse(JSON.stringify(res.data)));
          }
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

  const saveBatchChanges = async () => {
      setIsSaving(true);
      try {
          const promises: Promise<any>[] = [];
          
          unsavedChanges.forEach(id => {
              const session = localSessions.find(s => s.id === id);
              if (session) {
                  promises.push(saveOutreachSession(session));
                  return;
              }
              const slot = localPrayerSlots.find(s => s.id === id);
              if (slot) {
                  promises.push(savePrayerSlot(slot));
              }
          });

          await Promise.all(promises);
          
          setUnsavedChanges(new Set());
          setChangeCounts({ marked: 0, unmarked: 0 });
          onUpdate();
          setGenMsg({ type: 'success', text: 'All changes saved!' });
          setTimeout(() => setGenMsg(null), 3000);
      } catch (e) {
          console.error(e);
          setGenMsg({ type: 'error', text: 'Failed to save changes.' });
      } finally {
          setIsSaving(false);
      }
  };
  
  // --- DERIVED DATA & EXPORT LOGIC ---

  const sortedVisits = useMemo(() => {
      const all = (localSessions || []);
      const pending = all.filter(s => s.status === 'PENDING').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const completed = all.filter(s => s.status === 'COMPLETED').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const nextUp = pending.length > 0 ? pending[0] : null;
      const otherPending = pending.length > 0 ? pending.slice(1) : [];
      return { nextUp, otherPending, completed };
  }, [localSessions]);

  // Derived list of MISSED/INCOMPLETE visits from past sessions
  const incompleteVisits = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const list: { memberId: string, date: string, sessionId: string }[] = [];

      (localSessions || []).forEach(session => {
          // If session date is past, find unvisited members
          if (session.date < today) {
              session.assignedMemberIds.forEach(mid => {
                  if (!session.visitedMemberIds?.includes(mid)) {
                      list.push({ memberId: mid, date: session.date, sessionId: session.id });
                  }
              });
          }
      });
      return list.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [localSessions]);

  const prayerData = useMemo(() => {
      if(localPrayerSlots.length === 0) return { active: [], expired: [], completed: [] };
      const today = new Date().toISOString().split('T')[0];
      
      const all = [...localPrayerSlots].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const expired = all.filter(s => s.date < today && !s.isCompleted);
      const completed = all.filter(s => s.isCompleted);
      const active = all.filter(s => s.date >= today && !s.isCompleted);

      return { active, expired, completed };
  }, [localPrayerSlots]);

  const handleExportVisits = () => {
      const pendingVisits = [sortedVisits.nextUp, ...sortedVisits.otherPending].filter(Boolean) as OutreachSession[];
      if (pendingVisits.length === 0) return;

      const events = pendingVisits.map(s => {
          const names = s.assignedMemberIds.map(id => data.members.find(m => m.id === id)?.name).filter(Boolean).join(', ');
          
          // Construct UTC Dates manually for consistent ICS export (10 AM Local)
          const start = new Date(s.date);
          start.setUTCHours(10, 0, 0, 0); // 10:00 UTC (will render as 10:00 in calendar if we don't assume timezone offset)
          const end = new Date(start.getTime() + 5 * 60 * 60 * 1000); // 15:00 UTC

          return {
              title: `Visit: ${names}`,
              start,
              end,
              description: `Outreach visit to: ${names}`
          };
      });
      downloadICS('visitation_schedule.ics', events);
  };

  const handleExportPrayer = () => {
      if (prayerData.active.length === 0) return;

      const events = prayerData.active.map(s => {
          const names = s.assignedMemberIds.map(id => data.members.find(m => m.id === id)?.name).filter(Boolean).join(', ');
          
          // Construct UTC Dates (6 AM Local)
          const start = new Date(s.date);
          start.setUTCHours(6, 0, 0, 0); 
          const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins

          return {
              title: `Prayer: ${names}`,
              start,
              end,
              description: `Praying for: ${names}`
          };
      });
      downloadICS('prayer_schedule.ics', events);
  };

  // --- CONNECT TAB DATA ---
  // Updated Filter: Include Inconsistent Members regardless of status (often NOT_ACTIVE)
  const connectList = useMemo(() => {
      return data.members
        .filter(m => m.assignedChurch === 'UJ' &&
            (
                (m.status === MemberStatus.ACTIVE && [MemberType.MEMBER, MemberType.FNF, MemberType.VISITOR, MemberType.INCONSISTENT].includes(m.type)) ||
                (m.type === MemberType.INCONSISTENT) || // Include Inconsistent regardless of status
                (m.type === MemberType.VISITOR) // Include Visitors regardless of status
            )
        )
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.members]); 

  return (
    <div className="space-y-4 pb-24 relative min-h-screen">
      
      {/* HEADER TABS */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-1 sticky top-0 z-30 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('VISIT')} className={`flex-1 min-w-[80px] flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${activeTab === 'VISIT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <MapPin size={16}/> Visits
          </button>
          <button onClick={() => setActiveTab('PRAYER')} className={`flex-1 min-w-[80px] flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${activeTab === 'PRAYER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Heart size={16}/> Prayer
          </button>
          <button onClick={() => setActiveTab('CONNECT')} className={`flex-1 min-w-[80px] flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${activeTab === 'CONNECT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Phone size={16}/> Connect
          </button>
          <button onClick={() => setActiveTab('TRACK')} className={`flex-1 min-w-[80px] flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${activeTab === 'TRACK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <BarChart2 size={16}/> Progress
          </button>
      </div>

      {/* VISIT TAB */}
      {activeTab === 'VISIT' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <button 
                onClick={() => setIsCreatorOpen(!isCreatorOpen)}
                className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 font-bold hover:bg-indigo-100 transition-colors"
              >
                  <span className="flex items-center gap-2"><Calendar size={20}/> Plan New Visits</span>
                  {isCreatorOpen ? <ChevronUp size={20}/> : <Plus size={20}/>}
              </button>

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

              <div className="space-y-4">
                  {(sortedVisits.nextUp || sortedVisits.otherPending.length > 0) && (
                      <div className="flex justify-end">
                          <button 
                            onClick={handleExportVisits} 
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs shadow-sm hover:bg-indigo-50 transition-colors"
                          >
                              <CalendarPlus size={16}/> Add Schedule to Calendar
                          </button>
                      </div>
                  )}

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
                                  <div className="mt-3 flex gap-2">
                                      <button onClick={() => setAddMemberModal({show: true, sessionId: sortedVisits.nextUp!.id})} className="flex-1 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1">
                                          <Plus size={14}/> Add Member
                                      </button>
                                      {sortedVisits.nextUp.assignedMemberIds.length < 4 && (
                                          <button onClick={() => handleAutoFill(sortedVisits.nextUp!.id)} className="flex-1 py-2 text-xs font-bold text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
                                              <Zap size={14}/> Auto-Fill
                                          </button>
                                      )}
                                  </div>
                              </div>
                              <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-400">{sortedVisits.nextUp.assignedMemberIds.length} Kids Assigned</span>
                                  <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                            const names = sortedVisits.nextUp!.assignedMemberIds.map(id => data.members.find(m => m.id === id)?.name).filter(Boolean).join(', ');
                                            addToGoogleCalendar(`Visit: ${names}`, sortedVisits.nextUp!.date, `Visit to: ${names}`, 300, true);
                                        }}
                                        className="text-slate-300 hover:text-indigo-500 p-2"
                                        title="Add to Google Calendar"
                                      >
                                          <CalendarPlus size={16}/>
                                      </button>
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
                      </div>
                  )}

                  {sortedVisits.otherPending.map(session => (
                      <div key={session.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden opacity-90 hover:opacity-100 transition-all ${unsavedChanges.has(session.id) ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                              <h4 className="font-bold text-slate-700">{formatDateDDMMYYYY(session.date)}</h4>
                              <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                        const names = session.assignedMemberIds.map(id => data.members.find(m => m.id === id)?.name).filter(Boolean).join(', ');
                                        addToGoogleCalendar(`Visit: ${names}`, session.date, `Visit to: ${names}`, 300, true);
                                    }}
                                    className="text-slate-300 hover:text-indigo-500 p-1"
                                    title="Add to Google Calendar"
                                  >
                                      <CalendarPlus size={16}/>
                                  </button>
                                  <button 
                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                    disabled={loadingId === session.id}
                                    className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                                  >
                                    {loadingId === session.id ? <Loader2 size={16} className="animate-spin text-indigo-500"/> : <Trash2 size={16}/>}
                                  </button>
                              </div>
                          </div>
                          <div className="p-2">
                              <SessionChildList 
                                session={session} 
                                data={data} 
                                onToggle={toggleVisitForMember} 
                                onMove={(mid, sid) => setMoveModal({show: true, memberId: mid, currentSessionId: sid})}
                              />
                              <div className="mt-3 flex gap-2">
                                  <button onClick={() => setAddMemberModal({show: true, sessionId: session.id})} className="flex-1 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1">
                                      <Plus size={14}/> Add Member
                                  </button>
                                  {session.assignedMemberIds.length < 4 && (
                                      <button onClick={() => handleAutoFill(session.id)} className="flex-1 py-2 text-xs font-bold text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
                                          <Zap size={14}/> Auto-Fill
                                      </button>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}

                  {/* MISSED / YET TO COMPLETE SECTION - FOLDABLE ASCENDING */}
                  {incompleteVisits.length > 0 && (
                      <div className="pt-4 border-t border-dashed border-slate-200">
                          <CollapsibleMissedSection 
                              title="Missed & Awaiting Rescheduling" 
                              items={incompleteVisits} 
                              data={data} 
                              onReschedule={(mid, sid) => setMoveModal({show: true, memberId: mid, currentSessionId: sid})}
                          />
                      </div>
                  )}

                  {sortedVisits.completed.length > 0 && (
                      <div className="pt-6">
                          <CollapsibleCompletedVisits 
                              title="Completed History" 
                              sessions={sortedVisits.completed} 
                              data={data} 
                              loadingId={loadingId}
                              onDelete={handleDeleteSession}
                          />
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

              {/* Missed & Expired Section */}
              <CollapsibleSection 
                  title="Missed & Expired" 
                  items={prayerData.expired} 
                  data={data} 
                  unsavedChanges={unsavedChanges} 
                  onToggle={togglePrayerComplete} 
                  isExpired={true}
                  color="amber"
                  icon={AlertCircle}
              />

              {/* Current Schedule Section */}
              <CollapsibleSection 
                  title="Current Schedule" 
                  items={prayerData.active} 
                  data={data} 
                  unsavedChanges={unsavedChanges} 
                  onToggle={togglePrayerComplete} 
                  color="indigo"
                  icon={CalendarDays}
                  defaultOpen={true}
                  headerAction={
                      prayerData.active.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleExportPrayer(); }} 
                            className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors mr-2" 
                            title="Add All to Calendar"
                          >
                              <CalendarPlus size={18}/>
                          </button>
                      )
                  }
              />

              {/* Completed History Section (Grouped by Period) */}
              <CollapsibleHistorySection 
                  items={prayerData.completed} 
                  data={data} 
                  unsavedChanges={unsavedChanges} 
                  onToggle={togglePrayerComplete} 
              />
          </div>
      )}

      {/* CONNECT TAB */}
      {activeTab === 'CONNECT' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-sm font-medium flex items-start gap-2">
                  <Phone size={18} className="shrink-0 mt-0.5"/>
                  <p>Tap icons to call, message, or get directions.</p>
              </div>
              
              <CollapsibleContactSection 
                  title="Active Members" 
                  members={connectList.filter(m => m.type === MemberType.MEMBER)} 
                  color="indigo" 
                  icon={User} 
              />
              <CollapsibleContactSection 
                  title="Friends & Family (FNF)" 
                  members={connectList.filter(m => m.type === MemberType.FNF)} 
                  color="amber" 
                  icon={User} 
              />
              <CollapsibleContactSection 
                  title="Inconsistent" 
                  members={connectList.filter(m => m.type === MemberType.INCONSISTENT)} 
                  color="rose" 
                  icon={AlertCircle} 
              />
          </div>
      )}

      {/* TRACKING TAB */}
      {activeTab === 'TRACK' && (() => {
          const currentYear = new Date().getFullYear();
          let exactlyOnce = 0;
          let multipleTimes = 0;
          
          const churchVisitMap = new Map<string, number>();
          data.members.forEach(m => {
              if (m.assignedChurch && !churchVisitMap.has(m.assignedChurch)) {
                  churchVisitMap.set(m.assignedChurch, 0);
              }
              const visits = (data.outreachSessions || [])
                  .filter(s => s.status === 'COMPLETED' && new Date(s.date).getFullYear() === currentYear && s.visitedMemberIds?.includes(m.id))
                  .length;
              if (visits === 1) exactlyOnce++;
              else if (visits > 1) multipleTimes++;
          });

          (data.outreachSessions || []).forEach(s => {
              if (s.status === 'COMPLETED' && new Date(s.date).getFullYear() === currentYear) {
                  s.visitedMemberIds?.forEach(id => {
                      const member = data.members.find(m => m.id === id);
                      if (member && member.assignedChurch) {
                          churchVisitMap.set(member.assignedChurch, (churchVisitMap.get(member.assignedChurch) || 0) + 1);
                      }
                  });
              }
          });

          const chartData = Array.from(churchVisitMap.entries()).map(([church, visits]) => ({
              name: church,
              visits
          })).sort((a,b) => b.visits - a.visits);

          const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#06b6d4'];

          return (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex-1 text-center md:text-left">
                              <h3 className="font-bold text-xl text-slate-800 mb-1">Visitation Progress {currentYear}</h3>
                              <p className="text-sm text-slate-500">Monitoring Visitation Frequency vs. Goal (2/year).</p>
                          </div>
                          <div className="flex gap-4 w-full md:w-auto text-center md:text-left">
                              <div className="flex-1 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 min-w-[120px] text-center">
                                  <div className="flex justify-center items-center gap-2 mb-1">
                                      <Target size={18} className="text-indigo-500" />
                                      <div className="text-2xl font-black text-indigo-700">{exactlyOnce}</div>
                                  </div>
                                  <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Visited Once</div>
                                  <div className="text-[10px] text-indigo-500 mt-1">Needs 1 more visit</div>
                              </div>
                              <div className="flex-1 bg-teal-50 p-4 rounded-2xl border border-teal-100 min-w-[120px] text-center">
                                  <div className="flex justify-center items-center gap-2 mb-1">
                                      <CheckCircle2 size={18} className="text-teal-500" />
                                      <div className="text-2xl font-black text-teal-700">{multipleTimes}</div>
                                  </div>
                                  <div className="text-[10px] font-bold text-teal-900 uppercase tracking-wider">Visited 2+ Times</div>
                                  <div className="text-[10px] text-teal-500 mt-1">Goal Reached</div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-6">Visits by Age Group (Church)</h3>
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dy={10} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dx={-10} allowDecimals={false} />
                                  <RechartsTooltip cursor={{fill: '#F1F5F9'}} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
                                  <Bar dataKey="visits" name="Visits" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                      {chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
                  
                  <CollapsibleProgressSection title="Active Members" members={connectList.filter(m => m.type === MemberType.MEMBER)} data={data} icon={User} color="indigo" />
                  <CollapsibleProgressSection title="Friends & Family (FNF)" members={connectList.filter(m => m.type === MemberType.FNF)} data={data} icon={User} color="amber" />
                  <CollapsibleProgressSection title="Visitors" members={connectList.filter(m => m.type === MemberType.VISITOR)} data={data} icon={User} color="teal" />
                  <CollapsibleProgressSection title="Inconsistent" members={connectList.filter(m => m.type === MemberType.INCONSISTENT)} data={data} icon={AlertCircle} color="rose" />
              </div>
          );
      })()}

      {/* MOVE MODAL */}
      {moveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-1 text-slate-800">Reschedule</h3>
                  <p className="text-sm text-slate-500 mb-4">Choose a new date for this child:</p>
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      <button onClick={() => handleMoveMember('REMOVE')} className="w-full p-4 text-left border border-red-100 bg-red-50/30 rounded-2xl hover:bg-red-50 hover:border-red-200 transition-colors group mb-2">
                          <div className="font-bold text-red-600 group-hover:text-red-700 flex items-center gap-2"><Trash2 size={16}/> Remove from Schedule</div>
                          <div className="text-xs text-red-400 mt-1">Will be added back to pool for future generation</div>
                      </button>

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

      {/* ADD MEMBER MODAL */}
      {addMemberModal && (
          <AddMemberModal 
              isOpen={addMemberModal.show} 
              onClose={() => setAddMemberModal(null)} 
              onSelect={(mid: string) => handleAddMember(addMemberModal.sessionId, mid)}
              members={data.members}
              currentSessionMembers={localSessions.find(s => s.id === addMemberModal.sessionId)?.assignedMemberIds || []}
          />
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

      {/* FLOATING SAVE BUTTON */}
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
                          {changeCounts.unmarked > 0 ? ` -${changeCounts.unmarked} unmarked` : ''}
                      </span>
                  </div>
              </button>
          </div>
      )}
    </div>
  );
};

// --- SUB COMPONENTS ---

interface CollapsibleHistorySectionProps {
    items: PrayerSlot[];
    data: AppData;
    unsavedChanges: Set<string>;
    onToggle: (id: string) => void;
}

const CollapsibleHistorySection = ({ items, data, unsavedChanges, onToggle }: CollapsibleHistorySectionProps) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Group By Period (2 Weeks, This Month, Quarter)
    const groupedHistory = useMemo(() => {
        const groups: Record<string, PrayerSlot[]> = {};
        if (!items) return groups;
        
        const now = new Date();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(now.getDate() - 14);
        
        items.forEach((slot: PrayerSlot) => {
            const d = new Date(slot.date);
            let key = '';
            
            if (d >= twoWeeksAgo) {
                key = 'Last 2 Weeks';
            } else if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                key = 'This Month';
            } else {
                const q = Math.floor(d.getMonth() / 3) + 1;
                key = `Q${q} ${d.getFullYear()}`;
            }
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(slot);
        });
        
        return groups;
    }, [items]);

    if (!items || items.length === 0) return null;

    // Define sort order for keys
    const sortKeys = (keys: string[]) => {
        return keys.sort((a, b) => {
            if (a === 'Last 2 Weeks') return -1;
            if (b === 'Last 2 Weeks') return 1;
            if (a === 'This Month') return -1;
            if (b === 'This Month') return 1;
            return b.localeCompare(a); // Descending for Quarters
        });
    };

    return (
        <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? 'text-green-600 bg-green-50/50' : 'bg-white hover:bg-slate-50'}`}
            >
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-500"/> 
                    Completed History ({items.length})
                </h3>
                {isOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
            </button>
            
            {isOpen && (
                <div className="p-3 space-y-4 bg-slate-50/30">
                    {sortKeys(Object.keys(groupedHistory)).map((period) => (
                        <div key={period}>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pl-2 sticky top-0 bg-slate-50/90 backdrop-blur py-1 z-10">{period}</h4>
                            <div className="space-y-3">
                                {groupedHistory[period]
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Descending date
                                    .map((slot: PrayerSlot) => (
                                    <PrayerSlotCard key={slot.id} slot={slot} data={data} unsavedChanges={unsavedChanges} onToggle={onToggle} isExpired={false} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CollapsibleMissedSection = ({ title, items, data, onReschedule }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm">
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? 'bg-red-50/50 text-rose-600' : 'bg-white hover:bg-red-50/10'}`}
            >
                <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={14}/> {title} ({items.length})
                </h4>
                {isOpen ? <ChevronUp size={16} className="text-rose-300"/> : <ChevronDown size={16} className="text-rose-300"/>}
            </button>

            {isOpen && (
                <div className="divide-y divide-red-50">
                    {items.map((item: any) => {
                        const m = data.members.find((mem: any) => mem.id === item.memberId);
                        if (!m) return null;
                        return (
                            <div key={`${item.sessionId}-${item.memberId}`} className="flex items-center justify-between p-3 bg-red-50/10 hover:bg-red-50/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-500">
                                        {m.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">{m.name}</div>
                                        <div className="text-[10px] text-red-400 font-medium">Missed on {formatDateDDMMYYYY(item.date)}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onReschedule(item.memberId, item.sessionId)}
                                    className="text-xs bg-white border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shadow-sm font-bold"
                                >
                                    Reschedule
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const CollapsibleCompletedVisits = ({ title, sessions, data, loadingId, onDelete }: any) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
            >
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14}/> {title} ({sessions.length})
                </h4>
                {isOpen ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
            </button>

            {isOpen && (
                <div className="space-y-3 p-3 bg-slate-50/30">
                    {sessions.map((s: OutreachSession) => (
                        <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 shadow-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 text-green-600 rounded-full"><CheckCircle2 size={16}/></div>
                                    <div>
                                        <div className="font-bold text-slate-700 text-sm line-through">{formatDateDDMMYYYY(s.date)}</div>
                                        <div className="text-[10px] text-slate-400">By {s.completedBy || 'Teacher'}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => onDelete(s.id, e)}
                                    disabled={loadingId === s.id}
                                    className="text-slate-300 hover:text-red-500 disabled:opacity-50"
                                >
                                    {loadingId === s.id ? <Loader2 size={16} className="animate-spin text-indigo-500"/> : <Trash2 size={16}/>}
                                </button>
                            </div>
                            {s.visitedMemberIds && s.visitedMemberIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 pl-11">
                                    {s.visitedMemberIds.map(vid => {
                                        const m = data.members.find(mem => mem.id === vid);
                                        return m ? (
                                            <span key={vid} className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-200">{m.name}</span>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface CollapsibleSectionProps {
    title: string;
    items: PrayerSlot[];
    data: AppData;
    unsavedChanges: Set<string>;
    onToggle: (id: string) => void;
    isExpired?: boolean;
    color: string;
    icon: React.ElementType;
    defaultOpen?: boolean;
    headerAction?: React.ReactNode;
}

const CollapsibleSection = ({ title, items, data, unsavedChanges, onToggle, isExpired, color, icon: Icon, defaultOpen = false, headerAction }: CollapsibleSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    if (!items || items.length === 0) return null;

    const colorClasses: Record<string, string> = {
        indigo: 'text-indigo-600 bg-indigo-50/50',
        amber: 'text-amber-600 bg-amber-50/50',
        green: 'text-green-600 bg-green-50/50'
    };

    return (
        <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
            <div className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? colorClasses[color] : 'bg-white hover:bg-slate-50'}`}>
                <div onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center gap-2 cursor-pointer">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Icon size={18} className={color === 'amber' ? 'text-amber-500' : color === 'green' ? 'text-green-500' : 'text-indigo-600'}/> 
                        {title} ({items.length})
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <button onClick={() => setIsOpen(!isOpen)}>
                        {isOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                    </button>
                </div>
            </div>
            
            {isOpen && (
                <div className="p-3 space-y-3 bg-slate-50/30">
                    {items.map((slot: PrayerSlot) => (
                        <PrayerSlotCard key={slot.id} slot={slot} data={data} unsavedChanges={unsavedChanges} onToggle={onToggle} isExpired={isExpired} />
                    ))}
                </div>
            )}
        </div>
    );
};

const PrayerSlotCard = ({ slot, data, unsavedChanges, onToggle, isExpired }: any) => {
    const memberNames = slot.assignedMemberIds.map((id: string) => data.members.find((m: any) => m.id === id)?.name).filter(Boolean).join(', ');

    return (
        <div className={`bg-white rounded-2xl border transition-all ${slot.isCompleted ? 'border-green-200 shadow-none' : isExpired ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 shadow-sm'} ${unsavedChanges.has(slot.id) ? 'ring-2 ring-amber-300' : ''}`}>
            <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold border ${slot.isCompleted ? 'bg-green-50 text-green-700 border-green-100' : isExpired ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            <span>{slot.dayOfWeek.substring(0,3).toUpperCase()}</span>
                        </div>
                        <div>
                            <h4 className={`font-bold text-sm ${slot.isCompleted ? 'text-green-800' : 'text-slate-800'}`}>{formatDateDDMMYYYY(slot.date)}</h4>
                            <p className="text-[10px] text-slate-400 font-medium">{slot.assignedMemberIds.length} Children • 30 mins</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                // Updated to use memberNames as the title
                                addToGoogleCalendar(`Prayer: ${memberNames}`, slot.date, `Praying for: ${memberNames}`, 30);
                            }}
                            className="text-slate-300 hover:text-indigo-500 p-1"
                            title="Add to Google Calendar"
                        >
                            <CalendarPlus size={16}/>
                        </button>
                        <div onClick={() => onToggle(slot.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${slot.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent hover:border-green-400'}`}>
                            <Check size={14} strokeWidth={4}/>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {slot.assignedMemberIds.map((id: string) => {
                        const m = data.members.find((mem: any) => mem.id === id);
                        
                        // Handle removed or archived members
                        if(!m || m.status === MemberStatus.ARCHIVED || m.status === MemberStatus.TRANSFERRED) {
                             return <div key={id} className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold border bg-gray-100 text-gray-400 border-gray-200"><span>{m ? m.name : 'Unknown'}</span><span className="text-[8px] bg-red-100 text-red-600 px-1 rounded">GONE</span></div>;
                        }

                        let colorClass = 'bg-slate-50 text-slate-600 border-slate-100';
                        if (m.type === MemberType.FNF) colorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                        else if (m.type === MemberType.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE) colorClass = 'bg-rose-50 text-rose-700 border-rose-100';
                        else colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                        if (slot.isCompleted) colorClass = 'bg-green-50 text-green-700 border-green-100 opacity-80';
                        
                        return <div key={id} className={`flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold border ${colorClass}`}><span>{m.name}</span></div>;
                    })}
                </div>
            </div>
        </div>
    );
};

interface CollapsibleProgressSectionProps {
    title: string;
    members: Member[];
    data: AppData;
    icon: React.ElementType;
    color: string;
}

const CollapsibleProgressSection = ({ title, members, data, icon: Icon, color }: CollapsibleProgressSectionProps) => {
    const [isOpen, setIsOpen] = useState(false);
    if(members.length === 0) return null;

    const colorClasses: Record<string, string> = {
        indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        rose: 'text-rose-600 bg-rose-50 border-rose-100'
    };

    return (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={() => setIsOpen(!isOpen)} className={`w-full p-4 flex items-center justify-between transition-colors ${isOpen ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${colorClasses[color].replace('border-indigo-100','')}`}><Icon size={18}/></div>
                    <span className="font-bold text-slate-800 text-sm">{title} ({members.length})</span>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
            </button>
            
            {isOpen && (
                <div className="divide-y divide-slate-50">
                    {members.map((m: Member) => {
                        const stats = getMemberStats(m.id, data);
                        return (
                            <div key={m.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm">{m.name}</h4>
                                    <div className="flex gap-1">
                                        <Badge label="W" value={formatDuration(stats.prayer.week)} />
                                        <Badge label="M" value={formatDuration(stats.prayer.month)} />
                                        <Badge label="Q" value={formatDuration(stats.prayer.quarter)} />
                                        <Badge label="Y" value={formatDuration(stats.prayer.year)} highlight />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        <span>Visits</span>
                                        <span>{stats.visits}/2</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min(100, (stats.visits/2)*100)}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface CollapsibleContactSectionProps {
    title: string;
    members: Member[];
    icon: React.ElementType;
    color: string;
}

const CollapsibleContactSection = ({ title, members, icon: Icon, color }: CollapsibleContactSectionProps) => {
    const [isOpen, setIsOpen] = useState(false);
    if(members.length === 0) return null;

    const colorClasses: Record<string, string> = {
        indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        rose: 'text-rose-600 bg-rose-50 border-rose-100'
    };

    return (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={() => setIsOpen(!isOpen)} className={`w-full p-4 flex items-center justify-between transition-colors ${isOpen ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${colorClasses[color].replace('border-indigo-100','')}`}><Icon size={18}/></div>
                    <span className="font-bold text-slate-800 text-sm">{title} ({members.length})</span>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
            </button>
            
            {isOpen && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50">
                    {members.map((member: Member) => {
                      const phone = member.phone || member.parentPhone;
                      const hasPhone = !!phone;
                      const gps = member.gpsCoordinates;
                      const address = member.address;
                      const hasLoc = !!gps || !!address;
                      const mapLink = gps 
                        ? `https://www.google.com/maps/dir/?api=1&destination=${gps}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`;

                      return (
                          <div key={member.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                              <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{member.name}</h4>
                                  {address && <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><MapPin size={10}/> {address.substring(0,20)}...</div>}
                              </div>
                              <div className="flex gap-2">
                                  {hasPhone ? (
                                      <>
                                        <a href={`tel:${phone}`} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"><Phone size={16}/></a>
                                        <a href={`sms:${phone}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><MessageSquare size={16}/></a>
                                      </>
                                  ) : (
                                      <div className="p-2 bg-slate-50 text-slate-300 rounded-lg"><Phone size={16}/></div>
                                  )}
                                  {hasLoc ? (
                                      <a href={mapLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><MapIcon size={16}/></a>
                                  ) : (
                                      <div className="p-2 bg-slate-50 text-slate-300 rounded-lg"><MapIcon size={16}/></div>
                                  )}
                              </div>
                          </div>
                      );
                    })}
                </div>
            )}
        </div>
    );
};

const Badge = ({ label, value, highlight }: any) => (
    <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border flex flex-col items-center leading-none ${highlight ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
        <span className="opacity-50 text-[8px]">{label}</span>
        <span>{value}</span>
    </div>
);

const getMemberStats = (memberId: string, data: AppData) => {
    const year = new Date().getFullYear();
    // Visits (Count completed sessions where visited)
    const visits = (data.outreachSessions || [])
        .filter(s => s.status === 'COMPLETED' && new Date(s.date).getFullYear() === year && s.visitedMemberIds?.includes(memberId))
        .length;

    // Prayers: Calculate minutes (Count * 30 mins)
    const prayers = (data.prayerSchedule || []).filter(s => s.isCompleted && s.assignedMemberIds.includes(memberId));
    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    // Helper to sum minutes
    const sumMins = (slots: PrayerSlot[]) => slots.reduce((acc, s) => acc + (s.durationMins || 30), 0);

    return {
        visits,
        prayer: {
            week: sumMins(prayers.filter(s => Math.abs(now.getTime() - new Date(s.date).getTime()) < oneWeek)),
            month: sumMins(prayers.filter(s => new Date(s.date).getMonth() === now.getMonth() && new Date(s.date).getFullYear() === year)),
            quarter: sumMins(prayers.filter(s => Math.floor(new Date(s.date).getMonth() / 3) === Math.floor(now.getMonth() / 3) && new Date(s.date).getFullYear() === year)),
            year: sumMins(prayers.filter(s => new Date(s.date).getFullYear() === year))
        }
    };
};

const SessionChildList = ({ session, data, onToggle, onMove }: { session: OutreachSession, data: AppData, onToggle: (sid: string, mid: string) => void, onMove: (mid: string, sid: string) => void }) => {
    return (
        <div className="divide-y divide-slate-50">
            {session.assignedMemberIds.map(id => {
                const m = data.members.find(mem => mem.id === id);
                const isVisited = session.visitedMemberIds?.includes(id);
                
                // Handle archived/deleted members who are still in schedule
                if (!m || m.status === MemberStatus.ARCHIVED || m.status === MemberStatus.TRANSFERRED) {
                    return (
                        <div key={id} className="flex items-center justify-between p-3 bg-red-50/50">
                            <div className="flex items-center gap-3 opacity-50">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">?</div>
                                <div>
                                    <div className="font-bold text-sm text-slate-500">{m ? m.name : 'Unknown Child'}</div>
                                    <div className="text-[10px] text-red-500 font-bold uppercase">{m ? m.status : 'DELETED'}</div>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onMove(id, session.id); }}
                                className="text-xs text-red-500 hover:underline"
                            >
                                Remove
                            </button>
                        </div>
                    );
                }
                
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
                                    title="Reschedule or Remove"
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

const AddMemberModal = ({ isOpen, onClose, onSelect, members, currentSessionMembers }: any) => {
    const [search, setSearch] = useState('');
    if (!isOpen) return null;
    
    const available = members.filter((m: Member) => 
        !currentSessionMembers.includes(m.id) && 
        m.assignedChurch === 'UJ' &&
        !['Teacher','Helper','Volunteer'].includes(m.type)
    ).filter((m: Member) => m.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">Add Member</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400"/></button>
                </div>
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-full p-3 bg-slate-50 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />
                <div className="overflow-y-auto flex-1 space-y-2">
                    {available.map((m: Member) => (
                        <button key={m.id} onClick={() => onSelect(m.id)} className="w-full p-3 text-left hover:bg-slate-50 rounded-xl flex items-center justify-between group">
                            <div>
                                <div className="font-bold text-slate-700">{m.name}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{m.type}</div>
                            </div>
                            <Plus size={16} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
                        </button>
                    ))}
                    {available.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No members found.</p>}
                </div>
            </div>
        </div>
    );
};

export default OutreachHub;