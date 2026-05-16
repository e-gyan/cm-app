const https = require('https');

const data = JSON.stringify({
  sample: 'data'
});

const req = https.request('https://api.jsonbin.io/v3/b', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Master-Key': '$2a$10$wT/3G.A8s/sS1rJ7YwT7V.N6/vV2/f0V6/vV2/f0V6/vV2/f0' // dummy
  }
}, res => {
  let chunks = '';
  res.on('data', d => chunks += d);
  res.on('end', () => console.log(res.statusCode, chunks));
});
req.write(data);
req.end();
