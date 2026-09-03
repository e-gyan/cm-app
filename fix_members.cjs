const fs = require('fs');
let content = fs.readFileSync('components/MembersList.tsx', 'utf8');
content = content.replace(/await updateMember\(updatedMember as Member\);([\s\S]*?)const confirmDeleteSingle = \(\) => \{/m, `await updateMember(transferMember.id, updatedMember as Member);
      setTransferMember(null);
      setTransferTarget("");
      onUpdate();
    } else {
      setTransferMember(null);
      setTransferTarget("");
    }
  };
  const restoreMember = async (member: Member) => {
    await updateMember(member.id, {  ...member, status: MemberStatus.ACTIVE  });
    onUpdate();
  };
  const handleDeletePermanent = (member: Member) => {
    setMemberToDelete(member);
  };
  const confirmDeleteSingle = () => {`);
fs.writeFileSync('components/MembersList.tsx', content);
