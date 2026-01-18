import React, { useState, useEffect } from 'react';
import { getAppData, restoreSession, logoutUser, syncFromCloud, initializeRepository } from './services/storageService';
import { AppData, Church, Member, Role } from './types';
import Dashboard from './components/Dashboard';
import AttendanceTaker from './components/AttendanceTaker';
import ReportExport from './components/ReportExport';
import MembersList from './components/MembersList';
import Login from './components/Login';
import { LayoutDashboard, CalendarCheck, Users, Share2, Menu, X, ChevronLeft, ChevronRight, Building2, UserCog, LogOut, Loader2, RefreshCw, Zap, ChevronDown } from 'lucide-react';

enum View {
  DASHBOARD = 'Dashboard',
  ATTENDANCE = 'Attendance',
  MEMBERS = 'People Hub',
  EXPORT = 'Reports'
}

const App: React.FC = () => {
  const [data, setData] = useState<AppData>({ members: [], attendance: [] });
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // GLOBAL CONTEXT STATE
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [activeChurch, setActiveChurch] = useState<Church>('CM');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showMobileChurchMenu, setShowMobileChurchMenu] = useState(false);
  
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebarState');
    return savedState !== null ? JSON.parse(savedState) : false; // Default to open on desktop
  });

  // Initial load & Session Restore
  useEffect(() => {
    const init = async () => {
        await initializeRepository();
        refreshData();
        const savedUser = restoreSession();
        if (savedUser) {
            setCurrentUser(savedUser);
            if (savedUser.role === 'TEACHER') {
                setActiveChurch(savedUser.assignedChurch);
            }
        }
        setIsLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarState', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const refreshData = () => {
    setData({ ...getAppData() }); 
  };

  const handleCloudSync = async () => {
    setIsSyncing(true);
    const result = await syncFromCloud();
    if (result.success) {
        refreshData();
    }
    setIsSyncing(false);
  };

  const handleLogin = (user: Member) => {
    setCurrentUser(user);
    if (user.role === 'TEACHER') {
        setActiveChurch(user.assignedChurch);
    }
    refreshData();
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setCurrentView(View.DASHBOARD);
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
            <NavItem view={View.EXPORT} icon={Share2} />
          </nav>

          {/* Sync Status */}
          <div className={`mt-auto mb-4 ${isSidebarCollapsed ? 'flex justify-center' : 'px-1'}`}>
            <button 
                onClick={handleCloudSync}
                className={`w-full py-2.5 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all
                  ${isSyncing 
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600' 
                    : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50'}
                `}
                title="Force Sync"
            >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {!isSidebarCollapsed && (isSyncing ? 'Syncing...' : 'Sync Repository')}
            </button>
          </div>

          {/* Context Switcher (Admin Only) */}
          {isAdmin && (
              <div className={`pt-4 border-t border-slate-100 ${isSidebarCollapsed ? 'items-center' : ''} flex flex-col gap-1.5 mb-4`}>
                {!isSidebarCollapsed && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-1">Switch Branch</span>}
                
                {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(church => (
                    <button
                        key={church}
                        onClick={() => setActiveChurch(church)}
                        className={`
                            flex items-center gap-3 p-2 rounded-xl text-sm transition-all
                            ${activeChurch === church 
                                ? 'bg-slate-100 font-bold text-slate-900' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}
                            ${isSidebarCollapsed ? 'justify-center' : ''}
                        `}
                        title={`Switch to ${church}`}
                    >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${activeChurch === church ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                        {!isSidebarCollapsed && <span>{church} Church</span>}
                    </button>
                ))}
              </div>
          )}

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
          {/* Brand / Admin Switcher */}
           <div className="relative">
              <button 
                onClick={() => isAdmin && setShowMobileChurchMenu(!showMobileChurchMenu)}
                className="flex items-center gap-3 active:opacity-70 transition-opacity"
                disabled={!isAdmin}
              >
                 <div className={`
                    w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm
                    ${activeChurch === 'UJ' ? 'bg-indigo-600' : 
                      activeChurch === 'I' ? 'bg-emerald-500' :
                      activeChurch === 'K' ? 'bg-rose-500' : 'bg-amber-500'}
                 `}>
                     {activeChurch.substring(0,2)}
                 </div>
                 <div className="text-left">
                     <h1 className="font-bold text-slate-800 text-sm leading-tight flex items-center gap-1">
                        {activeChurch} Church
                        {isAdmin && <ChevronDown size={14} className={`text-slate-400 transition-transform ${showMobileChurchMenu ? 'rotate-180' : ''}`}/>}
                     </h1>
                     <p className="text-[10px] text-slate-500 font-medium">Ministry System</p>
                 </div>
              </button>

              {/* Mobile Church Switcher Dropdown */}
              {showMobileChurchMenu && isAdmin && (
                  <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMobileChurchMenu(false)}></div>
                  <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-20 flex flex-col gap-1 animate-in fade-in zoom-in-95 origin-top-left">
                      {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(church => (
                        <button
                            key={church}
                            onClick={() => { setActiveChurch(church); setShowMobileChurchMenu(false); }}
                            className={`flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${activeChurch === church ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${activeChurch === church ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                            {church} Church
                        </button>
                      ))}
                  </div>
                  </>
              )}
           </div>

           {/* Mobile Header Actions (Sync & Logout) */}
           <div className="flex items-center gap-1">
                <button 
                    onClick={handleCloudSync}
                    className={`p-2 rounded-full ${isSyncing ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                    disabled={isSyncing}
                >
                    <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                </button>
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

            {/* View Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {currentView === View.DASHBOARD && <Dashboard data={data} activeChurch={activeChurch} currentUser={currentUser} />}
                {currentView === View.ATTENDANCE && <AttendanceTaker data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
                {currentView === View.MEMBERS && <MembersList data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
                {currentView === View.EXPORT && <ReportExport data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-4 py-1 pb-safe flex justify-around items-center shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
            <MobileNavItem view={View.DASHBOARD} icon={LayoutDashboard} label="Home" />
            <MobileNavItem view={View.ATTENDANCE} icon={CalendarCheck} label="Attendance" />
            <MobileNavItem view={View.MEMBERS} icon={Users} label="People" />
            <MobileNavItem view={View.EXPORT} icon={Share2} label="Reports" />
        </nav>
      </main>
    </div>
  );
};

export default App;