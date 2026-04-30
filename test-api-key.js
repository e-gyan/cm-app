const apiKey = '$2a$10$ND0zIcPdo58JCZimZAcwRO.hL596gLZ3bxo/F0Po4bcSu.b0nvjEa';
const url = 'https://api.jsonbin.io/v3/b/6968447b43b1c97be9314e21';

async function test() {
    const headersMaster = {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
        'X-Bin-Versioning': 'false'
    };
    try {
        let response = await fetch(url, { method: 'GET', headers: headersMaster });
        console.log("MasterKey status:", response.status);
        let text = await response.text();
        console.log("MasterKey text:", text);
    } catch(e) {
        console.error(e);
    }
}
test();
