import https from 'https';
const req = https.request('https://api.jsonbin.io/v3/b/6968447b43b1c97be9314e21', {
  method: 'GET',
  headers: {
    'X-Master-Key': '$2a$10$ND0zIcPdo58JCZimZAcwRO.hL596gLZ3bxo/F0Po4bcSu.b0nvjEa'
  }
}, res => {
  let chunks = '';
  res.on('data', d => chunks += d);
  res.on('end', () => console.log(res.statusCode, chunks));
});
req.end();
