const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf8');

const seedDataFn = `
  const handleSeedData = async () => {
    setIsSyncing(true);
    setStatusMsg({ type: "info", text: "Generating demo data..." });
    try {
      const { generateDemoData } = await import("../services/seedService");
      await generateDemoData();
      setStatusMsg({ type: "success", text: "Demo data generated successfully!" });
      onUpdate();
    } catch(e) {
      console.error(e);
      setStatusMsg({ type: "error", text: "Failed to generate demo data." });
    }
    setIsSyncing(false);
  };
`;
content = content.replace(/const handleForcePush = async \(\) => \{/, seedDataFn + '\n  const handleForcePush = async () => {');
content = content.replace(/disabled=\{isSaving\}/, 'disabled={isSyncing}');

fs.writeFileSync('components/Settings.tsx', content);
