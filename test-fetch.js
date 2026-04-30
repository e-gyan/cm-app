const url = 'https://api.jsonbin.io/v3/b/6968447b43b1c97be9314e21';
fetch(url, { 
  method: 'OPTIONS', 
  headers: { 
    'Access-Control-Request-Method': 'PUT',
    'Access-Control-Request-Headers': 'X-Master-Key, Content-Type',
    'Origin': 'https://ais-dev-kjjkal6twpzliz266jd7og-5539359774.europe-west2.run.app'
  } 
})
  .then(res => { 
    console.log(res.status); 
    console.log(res.headers.get('access-control-allow-origin'));
    console.log(res.headers.get('access-control-allow-headers'));
    console.log(res.headers.get('access-control-allow-methods'));
    return res.text() 
  })
  .then(console.log)
  .catch(console.error);
