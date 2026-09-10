const fs = require('fs');
let content = fs.readFileSync('components/MembersList.tsx', 'utf8');

content = content.replace(/let startDate = new Date\(member\.joinedDate\);\n\s*if \(\n\s*member\.lastActivationDate &&\n\s*new Date\(member\.lastActivationDate\) > startDate\n\s*\) \{\n\s*startDate = new Date\(member\.lastActivationDate\);\n\s*\}/g, 'let startDate = new Date(member.joinedDate);');

content = content.replace(/\/\/ Include if it's the current church AND on or after the calculated start date AND not on vacation\n\s*return \(\n\s*r\.churchId === member\.assignedChurch &&\n\s*recordDate\.getTime\(\) >= startDate\.getTime\(\) &&\n\s*!isVacation\n\s*\);/g, `const isPresent = r.presentMemberIds.includes(member.id);\n      // Include if it's the current church AND on or after the calculated start date AND not on vacation (UNLESS they were present)\n      return (\n        r.churchId === member.assignedChurch &&\n        recordDate.getTime() >= startDate.getTime() &&\n        (!isVacation || isPresent)\n      );`);

fs.writeFileSync('components/MembersList.tsx', content);
