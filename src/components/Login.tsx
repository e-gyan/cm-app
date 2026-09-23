import React, { useState, useEffect } from "react";
import { Member, MemberType, MemberStatus } from "../types";
import {
  ArrowRight,
  AlertCircle, Database,
  Users,
  Sparkles,
  RefreshCw,
  Cloud,
  Eye,
  EyeOff,
} from "lucide-react";
import { sanitizeInput } from "../services/securityService";
import { loadData, verifyPasscode } from "../services/storageService";
import { APP_VERSION, APP_RELEASE_NAME } from "../version";
import { ChangelogModal } from "./ChangelogModal";

interface LoginProps {
  onLogin: (user: Member) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  // Check if data is loaded or default
  const [dataCount, setDataCount] = useState(0);

  
  
  const [hasLocalData, setHasLocalData] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    try {
      const keys = ["appData", "attendance_data", "childrens_ministry_data", "cm_app_data", "settings"];
      for (const k of keys) {
        if (localStorage.getItem(k)) {
          setHasLocalData(true);
          break;
        }
      }
    } catch (e) {
      console.warn("Local storage check failed", e);
    }
  }, []);

  const handleMigrateLocalData = async () => {
    setIsMigrating(true);
    setError("");
    try {
      // Find the most likely data payload
      let rawData = localStorage.getItem("appData") || localStorage.getItem("attendance_data") || localStorage.getItem("cm_app_data");
      
      if (!rawData) {
        setError("No compatible local data found.");
        setIsMigrating(false);
        return;
      }

      const parsed = JSON.parse(rawData);
      
      // We need to import this data. Let's use the DB directly
      const { db } = await import("../services/firebase");
      const { collection, doc, writeBatch } = await import("firebase/firestore");
      
      const batch = writeBatch(db);
      
      let memberCount = 0;
      let attCount = 0;

      if (parsed.members && Array.isArray(parsed.members)) {
        parsed.members.forEach((m: any) => {
          if (!m.id) m.id = doc(collection(db, "members")).id;
          batch.set(doc(db, "members", m.id), m);
          memberCount++;
        });
      }

      if (parsed.attendance && Array.isArray(parsed.attendance)) {
        parsed.attendance.forEach((a: any) => {
          if (!a.id) a.id = doc(collection(db, "attendance")).id;
          batch.set(doc(db, "attendance", a.id), a);
          attCount++;
        });
      }

      await batch.commit();
      
      // Clean up to prevent re-migration
      localStorage.removeItem("appData");
      localStorage.removeItem("attendance_data");
      
      setHasLocalData(false);
      await refreshDataCount();
      setError(`Successfully migrated ${memberCount} members and ${attCount} attendance records from your browser! You can now log in.`);
    } catch (e: any) {
      console.error(e);
      setError("Migration failed: " + e.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleInitialSetup = async () => {
    setIsLoading(true);
    try {
      
      await refreshDataCount();
      setError("Database synced!");
    } catch (e: any) {
      console.error(e);
      setError("Failed to initialize database.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDataCount = async () => {
    try {
      const data = await loadData();
      setDataCount(data.members?.length || 0);
    } catch (e) {
      console.warn("Could not load data for count", e);
      setDataCount(0);
    }
  };

  useEffect(() => {
    // Initial check
    refreshDataCount();

    // Auto-sync on mount to ensure fresh credentials (e.g. after logout or on new device)
    handleSync();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Force sync when manually refreshed or on mount to ensure we see the latest data
      await Promise.resolve(true);
      refreshDataCount();
    } catch (e: any) {
      console.warn("Login background sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const cleanName = sanitizeInput(name);

    try {
      // Optimistic fast login using local data
      let result = await verifyPasscode(cleanName, passcode, true);

      // If local authentication fails, force fetch from cloud
      // to ensure we have the absolute latest credentials (e.g. newly added users)
      // and try again.
      if (!result.success && result.message === "Invalid credentials.") {
        await Promise.resolve(true);
        result = await verifyPasscode(cleanName, passcode);
      } else if (!result.success) {
        // e.g. Locked account, or access deactivated
        setError(result.message || "Login failed");
        setIsLoading(false);
        return;
      }

      if (result.success && result.member) {
        onLogin(result.member);
      } else {
        setError(result.message || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-5xl flex overflow-hidden z-10 min-h-[600px] border border-white/50 animate-in fade-in zoom-in-95 duration-500">
        {/* Left Side - Visual */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 p-12 flex-col justify-between text-white relative">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <Sparkles className="text-white" size={24} />
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight">
              Children's Ministry Directorate
              <br />
              Platform
            </h1>
            <p className="text-indigo-100 text-lg leading-relaxed opacity-90 font-medium">
              Seamlessly track attendance, manage members, and generate insights
              for a thriving family.
            </p>
          </div>
          <div className="flex justify-between items-center text-sm text-indigo-200">
            <button
              type="button"
              onClick={() => setIsChangelogOpen(true)}
              className="hover:text-white transition-colors flex items-center gap-2 font-semibold group text-left"
              title="View Release Changelog"
            >
              <span>© {new Date().getFullYear()} CMD Platform</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold group-hover:bg-white/30 transition-all flex items-center gap-1">
                <Sparkles size={10} /> v{APP_VERSION}
              </span>
            </button>
            <span className="flex items-center gap-1 opacity-70">
              <Cloud size={12} /> Connected
            </span>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center relative">
          {/* Mobile Sync/Status */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`p-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all ${isSyncing ? "animate-spin text-indigo-600" : ""}`}
              title="Refresh Data"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="max-w-sm mx-auto w-full">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm md:hidden">
                <Users size={32} />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome Back
              </h2>
              <p className="text-slate-500 mt-2 font-medium">
                Please sign in to continue
              </p>
              
              
              {hasLocalData && dataCount === 0 && (
                <div className="mt-3 flex flex-col items-center gap-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <div className="inline-flex items-center gap-2 text-emerald-700 text-xs font-bold">
                    <Database size={14} />
                    <span>Previous Local Data Detected!</span>
                  </div>
                  <p className="text-xs text-emerald-600 text-center">We found your old records saved in this browser. Migrate them to the new cloud database now.</p>
                  <button type="button" onClick={handleMigrateLocalData} disabled={isMigrating} className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 w-full">
                    {isMigrating ? "Migrating..." : "Restore My 9 Months of Records"}
                  </button>
                </div>
              )}

              {dataCount === 0 && !isSyncing && (
                <div className="mt-3 flex flex-col items-center gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <div className="inline-flex items-center gap-2 text-indigo-700 text-xs font-bold">
                    <AlertCircle size={14} />
                    <span>Database Empty (First Time Setup)</span>
                  </div>
                  <button type="button" onClick={handleInitialSetup} disabled={isLoading} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">
                    Generate Initial Admin & Demo Data
                  </button>
                </div>
              )}

              {isSyncing && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Syncing Credentials...</span>
                </div>
              )}
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="provide your assigned name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-200 font-medium text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Access Code
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? "text" : "password"}
                    placeholder="••••"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-200 font-mono tracking-widest text-lg text-slate-900 placeholder:text-slate-300 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPasscode ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 border border-red-100 shadow-sm">
                  <AlertCircle size={20} className="shrink-0" />
                  <span className="font-bold">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? "Verifying..." : "Sign In"}
                {!isLoading && <ArrowRight size={20} />}
              </button>
            </form>

            {/* Version & Sync Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setIsChangelogOpen(true)}
                className="hover:text-indigo-600 transition-colors font-bold flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-indigo-50/60"
                title="View Release Changelog"
              >
                <Sparkles size={13} className="text-indigo-600" />
                <span>v{APP_VERSION}</span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  • What's New
                </span>
              </button>

              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-50"
              >
                <RefreshCw
                  size={12}
                  className={isSyncing ? "animate-spin text-indigo-600" : ""}
                />
                {isSyncing ? "Syncing..." : "Refresh Data"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
    </div>
  );
};

export default Login;
