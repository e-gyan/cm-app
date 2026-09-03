const fs = require('fs');

// App.tsx
let app = fs.readFileSync('App.tsx', 'utf8');
app = app.replace(/getAppData/g, 'loadData');
// the original file has promise chain loading issues because loadData returns a Promise
// we will replace the whole refreshData function to be safer

app = app.replace(/const refreshData = \(\) => {[\s\S]*?};/g, `
  const refreshData = async () => {
    try {
      const dbData = await loadData();
      setData(dbData);
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false };
    }
  };
`);

fs.writeFileSync('App.tsx', app);
