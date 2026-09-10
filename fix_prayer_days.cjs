const fs = require('fs');

// 1. Update storageService.ts
let storagePath = 'services/storageService.ts';
let storageContent = fs.readFileSync(storagePath, 'utf8');

storageContent = storageContent.replace(
  /for \(let i = 0; i < 7; i\+\+\) \{/g,
  'for (let i = 0; i < 5; i++) {'
);

fs.writeFileSync(storagePath, storageContent);

// 2. Update OutreachHub.tsx
let outreachPath = 'components/OutreachHub.tsx';
let outreachContent = fs.readFileSync(outreachPath, 'utf8');

outreachContent = outreachContent.replace(
  /!\["Teacher", "Helper", "Volunteer"\].includes\(m.type\),/g,
  '!["Teacher", "Helper", "Volunteer"].includes(m.type) &&\n            m.status !== MemberStatus.ARCHIVED,'
);

fs.writeFileSync(outreachPath, outreachContent);
