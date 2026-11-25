(() => {
  if (Session.get()?.token) { window.location.replace('/app'); return; }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabs = { login: document.getElementById('tab-login'), register: document.getElementById('tab-register') };

  function show(mode) {
    const registering = mode === 'register';
    loginForm.hidden = registering;
    registerForm.hidden = !registering;
    tabs.login.setAttribute('aria-selected', String(!registering));
    tabs.register.setAttribute('aria-selected', String(registering));
    document.getElementById('demo').hidden = registering;
    (registering ? registerForm : loginForm).querySelector('input').focus();
  }
  tabs.login.addEventListener('click', () => show('login'));
  tabs.register.addEventListener('click', () => show('register'));

  async function submit(form, url, loadingLabel) {
    const error = form.querySelector('.form-error');
    const button = form.querySelector('button[type="submit"]');
    error.textContent = '';
    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      error.textContent = invalid.validationMessage;
      invalid.focus();
      return;
    }
    setBusy(button, true, loadingLabel);
    try {
      const data = await api(url, { method: 'POST', body: formToObject(form) });
      Session.set(data);
      window.location.assign('/app');
    } catch (err) {
      error.textContent = err.message;
      setBusy(button, false);
    }
  }

  loginForm.addEventListener('submit', (e) => { e.preventDefault(); submit(loginForm, '/api/auth/login', 'Connexion…'); });
  registerForm.addEventListener('submit', (e) => { e.preventDefault(); submit(registerForm, '/api/auth/register', 'Création…'); });

  document.querySelectorAll('.demo-list button').forEach((button) => {
    button.addEventListener('click', () => {
      loginForm.company.value = button.dataset.company;
      loginForm.email.value = button.dataset.email;
      loginForm.password.value = 'demo1234';
      loginForm.querySelector('button[type="submit"]').focus();
    });
  });
})();
