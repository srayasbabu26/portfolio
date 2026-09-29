(()=>{
const $=id=>document.getElementById(id);
let works=[],filter='all',canManage=false,selectedFile=null,uploading=false,previewUrl=null,pendingDelete=null;
const labels={design:'Graphic design',video:'Video',photo:'Photography'};
const allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];
const mime=file=>file.type||({mov:'video/quicktime',mp4:'video/mp4',webm:'video/webm',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[file.name.split('.').pop().toLowerCase()]||'');
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};

async function api(url,options){
  const r=await fetch(url,options);
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'Something went wrong. Please try again.');
  return data;
}

function setCanManage(state){
  canManage=Boolean(state);
  const addBtn=$('add-work'), loginBtn=$('admin-login-btn'), logoutBtn=$('admin-logout-btn'), footerBtn=$('footer-admin-btn');
  if(addBtn)addBtn.hidden=!canManage;
  if(loginBtn)loginBtn.hidden=canManage;
  if(logoutBtn)logoutBtn.hidden=!canManage;
  if(footerBtn)footerBtn.textContent=canManage?'Log out (Owner)':'Owner Login';
  render();
}

function render(){
  const grid=$('work-grid');
  grid.replaceChildren();
  const visible=works.filter(w=>filter==='all'||w.category===filter);
  $('work-count').textContent=visible.length+' '+(visible.length===1?'piece':'pieces');
  if(!visible.length){
    const empty=node('div','no-work');
    empty.append(
      node('h3','',filter==='all'?'A new collection starts here.':'More '+(filter==='video'?'films':filter==='photo'?'photographs':'designs')+' to come.'),
      node('p','',canManage?'Use Add work to share your next piece.':'Explore another category in the meantime.')
    );
    grid.append(empty);
    return;
  }
  for(const work of visible){
    const card=node('article','work-card'),button=node('button','work-preview');
    button.type='button';
    button.setAttribute('aria-label','View '+work.title);
    const isVideo=work.type&&work.type.startsWith('video/');
    const media=node(isVideo?'video':'img');
    media.src=work.url;
    if(isVideo){
      media.preload='metadata';
      media.muted=true;
      media.playsInline=true;
      button.append(node('span','video-badge','Play video'));
    }else{
      media.alt=work.title;
      media.loading='lazy';
    }
    button.prepend(media);
    button.append(node('span','view-label',isVideo?'Watch film':'View work'));
    button.addEventListener('click',()=>openViewer(work));
    const info=node('div','card-info'),text=node('div');
    text.append(node('span','card-category',labels[work.category]||work.category),node('h3','',work.title));
    info.append(text);
    if(canManage){
      const remove=node('button','remove-work','Remove');
      remove.type='button';
      remove.setAttribute('aria-label','Remove '+work.title);
      remove.addEventListener('click',()=>{
        pendingDelete=work;
        $('delete-description').textContent=work.title;
        $('delete-status').textContent='';
        $('delete-dialog').showModal();
      });
      info.append(remove);
    }
    card.append(button,info);
    grid.append(card);
  }
}

async function load(){
  $('gallery-status').textContent='Loading the collection…';
  $('retry-work').hidden=true;
  try{
    const data=await api('/api/works');
    works=data.works||[];
    $('gallery-status').textContent='';
    render();
  }catch(e){
    $('gallery-status').textContent='Couldn’t load the collection. Please try again.';
    $('retry-work').hidden=false;
  }
}

function openViewer(work){
  $('viewer-title').textContent=work.title;
  $('viewer-description').textContent=work.description;
  $('viewer-category').textContent=labels[work.category]||work.category;
  const media=node(work.type&&work.type.startsWith('video/')?'video':'img');
  media.src=work.url;
  if(media.tagName==='VIDEO'){
    media.controls=true;
    media.playsInline=true;
    media.preload='metadata';
  }else media.alt=work.title;
  $('viewer-media').replaceChildren(media);
  $('viewer-dialog').showModal();
}

$('viewer-dialog').addEventListener('close',()=>$('viewer-media').replaceChildren());
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  render();
}));

document.querySelectorAll('.dialog-close').forEach(b=>b.addEventListener('click',()=>{
  const dlg=b.closest('dialog');
  if(!dlg)return;
  if(dlg.id==='upload-dialog'&&uploading)return;
  dlg.close();
}));

