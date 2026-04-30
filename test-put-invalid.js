const apiKey = '$2a$10$INVALIDKEY0P1Q2R3S4T5U6V7W8X9Y0Z';
const url = 'https://api.jsonbin.io/v3/b/6968447b43b1c97be9314e21';

async function testPut() {
    const headersMaster = {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
        'X-Bin-Versioning': 'false'
    };
    try {
        let response = await fetch(url, { 
            method: 'PUT', 
            headers: headersMaster, 
            body: JSON.stringify({foo: 'bar'}) 
        });
        console.log("MasterKey PUT status:", response.status);
    } catch(e) {
        console.error(e);
    }
}
testPut();
