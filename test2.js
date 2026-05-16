import https from 'https';

const API_KEY = '$2a$10$ND0zIcPdo58JCZimZAcwRO.hL596gLZ3bxo/F0Po4bcSu.b0nvjEa';
const BIN_ID = '6968447b43b1c97be9314e21'; // oh wait, 6968447b43b1c97be9314e21 doesn't look like a real mongo object id, usually JSON bin id is shorter or longer? Ah 6596... wait, let's copy exactly

const data = JSON.stringify({
  sample: 'data'
});

const req = https.request('https://api.jsonbin.io/v3/b/6968447b43b1c97be9314e21', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Master-Key': API_KEY,
    'X-Bin-Versioning': 'false' 
  }
}, res => {
  let chunks = '';
  res.on('data', d => chunks += d);
  res.on('end', () => console.log(res.statusCode, chunks));
});
req.write(data);
req.end();
