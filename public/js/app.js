(() => {
  const TOKEN_KEY = 'saas_token';
  const USER_KEY = 'saas_user';
  const COMPANY_KEY = 'saas_company';

  const readSession = () => {
    try {
      return {
        token: localStorage.getItem(TOKEN_KEY),
        user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
        company: JSON.parse(localStorage.getItem(COMPANY_KEY) || 'null'),
      };
    } catch {
      return { token: null, user: null, company: null };
    }
  };

  const saveSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    if (data.company) localStorage.setItem(COMPANY_KEY, JSON.stringify(data.company));
  };

  const api = async (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const { token } = readSession();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'La requête a échoué.');
    return data;
  };

  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  if (loginForm && registerForm) {
    const message = document.querySelector('#message');
    const loginTab = document.querySelector('#login-tab');
    const registerTab = document.querySelector('#register-tab');

    const showForm = (formName) => {
      const registering = formName === 'register';
      loginForm.hidden = registering;
      registerForm.hidden = !registering;
      loginTab.classList.toggle('active', !registering);
      registerTab.classList.toggle('active', registering);
      loginTab.setAttribute('aria-selected', String(!registering));
      registerTab.setAttribute('aria-selected', String(registering));
      message.textContent = '';
    };

    loginTab.addEventListener('click', () => showForm('login'));
    registerTab.addEventListener('click', () => showForm('register'));

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = 'Connexion en cours…';
      message.style.color = '#68738a';
      const body = Object.fromEntries(new FormData(loginForm));
      try {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(body) });
        saveSession(data);
        window.location.assign('/dashboard.html');
      } catch (error) {
        message.textContent = error.message;
        message.style.color = '#b42318';
      }
    });

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = 'Création de l’espace en cours…';
      message.style.color = '#68738a';
      const body = Object.fromEntries(new FormData(registerForm));
      try {
        const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(body) });
        saveSession(data);
        window.location.assign('/dashboard.html');
      } catch (error) {
        message.textContent = error.message;
        message.style.color = '#b42318';
      }
    });

    const { token, user } = readSession();
    if (token && user) window.location.replace('/dashboard.html');
  }

  const profile = document.querySelector('#profile');
  if (profile) {
    const { token, user, company } = readSession();
    if (!token || !user) {
      window.location.replace('/');
      return;
    }

    const entries = [
      ['Nom', user.name],
      ['Email', user.email],
      ['Rôle', user.role],
      ['Entreprise', company?.name || '—'],
      ['Identifiant entreprise', user.company_id],
    ];
    profile.replaceChildren(...entries.map(([label, value]) => {
      const box = document.createElement('div');
      const caption = document.createElement('small');
      caption.textContent = label;
      const content = document.createElement('strong');
      content.textContent = value || '—';
      box.append(caption, content);
      return box;
    }));

    const membersPanel = document.querySelector('#members-panel');
    const notice = document.querySelector('#notice');
    if (user.role !== 'ADMIN') membersPanel.hidden = true;

    document.querySelector('#member-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      notice.textContent = 'Ajout en cours…';
      notice.classList.remove('error');
      const body = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const data = await api('/company/users', { method: 'POST', body: JSON.stringify(body) });
        notice.textContent = `${data.user.name} a été ajouté avec le rôle ${data.user.role}.`;
        event.currentTarget.reset();
      } catch (error) {
        notice.textContent = error.message;
        notice.classList.add('error');
      }
    });
  }

  const logout = document.querySelector('#logout');
  if (logout) {
    logout.addEventListener('click', () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(COMPANY_KEY);
      window.location.replace('/');
    });
  }
})();
