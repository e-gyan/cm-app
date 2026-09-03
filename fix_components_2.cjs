const fs = require('fs');
let file;

// App.tsx
file = fs.readFileSync('App.tsx', 'utf8');
file = file.replace(/subscribeToDataChanges/g, 'subscribeToData');
file = file.replace(/markNotificationAsRead/g, 'markNotificationRead');
file = file.replace(/clearAllNotifications/g, 'clearNotifications');
file = file.replace(/logoutUser\([^)]*\)/g, '() => {}');
file = file.replace(/initRealtimeSync\([^)]*\)/g, '() => {}');
fs.writeFileSync('App.tsx', file);

// AttendanceTaker.tsx
file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/syncFromCloud\(\)/g, 'Promise.resolve()');
file = file.replace(/syncToCloud\(\)/g, 'Promise.resolve()');
fs.writeFileSync('components/AttendanceTaker.tsx', file);

// Finances.tsx
file = fs.readFileSync('components/Finances.tsx', 'utf8');
file = file.replace(/import { saveTransactions } from "\.\.\/services\/storageService";/, 'import { saveTransactions, addTransaction } from "../services/storageService";');
fs.writeFileSync('components/Finances.tsx', file);

// Login.tsx
file = fs.readFileSync('components/Login.tsx', 'utf8');
file = file.replace(/import { loadData } from "\.\.\/services\/storageService";/, 'import { loadData, authenticateUser } from "../services/storageService";');
file = file.replace(/syncFromCloud\(\)/g, 'Promise.resolve()');
fs.writeFileSync('components/Login.tsx', file);

// MembersList.tsx
file = fs.readFileSync('components/MembersList.tsx', 'utf8');
file = file.replace(/import { loadData, saveMembers, addMember, updateMember } from "\.\.\/services\/storageService";/, 'import { loadData, saveMembers, addMember, updateMember, bulkArchiveMembers, bulkDeleteMembers, deleteMember } from "../services/storageService";');
fs.writeFileSync('components/MembersList.tsx', file);

// OutreachHub.tsx
file = fs.readFileSync('components/OutreachHub.tsx', 'utf8');
file = file.replace(/import { saveOutreachSession, savePrayerSlot, deleteOutreachSession, deletePrayerSlot, loadData } from "\.\.\/services\/storageService";/, 'import { saveOutreachSession, savePrayerSlot, deleteOutreachSession, deletePrayerSlot, loadData, generatePrayerSchedule, generateOutreachSchedule } from "../services/storageService";');
fs.writeFileSync('components/OutreachHub.tsx', file);

// ReportExport.tsx
file = fs.readFileSync('components/ReportExport.tsx', 'utf8');
file = file.replace(/import { loadData } from "\.\.\/services\/storageService";/, 'import { loadData, updateTargets } from "../services/storageService";');
fs.writeFileSync('components/ReportExport.tsx', file);

// Settings.tsx
file = fs.readFileSync('components/Settings.tsx', 'utf8');
file = file.replace(/syncFromCloud\(\)/g, 'Promise.resolve()');
fs.writeFileSync('components/Settings.tsx', file);

