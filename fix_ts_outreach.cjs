const fs = require('fs');
let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

// Move divisions and visitorFnfIds UP.
// First extract them
const extractRegex = /( {2}const divisions = useMemo\([\s\S]*?\}, \[data\.members\]\);\n\n  const visitorFnfIds = useMemo\([\s\S]*?\}, \[data\.members\]\);\n\n)/;
const match = content.match(extractRegex);

if (match) {
  content = content.replace(match[1], ''); // remove from current place

  // insert right after OutreachHub component start
  content = content.replace(
    /const OutreachHub = \(\{.*?\}\) => \{[\s\S]*?const \[activeTab/m,
    function(m) {
      return m.replace('const [activeTab', match[1] + 'const [activeTab');
    }
  );
}

// Fix PrayerSlot `memberId` to `assignedMemberIds`
// slots.filter(s => assignedIds.has(s.memberId) || visitorFnfIds.has(s.memberId));
content = content.replace(/assignedIds\.has\(s\.memberId\) \|\| visitorFnfIds\.has\(s\.memberId\)/g, 's.assignedMemberIds?.some(id => assignedIds.has(id) || visitorFnfIds.has(id))');
content = content.replace(/visitorFnfIds\.has\(s\.memberId\)/g, 's.assignedMemberIds?.some(id => visitorFnfIds.has(id))');

fs.writeFileSync('components/OutreachHub.tsx', content);
