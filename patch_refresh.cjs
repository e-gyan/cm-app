const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf-8');

content = content.replace(
`    rawAttendance.forEach(record => {
      const key = \`\${record.date}_\${record.churchId}\`;
      const existing = attendanceMap.get(key);
      if (!existing) {
        attendanceMap.set(key, record);
      } else {
        if (record.branchId === activeBranchId || (!existing.branchId && record.branchId)) {
          attendanceMap.set(key, record);
        }
      }
    });`,
`    rawAttendance.forEach(record => {
      const key = \`\${record.date}_\${record.churchId}\`;
      const existing = attendanceMap.get(key);
      if (!existing) {
        attendanceMap.set(key, record);
      } else {
        const recordTime = record.lastUpdated || 0;
        const existingTime = existing.lastUpdated || 0;
        
        if (recordTime > existingTime) {
          attendanceMap.set(key, record);
        } else if (recordTime === existingTime) {
          if (record.branchId === activeBranchId || (!existing.branchId && record.branchId)) {
            attendanceMap.set(key, record);
          }
        }
      }
    });`
);

fs.writeFileSync('App.tsx', content);
