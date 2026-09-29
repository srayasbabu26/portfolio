import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
export class TestBucket{
 constructor(){this.items=new Map();}
 async put(key,body,options={}){const bytes=new Uint8Array(await new Response(body).arrayBuffer());this.items.set(key,{key,bytes,size:bytes.length,...options});}
 async list({prefix}){return {objects:[...this.items.values()].filter(x=>x.key.startsWith(prefix)),truncated:false};}
 async head(key){return this.items.get(key)||null;}
 async get(key,options){const item=this.items.get(key);if(!item)return null;const r=options?.range;return {...item,body:r?item.bytes.slice(r.offset,r.offset+r.length):item.bytes};}
 async delete(key){this.items.delete(key);}
}
const origin='https://portfolio.test';
const headers={'Origin':origin,'oai-authenticated-user-id':'owner-test','oai-authenticated-user-email':'srayasbabu26@gmail.com','Content-Type':'image/jpeg','Content-Length':'4'};
const post=(override={},query='title=Example&category=design')=>new Request(origin+'/api/works?'+query,{method:'POST',headers:{...headers,...override},body:new Uint8Array([255,216,255,217])});
test('owner upload persists, lists, serves byte ranges, and deletes',async()=>{const env={BUCKET:new TestBucket()};let r=await worker.fetch(post(),env);assert.equal(r.status,201);const {work}=await r.json();assert.equal(env.BUCKET.items.size,1);r=await worker.fetch(new Request(origin+'/api/works'),env);assert.equal((await r.json()).works.length,3);r=await worker.fetch(new Request(origin+work.url,{headers:{Range:'bytes=1-2'}}),env);assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 1-2/4');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[216,255]);r=await worker.fetch(new Request(origin+work.url,{headers:{Range:'bytes=8-9'}}),env);assert.equal(r.status,416);r=await worker.fetch(new Request(origin+'/api/works/'+work.id,{method:'DELETE',headers}),env);assert.equal(r.status,200);assert.equal(env.BUCKET.items.size,0);});
test('rejects anonymous, non-owner, cross-site, wrong type, oversized, category mismatch',async()=>{const env={BUCKET:new TestBucket()};for(const [override,status] of [[{'oai-authenticated-user-id':''},403],[{'oai-authenticated-user-email':'someone@example.com'},403],[{Origin:'https://other.test'},403],[{'Content-Type':'text/html'},415],[{'Content-Length':String(51*1024*1024)},413]]){assert.equal((await worker.fetch(post(override),env)).status,status);}assert.equal((await worker.fetch(post({},'title=Example&category=video'),env)).status,400);assert.equal(env.BUCKET.items.size,0);});
test('bundled work can be removed and remains hidden',async()=>{const env={BUCKET:new TestBucket()};assert.equal((await worker.fetch(new Request(origin+'/api/works/seed-silvia',{method:'DELETE',headers}),env)).status,200);const data=await(await worker.fetch(new Request(origin+'/api/works'),env)).json();assert.equal(data.works.length,1);assert.equal(data.works[0].id,'seed-crafting');});
test('unavailable storage reports failure without claiming success',async()=>{assert.equal((await worker.fetch(new Request(origin+'/api/works'),{})).status,503);});

test('previous admin can no longer upload or delete',async()=>{const env={BUCKET:new TestBucket()};const old={'oai-authenticated-user-email':'renowaltpc@gmail.com'};assert.equal((await worker.fetch(post(old),env)).status,403);assert.equal((await worker.fetch(new Request(origin+'/api/works/seed-silvia',{method:'DELETE',headers:{...headers,...old}}),env)).status,403);assert.equal(env.BUCKET.items.size,0);});
