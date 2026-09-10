const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf8');

const newTabs = `        {/* Sidebar */}
        <div className="md:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab("GENERAL")}
            className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab === "GENERAL"? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
          >
            <SettingsIcon size={16} /> General
          </button>
          <button
            onClick={() => setActiveTab("CHURCHES")}
            className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab === "CHURCHES"? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
          >
            <Database size={16} /> Church Branches
          </button>
          <button
            onClick={() => setActiveTab("ORGANIZATION")}
            className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab === "ORGANIZATION"? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
          >
            <List size={16} /> Organization Structure
          </button>
          <button
            onClick={() => setActiveTab("THEME")}
            className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab === "THEME"? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
          >
            <Palette size={16} /> Theme Colors
          </button>
          <button
            onClick={() => setActiveTab("PERMISSIONS")}
            className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab ==="PERMISSIONS" ? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
          >
            <CheckCircle size={16} /> Role Permissions
          </button>
          <button
            onClick={() => setActiveTab("CLOUD")}
            className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab === "CLOUD"? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
          >
            <Cloud size={16} /> Cloud Sync
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("MAINTENANCE")}
              className={\`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 \${activeTab === "MAINTENANCE" ? "bg-indigo-600 text-white shadow-md scale-[1.02]" : "bg-white text-slate-500 hover:bg-slate-50 hover:scale-[1.01]"}\`}
            >
              <Wrench size={16} /> Maintenance
            </button>
          )}`;

const oldTabsRegex = /\{\/\* Sidebar \*\/\}.*?Maintenance\n            <\/button>\n          \)\}/s;
content = content.replace(oldTabsRegex, newTabs);

fs.writeFileSync('components/Settings.tsx', content);
