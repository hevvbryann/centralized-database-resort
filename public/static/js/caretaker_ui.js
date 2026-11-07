(() => {
  window.caretakerNotice = message => window.confirmSystemAction({
    title: 'Check your details', message, confirmText: 'OK', cancelText: 'Close', icon: '!',
  });
  // Preserve the real submitter and native validation when replacing a confirm.
  const approved = new WeakSet();
  document.addEventListener('submit', async event => {
    const form = event.target;
    const submitter = event.submitter;
    if (!submitter?.dataset.confirm) return;
    if (approved.has(form)) { approved.delete(form); return; }
    event.preventDefault();
    const confirmed = await window.confirmSystemAction({
      title: submitter.dataset.confirm, message: 'Please confirm before continuing with this action.',
      confirmText: 'Yes, reject', cancelText: 'Go back', danger: true,
    });
    if (confirmed && form.isConnected && submitter.isConnected) {
      approved.add(form);
      form.requestSubmit(submitter);
    }
  }, true);
})();
