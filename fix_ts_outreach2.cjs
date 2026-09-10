const fs = require('fs');
let content = fs.readFileSync('components/OutreachHub.tsx', 'utf8');

const strToInsert = `  const divisions = useMemo(() => {
    return calculateChurchDivisions(data.members, ["UJ"]);
  }, [data.members]);

  const visitorFnfIds = useMemo(() => {
    return new Set(
      data.members
        .filter(
          (m) =>
            m.type === MemberType.VISITOR ||
            m.type === MemberType.FNF ||
            m.type === MemberType.NOT_MEMBER,
        )
        .map((m) => m.id)
    );
  }, [data.members]);
`;

content = content.replace('const [activeTab', strToInsert + '\n  const [activeTab');

fs.writeFileSync('components/OutreachHub.tsx', content);
