const fs = require('fs');
let content = fs.readFileSync('components/Dashboard.tsx', 'utf8');

content = content.replace(
  'const ChurchDashboard: React.FC<{ data: AppData; activeChurch: Church }> = ({\n  data,\n  activeChurch,\n}) => {',
  'const ChurchDashboard: React.FC<{ data: AppData; activeChurch: Church; currentUser: Member }> = ({\n  data,\n  activeChurch,\n  currentUser,\n}) => {'
);
content = content.replace(
  '<ChurchDashboard data={data} activeChurch={activeChurch} />',
  '<ChurchDashboard data={data} activeChurch={activeChurch} currentUser={currentUser} />'
);

// Also need to import calculateChurchDivisions in Dashboard.tsx
if (!content.includes('calculateChurchDivisions')) {
    content = content.replace(
      'import { AppData, MemberType, MemberStatus, Church, Member } from "../types";',
      'import { AppData, MemberType, MemberStatus, Church, Member } from "../types";\nimport { calculateChurchDivisions } from "../lib/teacherDivision";'
    );
}
fs.writeFileSync('components/Dashboard.tsx', content);
