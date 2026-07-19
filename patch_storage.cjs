const fs = require('fs');
let content = fs.readFileSync('services/storageService.ts', 'utf-8');

content = content.replace(
`    presentMemberIds: presentIds,
    punctualMemberIds: punctualIds,
    serviceMap: serviceMap, // Persist the service map
    eventName: eventName,
  };`,
`    presentMemberIds: presentIds,
    punctualMemberIds: punctualIds,
    serviceMap: serviceMap, // Persist the service map
    eventName: eventName,
    lastUpdated: Date.now(),
  };`
);

fs.writeFileSync('services/storageService.ts', content);
