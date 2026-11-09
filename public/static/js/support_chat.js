(() => {
  'use strict';
  const log=document.getElementById('chat-messages'),inbox=document.getElementById('chat-inbox'),form=document.getElementById('chat-compose'),status=document.getElementById('chat-status');
  let timer,stopped=false,busy=false,refreshing=false,lastSignature='';
  function render(data){
    if(log){
      const ids=new Set([...log.querySelectorAll('[data-message-id]')].map(e=>e.dataset.messageId));
      const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;
      for(const message of data.messages){
        if(ids.has(String(message.support_message_id)))continue;
        log.querySelector('.chat-empty')?.remove();
        const item=document.createElement('article');item.className='bubble'+(message.mine?' mine':'');item.dataset.messageId=message.support_message_id;
        const sender=document.createElement('strong');sender.textContent=message.sender_name+' · '+message.sender_role;
        const body=document.createElement('p');body.textContent=message.message;
        const time=document.createElement('time');time.textContent=message.sent_at;item.append(sender,body,time);log.append(item);
      }
      if(nearBottom)log.scrollTop=log.scrollHeight;
    }
    if(inbox){
      const signature=JSON.stringify(data.threads);
      if(signature!==lastSignature){lastSignature=signature;inbox.replaceChildren();
        for(const thread of data.threads){const link=document.createElement('a');link.className='thread-link';link.href=thread.url;const name=document.createElement('strong');name.textContent=thread.customer_name;const resort=document.createElement('small');resort.textContent=thread.resort_name;const preview=document.createElement('span');preview.textContent=thread.message.slice(0,90);link.append(name,resort,preview);if(thread.unread_count){const badge=document.createElement('b');badge.textContent=thread.unread_count+' unread';link.append(badge);}inbox.append(link);}
        if(!data.threads.length)inbox.textContent='No customer inquiries yet.';
      }
    }
  }
  async function refresh(){
    if(stopped||refreshing||document.hidden)return;
    refreshing=true;
    try{const url=new URL(location.href);url.searchParams.set('format','json');const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});if(response.redirected||response.status===401||response.status===403||response.status===404){stopped=true;throw new Error('This conversation is unavailable. Sign in again.');}if(!response.ok)throw new Error('Could not update messages. Retrying shortly.');render(await response.json());status.textContent='Messages are up to date.';}catch(error){status.textContent=error.message;}finally{refreshing=false;}
  }
  function schedule(){clearTimeout(timer);if(!stopped)timer=setTimeout(async()=>{await refresh();schedule();},5000);}
  form?.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    const input=form.elements.message;if(!input.value.trim())return;
    busy=true;const button=form.querySelector('button');button.disabled=true;status.textContent='Sending…';
    try{const response=await fetch(location.href,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});if(!response.ok||response.redirected)throw new Error('Message was not sent. Reload if your session expired; your draft has been kept.');input.value='';await refresh();if(log)log.scrollTop=log.scrollHeight;input.focus();}catch(error){status.textContent=error.message;}finally{busy=false;button.disabled=false;}
  });
  if(log)log.scrollTop=log.scrollHeight;
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});schedule();
})();
