const fs = require('fs');
let file = fs.readFileSync('components/AnalyticsHub.tsx', 'utf8');

const matrixComp = fs.readFileSync('branch_cross_tab.tsx', 'utf8');

file = file.replace(/const AgeDistributionChart =/, matrixComp + '\n\nconst AgeDistributionChart =');

// Also place it at the bottom of the return statement
file = file.replace(/\{hasManagementView && \(\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">/, 
`
      {hasManagementView && adminFilterChurch === "All" && (
        <BranchCrossTabulation attendance={attendance} />
      )}
      {hasManagementView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
`);

fs.writeFileSync('components/AnalyticsHub.tsx', file);
