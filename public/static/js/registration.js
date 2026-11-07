(() => {
  const form = document.getElementById('registration-form');
  if (!form) return;
  const password = form.elements.namedItem('password');
  const confirmation = form.elements.namedItem('confirm_password');
  const feedback = document.getElementById('registration-feedback');
  const button = form.querySelector('button[type="submit"]');
  const requirements = value => ({
    length: value.length >= 8, lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value), number: /\d/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  });
  function updateChecklist() {
    const rules = requirements(password.value);
    rules.match = password.value.length > 0 && password.value === confirmation.value;
    form.querySelectorAll('.password-checklist [data-rule]').forEach(item => {
      const valid = rules[item.dataset.rule];
      item.classList.toggle('valid', valid);
      item.querySelector('i').className = valid ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
    });
    password.setCustomValidity(Object.values(requirements(password.value)).every(Boolean) ? '' : 'Please meet all password requirements.');
    confirmation.setCustomValidity(confirmation.value && !rules.match ? 'Passwords must match.' : '');
  }
  [password, confirmation].forEach(input => {
    input.addEventListener('input', updateChecklist);
    input.addEventListener('change', updateChecklist);
  });
  window.addEventListener('pageshow', updateChecklist);
  form.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    if (feedback.dataset.field === event.target.name) {
      feedback.hidden = true;
      feedback.textContent = '';
      delete feedback.dataset.field;
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    updateChecklist();
    if (!form.reportValidity() || button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Creating your account…';
    form.setAttribute('aria-busy', 'true');
    feedback.hidden = true;
    delete feedback.dataset.field;
    try {
      const response = await fetch(form.action, {
        method: 'POST', body: new FormData(form),
        headers: {'Accept': 'application/json'}, credentials: 'same-origin',
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        window.location.assign(data.next_url);
        return;
      }
      feedback.textContent = data.message || 'Please check your details and try again.';
      feedback.dataset.field = data.field || '';
      feedback.hidden = false;
      const field = data.field ? form.elements.namedItem(data.field) : null;
      if (field?.focus) {
        field.setAttribute('aria-invalid', 'true');
        field.focus({preventScroll: true});
        field.select?.();
      }
      feedback.scrollIntoView({block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    } catch (error) {
      feedback.textContent = 'We could not complete this request. Your entries are still here. Please try again.';
      feedback.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = label;
      form.removeAttribute('aria-busy');
    }
  });
  updateChecklist();
})();
