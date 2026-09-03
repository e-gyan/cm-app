const fs = require('fs');
let file;

// Fix App.tsx missing imports
file = fs.readFileSync('App.tsx', 'utf8');
file = file.replace(/const res = await onUpdate\(\);[\s\S]*?if \(res && res.success\) {/g, 'await onUpdate();\n      if (true) {');
fs.writeFileSync('App.tsx', file);

// AttendanceTaker.tsx
file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/const handleAttendance = async \(\) => {[\s\S]*?};/g, `
  const handleAttendance = async () => {
    try {
      const dbData = await loadData();
      const updatedMembers = dbData.members.map((m) => {
        if (attendance.includes(m.id)) {
          return { ...m, lastActivationDate: new Date().toISOString() };
        }
        return m;
      });
      await saveMembers(updatedMembers);
      
      const newRecord = {
        id: crypto.randomUUID(),
        date: dateStr,
        churchId: activeChurch,
        branchId: activeBranch,
        eventName: isSpecialService ? eventName : undefined,
        presentMemberIds: attendance,
        punctualMemberIds: punctual,
        serviceMap,
        lastUpdated: Date.now()
      };
      
      await saveAttendance(newRecord.id, [newRecord]);
      await onUpdate();
      alert("Attendance recorded successfully!");
      setAttendance([]);
      setPunctual([]);
      setServiceMap({});
    } catch (err) {
      console.error(err);
      alert("Failed to save attendance.");
    }
  };
`);
fs.writeFileSync('components/AttendanceTaker.tsx', file);

// Finances.tsx
file = fs.readFileSync('components/Finances.tsx', 'utf8');
file = file.replace(/addTransaction\(([^)]+)\)/g, 'saveTransactions([...data.transactions, $1])');
fs.writeFileSync('components/Finances.tsx', file);

