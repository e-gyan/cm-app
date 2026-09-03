const fs = require('fs');
let file = fs.readFileSync('components/Login.tsx', 'utf8');

const seedFunc = `
  const handleInitialSetup = async () => {
    setIsLoading(true);
    try {
      const { generateDemoData } = await import("../services/seedService");
      await generateDemoData();
      await refreshDataCount();
      setError("Database initialized! You can now log in as 'Demo Admin' with passcode '0000'.");
    } catch (e: any) {
      console.error(e);
      setError("Failed to initialize database.");
    } finally {
      setIsLoading(false);
    }
  };
`;

file = file.replace(/const refreshDataCount =/, seedFunc + '\n  const refreshDataCount =');

const setupBtn = `
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
`;

file = file.replace(/\{dataCount <= 1 && !isSyncing && \([\s\S]*?<\/div>\s*\)\}/, setupBtn);

fs.writeFileSync('components/Login.tsx', file);
