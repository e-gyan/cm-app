import React, { useState, useMemo } from 'react';
import { AppData, Member, OutreachSession, PrayerSlot, MemberStatus } from '../types';
import { generateOutreachSchedule, saveOutreachSession, savePrayerSlot, updateMember } from '../services/storageService';
import { Calendar, MapPin, Phone, MessageSquare, Plus, Trash2, CheckCircle2, Clock, User, Heart, AlertCircle, Save } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'VISIT' | 'PRAYER' | 'CONTACTS'>('VISIT');
  
  // Visitation State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  
  // Prayer State
  const [prayerWeek, setPrayerWeek] = useState(getStartOfWeek(new Date()));

  function getStartOfWeek(date: Date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      return new Date(d.setDate(diff));
  }

  // --- LOGIC: VISITATION ---
  const handleAddDate = () => {
      if(newDateInput && !selectedDates.includes(newDateInput)) {
          setSelectedDates([...selectedDates, newDateInput].sort());
          setNewDateInput('');
      }
  };

  const handleRemoveDate = (date: string) => {
      setSelectedDates(selectedDates.filter(d => d !== date));
  };

  const handleGenerateSchedule = () => {
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      generateOutreachSchedule(selectedDates, ujMembers);
      setSelectedDates([]);
      onUpdate();
  };

  const pendingVisits = useMemo(() => {
      return (data.outreachSessions || [])
        .filter(s => s.status === 'PENDING')
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data.outreachSessions]);
  
  const completedVisits = useMemo(() => {
      return (data.outreachSessions || [])
        .filter(s => s.status === 'COMPLETED')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Recent first
  }, [data.outreachSessions]);

  const markVisitComplete = (session: OutreachSession) => {
      saveOutreachSession({ ...session, status: 'COMPLETED', completedBy: currentUser.name });
      onUpdate();
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
      // Create slots for Mon-Fri of the selected week
      const start = new Date(prayerWeek);
      const slots: PrayerSlot[] = [];
      const ujMembers = data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper','Volunteer'].includes(m.type));
      
      // Filter out members already prayed for recently? For simplicity, random pick for now.
      const pool = [...ujMembers].sort(() => 0.5 - Math.random());
      
      for (let i=0; i<5; i++) { // Mon-Fri
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          
          // Check if slot exists
          const existing = data.prayerSchedule?.find(s => s.date === dateStr);
          if (!existing) {
              const targetMembers = pool.splice(0, 3).map(m => m.id); // 3 members per day
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
      </div>

      {/* VISITATION TAB */}
      {activeTab === 'VISIT' && (
          <div className="space-y-6">
              
              {/* SCHEDULER CARD */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Calendar size={20}/> Schedule Visits</h3>
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
                  <h3 className="font-bold text-slate-800 px-2">Upcoming Visits</h3>
                  {pendingVisits.length === 0 ? (
                      <div className="text-center p-8 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">No pending visits scheduled.</div>
                  ) : (
                      pendingVisits.map(session => (
                          <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                              <div className="flex justify-between items-start mb-4 pl-3">
                                  <div>
                                      <h4 className="font-bold text-lg text-slate-800">{formatDateDDMMYYYY(session.date)}</h4>
                                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1"><Clock size={12}/> {session.startTime} - {session.endTime}</p>
                                  </div>
                                  <button onClick={() => markVisitComplete(session)} className="px-3 py-1 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-100">
                                      <CheckCircle2 size={14}/> Mark Done
                                  </button>
                              </div>
                              
                              <div className="space-y-3 pl-3">
                                  {session.assignedMemberIds.map(id => {
                                      const m = data.members.find(mem => mem.id === id);
                                      if(!m) return null;
                                      return (
                                          <div key={id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${m.type === 'Member' ? 'bg-indigo-400' : m.type === 'FNF' ? 'bg-amber-400' : 'bg-rose-400'}`}>
                                                      {m.type[0]}
                                                  </div>
                                                  <div>
                                                      <p className="font-bold text-sm text-slate-700">{m.name}</p>
                                                      <p className="text-[10px] text-slate-400">{m.address || 'No Address'}</p>
                                                  </div>
                                              </div>
                                              <div className="flex gap-2">
                                                  <button onClick={() => openMap(m)} className="p-2 bg-white rounded-full shadow-sm text-blue-500 hover:bg-blue-50" title="Map"><MapPin size={16}/></button>
                                                  {m.parentPhone && (
                                                      <>
                                                        <a href={`tel:${m.parentPhone}`} className="p-2 bg-white rounded-full shadow-sm text-green-500 hover:bg-green-50" title="Call"><Phone size={16}/></a>
                                                        <a href={`sms:${m.parentPhone}`} className="p-2 bg-white rounded-full shadow-sm text-indigo-500 hover:bg-indigo-50" title="Message"><MessageSquare size={16}/></a>
                                                      </>
                                                  )}
                                              </div>
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
                              <div className="flex flex-wrap gap-2">
                                  {slot.assignedMemberIds.map(id => {
                                      const m = data.members.find(mem => mem.id === id);
                                      return m ? (
                                          <span key={id} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 flex items-center gap-1">
                                              <User size={10}/> {m.name}
                                          </span>
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
                      {data.members.filter(m => m.assignedChurch === 'UJ' && !['Teacher','Helper'].includes(m.type)).map(m => (
                          <ContactRow key={m.id} member={m} onUpdate={onUpdate} />
                      ))}
                  </tbody>
              </table>
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
                <td className="p-4 font-bold">{member.name}</td>
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
            <td className="p-4 font-bold text-slate-700">{member.name}</td>
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