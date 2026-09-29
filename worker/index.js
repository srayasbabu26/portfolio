const OWNER_EMAIL='srayasbabu26@gmail.com';
const MAX_BYTES=50*1024*1024;
const TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
const SEEDS=[{id:'seed-silvia',title:'Nissan Silvia',description:'Automotive poster design. Red, black, and a sense of motion.',category:'design',type:'image/jpeg',url:'/assets/nissan-silvia.jpeg',createdAt:'2026-09-29T00:00:01Z'},{id:'seed-crafting',title:'Hours of crafting',description:'A visual exploration of time, imagination, and the creative process.',category:'design',type:'image/jpeg',url:'/assets/crafting.jpeg',createdAt:'2026-09-29T00:00:00Z'}];
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const isOwner=request=>Boolean(request.headers.get('oai-authenticated-user-id'))&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===OWNER_EMAIL;
function authorized(request){if(!isOwner(request))return json({error:'Only the portfolio owner can manage work.'},403);const origin=request.headers.get('Origin');if(origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Please upload from the portfolio website.'},403);}
async function listAll(bucket,prefix,include=[]){let cursor;const items=[];do{const page=await bucket.list({prefix,cursor,include,limit:1000});items.push(...page.objects);cursor=page.truncated?page.cursor:undefined;}while(cursor);return items;}
export default {async fetch(request,env){try{const url=new URL(request.url);const path=url.pathname;
 if(path==='/api/session')return json({canManage:isOwner(request),maxBytes:MAX_BYTES});
 if(path.startsWith('/api/')){
  if(!env.BUCKET)return json({error:'The work library is temporarily unavailable. Please try again.'},503);
  if(path==='/api/works'&&request.method==='GET'){
   const [files,hidden]=await Promise.all([listAll(env.BUCKET,'works/',['customMetadata']),listAll(env.BUCKET,'hidden/')]);const hiddenIds=new Set(hidden.map(o=>o.key.slice(7)));
   const works=files.map(o=>{try{return {...JSON.parse(o.customMetadata.work),url:'/api/media/'+o.key.slice(6)};}catch{return null;}}).filter(Boolean);
   return json({works:[...works,...SEEDS.filter(w=>!hiddenIds.has(w.id))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  }
  if(path==='/api/works'&&request.method==='POST'){
   const denied=authorized(request);if(denied)return denied;
   const type=request.headers.get('Content-Type')?.split(';')[0];const size=Number(request.headers.get('Content-Length'));
   if(!TYPES.has(type))return json({error:'Choose a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.'},415);
   if(!Number.isSafeInteger(size)||size<=0||size>MAX_BYTES||!request.body)return json({error:'Choose a non-empty file up to 50 MB.'},413);
   const title=(url.searchParams.get('title')||'').trim(),description=(url.searchParams.get('description')||'').trim(),category=url.searchParams.get('category');
   if(!title||title.length>100||description.length>500||!['design','photo','video'].includes(category)||type.startsWith('video/')!==(category==='video'))return json({error:'Add a title and choose a category that matches your file.'},400);
   const id=crypto.randomUUID();const work={id,title,description,category,type,size,createdAt:new Date().toISOString()};
   await env.BUCKET.put('works/'+id,request.body,{httpMetadata:{contentType:type},customMetadata:{work:JSON.stringify(work)}});
   return json({work:{...work,url:'/api/media/'+id}},201);
  }
  if(path.startsWith('/api/works/')&&request.method==='DELETE'){
   const denied=authorized(request);if(denied)return denied;const id=path.slice(11);
   if(SEEDS.some(w=>w.id===id))await env.BUCKET.put('hidden/'+id,'');else if(/^[a-f0-9-]{36}$/.test(id))await env.BUCKET.delete('works/'+id);else return json({error:'Work not found.'},404);
   return json({ok:true});
  }
  if(path.startsWith('/api/media/')&&['GET','HEAD'].includes(request.method)){
   const id=path.slice(11);if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Not found.'},404);
   const head=await env.BUCKET.head('works/'+id);if(!head)return json({error:'This file is no longer available.'},404);
   const headers=new Headers({'Content-Type':head.httpMetadata.contentType,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Content-Length':String(head.size)});
   if(request.method==='HEAD')return new Response(null,{headers});
   const range=request.headers.get('Range');let options,status=200;
   if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});let start=m[1]?Number(m[1]):Math.max(0,head.size-Number(m[2]));let end=m[1]?(m[2]?Math.min(Number(m[2]),head.size-1):head.size-1):head.size-1;if(start>end||start>=head.size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});options={range:{offset:start,length:end-start+1}};headers.set('Content-Range',`bytes ${start}-${end}/${head.size}`);headers.set('Content-Length',String(end-start+1));status=206;}
   const object=await env.BUCKET.get('works/'+id,options);if(!object)return json({error:'File not found.'},404);return new Response(object.body,{status,headers});
  }
  return json({error:'Not found.'},404);
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=ASSETS[path==='/'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':path==='/'||path.endsWith('.html')?'no-cache':'public, max-age=300'}});
}catch(error){console.error('Portfolio request failed',error);return json({error:'Unable to access the work library right now. Your file has not been confirmed saved. Please try again.'},503);}}};
