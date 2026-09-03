const fs = require('fs');
let content = fs.readFileSync('components/MembersList.tsx', 'utf8');

// I replaced `deleteMember` with `archiveMember` globally before.
// I will just add imports and change archiveMember back to deleteMember in storageService imports
content = content.replace(/archiveMember\("/, 'deleteMember("'); // Inside confirmDeleteSingle
content = content.replace(/archiveMember\(memberToDelete\);/, 'deleteMember(memberToDelete.id);'); 
content = content.replace(/archiveMember\(deleteBulkIds\)/, 'bulkDeleteMembers(deleteBulkIds)');
content = content.replace(/import\s*\{\s*addMember,\s*updateMember\s*\}\s*from\s*"..\/services\/storageService";/, 'import { addMember, updateMember, deleteMember, bulkDeleteMembers, bulkArchiveMembers } from "../services/storageService";');

fs.writeFileSync('components/MembersList.tsx', content);
