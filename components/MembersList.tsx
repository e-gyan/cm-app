import React, { useState } from 'react';
import { AppData, Member, MemberType, MemberStatus, Church, Role } from '../types';
import { User, Users, Edit2, Archive, X, Save, GraduationCap, Undo2, HelpCircle, AlertCircle, Activity, Briefcase, ChevronDown, ChevronUp, Plus, Lock, Key, Heart, Hand } from 'lucide-react';
import { updateMember, bulkArchiveMembers, addMember } from '../services/storageService';

interface MembersListProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const MembersList: React.FC<MembersListProps> = ({ data, onUpdate, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Tabs for the Central Hub
  const [hubTab, setHubTab] = useState<'MEMBERS' | 'TEACHERS'>('MEMBERS');
  const [filter, setFilter] = useState<'ALL' | 'ARCHIVED' | string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // CREATE NEW MEMBER STATE
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMemberData, setNewMemberData] = useState<{
      name: string;
      type: MemberType;
      status: MemberStatus;
      birthDate: string;
      assignedChurch: Church;
  }>({
      name: '',
      type: MemberType.MEMBER, 
      status: MemberStatus.ACTIVE,
      birthDate: '',
      assignedChurch: activeChurch === 'ALL' ? 'UJ' : activeChurch
  });
  
  // EDIT STATE
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<MemberType>(MemberType.MEMBER);
  const [editStatus, setEditStatus] = useState<MemberStatus>(MemberStatus.ACTIVE);
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editChurch, setEditChurch] = useState<Church>('UJ');
  
  // TEACHER ACCESS EDIT STATE
  const [editPasscode, setEditPasscode] = useState('');
  const [editAccessActive, setEditAccessActive] = useState(false);
  const [editRole, setEditRole] = useState<Role>('NONE');

  const startEditing = (member: Member) => {
    setEditingId(member.id);
    setEditName(member.name);
    setEditType(member.type);
    setEditStatus(member.status);
    setEditBirthDate(member.birthDate || '');
    setEditChurch(member.assignedChurch || 'UJ');
    
    // Auth fields (Passcode is masked/hashed, so we show blank or placeholder)
    setEditPasscode(''); // Don't show existing hash
    setEditAccessActive(member.isAccessActive || false);
    setEditRole(member.role || 'NONE');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const original = data.members.find(m => m.id === editingId);
    if (!original) return;
    
    // Only update passcode if user typed something new
    const finalPasscode = editPasscode.trim() ? editPasscode.trim() : original.passcode;

    await updateMember({
      ...original,
      name: editName,
      type: editType,
      status: editStatus,
      birthDate: editBirthDate,
      assignedChurch: editChurch,
      role: editRole,
      passcode: finalPasscode,
      isAccessActive: editAccessActive
    });
    setEditingId(null);
    onUpdate();
  };

  const openCreateModal = () => {
      setNewMemberData({
        name: '',
        type: hubTab === 'TEACHERS' ? MemberType.TEACHER : MemberType.MEMBER,
        status: MemberStatus.ACTIVE,
        birthDate: '',
        assignedChurch: activeChurch === 'ALL' ? 'UJ' : activeChurch
      });
      setIsCreateModalOpen(true);
  };

  const handleCreateMember = () => {
    if(!newMemberData.name) return;
    addMember(
        newMemberData.name, 
        newMemberData.type, 
        newMemberData.assignedChurch, 
        newMemberData.birthDate, 
        newMemberData.status
    );
    setIsCreateModalOpen(false);
    onUpdate();
  };

  const archiveMember = async (member: Member) => {
    if (window.confirm(`Are you sure you want to archive ${member.name}?`)) {
      await updateMember({ ...member, status: MemberStatus.ARCHIVED });
      onUpdate();
    }
  };

  const restoreMember = async (member: Member) => {
     await updateMember({ ...member, status: MemberStatus.ACTIVE });
     onUpdate();
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = (members: Member[]) => {
    const allIds = members.map(m => m.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    const newSelection = new Set(selectedIds);
    if (allSelected) allIds.forEach(id => newSelection.delete(id));
    else allIds.forEach(id => newSelection.add(id));
    setSelectedIds(newSelection);
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Are you sure you want to archive ${selectedIds.size} selected members?`)) {
      bulkArchiveMembers(Array.from(selectedIds));
      setSelectedIds(new Set());
      onUpdate();
    }
  };

  const getTeenStatus = (birthDateStr?: string) => {
    if (!birthDateStr) return { label: 'NO', colorClass: 'bg-red-50 text-red-600 border-red-100' };
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    
    if (age >= 13) return { label: 'YES', colorClass: 'bg-green-100 text-green-700 border-green-200' };
    const thirteenthBirthday = new Date(birth);
    thirteenthBirthday.setFullYear(birth.getFullYear() + 13);
    const fiveMonthsFromNow = new Date(today);
    fiveMonthsFromNow.setMonth(today.getMonth() + 5);
    if (thirteenthBirthday <= fiveMonthsFromNow) return { label: 'SOON', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'NO', colorClass: 'bg-red-50 text-red-600 border-red-100' };
  };

  const getStatusBadgeColor = (status: MemberStatus) => {
    switch (status) {
        case MemberStatus.ACTIVE: return 'bg-green-100 text-green-700';
        case MemberStatus.NOT_ACTIVE: return 'bg-yellow-100 text-yellow-700';
        case MemberStatus.ARCHIVED: return 'bg-gray-100 text-gray-600';
        default: return 'bg-gray-100 text-gray-600';
    }
  };

  const MemberTableSection = ({ title, members, icon: Icon, colorClass, badgeClass, isTeacherSection }: any) => {
    const [isOpen, setIsOpen] = useState(true);
    if (members.length === 0) return null;
    const allSectionSelected = members.length > 0 && members.every((m: Member) => selectedIds.has(m.id));
    const isArchivedView = filter === 'ARCHIVED';

    return (
      <div className="mb-6 border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
        <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors ${!isOpen ? 'rounded-xl' : ''}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${colorClass}`}>
            <Icon size={16} />
            {title} ({members.length})
          </h3>
          {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        
        {isOpen && (
          <div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500 min-w-[900px]">
                <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-700">
                  <tr>
                    {!isArchivedView && isAdmin && (
                      <th className="px-6 py-3 w-10">
                        <input type="checkbox" className="rounded border-gray-300 text-indigo-600 cursor-pointer" checked={allSectionSelected} onChange={() => toggleSelectAll(members)} />
                      </th>
                    )}
                    <th className="px-6 py-3 w-[200px]">Full Name</th>
                    {/* UPDATED LABEL */}
                    <th className="px-6 py-3">Assigned Church</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Membership Status</th>
                    <th className="px-6 py-3">Date of Birth</th>
                    {isTeacherSection && isAdmin ? (
                         <th className="px-6 py-3 w-[250px]">System Access</th>
                    ) : (
                         <th className="px-6 py-3">Teen Status</th>
                    )}
                    {!isTeacherSection && <th className="px-6 py-3">Attendance</th>}
                    {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((member: Member) => {
                    const isEditing = editingId === member.id;
                    const isSelected = selectedIds.has(member.id);
                    const teenStatus = getTeenStatus(member.birthDate);
                    
                    const churchAttendance = data.attendance.filter(r => r.churchId === member.assignedChurch);
                    const totalSessions = churchAttendance.length;
                    const attendedSessions = churchAttendance.filter(r => r.presentMemberIds.includes(member.id)).length;
                    const attendanceRate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;
                    
                    return (
                      <tr key={member.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                        {!isArchivedView && isAdmin && (
                          <td className="px-6 py-4">
                            <input type="checkbox" className="rounded border-gray-300 text-indigo-600 cursor-pointer" checked={isSelected} onChange={() => toggleSelection(member.id)} />
                          </td>
                        )}
                        
                        <td className="px-6 py-4">
                          {isEditing ? (
                              <input type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={editName} onChange={e => setEditName(e.target.value)} />
                          ) : (
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${badgeClass}`}><Icon size={16} /></div>
                                <div><p className="font-medium text-gray-900">{member.name}</p></div>
                              </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isEditing ? (
                              <select className="p-2 border border-gray-300 rounded text-sm font-bold" value={editChurch} onChange={(e) => setEditChurch(e.target.value as Church)}>
                                 {['UJ', 'I', 'K', 'LJ'].map(c => <option key={c} value={c}>{c}</option>)}
                                 {isAdmin && <option value="ALL">ALL (Admin)</option>}
                              </select>
                          ) : (
                              <span className={`px-2 py-1 rounded text-xs font-bold border border-gray-200 bg-gray-50 text-gray-700`}>{member.assignedChurch}</span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          {isEditing ? (
                              <select className="p-2 border border-gray-300 rounded text-sm" value={editType} onChange={(e) => setEditType(e.target.value as MemberType)}>
                                  {Object.values(MemberType).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          ) : (
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>{member.type}</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isEditing ? (
                              <select className="p-2 border border-gray-300 rounded text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value as MemberStatus)}>
                                  {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                          ) : (
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(member.status)}`}>{member.status}</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                            {isEditing ? (
                                 <input type="date" className="w-full p-2 border border-gray-300 rounded" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)} />
                            ) : (
                                <span className="text-sm text-gray-600">{member.birthDate ? new Date(member.birthDate).toLocaleDateString() : '--'}</span>
                            )}
                        </td>

                        {isTeacherSection && isAdmin ? (
                             <td className="px-6 py-4">
                                {isEditing ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="New PIN" className="w-16 p-1 border rounded text-xs text-center font-mono" value={editPasscode} onChange={e => setEditPasscode(e.target.value)} maxLength={4}/>
                                            <select className="text-xs border rounded p-1 flex-1" value={editRole} onChange={e => setEditRole(e.target.value as Role)}>
                                                <option value="TEACHER">Staff</option>
                                                <option value="ADMIN">Admin</option>
                                                <option value="NONE">None</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer bg-gray-50 p-1 rounded">
                                            <input type="checkbox" checked={editAccessActive} onChange={e => setEditAccessActive(e.target.checked)} className="rounded text-indigo-600"/>
                                            <span>Login Active</span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {member.role !== 'NONE' && member.isAccessActive ? (
                                            <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                                                <Key size={12}/> {member.role === 'ADMIN' ? 'Admin' : 'Staff'}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs bg-gray-50 text-gray-400 px-2 py-1 rounded border border-gray-100">
                                                <Lock size={12}/> No Access
                                            </span>
                                        )}
                                    </div>
                                )}
                             </td>
                        ) : (
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-sm ${teenStatus.colorClass}`}>
                                    {teenStatus.label}
                                </span>
                            </td>
                        )}

                        {!isTeacherSection && (
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-gray-400" />
                                    <span className="font-semibold text-gray-600">{attendanceRate}%</span>
                                </div>
                            </td>
                        )}

                        {isAdmin && (
                            <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                {isEditing ? (
                                    <>
                                        <button onClick={saveEdit} className="p-2 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"><Save size={16} /></button>
                                        <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"><X size={16} /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEditing(member)} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button>
                                        {(member.status === MemberStatus.ARCHIVED) ? (
                                            <button onClick={() => restoreMember(member)} className="p-2 text-green-500 hover:text-green-700 bg-green-50 rounded"><Undo2 size={16} /></button>
                                        ) : (
                                            <button onClick={() => archiveMember(member)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Archive size={16} /></button>
                                        )}
                                    </>
                                )}
                            </div>
                            </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
             {/* MOBILE CARD VIEW */}
            <div className="md:hidden p-2 space-y-2">
              {members.map((member: Member) => {
                 const isEditing = editingId === member.id;
                 const teenStatus = getTeenStatus(member.birthDate);
                 return (
                   <div key={member.id} className="p-3 rounded-lg border shadow-sm bg-white border-gray-200">
                      {isEditing ? (
                          <div className="space-y-3">
                             <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Full Name</label>
                                <input type="text" className="w-full p-2 border rounded" value={editName} onChange={e => setEditName(e.target.value)} />
                             </div>
                             {/* ... (Previous input fields) ... */}
                             <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Date of Birth</label>
                                    <input type="date" className="w-full p-2 border rounded" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Church Branch</label>
                                    <select className="w-full p-2 border rounded" value={editChurch} onChange={(e) => setEditChurch(e.target.value as Church)}>
                                        {['UJ', 'I', 'K', 'LJ'].map(c => <option key={c} value={c}>{c}</option>)}
                                        {isAdmin && <option value="ALL">ALL (Admin)</option>}
                                    </select>
                                </div>
                             </div>
                             <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Role Category</label>
                                    <select className="w-full p-2 border rounded" value={editType} onChange={(e) => setEditType(e.target.value as MemberType)}>
                                        {Object.values(MemberType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Membership Status</label>
                                    <select className="w-full p-2 border rounded" value={editStatus} onChange={(e) => setEditStatus(e.target.value as MemberStatus)}>
                                    {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                             </div>
                             
                             {isTeacherSection && (
                                <div className="p-3 bg-gray-50 rounded border border-indigo-100">
                                    <p className="text-xs font-bold text-indigo-600 mb-2 uppercase flex items-center gap-2"><Key size={12}/> System Access</p>
                                    <div className="flex gap-2 mb-2">
                                        <div className="flex-1">
                                             <input type="text" placeholder="Set New PIN" className="w-full p-2 border rounded text-center font-mono tracking-widest" value={editPasscode} onChange={e => setEditPasscode(e.target.value)} maxLength={4}/>
                                        </div>
                                        <div className="flex-1">
                                            <select className="w-full p-2 border rounded" value={editRole} onChange={e => setEditRole(e.target.value as Role)}>
                                                <option value="TEACHER">Staff Role</option>
                                                <option value="ADMIN">Admin Role</option>
                                                <option value="NONE">No Role</option>
                                            </select>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-gray-700 bg-white p-2 rounded border cursor-pointer">
                                        <input type="checkbox" checked={editAccessActive} onChange={e => setEditAccessActive(e.target.checked)} className="rounded text-indigo-600 w-4 h-4"/>
                                        <span>Allow Login Access</span>
                                    </label>
                                </div>
                             )}
                             <div className="flex gap-2 pt-2 border-t mt-2">
                                <button onClick={saveEdit} className="flex-1 py-2 bg-indigo-600 text-white rounded font-medium shadow-sm">Save Changes</button>
                                <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded font-medium">Cancel</button>
                             </div>
                          </div>
                      ) : (
                          // ... (Existing Read-only Card View) ...
                          <div className="flex justify-between items-start">
                             <div className="flex items-start gap-3 flex-1">
                                <div className={`mt-1 p-2 rounded-full shrink-0 ${badgeClass}`}><Icon size={16} /></div>
                                <div>
                                    <h4 className="font-bold text-gray-900">{member.name}</h4>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadgeColor(member.status)}`}>{member.status}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border">{member.assignedChurch}</span>
                                        {member.birthDate && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">🎂 {new Date(member.birthDate).toLocaleDateString()}</span>}
                                        {!isTeacherSection && teenStatus.label !== 'NO' && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${teenStatus.colorClass}`}>Teen: {teenStatus.label}</span>}
                                        {isTeacherSection && member.isAccessActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100 flex items-center gap-1"><Key size={8}/> Access</span>}
                                    </div>
                                </div>
                             </div>
                             
                             {isAdmin && (
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => startEditing(member)} className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 rounded-lg"><Edit2 size={16} /></button>
                                    {member.status === MemberStatus.ARCHIVED ? (
                                        <button onClick={() => restoreMember(member)} className="p-2 text-green-500 hover:text-green-700 bg-green-50 rounded-lg"><Undo2 size={16} /></button>
                                    ) : (
                                        <button onClick={() => archiveMember(member)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 rounded-lg"><Archive size={16} /></button>
                                    )}
                                </div>
                             )}
                          </div>
                      )}
                   </div>
                 );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const getCreationRoleOptions = () => {
    if (hubTab === 'TEACHERS') {
      return [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER];
    }
    return [MemberType.MEMBER, MemberType.FNF, MemberType.INCONSISTENT, MemberType.NOT_MEMBER];
  };

  const getFilteredContent = () => {
    let baseMembers = data.members;
    
    // 1. Filter by Church Context
    if (activeChurch !== 'ALL') {
      baseMembers = baseMembers.filter(m => m.assignedChurch === activeChurch);
    }

    // 2. Filter by Tab (Members vs Staff)
    const staffTypes = [MemberType.TEACHER, MemberType.HELPER, MemberType.VOLUNTEER];
    if (hubTab === 'TEACHERS') {
      baseMembers = baseMembers.filter(m => staffTypes.includes(m.type));
    } else {
      baseMembers = baseMembers.filter(m => !staffTypes.includes(m.type));
    }

    // 3. Filter by Status/Type dropdown
    if (filter === 'ARCHIVED') {
        baseMembers = baseMembers.filter(m => m.status === MemberStatus.ARCHIVED);
    } else if (filter !== 'ALL') {
        baseMembers = baseMembers.filter(m => m.type === filter && m.status !== MemberStatus.ARCHIVED);
    } else {
        baseMembers = baseMembers.filter(m => m.status !== MemberStatus.ARCHIVED);
    }

    // 4. Sort alphabetically
    baseMembers.sort((a, b) => a.name.localeCompare(b.name));
    
    const renderSection = (title: string, type: MemberType, icon: any, color: string, badge: string, isTeacher = false) => {
        const sectionMembers = baseMembers.filter(m => m.type === type);
        if (sectionMembers.length === 0) return null;
        
        return (
            <MemberTableSection 
                key={type}
                title={title} 
                members={sectionMembers} 
                icon={icon} 
                colorClass={color} 
                badgeClass={badge}
                isTeacherSection={isTeacher}
            />
        );
    };

    if (hubTab === 'TEACHERS') {
        return (
            <div className="space-y-6">
                {renderSection("Teachers & Leaders", MemberType.TEACHER, GraduationCap, "text-purple-600", "bg-purple-100 text-purple-700", true)}
                {renderSection("Helpers", MemberType.HELPER, Heart, "text-pink-600", "bg-pink-100 text-pink-700", true)}
                {renderSection("Volunteers", MemberType.VOLUNTEER, Hand, "text-orange-600", "bg-orange-100 text-orange-700", true)}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {renderSection("Regular Members", MemberType.MEMBER, User, "text-indigo-600", "bg-indigo-100 text-indigo-700")}
            {renderSection("Friends & Family (New)", MemberType.FNF, Users, "text-amber-600", "bg-amber-100 text-amber-700")}
            {renderSection("Inconsistent / Inactive", MemberType.INCONSISTENT, AlertCircle, "text-rose-600", "bg-rose-100 text-rose-700")}
            {renderSection("Not A Member", MemberType.NOT_MEMBER, HelpCircle, "text-gray-600", "bg-gray-100 text-gray-700")}
        </div>
    );
  };
  
  return (
      <div className="space-y-6 relative pb-20">
          {/* Header Controls (unchanged) */}
           <div className="flex items-center justify-between mb-4">
             <div>
                <h2 className="text-xl font-bold text-gray-800">People Hub: {activeChurch}</h2>
                <p className="text-sm text-gray-500">Manage teachers and members.</p>
             </div>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setHubTab('MEMBERS')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${hubTab === 'MEMBERS' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
                    <span className="flex items-center gap-2"><User size={16}/> Members</span>
                </button>
                <button onClick={() => setHubTab('TEACHERS')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${hubTab === 'TEACHERS' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>
                    <span className="flex items-center gap-2"><Briefcase size={16}/> Staff</span>
                </button>
             </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Filtering {hubTab.toLowerCase()}</h3>
            <div className="flex bg-gray-50 rounded-lg p-1 overflow-x-auto max-w-full w-full sm:w-auto">
              {['ALL', ...getCreationRoleOptions(), 'ARCHIVED'].map((f) => (
                 <button key={f} onClick={() => { setFilter(f); setSelectedIds(new Set()); }} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all flex-1 sm:flex-none text-center ${filter === f ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                    {f === 'ALL' ? 'Active' : f}
                  </button>
              ))}
            </div>
          </div>

          {selectedIds.size > 0 && filter !== 'ARCHIVED' && isAdmin && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-4 w-[90%] md:w-auto justify-between md:justify-start">
              <span className="font-medium whitespace-nowrap">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-gray-700 hidden md:block"></div>
              <button onClick={handleBulkArchive} className="flex items-center gap-2 hover:text-red-300 transition-colors font-medium text-red-200 whitespace-nowrap"><Archive size={18} /> Bulk Archive</button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1 hover:bg-gray-700 rounded-full transition-colors"><X size={16} /></button>
            </div>
          )}

          {getFilteredContent()}

          {isAdmin && !isCreateModalOpen && (
            <button 
                onClick={openCreateModal}
                className="fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 z-40"
                title="Create New Member/Teacher"
            >
                <Plus size={24} />
            </button>
          )}

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Create New {hubTab === 'TEACHERS' ? 'Teacher/Staff' : 'Member'}</h3>
                        <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" className="w-full p-3 border border-gray-200 rounded-xl" placeholder="e.g., John Doe" value={newMemberData.name} onChange={e => setNewMemberData({...newMemberData, name: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role Category</label>
                                <select className="w-full p-3 border border-gray-200 rounded-xl" value={newMemberData.type} onChange={e => setNewMemberData({...newMemberData, type: e.target.value as MemberType})}>
                                    {getCreationRoleOptions().map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Church</label>
                                <select className="w-full p-3 border border-gray-200 rounded-xl" value={newMemberData.assignedChurch} onChange={e => setNewMemberData({...newMemberData, assignedChurch: e.target.value as Church})}>
                                    {['UJ', 'I', 'K', 'LJ'].map(c => <option key={c} value={c}>{c}</option>)}
                                    {hubTab === 'TEACHERS' && isAdmin && <option value="ALL">ALL (Admin)</option>}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                <input type="date" className="w-full p-3 border border-gray-200 rounded-xl" value={newMemberData.birthDate} onChange={e => setNewMemberData({...newMemberData, birthDate: e.target.value})} />
                            </div>
                            <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Membership Status</label>
                                 <select className="w-full p-3 border border-gray-200 rounded-xl" value={newMemberData.status} onChange={e => setNewMemberData({...newMemberData, status: e.target.value as MemberStatus})}>
                                    {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <button 
                            onClick={handleCreateMember}
                            disabled={!newMemberData.name}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold mt-4 disabled:opacity-50"
                        >
                            Create Record
                        </button>
                    </div>
                </div>
            </div>
          )}
      </div>
  );
};

export default MembersList;