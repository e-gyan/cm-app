const https = require('https');

const data = JSON.stringify({
  sample: 'data'
});

const req = https.request('https://api.jsonbin.io/v3/b', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Master-Key': '$2a$10$K5M6PsdqUpAmMJHp06t1PeEK2tabwlgLoFMHLo/yEWV5ndxGCMcRu0' // dummy
  }
}, res => {
  let chunks = '';
  res.on('data', d => chunks += d);
  res.on('end', () => console.log(res.statusCode, chunks));
});
req.write(data);
req.end();
