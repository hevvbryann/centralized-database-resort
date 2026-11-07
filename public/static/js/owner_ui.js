(() => {
  const approved = new WeakSet();
  document.addEventListener('submit', async event => {
    const form = event.target;
    const submitter = event.submitter;
    const message = submitter?.dataset.confirm || form.dataset.confirm;
    if (!message) return;
    if (approved.has(form)) { approved.delete(form); return; }
    event.preventDefault();
    const confirmed = await window.confirmSystemAction({title: 'Please confirm this action', message, confirmText: 'Yes, continue', cancelText: 'Go back', danger: true});
    if (confirmed && form.isConnected) { approved.add(form); form.requestSubmit(submitter || undefined); }
  }, true);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-submit-form]');
    if (!button) return;
    event.preventDefault();
    const confirmed = await window.confirmSystemAction({title: 'Please confirm this action', message: button.dataset.confirm, confirmText: 'Yes, continue', cancelText: 'Go back', danger: true});
    const form = document.getElementById(button.dataset.submitForm);
    if (confirmed && form) form.requestSubmit();
  });
})();
