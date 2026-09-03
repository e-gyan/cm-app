const fs = require('fs');
let file = fs.readFileSync('components/Login.tsx', 'utf8');

const migrationLogic = `
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
      setError(\`Successfully migrated \${memberCount} members and \${attCount} attendance records from your browser! You can now log in.\`);
    } catch (e: any) {
      console.error(e);
      setError("Migration failed: " + e.message);
    } finally {
      setIsMigrating(false);
    }
  };
`;

file = file.replace(/const handleInitialSetup = async \(\) => \{/, migrationLogic + '\n  const handleInitialSetup = async () => {');

const migrationBtn = `
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
`;

file = file.replace(/\{dataCount === 0 && !isSyncing && \(/, migrationBtn + '\n              {dataCount === 0 && !isSyncing && (');

if (!file.includes('Database,')) {
    file = file.replace(/import \{([^}]*?)(AlertCircle)([^}]*?)\} from "lucide-react";/, 'import {$1AlertCircle, Database$3} from "lucide-react";');
}

fs.writeFileSync('components/Login.tsx', file);
