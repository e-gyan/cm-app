import React, { useState, useRef, useEffect } from "react";
import {
  Users,
  Shield,
  BookOpen,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  LayoutGrid,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { SUITE_APPS, SuiteAppDefinition } from "../config/suiteApps";

export type ActiveSuiteView = "cm-app" | "watchman" | "save-n-know" | "launcher";

const getAppIcon = (id: SuiteAppDefinition["id"], size = 18) => {
  switch (id) {
    case "cm-app":
      return <Users size={size} />;
    case "watchman":
      return <Shield size={size} />;
    case "save-n-know":
      return <BookOpen size={size} />;
  }
};

interface SwitcherButtonProps {
  activeSuiteApp: ActiveSuiteView;
  onSelectApp: (appId: ActiveSuiteView) => void;
  compact?: boolean;
}

export const AppSuiteSwitcherButton: React.FC<SwitcherButtonProps> = ({
  activeSuiteApp,
  onSelectApp,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentAppObj = SUITE_APPS.find((a) => a.id === activeSuiteApp);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Switch Ministry App"
        className={`flex items-center gap-2 rounded-xl border transition-all ${
          compact ? "p-2" : "px-3 py-2"
        } ${
          isOpen || activeSuiteApp !== "cm-app"
            ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
            : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
        }`}
      >
        <LayoutGrid size={compact ? 19 : 18} />
        {!compact && (
          <span className="text-xs font-bold hidden lg:inline">
            {activeSuiteApp === "launcher"
              ? "App Launcher"
              : currentAppObj?.shortName || "Apps"}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[120] animate-in fade-in zoom-in-95 origin-top-right">
          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <LayoutGrid size={14} className="text-indigo-600" />
              Ministry App Suite
            </span>
            <button
              type="button"
              onClick={() => {
                onSelectApp("launcher");
                setIsOpen(false);
              }}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
            >
              All Apps View
            </button>
          </div>

          <div className="p-2.5 space-y-1.5">
            {SUITE_APPS.map((app) => {
              const isActive = activeSuiteApp === app.id;
              return (
                <div
                  key={app.id}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                    isActive
                      ? "bg-indigo-50/70 border-indigo-200"
                      : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectApp(app.id);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${app.iconBgClass}`}
                    >
                      {getAppIcon(app.id, 18)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {app.shortName}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-extrabold shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {app.description}
                      </p>
                    </div>
                  </button>

                  {!app.isCurrentApp && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${app.shortName} in new tab`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors shrink-0"
                    >
                      <ExternalLink size={14} />
                    </a>
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

interface SuiteLauncherViewProps {
  activeSuiteApp: ActiveSuiteView;
  onSelectApp: (appId: ActiveSuiteView) => void;
}

export const SuiteLauncherView: React.FC<SuiteLauncherViewProps> = ({
  activeSuiteApp,
  onSelectApp,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3">
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white p-6 md:p-8 rounded-3xl shadow-lg">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-indigo-100 text-xs font-bold mb-2">
          <Sparkles size={13} /> Unified Ministry Workspace
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Ministry App Launcher
        </h2>
        <p className="text-indigo-200 text-xs md:text-sm mt-1 max-w-2xl">
          Switch seamlessly between your deployed ministry applications without losing your place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SUITE_APPS.map((app) => {
          const isCurrent = activeSuiteApp === app.id;
          return (
            <div
              key={app.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className={`h-2 bg-gradient-to-r ${app.gradientClass}`} />
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${app.iconBgClass}`}
                    >
                      {getAppIcon(app.id, 22)}
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {app.badgeText}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">
                      {app.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectApp(app.id)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    isCurrent
                      ? "bg-emerald-600 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  }`}
                >
                  {isCurrent && <CheckCircle2 size={14} />}
                  {app.isCurrentApp ? "Open CM Attendance" : `Switch to ${app.shortName}`}
                </button>
                {!app.isCurrentApp && (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${app.shortName} in new tab`}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ExternalAppFrameProps {
  app: SuiteAppDefinition;
  onBackToCm: () => void;
  onSelectApp: (appId: ActiveSuiteView) => void;
}

export const ExternalAppFrame: React.FC<ExternalAppFrameProps> = ({
  app,
  onBackToCm,
  onSelectApp,
}) => {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isLoadingFrame, setIsLoadingFrame] = useState(true);

  useEffect(() => {
    setIsLoadingFrame(true);
  }, [app.id, reloadNonce]);

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-6rem)] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      {/* Slim App Bar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackToCm}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 text-xs font-bold flex items-center gap-1 transition-all shrink-0"
          >
            <ArrowLeft size={14} /> CM App
          </button>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${app.iconBgClass}`}>
            {getAppIcon(app.id, 14)}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs md:text-sm font-extrabold text-slate-800 truncate">
              {app.name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 text-xs font-bold flex items-center gap-1 transition-all"
            title="Reload App"
          >
            <RefreshCw size={13} className={isLoadingFrame ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
            title="Open in New Tab (useful for Google sign-in popup)"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">New Tab</span>
          </a>
          <AppSuiteSwitcherButton
            activeSuiteApp={app.id}
            onSelectApp={onSelectApp}
            compact
          />
        </div>
      </div>

      {/* Embedded Frame */}
      <div className="relative flex-1 bg-slate-100">
        {isLoadingFrame && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50/90 z-10 pointer-events-none">
            <Loader2 size={28} className="text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-600">
              Loading {app.shortName}... (Render services may take a few seconds to wake up)
            </p>
          </div>
        )}
        <iframe
          key={`${app.id}-${reloadNonce}`}
          src={app.url}
          title={app.name}
          onLoad={() => setIsLoadingFrame(false)}
          className="w-full h-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; camera; microphone; geolocation"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
};
