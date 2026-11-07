(() => {
  const inputs = [...document.querySelectorAll('.otp-box input')];
  if (!inputs.length) return;
  const digits = value => String(value || '').replace(/\D/g, '');
  function distribute(value, index) {
    const code = digits(value);
    if (!code) return;
    const start = code.length >= inputs.length ? 0 : index;
    [...code.slice(0, inputs.length - start)].forEach((digit, offset) => {
      inputs[start + offset].value = digit;
    });
    const next = Math.min(start + code.length, inputs.length - 1);
    inputs[next].focus({ preventScroll: true });
    inputs[next].select();
  }
  inputs.forEach((input, index) => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('beforeinput', event => {
      if (event.data && digits(event.data).length > 1) {
        event.preventDefault();
        distribute(event.data, index);
      }
    });
    input.addEventListener('input', () => {
      const value = digits(input.value);
      input.value = value.slice(0, 1);
      if (value.length > 1) distribute(value, index);
      else if (value && index < inputs.length - 1) {
        inputs[index + 1].focus({ preventScroll: true });
        inputs[index + 1].select();
      }
    });
    input.addEventListener('paste', event => {
      const value = event.clipboardData?.getData('text') || '';
      if (!digits(value)) return;
      event.preventDefault();
      distribute(value, index);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        event.preventDefault();
        inputs[index - 1].value = '';
        inputs[index - 1].focus({ preventScroll: true });
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault(); inputs[index - 1].focus({ preventScroll: true });
      } else if (event.key === 'ArrowRight' && index < inputs.length - 1) {
        event.preventDefault(); inputs[index + 1].focus({ preventScroll: true });
      }
    });
  });
  inputs[0].focus({ preventScroll: true });
})();
