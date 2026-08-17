const fs = require('fs');
const glob = require('glob'); // Note: we can just use fs and path recursion

const findAndReplace = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const filePath = `${dir}/${file}`;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findAndReplace(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      content = content.replace(/\[MemberStatus\.ACTIVE, MemberStatus\.INCONSISTENT\]/g, '[MemberStatus.ACTIVE, MemberStatus.INCONSISTENT, MemberStatus.NOT_ACTIVE]');
      content = content.replace(/\["Active", "Inconsistent"\]/g, '["Active", "Inconsistent", "Not Active"]');
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
      }
    }
  }
};

findAndReplace('.');
