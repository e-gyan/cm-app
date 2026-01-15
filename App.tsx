import React, { useState, useEffect } from 'react';
import { getAppData, restoreSession, logoutUser, syncFromCloud, initializeStorage } from './services/storageService';
import { AppData, Church, Member, Role } from './types';
import Dashboard from './components/Dashboard';
import AttendanceTaker from './components/AttendanceTaker';
import ReportExport from './components/ReportExport';
import MembersList from './components/MembersList';
import Login from './components/Login';
import { LayoutDashboard, CalendarCheck, Users, Share2, Menu, X, ChevronLeft, ChevronRight, Building2, UserCog, LogOut, Loader2, RefreshCw, AlertTriangle, Trash2, Power } from 'lucide-react';

enum View {
  DASHBOARD = 'Dashboard',
  ATTENDANCE = 'Attendance',
  MEMBERS = 'Hub',
  EXPORT = 'Export'
}

// Global Error Boundary for Robustness
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800 p-4 text-center">
            <div className="bg-red-50 p-4 rounded-full mb-4 text-red-600 shadow-soft">
                <AlertTriangle size={48} />
            </div>
            <h1 className="text-2xl font-extrabold mb-2">System Error</h1>
            <p className="text-gray-600 mb-8 max-w-md">The application encountered an unexpected state. Don't worry, your data is likely safe.</p>
            <div className="flex gap-4">
                <button 
                    onClick={() => window.location.reload()}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1"
                >
                    Reload App
                </button>
                <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="bg-white border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                    Reset Data
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const [data, setData] = useState<AppData>({ members: [], attendance: [] });
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // GLOBAL CONTEXT STATE
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [activeChurch, setActiveChurch] = useState<Church>('UJ');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initError, setInitError] = useState('');
  
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebarState');
    return savedState !== null ? JSON.parse(savedState) : true;
  });

  // Initial load & Session Restore
  useEffect(() => {
    const initApp = async () => {
        try {
            await initializeStorage();
            
            const savedUser = restoreSession();
            if (savedUser) {
                setCurrentUser(savedUser);
                if (savedUser.role === 'TEACHER') {
                    setActiveChurch(savedUser.assignedChurch);
                }
            }

            refreshData();
            handleCloudSync(); 
        } catch (e: any) {
            console.error("Initialization failed", e);
            setInitError(e.message || "Failed to initialize storage.");
        } finally {
            setIsLoading(false);
        }
    };

    initApp();
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

  if (isLoading || initError) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-indigo-600 gap-6 p-4 text-center">
            {initError ? (
                 <>
                    <div className="bg-red-50 p-6 rounded-3xl text-red-600 mb-4 shadow-soft"><AlertTriangle size={32}/></div>
                    <h2 className="text-xl font-bold text-gray-800">Startup Failed</h2>
                    <p className="text-sm text-gray-600 max-w-md">{initError}</p>
                 </>
            ) : (
                <>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                        <Loader2 className="animate-spin relative z-10" size={48} />
                    </div>
                    <p className="text-sm font-bold tracking-wide animate-pulse">STARTING ENGINE...</p>
                </>
            )}
            
            <div className="mt-12">
                <button 
                    onClick={() => { 
                        if(window.confirm("This will delete all LOCAL data. Are you sure?")) {
                            localStorage.clear(); 
                            window.location.reload(); 
                        }
                    }}
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors shadow-sm"
                >
                    <Trash2 size={16} /> Factory Reset App
                </button>
            </div>
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
        relative w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group
        ${currentView === view 
          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-200 scale-100' 
          : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-700 hover:scale-[1.02]'}
        ${isSidebarCollapsed ? 'justify-center px-0' : ''}
      `}
      title={isSidebarCollapsed ? view : ''}
    >
      <Icon size={22} className={`shrink-0 transition-transform ${currentView === view ? 'scale-110' : 'group-hover:scale-110'}`} />
      {!isSidebarCollapsed && <span className="whitespace-nowrap overflow-hidden transition-all">{view}</span>}
      {currentView === view && !isSidebarCollapsed && (
          <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/50"></div>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] text-gray-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white/90 backdrop-blur-md border-r border-gray-200/50 transform transition-all duration-300 ease-spring md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'w-[88px]' : 'w-72'}
      `}>
        <div className="h-full flex flex-col px-4 py-6">
          
          {/* Brand */}
          <div className={`flex items-center gap-4 mb-10 mt-2 ${isSidebarCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold shrink-0 shadow-lg transition-colors duration-500
                ${activeChurch === 'UJ' ? 'bg-indigo-600 shadow-indigo-200' : 
                  activeChurch === 'I' ? 'bg-emerald-600 shadow-emerald-200' :
                  activeChurch === 'K' ? 'bg-rose-600 shadow-rose-200' : 'bg-amber-500 shadow-amber-200'}
            `}>
              {activeChurch}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                <h1 className="text-lg font-extrabold leading-tight text-gray-900 tracking-tight">{activeChurch} Church</h1>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Attendance V5</span>
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
          <div className={`mt-auto mb-6 ${isSidebarCollapsed ? 'flex justify-center' : 'px-2'}`}>
            <button 
                onClick={handleCloudSync}
                className={`
                    w-full py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all
                    ${isSyncing 
                        ? 'bg-indigo-50 text-indigo-600' 
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}
                    ${isSidebarCollapsed ? 'justify-center' : 'px-4'}
                `}
                title="Force Sync"
            >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {!isSidebarCollapsed && (isSyncing ? 'Syncing...' : 'Sync Data')}
            </button>
          </div>

          {/* Context Switcher (Admin Only) */}
          {isAdmin && (
              <div className={`border-t border-gray-100 pt-6 ${isSidebarCollapsed ? 'items-center' : ''} flex flex-col gap-2 mb-4`}>
                {!isSidebarCollapsed && <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest px-2 mb-1">Context</span>}
                
                {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(church => (
                    <button
                        key={church}
                        onClick={() => setActiveChurch(church)}
                        className={`
                            flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all
                            ${activeChurch === church 
                                ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                                : 'text-gray-500 hover:bg-gray-50 hover:scale-105'}
                            ${isSidebarCollapsed ? 'justify-center' : ''}
                        `}
                        title={`Switch to ${church}`}
                    >
                        <Building2 size={16} className={activeChurch === church ? 'text-indigo-400' : ''}/>
                        {!isSidebarCollapsed && <span>{church}</span>}
                    </button>
                ))}
              </div>
          )}

          {/* User Info / Logout */}
          <div className={`border-t border-gray-100 pt-4 flex items-center justify-between gap-2 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
             {!isSidebarCollapsed && (
                 <div className="px-1 overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                    <p className="text-[10px] font-medium text-gray-400 truncate">{currentUser.role}</p>
                 </div>
             )}
             <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Logout">
                <Power size={18} />
             </button>
          </div>

          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm z-50"
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 md:hidden flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
             <span className={`w-2 h-8 rounded-full ${
                  activeChurch === 'UJ' ? 'bg-indigo-600' : 
                  activeChurch === 'I' ? 'bg-emerald-600' :
                  activeChurch === 'K' ? 'bg-rose-600' : 'bg-amber-500'
             }`}></span>
             <div>
                 <h1 className="font-bold text-gray-900 leading-none">{activeChurch}</h1>
                 <span className="text-xs font-medium text-gray-500">{currentView}</span>
             </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto pb-10">
            <div className="mb-8 hidden md:flex items-end justify-between animate-in slide-in-from-top-4 fade-in duration-500">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-1">{currentView}</h2>
                <p className="text-gray-500 font-medium">Managing activities for <span className={`font-bold ${
                     activeChurch === 'UJ' ? 'text-indigo-600' : 
                     activeChurch === 'I' ? 'text-emerald-600' :
                     activeChurch === 'K' ? 'text-rose-600' : 'text-amber-600'
                }`}>{activeChurch} Church</span>.</p>
              </div>
              <div className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-full text-xs font-bold text-gray-700 shadow-sm">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isAdmin ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                  {isAdmin ? 'Administrator' : currentUser.name}
              </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {currentView === View.DASHBOARD && <Dashboard data={data} activeChurch={activeChurch} currentUser={currentUser} />}
                {currentView === View.ATTENDANCE && <AttendanceTaker data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
                {currentView === View.MEMBERS && <MembersList data={data} onUpdate={refreshData} activeChurch={activeChurch} currentUser={currentUser} />}
                {currentView === View.EXPORT && <ReportExport data={data} onUpdate={refreshData} activeChurch={activeChurch} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;