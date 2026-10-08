require('./load-typescript.cjs');const {test}=require('node:test');const assert=require('node:assert/strict');
const {publicAddress,publicUrl}=require('../apps/web/src/lib/jobs/public-web.ts');
test('source access rejects private, loopback, metadata, reserved, and mapped IPs',()=>{
 for(const ip of ['127.0.0.1','10.4.1.5','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','198.19.0.1','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('source URLs reject credentials, private suffixes, non-HTTPS and unexpected ports',()=>{
 for(const url of ['file:///etc/passwd','http://example.com','https://user:secret@example.com','https://metadata.internal','https://service.local','https://example.com:8080'])assert.throws(()=>publicUrl(url));
 assert.equal(publicUrl('https://example.com/about#team').href,'https://example.com/about');
});
