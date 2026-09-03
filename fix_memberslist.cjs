const fs = require('fs');
let content = fs.readFileSync('components/MembersList.tsx', 'utf8');

content = content.replace(/const newMember = (await )?addMember\(\s*([\s\S]*?),\s*([\s\S]*?),\s*([\s\S]*?),\s*([\s\S]*?),\s*([\s\S]*?)\s*\);/g, (match, awaitStr, p1, p2, p3, p4, p5) => {
    return `const mId = crypto.randomUUID();\n      const newMember = { id: mId, name: ${p1}, type: ${p2}, churchId: ${p3}, passcode: ${p4}, status: ${p5}, addedAt: Date.now() };\n      await addMember(newMember);`;
});

content = content.replace(/updateMember\(\s*\{([\s\S]*?)\}\s*\)/g, 'updateMember(newMember.id, { $1 })');

// Check for updateMember(id) missing id
content = content.replace(/await updateMember\(\s*newMember\s*\);/g, 'await updateMember(newMember.id, newMember);');
// Handle other updateMember calls with 1 arg instead of 2.
// e.g., await updateMember(editingMember) => await updateMember(editingMember.id, editingMember)
// We'll just do a quick generic replace
content = content.replace(/updateMember\(([^,]+)\)/g, 'updateMember($1.id, $1)');

content = content.replace(/deleteMember/g, 'archiveMember');
content = content.replace(/bulkDeleteMembers/g, 'bulkArchiveMembers');

fs.writeFileSync('components/MembersList.tsx', content);
