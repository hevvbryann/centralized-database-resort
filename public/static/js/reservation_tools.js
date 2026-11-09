(() => {
  'use strict';
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-copy-reference]');if(!button)return;
    const reference=button.dataset.copyReference;if(!reference)return;
    const original=button.textContent;
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(reference);
      else{const input=document.createElement('textarea');input.value=reference;input.style.cssText='position:fixed;opacity:0;left:0;top:0';document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw new Error('Copy unavailable');}
      button.textContent='Copied';button.setAttribute('aria-label','Reference copied');setTimeout(()=>{button.textContent=original;button.setAttribute('aria-label','Copy reference number');},1800);
    }catch{button.textContent='Select and copy the reference';}
  });
  let pending=false;
  document.addEventListener('submit',event=>{
    const form=event.target,submitter=event.submitter;
    if(submitter?.name!=='action'||submitter.value!=='reject')return;
    const saved=form.querySelector('[name="reason"]')?.value.trim();
    if(saved&&saved.length>=5&&saved.length<=2000)return;
    event.preventDefault();event.stopImmediatePropagation();if(pending)return;pending=true;
    const dialog=document.createElement('dialog');dialog.className='review-dialog';dialog.setAttribute('aria-labelledby','review-dialog-title');
    dialog.innerHTML='<form method="dialog"><h2 id="review-dialog-title">Reject this reservation?</h2><p>Explain why the payment or reference could not be verified. The customer will see this reason.</p><label for="review-reason">Rejection reason <span>(required)</span></label><textarea id="review-reason" minlength="5" maxlength="2000" required rows="4" placeholder="For example: The reference number does not match the payment record."></textarea><div class="review-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Reject and notify customer</button></div></form>';
    dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{pending=false;dialog.remove();submitter.focus();},{once:true});
    dialog.querySelector('form').addEventListener('submit',e=>{
      e.preventDefault();const reason=dialog.querySelector('textarea').value.trim();if(reason.length<5){dialog.querySelector('textarea').setCustomValidity('Enter at least 5 non-space characters.');dialog.querySelector('textarea').reportValidity();return;}
      let input=form.querySelector('[name="reason"]');if(!input){input=document.createElement('input');input.type='hidden';input.name='reason';form.append(input);}input.value=reason;delete submitter.dataset.confirm;dialog.close();form.requestSubmit(submitter);
    });
    dialog.querySelector('textarea').addEventListener('input',e=>e.target.setCustomValidity(''));
    document.body.append(dialog);dialog.showModal();dialog.querySelector('textarea').focus();
  },true);
})();
