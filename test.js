import https from 'https';

const data = JSON.stringify({
  sample: 'data'
});

const req = https.request('https://api.jsonbin.io/v3/b', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bin-Versioning': 'false'
  }
}, res => {
  let chunks = '';
  res.on('data', d => chunks += d);
  res.on('end', () => console.log(res.statusCode, chunks));
});
req.write(data);
req.end();
