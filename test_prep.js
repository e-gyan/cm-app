const predictiveModel = useMemo(() => {
    // We want the last 4 distinct dates from the attendance records for the selected church
    const churchRecords = data.attendance.filter(r => effectiveChurch === "All" ? true : r.churchId === effectiveChurch);
    
    // Group by date
    const groupedByDate = new Map();
    churchRecords.forEach(r => {
      const dateKey = r.date;
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, { Members: 0, FirstTimers: 0, FNF: 0, presentIds: new Set() });
      }
      const entry = groupedByDate.get(dateKey);
      
      r.presentMemberIds.forEach(id => {
        if (!entry.presentIds.has(id)) {
          entry.presentIds.add(id);
          const m = data.members.find(mem => mem.id === id);
          if (m) {
            const isTeacher = ["Teacher", "Helper", "Volunteer"].includes(m.type) || m.type === MemberType.TEACHER;
            if (m.type === MemberType.MEMBER || isTeacher) entry.Members++;
            else if (m.type === MemberType.VISITOR) entry.FirstTimers++;
            else if (m.type === MemberType.FNF) entry.FNF++;
          }
        }
      });
    });

    const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const last4 = sortedDates.slice(0, 4).map(d => groupedByDate.get(d));
    const last2 = last4.slice(0, 2);

    const calcAvg = (arr, key) => arr.length ? Math.round(arr.reduce((acc, curr) => acc + curr[key], 0) / arr.length) : 0;

    return {
      last2Weeks: {
        Members: calcAvg(last2, 'Members'),
        FirstTimers: calcAvg(last2, 'FirstTimers'),
        FNF: calcAvg(last2, 'FNF'),
      },
      last1Month: {
        Members: calcAvg(last4, 'Members'),
        FirstTimers: calcAvg(last4, 'FirstTimers'),
        FNF: calcAvg(last4, 'FNF'),
      },
      targets: {
         // Target could be 5% growth over the 1-month average or max of 2-week/1-month + 5%
         Members: Math.ceil(Math.max(calcAvg(last2, 'Members'), calcAvg(last4, 'Members')) * 1.05),
         FirstTimers: Math.ceil(Math.max(calcAvg(last2, 'FirstTimers'), calcAvg(last4, 'FirstTimers')) * 1.10),
         FNF: Math.ceil(Math.max(calcAvg(last2, 'FNF'), calcAvg(last4, 'FNF')) * 1.10),
      }
    };
  }, [data, effectiveChurch]);
