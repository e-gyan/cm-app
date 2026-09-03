const fs = require('fs');
let file = fs.readFileSync('components/MembersList.tsx', 'utf8');

file = file.replace(/\) : \(\s*<button\s*onClick=\{\(\) => \{\s*setVacationMember\(member\);/g, ') : (\n<>\n<button onClick={() => { setVacationMember(member);');
file = file.replace(/<Archive size=\{16\} \/>\s*<\/button>\s*\)\}\s*<\/div>/g, '<Archive size={16} />\n</button>\n</>\n)}\n</div>');

fs.writeFileSync('components/MembersList.tsx', file);
