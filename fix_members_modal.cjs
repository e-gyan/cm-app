const fs = require('fs');
let file = fs.readFileSync('components/MembersList.tsx', 'utf8');

// Add "Manage Leave" button in dropdown
const manageLeaveBtn = `                          <button
                            onClick={() => {
                              setVacationMember(member);
                              setVacationStart(member.vacationStartDate || "");
                              setVacationEnd(member.vacationEndDate || "");
                            }}
                            className="p-2 text-indigo-400 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
                            title="Manage Leave/Vacation"
                          >
                            <Calendar size={18} />
                          </button>
`;
file = file.replace(/<button\s*onClick=\{\(\) => archiveMember\(member\)\}/, manageLeaveBtn + '                          <button\n                            onClick={() => archiveMember(member)}');

// Add Calendar icon to imports
file = file.replace(/import \{([^}]*?)(Archive|Calendar)([^}]*?)\} from "lucide-react";/, 'import {$1Archive, Calendar$3} from "lucide-react";');
if (!file.includes('Calendar,')) {
    file = file.replace(/import \{/, 'import { Calendar, ');
}

// Add the modal dialog
const modalHtml = `
      {vacationMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">
              Manage Leave / Vacation
            </h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Set an excused absence period for {vacationMember.name}. Their expected attendance will be paused during this time.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                <input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3" value={vacationStart} onChange={e => setVacationStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                <input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3" value={vacationEnd} onChange={e => setVacationEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setVacationMember(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleVacationSave} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
`;

file = file.replace(/\{\/\* CONFIRMATION DIALOG - ARCHIVE \*\/\}/, modalHtml + '\n      {/* CONFIRMATION DIALOG - ARCHIVE */}');

fs.writeFileSync('components/MembersList.tsx', file);
