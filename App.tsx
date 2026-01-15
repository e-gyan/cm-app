import React, { useState, useEffect } from 'react';
import { getAppData, restoreSession, logoutUser, syncFromCloud, initializeRepository } from './services/storageService';
import { AppData, Church, Member, Role } from './types';
import Dashboard from './components/Dashboard';
import AttendanceTaker from './components/AttendanceTaker';
import ReportExport from './components/ReportExport';
import MembersList from './components/MembersList';
import Login from './components/Login';
import { LayoutDashboard, CalendarCheck, Users, Share2, Menu, X, ChevronLeft, ChevronRight, Building2, UserCog, LogOut, Loader2, RefreshCw } from 'lucide-react';

enum View {
  DASHBOARD = 'Dashboard',
  ATTENDANCE = 'Attendance',
  MEMBERS = 'Hub',
  EXPORT = 'Export'
}

const App: React.FC = () => {
  const [data, setData] = useState<AppData>({ members: [], attendance: [] });
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // GLOBAL CONTEXT STATE
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [activeChurch, setActiveChurch] = useState<Church>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebarState');
    return savedState !== null ? JSON.parse(savedState) : true;
  });

  // Initial load & Session Restore
  useEffect(() => {
    const init = async () => {
        // This ensures we try to fetch from cloud BEFORE showing anything
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 flex-col gap-4">
            <Loader2 className="animate-spin" size={48} />
            <p className="text-sm font-medium text-gray-500 animate-pulse">Synchronizing with Cloud...</p>
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
        setIsMobileMenuOpen(false);
      }}
      className={`
        w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200
        ${currentView === view 
          ? 'bg-indigo-600 text-white shadow-md' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
        ${isSidebarCollapsed ? 'justify-center' : ''}
      `}
      title={isSidebarCollapsed ? view : ''}
    >
      <Icon size={20} className="shrink-0" />
      {!isSidebarCollapsed && <span className="whitespace-nowrap overflow-hidden transition-all">{view}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className="h-full flex flex-col p-4">
          
          {/* Brand */}
          <div className={`flex items-center gap-3 mb-8 mt-2 ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0
                ${activeChurch === 'UJ' ? 'bg-indigo-600' : 
                  activeChurch === 'I' ? 'bg-emerald-600' :
                  activeChurch === 'K' ? 'bg-rose-600' : 'bg-amber-600'}
            `}>
              {activeChurch}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-lg font-bold leading-none">{activeChurch} Church</h1>
                <span className="text-xs text-gray-500 font-medium">System</span>
              </div>
            )}
          </div>

          <nav className="space-y-2 flex-1">
            <NavItem view={View.DASHBOARD} icon={LayoutDashboard} />
            <NavItem view={View.ATTENDANCE} icon={CalendarCheck} />
            <NavItem view={View.MEMBERS} icon={Users} />
            <NavItem view={View.EXPORT} icon={Share2} />
          </nav>

          {/* Sync Status - Visual indicator in sidebar */}
          <div className={`mt-auto mb-2 ${isSidebarCollapsed ? 'flex justify-center' : 'px-2'}`}>
            <button 
                onClick={handleCloudSync}
                className={`text-xs flex items-center gap-2 ${isSyncing ? 'text-indigo-600 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                title="Force Sync"
            >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {!isSidebarCollapsed && (isSyncing ? 'Syncing...' : 'Sync Data')}
            </button>
          </div>

          {/* Context Switcher (Admin Only) */}
          {isAdmin && (
              <div className={`border-t pt-4 ${isSidebarCollapsed ? 'items-center' : ''} flex flex-col gap-2 mb-2`}>
                {!isSidebarCollapsed && <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Switch Context</span>}
                
                {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(church => (
                    <button
                        key={church}
                        onClick={() => setActiveChurch(church)}
                        className={`
                            flex items-center gap-2 p-2 rounded-md text-sm transition-colors
                            ${activeChurch === church 
                                ? 'bg-gray-100 font-bold text-gray-900' 
                                : 'text-gray-500 hover:bg-gray-50'}
                            ${isSidebarCollapsed ? 'justify-center' : ''}
                        `}
                        title={`Switch to ${church}`}
                    >
                        <Building2 size={16} className={activeChurch === church ? 'text-indigo-600' : ''}/>
                        {!isSidebarCollapsed && <span>{church} Church</span>}
                    </button>
                ))}
              </div>
          )}

          {/* User Info / Logout */}
          <div className={`mt-2 border-t pt-4 ${isSidebarCollapsed ? 'items-center' : ''} flex flex-col gap-2`}>
             <button onClick={handleLogout} className="flex items-center gap-2 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors w-full">
                <LogOut size={18} />
                {!isSidebarCollapsed && <span className="text-sm font-medium">Logout</span>}
             </button>
             {!isSidebarCollapsed && (
                 <div className="px-2 text-xs text-gray-400">
                    Logged as {currentUser.name} ({currentUser.role})
                 </div>
             )}
          </div>

          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex items-center justify-center w-full p-2 mt-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4 md:hidden flex items-center justify-between">
          <div className="flex items-center gap-2">
             <span className="font-bold text-gray-800">{activeChurch}</span>
             <span className="text-gray-400">|</span>
             <span className="font-medium text-gray-600">{currentView}</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 rounded-md hover:bg-gray-100"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 hidden md:flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{currentView}</h2>
                <p className="text-gray-500 text-sm">Managing activities for <span className="font-bold text-indigo-600">{activeChurch} Church</span>.</p>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full text-xs font-bold text-indigo-700">
                  {isAdmin ? <UserCog size={14} /> : <Users size={14} />}
                  {isAdmin ? 'Admin Mode' : currentUser.name}
              </div>
            </div>

            {currentView === View.DASHBOARD && <Dashboard data={data} activeChurch={activeChurch} currentUser={currentUser} />}
            {currentView === View.ATTENDANCE && <AttendanceTaker data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
            {currentView === View.MEMBERS && <MembersList data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
            {currentView === View.EXPORT && <ReportExport data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;