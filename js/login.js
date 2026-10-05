import { loginWithGoogle, onAuthChange } from './auth.js';

const btn = document.getElementById('btn-google-login');
const errEl = document.getElementById('login-error');

onAuthChange((user) => {
  if (user) {
    window.location.href = '/app.html';
  }
});

btn.addEventListener('click', async () => {
  btn.disabled = true;
  errEl.hidden = true;
  try {
    await loginWithGoogle();
  } catch (err) {
    errEl.textContent = 'Não foi possível entrar. Tente novamente. (' + (err.message || 'erro') + ')';
    errEl.hidden = false;
    btn.disabled = false;
  }
});
