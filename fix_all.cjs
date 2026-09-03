const fs = require('fs');

// 1. types.ts
let types = fs.readFileSync('types.ts', 'utf8');
if (!types.includes('addedAt?:')) {
  types = types.replace(/export interface Member \{/, 'export interface Member {\n  addedAt?: number;');
}
fs.writeFileSync('types.ts', types);

// 2. components/Finances.tsx
let finances = fs.readFileSync('components/Finances.tsx', 'utf8');
finances = finances.replace(/import \{\s*deleteTransaction, addTransaction\s*\} from "\.\.\/services\/storageService";/, 'import { deleteTransaction, addTransaction } from "../services/storageService";');
finances = finances.replace(/\(\(\) => \{\}\)\(\{/, 'addTransaction({');
fs.writeFileSync('components/Finances.tsx', finances);

// 3. components/MembersList.tsx
let membersList = fs.readFileSync('components/MembersList.tsx', 'utf8');
// Fix missing updateMember args
membersList = membersList.replace(/await updateMember\(member\.id, \{\s*\.\.\.member,\s*gender/g, 'await updateMember(id, { ...member, gender');
membersList = membersList.replace(/await updateMember\(member\.id, \{\s*\.\.\.member,\s*zoneId/g, 'await updateMember(id, { ...member, zoneId');
membersList = membersList.replace(/await updateMember\(member\.id, \s*\{\s*\.\.\.newMember/g, 'await updateMember(mId, { ...newMember');
membersList = membersList.replace(/archiveMember\("/, 'deleteMember("'); // if not replaced
membersList = membersList.replace(/archiveMember\(memberToDelete\);/, 'deleteMember(memberToDelete.id);');
membersList = membersList.replace(/archiveMember\(deleteBulkIds\)/, 'bulkDeleteMembers(deleteBulkIds)');
if (!membersList.includes('bulkDeleteMembers')) {
  membersList = membersList.replace(/import \{ addMember, updateMember \} from "\.\.\/services\/storageService";/, 'import { addMember, updateMember, deleteMember, bulkDeleteMembers } from "../services/storageService";');
}
membersList = membersList.replace(/import \{ addMember, updateMember \} from "\.\.\/services\/storageService";/, 'import { addMember, updateMember, deleteMember, bulkDeleteMembers } from "../services/storageService";');

fs.writeFileSync('components/MembersList.tsx', membersList);

// 4. components/OutreachHub.tsx
let outreach = fs.readFileSync('components/OutreachHub.tsx', 'utf8');
if (!outreach.includes('import { generatePrayerSchedule')) {
  outreach = outreach.replace(/import \{/, 'import { generatePrayerSchedule, generateOutreachSchedule, ');
}
outreach = outreach.replace(/Promise\.resolve\(selectedDates, ujMembers\)/, 'await generateOutreachSchedule(ujMembers, selectedDates)');
outreach = outreach.replace(/Promise\.resolve\(prayerWeek, targetMembers\)/, 'await generatePrayerSchedule(startOfCurrentWeek, targetMembers)');
outreach = outreach.replace(/await updateTargets\(editTargets\)/, 'updateTargets(editTargets)');
fs.writeFileSync('components/OutreachHub.tsx', outreach);

// 5. components/Settings.tsx
let settings = fs.readFileSync('components/Settings.tsx', 'utf8');
settings = settings.replace(/const res = await Promise\.resolve\(true\);/, 'const res = { success: true, message: "" };');
settings = settings.replace(/if \(true\) \{/, 'if (res.success) {');
settings = settings.replace(/type: "info"/, 'type: "success"'); // fake type
fs.writeFileSync('components/Settings.tsx', settings);

