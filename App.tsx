
import React, { useState, useEffect, useMemo } from 'react';
import { getAppData, restoreSession, logoutUser, syncFromCloud, initializeRepository, markNotificationAsRead, clearAllNotifications } from './services/storageService';
import { AppData, Church, Member, Role, Notification } from './types';
import Dashboard from './components/Dashboard';
import AttendanceTaker from './components/AttendanceTaker';
import ReportExport from './components/ReportExport';
import MembersList from './components/MembersList';
import Finances from './components/Finances';
import OutreachHub from './components/OutreachHub';
import AnalyticsHub from './components/AnalyticsHub'; 
import Settings from './components/Settings'; // New Import
import Login from './components/Login';
import { LayoutDashboard, CalendarCheck, Users, Share2, Menu, X, ChevronLeft, ChevronRight, Building2, UserCog, LogOut, Loader2, RefreshCw, Zap, ChevronDown, Bell, Check, HeartHandshake, PieChart, Settings as SettingsIcon } from 'lucide-react';
import { DEFAULT_SETTINGS } from './constants';

enum View {
  DASHBOARD = 'Dashboard',
  ATTENDANCE = 'Attendance',
  MEMBERS = 'People Hub',
  OUTREACH = 'Outreach',
  ANALYTICS = 'Analytics', 
  FINANCES = 'Finances',
  EXPORT = 'Reports',
  SETTINGS = 'Settings' // New View Enum
}

