const fs = require('fs');
let content = fs.readFileSync('components/MembersList.tsx', 'utf8');

const vacationFn = `
  const handleVacationSave = async () => {
    if (vacationMember) {
      await updateMember(vacationMember.id, {
        ...vacationMember,
        vacationStartDate: vacationStart,
        vacationEndDate: vacationEnd
      });
      setVacationMember(null);
      onUpdate();
    }
  };
`;
content = content.replace(/const handleDeletePermanent =/, vacationFn + '\n  const handleDeletePermanent =');
fs.writeFileSync('components/MembersList.tsx', content);
