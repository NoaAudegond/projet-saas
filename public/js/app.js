(() => {
  const TOKEN_KEY = 'saas_token';
  const USER_KEY = 'saas_user';
  const COMPANY_KEY = 'saas_company';
  const readSession = () => {
    try { return { token: localStorage.getItem(TOKEN_KEY), user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'), company: JSON.parse(localStorage.getItem(COMPANY_KEY) || 'null') }; }
    catch { return { token: null, user: null, company: null }; }
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
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  if (loginForm && registerForm) {
    const message = document.querySelector('#message');
    const loginTab = document.querySelector('#login-tab');
    const registerTab = document.querySelector('#register-tab');
    const showForm = (registering) => {
      loginForm.hidden = registering; registerForm.hidden = !registering;
      loginTab.classList.toggle('active', !registering); registerTab.classList.toggle('active', registering);
      loginTab.setAttribute('aria-selected', String(!registering)); registerTab.setAttribute('aria-selected', String(registering));
      message.textContent = '';
    };
    loginTab.addEventListener('click', () => showForm(false));
    registerTab.addEventListener('click', () => showForm(true));
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault(); message.textContent = 'Connexion en cours…'; message.style.color = '#68738a';
      try { saveSession(await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) })); window.location.assign('/dashboard.html'); }
      catch (error) { message.textContent = error.message; message.style.color = '#b42318'; }
    });
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault(); message.textContent = 'Création de l’espace en cours…'; message.style.color = '#68738a';
      try { saveSession(await api('/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(registerForm))) })); window.location.assign('/dashboard.html'); }
      catch (error) { message.textContent = error.message; message.style.color = '#b42318'; }
    });
    if (readSession().token) window.location.replace('/dashboard.html');
  }

  const profile = document.querySelector('#profile');
  if (profile) {
    const { token, user, company } = readSession();
    if (!token || !user) { window.location.replace('/'); return; }
    const roleNames = { ADMIN: 'Administrateur', MEMBER: 'Membre', VIEWER: 'Viewer' };
    profile.innerHTML = [
      ['Nom', user.name], ['Email', user.email], ['Rôle', roleNames[user.role] || user.role],
      ['Entreprise', company?.name || '—'], ['Identifiant entreprise', user.company_id],
    ].map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value || '—')}</strong></div>`).join('');

    const isAdmin = user.role === 'ADMIN';
    const canEditTasks = isAdmin || user.role === 'MEMBER';
    const membersPanel = document.querySelector('#members-panel');
    const projectPanel = document.querySelector('#project-create-panel');
    membersPanel.hidden = !isAdmin;
    projectPanel.hidden = !isAdmin;
    document.querySelector('#permissions-note').textContent = canEditTasks ? 'Vous pouvez consulter les projets et ajouter ou modifier des tâches.' : 'Accès en lecture seule : vous pouvez consulter les projets et les tâches.';

    const showNotice = (element, text, isError = false) => { element.textContent = text; element.classList.toggle('error', isError); };

    async function loadUsers() {
      const { users } = await api('/company/users');
      const list = document.querySelector('#users-list');
      document.querySelector('#users-empty').hidden = users.length !== 0;
      list.innerHTML = users.map((item) => `<tr><td>${esc(item.name)}</td><td>${esc(item.email)}</td><td>${esc(roleNames[item.role] || item.role)}</td></tr>`).join('');
    }
    if (isAdmin) {
      loadUsers().catch((error) => showNotice(document.querySelector('#member-notice'), error.message, true));
      document.querySelector('#member-form').addEventListener('submit', async (event) => {
        event.preventDefault(); const notice = document.querySelector('#member-notice'); showNotice(notice, 'Ajout en cours…');
        const form = event.currentTarget;
        try {
          const { user: added } = await api('/company/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
          showNotice(notice, `${added.name} a été ajouté.`); form.reset(); await loadUsers();
        } catch (error) { showNotice(notice, error.message, true); }
      });
      document.querySelector('#project-form').addEventListener('submit', async (event) => {
        event.preventDefault(); const notice = document.querySelector('#project-notice'); showNotice(notice, 'Création en cours…');
        const form = event.currentTarget;
        try {
          await api('/projects', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
          form.reset(); showNotice(notice, 'Projet créé.'); await loadProjects();
        } catch (error) { showNotice(notice, error.message, true); }
      });
    }

    async function loadProjects() {
      const container = document.querySelector('#projects-list');
      try {
        const { projects } = await api('/projects');
        if (!projects.length) { container.innerHTML = '<p class="empty">Aucun projet pour cette entreprise.</p>'; return; }
        container.innerHTML = projects.map((project) => `
          <article class="project" data-project-id="${esc(project._id)}">
            <div class="project-head"><div><h3>${esc(project.name)}</h3><p class="muted">${esc(project.description || 'Aucune description')} · ${project.task_count} tâche(s)</p></div>
            ${isAdmin ? `<button class="danger delete-project" type="button">Supprimer</button>` : ''}</div>
            ${canEditTasks ? `<form class="task-form"><label>Nouvelle tâche<input name="title" required maxlength="200" placeholder="Titre de la tâche"></label><label>Description<input name="description" maxlength="10000"></label><label>Priorité<select name="priority"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option></select></label><button class="add" type="submit">Ajouter</button></form>` : ''}
            <div class="table-wrap"><table><thead><tr><th>Tâche</th><th>Priorité</th><th>Assignée à</th><th>Échéance</th><th>Statut</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody class="tasks-body"><tr><td colspan="6">Chargement…</td></tr></tbody></table></div>
          </article>`).join('');
        container.querySelectorAll('.project').forEach((article) => {
          const projectId = article.dataset.projectId;
          article.querySelector('.task-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            try { await api(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); await loadProjects(); }
            catch (error) { window.alert(error.message); }
          });
          article.querySelector('.delete-project')?.addEventListener('click', async () => {
            if (!window.confirm('Supprimer ce projet et toutes ses tâches ?')) return;
            try { await api(`/projects/${projectId}`, { method: 'DELETE' }); await loadProjects(); }
            catch (error) { window.alert(error.message); }
          });
          loadTasks(projectId, article.querySelector('.tasks-body'));
        });
      } catch (error) { container.innerHTML = `<p class="empty">${esc(error.message)}</p>`; }
    }

    async function loadTasks(projectId, tbody) {
      try {
        const { tasks } = await api(`/projects/${projectId}/tasks`);
        tbody.innerHTML = tasks.length ? tasks.map((task) => `<tr data-task-id="${esc(task._id)}"><td>${esc(task.title)}${task.description ? `<br><small>${esc(task.description)}</small>` : ''}</td><td>${esc(task.priority)}</td><td>${esc(task.assigned_to?.name || '—')}</td><td>${task.due_date ? esc(new Date(task.due_date).toLocaleDateString('fr-FR')) : '—'}</td><td>${canEditTasks ? `<select class="task-status"><option value="TODO" ${task.status === 'TODO' ? 'selected' : ''}>À faire</option><option value="IN_PROGRESS" ${task.status === 'IN_PROGRESS' ? 'selected' : ''}>En cours</option><option value="DONE" ${task.status === 'DONE' ? 'selected' : ''}>Terminée</option></select>` : esc({ TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminée' }[task.status] || task.status)}</td>${isAdmin ? '<td><button class="danger delete-task" type="button">Supprimer</button></td>' : ''}</tr>`).join('') : '<tr><td colspan="6" class="empty">Aucune tâche pour ce projet.</td></tr>';
        tbody.querySelectorAll('.task-status').forEach((select) => select.addEventListener('change', async (event) => {
          const taskId = event.target.closest('tr').dataset.taskId;
          try { await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) }); }
          catch (error) { window.alert(error.message); await loadTasks(projectId, tbody); }
        }));
        tbody.querySelectorAll('.delete-task').forEach((button) => button.addEventListener('click', async (event) => {
          const taskId = event.target.closest('tr').dataset.taskId;
          try { await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }); await loadProjects(); }
          catch (error) { window.alert(error.message); }
        }));
      } catch (error) { tbody.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; }
    }
    loadProjects();
  }

  document.querySelector('#logout')?.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem(COMPANY_KEY); window.location.replace('/');
  });
})();
