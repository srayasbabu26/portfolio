document.documentElement.classList.add('js');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}},{threshold:0.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));}else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));}
document.querySelectorAll('.practice-item').forEach(item=>{item.addEventListener('toggle',()=>{if(item.open){document.querySelectorAll('.practice-item').forEach(other=>{if(other!==item)other.open=false;});}});});
const copyButton=document.getElementById('copy-email');
copyButton.addEventListener('click',async()=>{const status=document.getElementById('copy-status');try{await navigator.clipboard.writeText('srayasbabu26@gmail.com');copyButton.textContent='Copied!';status.textContent='Email address copied to your clipboard.';setTimeout(()=>{copyButton.textContent='Copy email';status.textContent='';},3500);}catch{status.textContent='Email: srayasbabu26@gmail.com — select the address to copy it.';}});
document.getElementById('year').textContent=new Date().getFullYear();
