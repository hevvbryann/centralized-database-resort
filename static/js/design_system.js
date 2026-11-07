/* Presentation helpers only; booking actions stay with their existing handlers. */
(() => {
  const eyeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const hiddenEyeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m3 3 18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 4M6.1 6.1A20 20 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  let passwordFieldNumber = 0;
  function addPasswordToggles(root) {
    const inputs = [...root.querySelectorAll('input[type="password"]')];
    if (root.matches?.('input[type="password"]')) inputs.unshift(root);
    inputs.forEach(input => {
      if (input.dataset.passwordInput) return;
      input.dataset.passwordInput = 'true';
      if (!input.id) {
        do { passwordFieldNumber += 1; } while (document.getElementById('password-field-' + passwordFieldNumber));
        input.id = 'password-field-' + passwordFieldNumber;
      }
      const wrapper = document.createElement('span');
      wrapper.className = 'password-field';
      input.before(wrapper);
      wrapper.appendChild(input);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'password-visibility-toggle';
      toggle.setAttribute('aria-label', 'Show password');
      toggle.setAttribute('aria-controls', input.id);
      toggle.setAttribute('aria-pressed', 'false');
      toggle.title = 'Show password';
      toggle.innerHTML = eyeIcon;
      toggle.addEventListener('click', () => {
        const revealed = input.type === 'password';
        input.type = revealed ? 'text' : 'password';
        const label = revealed ? 'Hide password' : 'Show password';
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('aria-pressed', String(revealed));
        toggle.title = label;
        toggle.innerHTML = revealed ? hiddenEyeIcon : eyeIcon;
      });
      wrapper.appendChild(toggle);
    });
  }
  addPasswordToggles(document);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) addPasswordToggles(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });

  let pendingConfirmation = null;
  window.confirmSystemAction = ({ title, message, confirmText = 'Continue', cancelText = 'Go back', danger = false, icon = '!' }) => {
    if (pendingConfirmation) return pendingConfirmation;
    pendingConfirmation = new Promise(resolve => {
      const previousFocus = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'system-confirmation' + (danger ? ' is-warning' : '');
      dialog.setAttribute('aria-labelledby', 'system-confirmation-title');
      dialog.setAttribute('aria-describedby', 'system-confirmation-message');
      dialog.innerHTML = '<div class="system-confirmation-card"><span class="system-confirmation-icon" aria-hidden="true"></span><p class="system-confirmation-eyebrow">PLEASE CONFIRM</p><h2 id="system-confirmation-title"></h2><p id="system-confirmation-message"></p><div class="system-confirmation-actions"><button type="button" class="system-confirmation-stay" autofocus></button><button type="button" class="system-confirmation-proceed"></button></div></div>';
      dialog.querySelector('.system-confirmation-icon').textContent = icon;
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('#system-confirmation-message').textContent = message;
      dialog.querySelector('.system-confirmation-stay').textContent = cancelText;
      dialog.querySelector('.system-confirmation-proceed').textContent = confirmText;
      const finish = confirmed => {
        dialog.close();
        dialog.remove();
        pendingConfirmation = null;
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(confirmed);
      };
      dialog.querySelector('.system-confirmation-stay').addEventListener('click', () => finish(false));
      dialog.querySelector('.system-confirmation-proceed').addEventListener('click', () => finish(true));
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      });
      dialog.addEventListener('click', event => {
        if (event.target === dialog) finish(false);
      });
      document.body.appendChild(dialog);
      dialog.showModal();
    });
    return pendingConfirmation;
  };

  window.showSystemNotice = message => window.confirmSystemAction({title: 'Please check', message: String(message), confirmText: 'OK', cancelText: 'Close', icon: '!'});
  const approvedSystemForms = new WeakSet();
  document.addEventListener('submit', async event => {
    const form = event.target;
    const submitter = event.submitter;
    if (!submitter?.dataset.systemConfirm) return;
    if (approvedSystemForms.has(form)) { approvedSystemForms.delete(form); return; }
    event.preventDefault();
    const confirmed = await window.confirmSystemAction({title: 'Cancel this reservation?', message: submitter.dataset.systemConfirm, confirmText: 'Yes, cancel reservation', cancelText: 'Keep reservation', danger: true});
    if (confirmed && form.isConnected && submitter.isConnected) {
      approvedSystemForms.add(form);
      form.requestSubmit(submitter);
    }
  }, true);
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.pathname !== '/logout') return;
    event.preventDefault();
    const confirmed = await window.confirmSystemAction({
      title: 'Are you sure you want to log out?',
      message: 'You will need to sign in again to access your account. Make sure you have saved any changes before leaving.',
      confirmText: 'Yes, log out', cancelText: 'Stay signed in', icon: '↗', danger: true,
    });
    if (confirmed) window.location.assign(destination.href);
  });

  const fallback = document.currentScript.dataset.resortFallback;
  const resortImages = '.thumb img, .heroimg img, .resort-card > img, .card-img, .customer-resort-image img, .resort-hero-slide > img, #ov-gallery img, #galleryImage img';
  function recoverImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.matches(resortImages)) return;
    if (!fallback || image.getAttribute('src') === fallback) return;
    image.src = fallback;
    image.srcset = '';
  }
  document.addEventListener('error', event => recoverImage(event.target), true);
  document.querySelectorAll(resortImages).forEach(image => {
    if (image.complete && !image.naturalWidth) recoverImage(image);
  });

  document.querySelectorAll('.tabbtn[data-tab], .tab-btn[data-tab]').forEach(button => {
    const group = button.parentElement;
    if (group.dataset.tabsReady) return;
    group.dataset.tabsReady = 'true';
    group.setAttribute('role', 'tablist');
    const buttons = [...group.querySelectorAll('button[data-tab]')];
    function synchronize() {
      buttons.forEach(tab => {
        const panel = document.getElementById('tab-' + tab.dataset.tab);
        if (!panel) return;
        tab.id ||= 'trigger-' + tab.dataset.tab;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
        tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      });
    }
    synchronize();
    group.addEventListener('click', synchronize);
    new MutationObserver(synchronize).observe(group, { subtree: true, attributes: true, attributeFilter: ['class'] });
    group.addEventListener('keydown', event => {
      const index = buttons.indexOf(document.activeElement);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].click();
      buttons[next].focus();
    });
  });
})();
