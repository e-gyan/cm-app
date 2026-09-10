const fs = require('fs');
let content = fs.readFileSync('components/AnalyticsHub.tsx', 'utf8');

const regex = /    const predict = \{\n      members: Math\.round\(avg2W\.members \* 0\.6 \+ avg1M\.members \* 0\.4\),\n      fnf: Math\.round\(avg2W\.fnf \* 0\.6 \+ avg1M\.fnf \* 0\.4\),\n      visitors: Math\.round\(avg2W\.visitors \* 0\.6 \+ avg1M\.visitors \* 0\.4\),\n      teachers: Math\.round\(avg2W\.teachers \* 0\.6 \+ avg1M\.teachers \* 0\.4\),\n    \};\n    predict\.total = predict\.members \+ predict\.fnf \+ predict\.visitors \+ predict\.teachers;/g;

const replacement = `    const membersPred = Math.round(avg2W.members * 0.6 + avg1M.members * 0.4);
    const fnfPred = Math.round(avg2W.fnf * 0.6 + avg1M.fnf * 0.4);
    const visitorsPred = Math.round(avg2W.visitors * 0.6 + avg1M.visitors * 0.4);
    const teachersPred = Math.round(avg2W.teachers * 0.6 + avg1M.teachers * 0.4);
    const predict = {
      members: membersPred,
      fnf: fnfPred,
      visitors: visitorsPred,
      teachers: teachersPred,
      total: membersPred + fnfPred + visitorsPred + teachersPred
    };`;

content = content.replace(regex, replacement);

fs.writeFileSync('components/AnalyticsHub.tsx', content);