// Admin login / logout modal logic
function openAdminLogin(){
  const dlg=$('admin-dialog');
  if(!dlg)return;
  $('admin-password').value='';
  $('admin-status').textContent='';
  dlg.showModal();
}

async function handleLogout(){
  try{
    await api('/api/logout',{method:'POST'});
  }catch{}
  setCanManage(false);
}

if($('admin-login-btn'))$('admin-login-btn').addEventListener('click',openAdminLogin);
if($('admin-logout-btn'))$('admin-logout-btn').addEventListener('click',handleLogout);
if($('footer-admin-btn'))$('footer-admin-btn').addEventListener('click',()=>{
  if(canManage)handleLogout();else openAdminLogin();
});

const adminForm=$('admin-form');
if(adminForm){
  adminForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const password=$('admin-password').value;
    $('admin-status').textContent='Verifying password…';
    $('admin-submit').disabled=true;
    try{
      const res=await api('/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password})
      });
      if(res.ok){
        setCanManage(true);
        $('admin-dialog').close();
      }
    }catch(err){
      $('admin-status').textContent=err.message||'Incorrect password. Please try again.';
    }finally{
      $('admin-submit').disabled=false;
    }
  });
}

$('upload-dialog').addEventListener('cancel',e=>{if(uploading)e.preventDefault();});
$('upload-dialog').addEventListener('close',()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}$('file-preview').replaceChildren();});
$('add-work').addEventListener('click',()=>{$('upload-form').reset();selectedFile=null;$('file-label').textContent='Choose a file or drop it here';$('upload-status').textContent='';$('upload-progress-wrap').hidden=true;$('file-preview').replaceChildren();$('upload-dialog').showModal();});

function choose(file){
  if(!file)return;
  const type=mime(file);
  $('upload-status').textContent='';
  if(!allowed.includes(type)||!file.size||file.size>50*1024*1024){
    selectedFile=null;
    $('work-file').value='';
    $('upload-status').textContent='Choose a supported image or video up to 50 MB.';
    return;
  }
  selectedFile=file;
  $('file-label').textContent=file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB';
  $('work-category').value=type.startsWith('video/')?'video':'design';
  if(!$('work-title').value)$('work-title').value=file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ').slice(0,100);
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  previewUrl=URL.createObjectURL(file);
  const media=node(type.startsWith('video/')?'video':'img');
  media.src=previewUrl;
  if(media.tagName==='VIDEO'){
    media.controls=true;
    media.preload='metadata';
  }else media.alt='Selected file preview';
  $('file-preview').replaceChildren(media);
}

$('work-file').addEventListener('change',e=>choose(e.target.files[0]));
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();if(!uploading)$('drop-zone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');});
$('drop-zone').addEventListener('drop',e=>{
  if(uploading)return;
  if(e.dataTransfer.files.length!==1){$('upload-status').textContent='Please choose one file at a time.';return;}
  $('work-file').files=e.dataTransfer.files;
  choose(e.dataTransfer.files[0]);
});

function uploadBinaryToBlob(clientToken, pathname, file, onProgress){
  return new Promise((resolve, reject)=>{
    const xhr=new XMLHttpRequest();
    xhr.open('PUT','https://blob.vercel-storage.com/'+pathname);
    xhr.setRequestHeader('authorization','Bearer '+clientToken);
    xhr.setRequestHeader('x-api-version','7');
    xhr.setRequestHeader('content-type',file.type||'application/octet-stream');
    xhr.timeout=600000;
    xhr.upload.onprogress=e=>{
      if(e.lengthComputable&&onProgress){
        onProgress(Math.round((e.loaded/e.total)*100));
      }
    };
    xhr.onload=()=>{
      if(xhr.status>=200&&xhr.status<300){
        try{
          const data=JSON.parse(xhr.responseText);
          resolve(data.url);
        }catch{
          reject(new Error('Invalid response from storage service.'));
        }
      }else{
        reject(new Error('Blob upload failed ('+xhr.status+').'));
      }
    };
    xhr.onerror=xhr.ontimeout=()=>reject(new Error('Network error while uploading file.'));
    xhr.send(file);
  });
}

