const fs = require('fs');

const fileList = [
  'components/AttendanceTaker.tsx',
  'components/Dashboard.tsx',
  'components/Finances.tsx',
  'components/Login.tsx',
  'components/MembersList.tsx',
  'components/OutreachHub.tsx',
  'components/ReportExport.tsx',
  'components/Settings.tsx'
];

fileList.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/syncFromCloud,/g, '');
  content = content.replace(/syncToCloud,/g, '');
  content = content.replace(/getAppData,/g, 'loadData,');
  content = content.replace(/getAppData\(\)/g, 'loadData()');
  
  content = content.replace(/updateTargets,/g, '');
  content = content.replace(/addTransaction,/g, '');
  content = content.replace(/authenticateUser,/g, '');
  
  content = content.replace(/bulkArchiveMembers,/g, '');
  content = content.replace(/bulkDeleteMembers,/g, '');
  content = content.replace(/deleteMember,/g, '');
  
  content = content.replace(/generateOutreachSchedule,/g, '');
  content = content.replace(/generatePrayerSchedule,/g, '');
  
  content = content.replace(/onUpdate\([^)]+\)/g, 'onUpdate()');
  
  fs.writeFileSync(file, content);
});

