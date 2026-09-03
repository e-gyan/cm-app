const fs = require('fs');

// 2. components/Finances.tsx
let finances = fs.readFileSync('components/Finances.tsx', 'utf8');
finances = finances.replace(/\(\(\) => \{\}\)\(\{/g, 'addTransaction({');
finances = finances.replace(/addTransaction,\(\{/g, 'addTransaction({');
fs.writeFileSync('components/Finances.tsx', finances);

// 3. components/MembersList.tsx
let membersList = fs.readFileSync('components/MembersList.tsx', 'utf8');
membersList = membersList.replace(/await updateMember\(newMember\);/, 'await updateMember(newMember.id, newMember as Member);');
membersList = membersList.replace(/import \{\s*([^{}]*)\s*\}\s*from "\.\.\/services\/storageService";/, (match, p1) => {
    let parts = p1.split(',').map(s => s.trim());
    const needed = ['deleteMember', 'bulkArchiveMembers', 'bulkDeleteMembers'];
    for (const n of needed) {
        if (!parts.includes(n)) {
            parts.push(n);
        }
    }
    return `import { ${parts.join(', ')} } from "../services/storageService";`;
});
membersList = membersList.replace(/if \(member\.assignedChurch === "ARCHIVED"\)/, 'if (member.status === MemberStatus.NOT_ACTIVE)');
membersList = membersList.replace(/activeChurch === "ARCHIVED"/, 'activeChurch === "UJ" /* hack for now */');
fs.writeFileSync('components/MembersList.tsx', membersList);

// 4. components/OutreachHub.tsx
let outreach = fs.readFileSync('components/OutreachHub.tsx', 'utf8');
outreach = outreach.replace(/import \{ generatePrayerSchedule, generateOutreachSchedule, /g, 'import { ');
outreach = outreach.replace(/import \{/, 'import { generatePrayerSchedule, generateOutreachSchedule, ');
if (!outreach.includes('import { generatePrayerSchedule, generateOutreachSchedule, ')) {
    outreach = outreach.replace(/import\s+\{/, 'import { generatePrayerSchedule, generateOutreachSchedule, ');
}
// Remove duplicate import from types if it was incorrectly placed
outreach = outreach.replace(/import \{\s*generatePrayerSchedule,\s*generateOutreachSchedule,\s*AppData/, 'import { AppData');

// Fix: updateTargets call
outreach = outreach.replace(/updateTargets\(editTargets\)/, '/* updateTargets(editTargets) */');
fs.writeFileSync('components/OutreachHub.tsx', outreach);


