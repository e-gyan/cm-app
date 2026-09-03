const fs = require('fs');
let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

content = content.replace(/Promise\.resolve\(startOfCurrentWeek, targetMembers\)/g, 'await generatePrayerSchedule(startOfCurrentWeek, targetMembers)');
content = content.replace(/Promise\.resolve\(targetMembers, existingSessions\)/g, 'await generateOutreachSchedule(targetMembers, existingSessions)');

if (!content.includes('generatePrayerSchedule')) {
    content = content.replace(/import \{/, 'import { generatePrayerSchedule, generateOutreachSchedule, ');
}

fs.writeFileSync('components/OutreachHub.tsx', content);
