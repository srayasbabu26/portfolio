import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
const paths=['index.html','style.css','script.js','gallery.js','gallery.css',...readdirSync('dist/assets').map(n=>'assets/'+n)];
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',jpeg:'image/jpeg',pdf:'application/pdf',svg:'image/svg+xml'};
const assets=Object.fromEntries(paths.map(p=>['/'+p,{type:mime[p.split('.').pop()],data:readFileSync('dist/'+p).toString('base64')}]));
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8'));
writeFileSync('dist/.openai/hosting.json',readFileSync('.openai/hosting.json'));
console.log('Built portfolio Worker with '+paths.length+' assets.');
