import https from 'https';

const req = https.request('https://api.jsonbin.io/v3/b/6968447b43b1c97be9314e21', {
  method: 'OPTIONS',
  headers: {
    'Access-Control-Request-Method': 'PUT',
    'Access-Control-Request-Headers': 'content-type, x-master-key, x-bin-versioning',
    'Origin': 'https://example.com'
  }
}, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});
req.end();