$('upload-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(uploading||!selectedFile)return;
  const type=mime(selectedFile),category=$('work-category').value,title=$('work-title').value.trim();
  if(!title||type.startsWith('video/')!==(category==='video')){
    $('upload-status').textContent='Add a title and select Video for video files, or a design/photo category for images.';
    return;
  }
  uploading=true;
  const controls=[...$('upload-form').querySelectorAll('input,select,textarea,button')];
  controls.forEach(c=>c.disabled=true);
  $('upload-dialog').querySelector('.dialog-close').disabled=true;
  $('upload-status').textContent='';
  $('upload-progress-wrap').hidden=false;
  $('upload-progress').value=0;
  $('upload-progress-label').textContent='Preparing upload…';

  const finish=()=>{
    uploading=false;
    controls.forEach(c=>c.disabled=false);
    $('upload-dialog').querySelector('.dialog-close').disabled=false;
  };

  try{
    // Try Vercel Blob client token flow
    let tokenData = null;
    try{
      tokenData=await api('/api/upload-token',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({filename:selectedFile.name,contentType:type})
      });
    }catch(tokenErr){
      console.warn('Upload token failed, checking fallback:', tokenErr.message);
    }

    if(tokenData&&tokenData.clientToken&&tokenData.pathname){
      $('upload-progress-label').textContent='Uploading to cloud…';
      const mediaUrl=await uploadBinaryToBlob(tokenData.clientToken,tokenData.pathname,selectedFile,percent=>{
        $('upload-progress').value=percent;
        $('upload-progress-label').textContent=percent===100?'Saving your work…':percent+'% uploaded';
      });

      const res=await api('/api/works',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          title,
          description:$('work-description').value.trim(),
          category,
          type,
          size:selectedFile.size,
          url:mediaUrl
        })
      });

      finish();
      works.unshift(res.work);
      filter='all';
      document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));
      render();
      $('upload-dialog').close();
      $('gallery-status').textContent='Your work has been added.';
      return;
    }

    // Direct server upload fallback (works seamlessly for files up to 4.5 MB)
    if(selectedFile.size<=4.5*1024*1024){
      $('upload-progress-label').textContent='Uploading directly…';
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file for upload'));
        reader.readAsDataURL(selectedFile);
      });

      const res=await api('/api/works',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          title,
          description:$('work-description').value.trim(),
          category,
          type,
          size:selectedFile.size,
          base64:base64Data
        })
      });

      finish();
      works.unshift(res.work);
      filter='all';
      document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));
      render();
      $('upload-dialog').close();
      $('gallery-status').textContent='Your work has been added.';
      return;
    }
    const query=new URLSearchParams({title,description:$('work-description').value.trim(),category});
    const xhr=new XMLHttpRequest();
    xhr.open('POST','/api/works?'+query);
    xhr.setRequestHeader('Content-Type',type);
    xhr.timeout=600000;
    xhr.upload.onprogress=ev=>{
      if(ev.lengthComputable){
        const percent=Math.round(ev.loaded/ev.total*100);
        $('upload-progress').value=percent;
        $('upload-progress-label').textContent=percent===100?'Saving your work…':percent+'% uploaded';
      }
    };
    xhr.onload=()=>{
      finish();
      let data;
      try{data=JSON.parse(xhr.responseText);}catch{data={error:'Upload could not be confirmed. Please refresh.'};}
      if(xhr.status===201&&data.work){
        works.unshift(data.work);
        filter='all';
        document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));
        render();
        $('upload-dialog').close();
        $('gallery-status').textContent='Your work has been added.';
      }else{
        $('upload-status').textContent=data.error||'Could not upload your work. Please try again.';
      }
    };
    xhr.onerror=xhr.ontimeout=()=>{
      finish();
      $('upload-status').textContent='The connection was interrupted. Please try again.';
    };
    xhr.send(selectedFile);
  }catch(err){
    finish();
    $('upload-status').textContent=err.message||'Could not upload your work.';
  }
});

$('cancel-delete').addEventListener('click',()=>$('delete-dialog').close());
$('confirm-delete').addEventListener('click',async()=>{
  if(!pendingDelete)return;
  const id=pendingDelete.id;
  $('confirm-delete').disabled=true;
  $('cancel-delete').disabled=true;
  try{
    await api('/api/works/'+encodeURIComponent(id),{method:'DELETE'});
    works=works.filter(w=>w.id!==id);
    render();
    $('delete-dialog').close();
    pendingDelete=null;
  }catch(e){
    $('delete-status').textContent=e.message;
  }finally{
    $('confirm-delete').disabled=false;
    $('cancel-delete').disabled=false;
  }
});

$('retry-work').addEventListener('click',load);

api('/api/session').then(session=>{
  setCanManage(session.canManage);
}).catch(()=>{
  setCanManage(false);
});

load();
})();
