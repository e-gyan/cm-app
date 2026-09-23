import React from "react";
import { X, History, Calendar, CheckCircle2, Tag } from "lucide-react";
import { APP_VERSION, APP_RELEASE_NAME, APP_BUILD_DATE, CHANGELOG } from "../version";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  CMD Release History
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black tracking-wide">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {APP_RELEASE_NAME} • Released {APP_BUILD_DATE}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Changelog Timeline */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {CHANGELOG.map((rel, idx) => (
            <div
              key={rel.version}
              className={`relative pl-6 pb-6 border-l-2 ${
                idx === 0 ? "border-indigo-500" : "border-slate-200"
              } last:pb-0`}
            >
              {/* Dot */}
              <div
                className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white ${
                  idx === 0
                    ? "border-indigo-600 ring-4 ring-indigo-50"
                    : "border-slate-400"
                }`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    Version {rel.version}
                  </span>
                  {rel.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      {rel.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                  <Calendar size={12} />
                  {rel.date}
                </div>
              </div>

              <h4 className="text-xs font-bold text-indigo-600 mb-2.5">
                {rel.title}
              </h4>

              <ul className="space-y-1.5">
                {rel.changes.map((change, cIdx) => (
                  <li
                    key={cIdx}
                    className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed"
                  >
                    <CheckCircle2
                      size={14}
                      className="text-indigo-500 shrink-0 mt-0.5"
                    />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Tag size={13} className="text-indigo-600" />
            <span>Semantic Versioning Protocol</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