const App: React.FC = () => {
  const [data, setData] = useState<AppData>({ members: [], attendance: [], transactions: [], notifications: [], settings: DEFAULT_SETTINGS });
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = localStorage.getItem('currentView');
    return (saved as View) || View.DASHBOARD;
  });
  
  // GLOBAL CONTEXT STATE
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [activeChurch, setActiveChurch] = useState<Church>('CM');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebarState');
    return savedState !== null ? JSON.parse(savedState) : true; 
  });

  // Initial load & Session Restore
  useEffect(() => {
    const init = async () => {
        await initializeRepository();
        
        try {
             const result = await syncFromCloud();
             if (!result.success) {
                 setSyncError("Cloud connection failed. Using local data.");
             }
        } catch (e) {
             console.warn("Initial cloud sync failed", e);
             setSyncError("Network error. Using local data.");
        }

        refreshData();
        const savedUser = restoreSession();
        if (savedUser) {
            setCurrentUser(savedUser);
            if (savedUser.role === 'TEACHER') {
                setActiveChurch(savedUser.assignedChurch);
            } else if (savedUser.role === 'ADMIN') {
                setActiveChurch('CM');
            }
        }
        setIsLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarState', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (currentUser) {
        localStorage.setItem('currentView', currentView);
    }
  }, [currentView, currentUser]);

  const refreshData = () => {
    setData({ ...getAppData() }); 
  };

  const handleCloudSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    const result = await syncFromCloud();
    if (result.success) {
        refreshData();
    } else {
        setSyncError("Sync failed");
    }
    setIsSyncing(false);
  };

  const handleLogin = (user: Member) => {
    setCurrentUser(user);
    if (user.role === 'TEACHER') {
        setActiveChurch(user.assignedChurch);
    } else {
        setActiveChurch('CM');
    }
    refreshData();
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setCurrentView(View.DASHBOARD);
  };

  const myNotifications = useMemo(() => {
      if (!data.notifications || !currentUser) return [];
      return data.notifications.filter(n => 
          !n.isRead && (n.targetChurch === activeChurch || (currentUser.role === 'ADMIN' && activeChurch === 'CM'))
      );
  }, [data.notifications, activeChurch, currentUser]);

  const handleMarkRead = (id: string) => {
      markNotificationAsRead(id);
      refreshData();
  };

  const handleClearAll = () => {
      clearAllNotifications(activeChurch);
      refreshData();
  };

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Zap size={24} className="text-indigo-600 fill-indigo-600" />
                </div>
            </div>
            <p className="text-sm font-semibold text-slate-500 animate-pulse">Syncing with data...</p>
        </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === 'ADMIN';
  const showOutreach = currentUser.role === 'TEACHER' && currentUser.assignedChurch === 'UJ';
  const showFinances = isAdmin || (currentUser.role === 'TEACHER' && currentUser.assignedChurch === 'UJ');

  const NavItem = ({ view, icon: Icon }: { view: View; icon: React.ElementType }) => (
    <button
      onClick={() => {
        setCurrentView(view);
      }}
      className={`
        w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 group relative overflow-hidden
        ${currentView === view 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
        ${isSidebarCollapsed ? 'justify-center px-2' : ''}
      `}
      title={isSidebarCollapsed ? view : ''}
    >
      <Icon size={22} className={`shrink-0 transition-transform group-hover:scale-110 ${currentView === view ? 'animate-pulse-once' : ''}`} />
      {!isSidebarCollapsed && <span className="whitespace-nowrap">{view}</span>}
    </button>
  );

  const MobileNavItem = ({ view, icon: Icon, label }: { view: View; icon: React.ElementType; label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`
        flex flex-col items-center justify-center w-full py-2 gap-1 active:scale-95 transition-transform
        ${currentView === view ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}
      `}
    >
      <div className={`p-1 rounded-xl transition-colors ${currentView === view ? 'bg-indigo-50' : 'bg-transparent'}`}>
        <Icon size={24} strokeWidth={currentView === view ? 2.5 : 2} />
      </div>
      <span className={`text-[10px] font-bold tracking-tight ${currentView === view ? 'text-indigo-700' : 'text-slate-500'}`}>{label}</span>
    </button>
  );
  
  const NotificationDropdown = () => (
      <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 origin-top-right">
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notifications ({myNotifications.length})</span>
              {myNotifications.length > 0 && (
                  <button onClick={handleClearAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Clear All</button>
              )}
          </div>
          <div className="max-h-80 overflow-y-auto">
              {myNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No new notifications</div>
              ) : (
                  myNotifications.map(n => (
                      <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors relative group">
                          <div className="flex gap-3">
                              <div className={`shrink-0 w-2 h-2 mt-2 rounded-full ${
                                  n.type === 'BIRTHDAY' ? 'bg-pink-500' : 
                                  n.type === 'PROMOTION' ? 'bg-indigo-500' :
                                  n.type === 'STATUS_CHANGE' ? 'bg-green-500' : 'bg-amber-500'
                              }`}></div>
                              <div className="flex-1">
                                  <p className="text-sm font-semibold text-slate-800 leading-tight">{n.message}</p>
                                  <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                                      {n.type.replace('_', ' ')} • {new Date(n.createdAt).toLocaleDateString()}
                                  </span>
                              </div>
                              <button 
                                onClick={() => handleMarkRead(n.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600"
                                title="Mark as read"
                              >
                                  <Check size={16}/>
                              </button>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar Navigation (Desktop Only) */}
      <aside className={`
        hidden md:flex flex-col
        bg-white border-r border-slate-100 shadow-xl shadow-slate-200/50 transition-all duration-300 ease-out z-50
        ${isSidebarCollapsed ? 'w-24' : 'w-72'}
      `}>
        <div className="h-full flex flex-col p-6">
          
          {/* Brand */}
          <div className={`flex items-center gap-3 mb-10 ${isSidebarCollapsed ? 'justify-center' : 'px-1'}`}>
            <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-md transition-colors duration-300
                ${activeChurch === 'UJ' ? 'bg-indigo-600 shadow-indigo-200' : 
                  activeChurch === 'I' ? 'bg-emerald-500 shadow-emerald-200' :
                  activeChurch === 'K' ? 'bg-rose-500 shadow-rose-200' : 'bg-amber-500 shadow-amber-200'}
            `}>
              {activeChurch.substring(0,2)}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden whitespace-nowrap animate-in slide-in-from-left-2 duration-300">
                <h1 className="text-lg font-bold leading-none tracking-tight text-slate-900">{activeChurch} Church</h1>
                <span className="text-xs text-slate-400 font-medium">Ministry System</span>
              </div>
            )}
          </div>

          <nav className="space-y-2 flex-1">
            <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
            <NavItem view={View.ATTENDANCE} icon={CalendarCheck} />
            <NavItem view={View.MEMBERS} icon={Users} />
            <NavItem view={View.ANALYTICS} icon={PieChart} />
            {showOutreach && <NavItem view={View.OUTREACH} icon={HeartHandshake} />}
            {showFinances && <NavItem view={View.FINANCES} icon={Building2} />}
            <NavItem view={View.EXPORT} icon={Share2} />
            {isAdmin && <div className="pt-4 mt-4 border-t border-slate-100"><NavItem view={View.SETTINGS} icon={SettingsIcon} /></div>}
          </nav>

          {/* Sync Status */}
          <div className={`mt-auto mb-4 ${isSidebarCollapsed ? 'flex justify-center' : 'px-1'}`}>
            <button 
                onClick={handleCloudSync}
                className={`w-full py-2.5 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all
                  ${isSyncing 
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600' 
                    : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50'}
                  ${syncError ? 'border-red-200 bg-red-50 text-red-500' : ''}
                `}
                title={syncError || "Force Sync"}
            >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {!isSidebarCollapsed && (isSyncing ? 'Syncing...' : (syncError ? 'Retry Sync' : 'Sync Repository'))}
            </button>
          </div>

          {/* User Info / Logout */}
          <div className={`pt-4 border-t border-slate-100 ${isSidebarCollapsed ? 'items-center' : ''} flex flex-col gap-1`}>
             <button onClick={handleLogout} className="flex items-center gap-3 p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors w-full group">
                <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform"/>
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Sign Out</span>}
             </button>
             {!isSidebarCollapsed && (
                 <div className="px-2 mt-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="text-xs text-slate-400 font-medium truncate">
                        {currentUser.name}
                    </div>
                 </div>
             )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md transition-all z-20"
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 md:hidden flex items-center justify-between sticky top-0 z-30">
          {/* Brand */}
           <div className="flex items-center gap-3">
                 <div className={`
                    w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm
                    ${activeChurch === 'UJ' ? 'bg-indigo-600' : 
                      activeChurch === 'I' ? 'bg-emerald-500' :
                      activeChurch === 'K' ? 'bg-rose-500' : 'bg-amber-500'}
                 `}>
                     {activeChurch.substring(0,2)}
                 </div>
                 <div className="text-left">
                     <h1 className="font-bold text-slate-800 text-sm leading-tight">
                        {activeChurch} Church
                     </h1>
                     <p className="text-[10px] text-slate-500 font-medium">Ministry System</p>
                 </div>
           </div>

           {/* Mobile Header Actions (Notification & Logout) */}
           <div className="flex items-center gap-1">
                {/* Notification Bell Mobile */}
                <div className="relative">
                    <button 
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                        className={`p-2 rounded-full ${isNotificationsOpen ? 'bg-slate-100 text-indigo-600' : 'text-slate-400'}`}
                    >
                        <Bell size={20} />
                        {myNotifications.length > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                        )}
                    </button>
                    {isNotificationsOpen && <NotificationDropdown />}
                </div>

                <button 
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                >
                    <LogOut size={20} />
                </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth pb-24 md:pb-10">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Desktop Header */}
            <div className="hidden md:flex items-end justify-between pb-2">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{currentView}</h2>
                <p className="text-slate-500 mt-1 font-medium">Managing ministry activities for <span className="text-indigo-600 font-bold">{activeChurch} Church</span>.</p>
              </div>
              
              <div className="flex items-center gap-4">
                  {/* Notification Bell Desktop */}
                  <div className="relative">
                       <button 
                          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                          className={`p-2.5 rounded-xl border transition-all ${isNotificationsOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
                       >
                           <Bell size={20} />
                           {myNotifications.length > 0 && (
                               <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-white">
                                   {myNotifications.length}
                               </span>
                           )}
                       </button>
                       {isNotificationsOpen && <NotificationDropdown />}
                  </div>

                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200">
                      <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {isAdmin ? <UserCog size={16} /> : <Users size={16} />}
                      </div>
                      <div className="text-right">
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Session</p>
                          <p className="text-sm font-bold text-slate-700">{currentUser.name}</p>
                      </div>
                  </div>
              </div>
            </div>

            {/* View Content - State Restoration using display: none */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
                <div style={{ display: currentView === View.DASHBOARD ? 'block' : 'none' }}>
                    <Dashboard data={data} activeChurch={activeChurch} currentUser={currentUser} />
                </div>
                <div style={{ display: currentView === View.ATTENDANCE ? 'block' : 'none' }}>
                    <AttendanceTaker data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />
                </div>
                <div style={{ display: currentView === View.MEMBERS ? 'block' : 'none' }}>
                    <MembersList data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />
                </div>
                <div style={{ display: currentView === View.ANALYTICS ? 'block' : 'none' }}>
                    <AnalyticsHub data={data} activeChurch={activeChurch} currentUser={currentUser} />
                </div>
                {showOutreach && (
                    <div style={{ display: currentView === View.OUTREACH ? 'block' : 'none' }}>
                        <OutreachHub data={data} onUpdate={refreshData} currentUser={currentUser} />
                    </div>
                )}
                {showFinances && (
                    <div style={{ display: currentView === View.FINANCES ? 'block' : 'none' }}>
                        <Finances data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />
                    </div>
                )}
                <div style={{ display: currentView === View.EXPORT ? 'block' : 'none' }}>
                    <ReportExport data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />
                </div>
                {isAdmin && (
                    <div style={{ display: currentView === View.SETTINGS ? 'block' : 'none' }}>
                        <Settings data={data} onUpdate={refreshData} currentUser={currentUser} />
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-4 py-1 pb-safe flex justify-around items-center shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
            <MobileNavItem view={View.DASHBOARD} icon={LayoutDashboard} label="Home" />
            <MobileNavItem view={View.ATTENDANCE} icon={CalendarCheck} label="Attend" />
            <MobileNavItem view={View.MEMBERS} icon={Users} label="People" />
            <MobileNavItem view={View.ANALYTICS} icon={PieChart} label="Stats" />
            {showOutreach && <MobileNavItem view={View.OUTREACH} icon={HeartHandshake} label="Outreach" />}
            {showFinances && <MobileNavItem view={View.FINANCES} icon={Building2} label="Finances" />}
            {isAdmin ? <MobileNavItem view={View.SETTINGS} icon={SettingsIcon} label="Config" /> : <MobileNavItem view={View.EXPORT} icon={Share2} label="Reports" />}
        </nav>
      </main>
    </div>
  );
};

export default App;
