/* Application principale (SPA légère, routage par hash). */
(() => {
  const session = Session.get();
  if (!session?.token) { window.location.replace('/'); return; }

  // ---------- État global ----------
  const state = { me: session.user, company: session.company, users: [], projects: [], teams: [], templates: [] };
  const view = document.getElementById('view');
  const modal = document.getElementById('modal');

  const ROLE_LABEL = { ADMIN: 'Administrateur', MEMBER: 'Membre', VIEWER: 'Viewer' };
  const ROLE_CLASS = { ADMIN: 'badge-admin', MEMBER: 'badge-member', VIEWER: 'badge-viewer' };
  const STATUSES = [
    { key: 'TODO', label: 'À faire', color: 'var(--st-todo)' },
    { key: 'IN_PROGRESS', label: 'En cours', color: 'var(--st-progress)' },
    { key: 'REVIEW', label: 'En revue', color: 'var(--st-review)' },
    { key: 'DONE', label: 'Terminé', color: 'var(--st-done)' },
  ];
  const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
  const SUBTASK_STATUS = { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminé' };
  const SUBTASK_NEXT = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'TODO' };
  const PRIORITIES = [['URGENT', 'Urgente'], ['HIGH', 'Haute'], ['MEDIUM', 'Moyenne'], ['LOW', 'Basse']];
  const PRIORITY_LABEL = Object.fromEntries(PRIORITIES);
  const PROJECT_STATUS = { ACTIVE: 'Actif', ON_HOLD: 'En pause', ARCHIVED: 'Archivé' };
  const PROJECT_COLORS = ['#ef5b3c', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#d946ef', '#64748b'];
  const TEAM_COLORS = ['#ef5b3c', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#d946ef'];

  const isAdmin = () => state.me.role === 'ADMIN';
  const canEdit = () => ['ADMIN', 'MEMBER'].includes(state.me.role);

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v4M12 17.5v.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
  };
  const icon = (name, style = '') => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${style}">${ICONS[name]}</svg>`;
  const priorityBadge = (priority) => `<span class="badge prio-${priority}">${priority === 'URGENT' ? icon('alert', 'width:11px;height:11px') : ''}${PRIORITY_LABEL[priority] || esc(priority)}</span>`;

  const userById = (id) => state.users.find((u) => String(u._id) === String(id));

  function stackedBar(stats) {
    if (!stats.total) return '<div class="bar"></div>';
    return `<div class="bar">${STATUSES.map((s) => (stats[s.key] ? `<span style="width:${(stats[s.key] / stats.total) * 100}%;background:${s.color}" title="${s.label} : ${stats[s.key]}"></span>` : '')).join('')}</div>`;
  }
  function avatarStack(users, max = 4) {
    const shown = users.slice(0, max).map((u) => avatar(u)).join('');
    const more = users.length > max ? `<span class="avatar avatar-more">+${users.length - max}</span>` : '';
    return `<div class="avatar-stack">${shown}${more}</div>`;
  }
  const emptyState = (iconName, title, text, action = '') => `
    <div class="empty-state"><span class="empty-icon">${icon(iconName)}</span>
      <h3 style="color:var(--ink)">${title}</h3><p>${text}</p>${action}</div>`;

  // ---------- Modales ----------
  function openModal({ title, body, footer, onSubmit, wide = false }) {
    modal.style.width = wide ? 'min(680px, calc(100vw - 32px))' : '';
    modal.innerHTML = `
      <form method="dialog" novalidate>
        <div class="modal-head"><h2>${title}</h2><button class="icon-btn" type="button" data-close aria-label="Fermer">${icon('x')}</button></div>
        <div class="modal-body">${body}<p class="form-error" role="alert" style="margin-top:14px"></p></div>
        <div class="modal-foot">${footer}</div>
      </form>`;
    const form = modal.querySelector('form');
    modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => modal.close()));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!onSubmit) { modal.close(); return; }
      const error = form.querySelector('.form-error');
      error.textContent = '';
      const invalid = form.querySelector(':invalid');
      if (invalid) { error.textContent = `${invalid.closest('.field')?.querySelector('span')?.textContent || 'Champ'} : ${invalid.validationMessage}`; invalid.focus(); return; }
      const button = event.submitter || form.querySelector('[type="submit"]');
      setBusy(button, true);
      try {
        await onSubmit(form, event.submitter);
        modal.close();
      } catch (err) {
        error.textContent = err.message;
      } finally { setBusy(button, false); }
    });
    if (!modal.open) modal.showModal();
    const first = form.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select');
    if (first) first.focus();
    return form;
  }

  function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = true }) {
    return new Promise((resolve) => {
      let answered = false;
      openModal({
        title,
        body: `<p class="muted">${message}</p>`,
        footer: `<button class="btn btn-ghost" type="button" data-close>Annuler</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit">${confirmLabel}</button>`,
        onSubmit: async () => { answered = true; resolve(true); },
      });
      // L'événement close est asynchrone : on ignore celui de la modale précédente (qui est rouverte).
      const onClose = () => {
        if (modal.open) return;
        modal.removeEventListener('close', onClose);
        if (!answered) resolve(false);
      };
      modal.addEventListener('close', onClose);
    });
  }

  // ---------- Chargement des données ----------
  async function refreshUsers() { state.users = (await api('/api/users')).users; }
  async function refreshTeams() { state.teams = (await api('/api/teams')).teams; }
  async function refreshTemplates() { state.templates = (await api('/api/templates')).templates; }
  async function refreshProjects() { state.projects = (await api('/api/projects')).projects; renderSidebarProjects(); }

  function renderSidebar() {
    const { me, company } = state;
    document.getElementById('company-name').textContent = company?.name || '—';
    document.getElementById('company-slug').textContent = company?.slug ? `Code : ${company.slug}` : '';
    document.getElementById('company-logo').textContent = initials(company?.name || '?');
    document.getElementById('nav-settings').hidden = !isAdmin();
    document.getElementById('nav-templates').hidden = !isAdmin();
    document.getElementById('me').innerHTML = `${avatar(me)}<span class="who"><strong>${esc(me.name)}</strong><small>${ROLE_LABEL[me.role]}</small></span>`;
  }
  function renderSidebarProjects() {
    const nav = document.getElementById('nav-projects');
    document.getElementById('projects-count').textContent = state.projects.length || '';
    nav.innerHTML = state.projects.length
      ? state.projects.map((p) => `<a class="nav-link" href="#/projects/${p._id}" data-project="${p._id}"><span class="pdot" style="background:${p.color}"></span><span class="name">${esc(p.name)}</span></a>`).join('')
      : '<p class="small" style="padding:4px 10px;color:#6f6f7a">Aucun projet</p>';
    highlightNav();
  }
  function highlightNav() {
    const [section, id] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (section || 'dashboard') && !id));
    document.querySelectorAll('[data-project]').forEach((a) => a.classList.toggle('active', a.dataset.project === id));
  }

  // ======================= VUES =======================

  // ---------- Tableau de bord ----------
  async function renderDashboard() {
    const { tasks } = await api('/api/tasks/mine');
    const totals = state.projects.reduce((acc, p) => {
      STATUSES.forEach((s) => { acc[s.key] += p.stats[s.key]; });
      return acc;
    }, { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 });
    const open = tasks.filter((t) => t.status !== 'DONE');
    const late = open.filter((t) => isOverdue(t.due_date)).length;
    const hour = new Date().getHours();
    const hello = hour < 18 ? 'Bonjour' : 'Bonsoir';

    const stat = (label, value, color, ic) => `
      <div class="card stat"><div class="label"><span class="ic" style="background:${color}1f;color:${color}">${icon(ic, 'width:14px;height:14px')}</span>${label}</div>
      <div class="value">${value}</div></div>`;

    view.innerHTML = `
      <div class="page-head"><div><h1>${hello}, ${esc(state.me.name.split(' ')[0])}</h1>
        <p class="sub">Voici où en sont les projets de ${esc(state.company?.name || 'votre entreprise')}.</p></div>
        ${isAdmin() ? `<div class="actions"><button class="btn btn-primary" id="dash-new-project">${icon('plus')}Nouveau projet</button></div>` : ''}
      </div>
      <div class="stats">
        ${stat('Projets', state.projects.length, '#6366f1', 'folder')}
        ${stat('Tâches en cours', totals.IN_PROGRESS + totals.REVIEW, '#e08a00', 'clock')}
        ${stat('Tâches terminées', totals.DONE, '#16a34a', 'check')}
        ${stat('Mes tâches en retard', late, '#c2321f', 'alert')}
      </div>
      <div class="dash-grid">
        <section class="card">
          <div class="section-head"><h2>Mes tâches</h2><span class="badge">${open.length} ouverte${open.length > 1 ? 's' : ''}</span></div>
          ${open.length ? open.slice(0, 8).map((t) => `
            <a class="task-row" href="#/projects/${t.project_id?._id}?task=${t._id}">
              <span class="status-pill"><i style="background:${STATUS[t.status].color}"></i></span>
              <span class="grow"><span class="t">${esc(t.title)}</span>
                <span class="meta"><span style="color:${t.project_id?.color}">●</span>${esc(t.project_id?.name || '')}</span></span>
              ${t.due_date ? `<span class="due ${isOverdue(t.due_date) ? 'late' : ''}">${icon('calendar')}${formatDate(t.due_date)}</span>` : ''}
              <span class="hide-sm">${priorityBadge(t.priority)}</span>
            </a>`).join('') : `<div style="border-top:1px solid var(--line)">${emptyState('check', 'Rien à faire', 'Aucune tâche ouverte ne vous est assignée.')}</div>`}
        </section>
        <section class="card">
          <div class="section-head"><h2>Avancement des projets</h2><a class="small muted" href="#/projects">Tout voir</a></div>
          ${state.projects.length ? state.projects.slice(0, 6).map((p) => {
            const pct = p.stats.total ? Math.round((p.stats.DONE / p.stats.total) * 100) : 0;
            return `<div class="progress-row"><div class="top"><a href="#/projects/${p._id}">${esc(p.name)}</a><span class="muted small">${pct}%</span></div>${stackedBar(p.stats)}</div>`;
          }).join('') : `<div style="border-top:1px solid var(--line)">${emptyState('folder', 'Aucun projet', isAdmin() ? 'Créez votre premier projet pour commencer.' : 'Vous n’êtes assigné à aucun projet pour le moment.')}</div>`}
        </section>
      </div>`;
    document.getElementById('dash-new-project')?.addEventListener('click', () => projectModal());
  }

  // ---------- Liste des projets ----------
  function renderProjects() {
    view.innerHTML = `
      <div class="page-head"><div><h1>Projets</h1><p class="sub">${isAdmin() ? 'Tous les projets de l’entreprise.' : 'Les projets auxquels vous êtes assigné.'}</p></div>
        ${isAdmin() ? `<div class="actions"><button class="btn btn-primary" id="new-project">${icon('plus')}Nouveau projet</button></div>` : ''}</div>
      ${state.projects.length ? `<div class="projects-grid">${state.projects.map((p) => {
        const pct = p.stats.total ? Math.round((p.stats.DONE / p.stats.total) * 100) : 0;
        return `<a class="card project-card" href="#/projects/${p._id}" style="--pc:${p.color}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><h3>${esc(p.name)}</h3><span class="badge st-${p.status}">${PROJECT_STATUS[p.status]}</span></div>
          <p class="desc">${esc(p.description || 'Pas de description.')}</p>
          <div>${stackedBar(p.stats)}<div style="display:flex;justify-content:space-between;margin-top:6px" class="small muted"><span>${p.stats.DONE}/${p.stats.total} tâches terminées</span><span>${pct}%</span></div></div>
          <div class="foot">${avatarStack(p.members)}${p.due_date ? `<span class="due ${isOverdue(p.due_date) && p.status !== 'ARCHIVED' ? 'late' : ''}">${icon('calendar')}${formatDate(p.due_date)}</span>` : ''}</div>
        </a>`;
      }).join('')}</div>` : `<div class="card">${emptyState('folder', 'Aucun projet', isAdmin() ? 'Créez un projet puis assignez-y des membres de votre équipe.' : 'Un administrateur doit vous assigner à un projet.', isAdmin() ? `<button class="btn btn-primary" id="new-project-2">${icon('plus')}Créer un projet</button>` : '')}</div>`}`;
    view.querySelectorAll('#new-project, #new-project-2').forEach((b) => b.addEventListener('click', () => projectModal()));
  }

  function projectModal(project = null) {
    const selected = new Set((project?.members || [state.me]).map((m) => String(m._id)));
    const color = project?.color || PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length];
    openModal({
      title: project ? 'Modifier le projet' : 'Nouveau projet',
      wide: true,
      body: `<div class="form-grid">
        <label class="field"><span>Nom du projet</span><input class="input" name="name" required maxlength="160" value="${esc(project?.name)}" placeholder="ex. Refonte du site"></label>
        <label class="field"><span>Description</span><textarea class="textarea" name="description" maxlength="5000" placeholder="Objectif, périmètre…">${esc(project?.description)}</textarea></label>
        <div class="form-row">
          <label class="field"><span>Statut</span><select class="select" name="status">${Object.entries(PROJECT_STATUS).map(([k, v]) => `<option value="${k}" ${project?.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span>Échéance</span><input class="input" type="date" name="due_date" value="${toInputDate(project?.due_date)}"></label>
        </div>
        <label class="field"><span>Équipe responsable</span><select class="select" name="team_id"><option value="">Aucune équipe</option>${state.teams.map((t) => `<option value="${t._id}" ${project?.team_id?._id === t._id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
          <small>Les sous-équipes appartiennent à votre entreprise.</small></label>
        <div class="field"><span>Couleur</span><div class="color-picker">${PROJECT_COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
        <div class="field"><span>Membres assignés au projet</span>
          <div class="member-picker">${state.users.map((u) => `
            <label class="member-option"><input type="checkbox" name="members" value="${u._id}" ${selected.has(String(u._id)) ? 'checked' : ''}>
              ${avatar(u)}<span class="grow"><strong>${esc(u.name)}</strong><br><span class="small muted">${esc(u.job_title || u.email)}</span></span>
              <span class="badge ${ROLE_CLASS[u.role]}">${ROLE_LABEL[u.role]}</span></label>`).join('')}</div>
          <small>Seuls les membres du projet le voient (hors administrateurs) et peuvent se voir assigner des tâches.</small>
        </div></div>`,
      footer: `<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">${project ? 'Enregistrer' : 'Créer le projet'}</button>`,
      onSubmit: async (form) => {
        const data = formToObject(form);
        data.members = [...form.querySelectorAll('input[name="members"]:checked')].map((i) => i.value);
        data.due_date = data.due_date || null;
        if (project) {
          await api(`/api/projects/${project._id}`, { method: 'PUT', body: data });
          toast('Projet mis à jour.');
          await refreshProjects();
          route();
        } else {
          const { project: created } = await api('/api/projects', { method: 'POST', body: data });
          toast('Projet créé.');
          await refreshProjects();
          location.hash = `#/projects/${created._id}`;
        }
      },
    });
  }

  // ---------- Page projet : Kanban ----------
  let board = { project: null, tasks: [], filters: { q: '', assignee: '', priority: '' } };

  async function renderProject(projectId, params) {
    const [{ project }, { tasks }] = await Promise.all([
      api(`/api/projects/${projectId}`),
      api(`/api/projects/${projectId}/tasks`),
    ]);
    board = { project, tasks, filters: { q: '', assignee: '', priority: '' } };

    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="project-title"><span class="swatch" style="background:${project.color}"></span><h1>${esc(project.name)}</h1><span class="badge st-${project.status}">${PROJECT_STATUS[project.status]}</span></div>
          <p class="sub">${esc(project.description || 'Pas de description.')}</p>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" id="show-members" title="Membres du projet">${avatarStack(project.members, 3)}<span>${project.members.length} membre${project.members.length > 1 ? 's' : ''}</span></button>
          ${isAdmin() ? `<button class="btn btn-ghost" id="edit-project">${icon('edit')}Modifier</button>
          <button class="btn btn-ghost" id="save-template">${icon('folder')}Enregistrer comme modèle</button>
          <button class="btn btn-danger-ghost" id="delete-project" aria-label="Supprimer le projet">${icon('trash')}</button>` : ''}
          ${canEdit() ? `<button class="btn btn-primary" id="new-task">${icon('plus')}Nouvelle tâche</button>` : ''}
        </div>
      </div>
      ${canEdit() ? '' : `<div class="readonly-note">${icon('eye')}Vous avez un accès en lecture seule (Viewer) : vous pouvez consulter les tâches sans les modifier.</div>`}
      <div class="toolbar">
        <label class="search"><span class="sr-only">Rechercher</span>${icon('search')}<input class="input" id="f-q" placeholder="Rechercher une tâche…"></label>
        <select class="select" id="f-assignee" aria-label="Filtrer par membre"><option value="">Tous les membres</option><option value="none">Non assignées</option>${project.members.map((m) => `<option value="${m._id}">${esc(m.name)}</option>`).join('')}</select>
        <select class="select" id="f-priority" aria-label="Filtrer par priorité"><option value="">Toutes priorités</option>${PRIORITIES.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <span class="spacer"></span>
        <span class="small muted" id="task-count"></span>
      </div>
      <div class="board" id="board">${STATUSES.map((s) => `
        <section class="column" data-status="${s.key}" aria-label="${s.label}">
          <div class="column-head"><span class="cdot" style="background:${s.color}"></span><h3>${s.label}</h3><span class="n" data-count></span>
            ${canEdit() ? `<button class="icon-btn" type="button" data-add="${s.key}" aria-label="Ajouter une tâche dans ${s.label}">${icon('plus')}</button>` : ''}</div>
          <div class="cards" data-cards></div>
          ${canEdit() ? `<button class="add-card" type="button" data-add="${s.key}">+ Ajouter une tâche</button>` : ''}
        </section>`).join('')}</div>`;

    renderBoard();

    const f = board.filters;
    document.getElementById('f-q').addEventListener('input', (e) => { f.q = e.target.value.toLowerCase(); renderBoard(); });
    document.getElementById('f-assignee').addEventListener('change', (e) => { f.assignee = e.target.value; renderBoard(); });
    document.getElementById('f-priority').addEventListener('change', (e) => { f.priority = e.target.value; renderBoard(); });
    document.getElementById('new-task')?.addEventListener('click', () => taskModal(null, 'TODO'));
    view.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => taskModal(null, b.dataset.add)));
    document.getElementById('show-members').addEventListener('click', membersModal);
    document.getElementById('edit-project')?.addEventListener('click', () => projectModal(project));
    document.getElementById('save-template')?.addEventListener('click', () => templateModal(null, project));
    document.getElementById('delete-project')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Supprimer le projet ?', message: `Le projet « ${esc(project.name)} » et ses ${tasks.length} tâche(s) seront définitivement supprimés.`, confirmLabel: 'Supprimer' });
      if (!ok) return;
      try {
        await api(`/api/projects/${project._id}`, { method: 'DELETE' });
        toast('Projet supprimé.');
        await refreshProjects();
        location.hash = '#/projects';
      } catch (err) { toast(err.message, 'error'); }
    });

    if (canEdit()) setupDragAndDrop();
    // Ouverture directe d'une tâche depuis le tableau de bord (?task=…)
    const taskId = params.get('task');
    if (taskId) {
      const task = board.tasks.find((t) => t._id === taskId);
      if (task) taskModal(task);
    }
  }

  function filteredTasks() {
    const { q, assignee, priority } = board.filters;
    return board.tasks.filter((t) => {
      if (q && !`${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase().includes(q)) return false;
      if (assignee === 'none' && t.assigned_to) return false;
      if (assignee && assignee !== 'none' && t.assigned_to?._id !== assignee) return false;
      if (priority && t.priority !== priority) return false;
      return true;
    });
  }

  function taskCard(t) {
    const done = t.status === 'DONE';
    return `<article class="task-card ${t.priority === 'URGENT' ? 'urgent' : ''}" tabindex="0" data-id="${t._id}" ${canEdit() ? 'draggable="true"' : ''}>
      <div class="top">${priorityBadge(t.priority)}${t.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join('')}</div>
      <div class="t" style="${done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</div>
      ${t.description ? `<div class="d">${esc(t.description)}</div>` : ''}
      <div class="bottom">
        <span class="card-meta">
          ${t.due_date ? `<span class="due ${isOverdue(t.due_date) && !done ? 'late' : ''}">${icon('calendar')}${formatDate(t.due_date)}</span>` : ''}
          ${t.team_id ? `<span class="team-tag" style="--tc:${t.team_id.color}">${esc(t.team_id.name)}</span>` : ''}
          ${t.subtask_stats?.total ? `<span class="small muted">${t.subtask_stats.DONE}/${t.subtask_stats.total} sous-tâches</span>` : ''}
        </span>
        ${t.assigned_to ? avatar(t.assigned_to) : '<span class="unassigned" title="Non assignée"></span>'}
      </div></article>`;
  }

  function renderBoard() {
    const tasks = filteredTasks();
    STATUSES.forEach((s) => {
      const column = view.querySelector(`.column[data-status="${s.key}"]`);
      const list = tasks.filter((t) => t.status === s.key).sort((a, b) => a.position - b.position);
      column.querySelector('[data-count]').textContent = list.length;
      column.querySelector('[data-cards]').innerHTML = list.map(taskCard).join('');
    });
    document.getElementById('task-count').textContent = `${tasks.length} tâche${tasks.length > 1 ? 's' : ''}${tasks.length !== board.tasks.length ? ` sur ${board.tasks.length}` : ''}`;
    view.querySelectorAll('.task-card').forEach((card) => {
      const open = () => taskModal(board.tasks.find((t) => t._id === card.dataset.id));
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  // Glisser-déposer natif HTML5 : change le statut et l'ordre dans la colonne.
  function setupDragAndDrop() {
    const boardEl = document.getElementById('board');
    let draggedId = null;

    boardEl.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
    });
    boardEl.addEventListener('dragend', (e) => {
      e.target.closest('.task-card')?.classList.remove('dragging');
      boardEl.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
    });
    boardEl.addEventListener('dragover', (e) => {
      const column = e.target.closest('.column');
      if (!column || !draggedId) return;
      e.preventDefault();
      boardEl.querySelectorAll('.drag-over').forEach((c) => c !== column && c.classList.remove('drag-over'));
      column.classList.add('drag-over');
    });
    boardEl.addEventListener('drop', async (e) => {
      const column = e.target.closest('.column');
      if (!column || !draggedId) return;
      e.preventDefault();
      column.classList.remove('drag-over');
      const task = board.tasks.find((t) => t._id === draggedId);
      draggedId = null;
      if (!task) return;

      // Calcul de la nouvelle position : milieu entre les deux cartes voisines.
      const status = column.dataset.status;
      const siblings = [...column.querySelectorAll('.task-card')].filter((c) => c.dataset.id !== task._id);
      const after = siblings.find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
      const pos = (id) => board.tasks.find((t) => t._id === id).position;
      const index = after ? siblings.indexOf(after) : siblings.length;
      const prev = index > 0 ? pos(siblings[index - 1].dataset.id) : null;
      const next = after ? pos(after.dataset.id) : null;
      let position;
      if (prev === null && next === null) position = 0;
      else if (prev === null) position = next - 1;
      else if (next === null) position = prev + 1;
      else position = (prev + next) / 2;

      if (task.status === status && task.position === position) return;
      const backup = { status: task.status, position: task.position };
      Object.assign(task, { status, position });
      renderBoard();
      try {
        await api(`/api/projects/${board.project._id}/tasks/${task._id}`, { method: 'PATCH', body: { status, position } });
        if (backup.status !== status) toast(`« ${task.title} » → ${STATUS[status].label}`);
        refreshProjects();
      } catch (err) {
        Object.assign(task, backup);
        renderBoard();
        toast(err.message, 'error');
      }
    });
  }

  async function refreshTaskDetails(task, readOnly) {
    const root = document.getElementById('task-details');
    if (!root) return;
    const [{ subtasks }, { comments }] = await Promise.all([
      api(`/api/tasks/${task._id}/subtasks`),
      api(`/api/tasks/${task._id}/comments`),
    ]);
    const done = subtasks.filter((s) => s.status === 'DONE').length;
    root.innerHTML = `
      <section class="detail-section">
        <div class="detail-head"><h3>Sous-tâches</h3>${subtasks.length ? `<span class="badge">${done}/${subtasks.length}</span>` : ''}</div>
        ${subtasks.length ? `<div class="bar detail-bar"><span style="width:${(done / subtasks.length) * 100}%;background:var(--st-done)"></span></div>` : ''}
        <div class="subtask-list">${subtasks.map((s) => `
          <div class="subtask-row ${s.status === 'DONE' ? 'done' : ''}">
            <button class="subtask-check" type="button" data-toggle="${s._id}" ${readOnly ? 'disabled' : ''} aria-label="Changer le statut">${s.status === 'DONE' ? icon('check', 'width:12px;height:12px') : ''}</button>
            <span class="grow">${esc(s.title)}</span>
            <span class="badge st-${s.status}">${SUBTASK_STATUS[s.status]}</span>
            ${readOnly ? '' : `<button class="icon-btn" type="button" data-del-sub="${s._id}" aria-label="Supprimer la sous-tâche">${icon('trash')}</button>`}
          </div>`).join('') || '<p class="small muted">Aucune sous-tâche.</p>'}</div>
        ${readOnly ? '' : `<div class="detail-add"><input class="input" id="subtask-title" maxlength="200" placeholder="Nouvelle sous-tâche…"><button class="btn btn-ghost btn-sm" id="add-subtask" type="button">${icon('plus')}Ajouter</button></div>`}
      </section>
      <section class="detail-section">
        <div class="detail-head"><h3>Discussion</h3><span class="badge">${comments.length}</span></div>
        <div class="comment-list">${comments.map((c) => `
          <div class="comment">${avatar({ name: c.author_name, email: '' })}
            <div class="grow"><div><strong>${esc(c.author_name)}</strong><span class="small muted detail-date">${formatDate(c.createdAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></div>
              <p class="comment-body">${esc(c.body)}</p></div></div>`).join('') || '<p class="small muted">Aucun commentaire. Lancez la discussion.</p>'}</div>
        ${readOnly ? '' : `<div class="detail-add"><textarea class="textarea" id="comment-body" maxlength="5000" placeholder="Écrire un commentaire…"></textarea><button class="btn btn-ghost btn-sm" id="add-comment" type="button">Publier</button></div>`}
      </section>`;

    const reload = async () => {
      await refreshTaskDetails(task, readOnly);
      if (document.getElementById('board')) renderBoard();
    };
    root.querySelector('#add-subtask')?.addEventListener('click', async () => {
      const input = root.querySelector('#subtask-title');
      if (!input.value.trim()) return;
      try {
        await api(`/api/tasks/${task._id}/subtasks`, { method: 'POST', body: { title: input.value } });
        await reload();
        toast('Sous-tâche ajoutée.');
      } catch (err) { toast(err.message, 'error'); }
    });
    root.querySelector('#subtask-title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); root.querySelector('#add-subtask')?.click(); }
    });
    root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      const sub = subtasks.find((s) => s._id === b.dataset.toggle);
      try {
        await api(`/api/tasks/${task._id}/subtasks/${sub._id}`, { method: 'PATCH', body: { status: SUBTASK_NEXT[sub.status] } });
        await reload();
      } catch (err) { toast(err.message, 'error'); }
    }));
    root.querySelectorAll('[data-del-sub]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Supprimer la sous-tâche ?', message: 'Elle sera retirée de la discussion.', confirmLabel: 'Supprimer' });
      if (!ok) return;
      try {
        await api(`/api/tasks/${task._id}/subtasks/${b.dataset.delSub}`, { method: 'DELETE' });
        await reload();
        toast('Sous-tâche supprimée.');
      } catch (err) { toast(err.message, 'error'); }
    }));
    root.querySelector('#add-comment')?.addEventListener('click', async () => {
      const input = root.querySelector('#comment-body');
      if (!input.value.trim()) return;
      try {
        await api(`/api/tasks/${task._id}/comments`, { method: 'POST', body: { body: input.value } });
        await reload();
        toast('Commentaire publié.');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function taskModal(task, defaultStatus = 'TODO') {
    const { project } = board;
    const readOnly = !canEdit();
    const canDelete = task && (isAdmin() || (canEdit() && String(task.created_by) === String(state.me._id)));
    const dis = readOnly ? 'disabled' : '';
    const creator = task ? userById(task.created_by) : null;
    openModal({
      title: task ? (readOnly ? 'Détail de la tâche' : 'Modifier la tâche') : 'Nouvelle tâche',
      wide: true,
      body: `<div class="form-grid">
        <label class="field"><span>Titre</span><input class="input" name="title" required maxlength="200" value="${esc(task?.title)}" ${dis} placeholder="ex. Préparer la démo"></label>
        <label class="field"><span>Description</span><textarea class="textarea" name="description" maxlength="10000" ${dis} placeholder="Détails, critères d’acceptation…">${esc(task?.description)}</textarea></label>
        <div class="form-row">
          <label class="field"><span>Statut</span><select class="select" name="status" ${dis}>${STATUSES.map((s) => `<option value="${s.key}" ${(task?.status || defaultStatus) === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
          <label class="field"><span>Priorité</span><select class="select" name="priority" ${dis}>${PRIORITIES.map(([k, v]) => `<option value="${k}" ${(task?.priority || 'MEDIUM') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Assignée à</span><select class="select" name="assigned_to" ${dis}><option value="">Personne</option>${project.members.map((m) => `<option value="${m._id}" ${task?.assigned_to?._id === m._id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Échéance</span><input class="input" type="date" name="due_date" value="${toInputDate(task?.due_date)}" ${dis}></label>
        </div>
        <label class="field"><span>Équipe</span><select class="select" name="team_id" ${dis}><option value="">Aucune équipe</option>${state.teams.map((t) => `<option value="${t._id}" ${task?.team_id?._id === t._id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Étiquettes</span><input class="input" name="tags" value="${esc(task?.tags?.join(', '))}" ${dis} placeholder="front, urgent, client"><small>Séparées par des virgules (10 max).</small></label>
        ${task ? `<p class="small muted">Créée le ${formatDate(task.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}${creator ? ` par ${esc(creator.name)}` : ''} · modifiée le ${formatDate(task.updatedAt, { day: 'numeric', month: 'long' })}</p>` : ''}
      </div>
      ${task ? '<div id="task-details" class="task-details"><p class="small muted">Chargement de la discussion…</p></div>' : ''}`,
      footer: readOnly
        ? '<button class="btn btn-ghost" type="button" data-close>Fermer</button>'
        : `${canDelete ? `<button class="btn btn-danger-ghost" type="button" id="delete-task">${icon('trash')}Supprimer</button>` : ''}<span class="spacer"></span>
           <button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">${task ? 'Enregistrer' : 'Créer la tâche'}</button>`,
      onSubmit: readOnly ? null : async (form) => {
        const data = formToObject(form);
        data.assigned_to = data.assigned_to || null;
        data.due_date = data.due_date || null;
        data.tags = data.tags.split(',').map((s) => s.trim()).filter(Boolean);
        if (task) {
          const { task: updated } = await api(`/api/projects/${project._id}/tasks/${task._id}`, { method: 'PATCH', body: data });
          Object.assign(task, updated);
          toast('Tâche mise à jour.');
        } else {
          const { task: created } = await api(`/api/projects/${project._id}/tasks`, { method: 'POST', body: data });
          board.tasks.push(created);
          toast('Tâche créée.');
        }
        renderBoard();
        refreshProjects();
      },
    });
    if (task) refreshTaskDetails(task, readOnly).catch((err) => toast(err.message, 'error'));
    modal.querySelector('#delete-task')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Supprimer la tâche ?', message: `« ${esc(task.title)} » sera définitivement supprimée.`, confirmLabel: 'Supprimer' });
      if (!ok) return;
      try {
        await api(`/api/projects/${project._id}/tasks/${task._id}`, { method: 'DELETE' });
        board.tasks = board.tasks.filter((t) => t._id !== task._id);
        renderBoard();
        refreshProjects();
        toast('Tâche supprimée.');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function membersModal() {
    const { project } = board;
    openModal({
      title: 'Membres du projet',
      body: `<div class="member-picker" style="max-height:none">${project.members.map((m) => `
        <div class="member-option" style="cursor:default">${avatar(m)}<span class="grow"><strong>${esc(m.name)}</strong><br><span class="small muted">${esc(m.job_title || m.email)}</span></span>
        <span class="small muted">${board.tasks.filter((t) => t.assigned_to?._id === m._id && t.status !== 'DONE').length} tâche(s) ouverte(s)</span></div>`).join('') || '<p class="muted">Aucun membre.</p>'}</div>`,
      footer: `${isAdmin() ? `<button class="btn btn-ghost" type="button" id="manage-members">${icon('users')}Gérer les membres</button><span class="spacer"></span>` : ''}<button class="btn btn-primary" type="button" data-close>Fermer</button>`,
    });
    modal.querySelector('#manage-members')?.addEventListener('click', () => { modal.close(); projectModal(project); });
  }

  // ---------- Équipe ----------
  function renderTeam() {
    view.innerHTML = `
      <div class="page-head"><div><h1>Équipe</h1><p class="sub">${state.users.length} compte${state.users.length > 1 ? 's' : ''} dans ${esc(state.company?.name || 'l’entreprise')}.</p></div>
        ${isAdmin() ? `<div class="actions"><button class="btn btn-primary" id="new-user">${icon('plus')}Ajouter un utilisateur</button></div>` : ''}</div>
      <div class="card table-wrap"><table class="table">
        <thead><tr><th>Nom</th><th class="hide-sm">Email</th><th>Rôle</th><th class="hide-sm">Projets</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
        <tbody>${state.users.map((u) => {
          const nbProjects = state.projects.filter((p) => p.members.some((m) => m._id === u._id)).length;
          const self = u._id === state.me._id;
          return `<tr>
            <td><div class="person">${avatar(u, 'avatar-lg')}<div><strong>${esc(u.name)}${self ? ' <span class="small muted">(vous)</span>' : ''}</strong><span class="small muted">${esc(u.job_title || '—')}</span></div></div></td>
            <td class="hide-sm">${esc(u.email)}</td>
            <td><span class="badge ${ROLE_CLASS[u.role]}">${ROLE_LABEL[u.role]}</span></td>
            <td class="hide-sm muted">${isAdmin() ? nbProjects : '—'}</td>
            ${isAdmin() ? `<td class="actions"><button class="icon-btn" data-edit="${u._id}" aria-label="Modifier ${esc(u.name)}">${icon('edit')}</button>
              ${self ? '' : `<button class="icon-btn" data-delete="${u._id}" aria-label="Supprimer ${esc(u.name)}">${icon('trash')}</button>`}</td>` : ''}
          </tr>`;
        }).join('')}</tbody></table></div>
      ${isAdmin() ? `<div class="section-head" style="padding:24px 0 12px"><div><h2>Sous-équipes</h2><p class="sub small">Regroupez des membres (Dev, BD…) puis associez-les à des projets ou des tâches.</p></div><button class="btn btn-primary" id="new-team">${icon('plus')}Nouvelle équipe</button></div>
      <div class="teams-grid">${state.teams.map((t) => `
        <div class="card team-card" style="--tc:${t.color}">
          <div class="team-card-head"><span class="team-dot"></span><h3>${esc(t.name)}</h3>
            ${isAdmin() ? `<span class="spacer"></span><button class="icon-btn" data-edit-team="${t._id}" aria-label="Modifier ${esc(t.name)}">${icon('edit')}</button><button class="icon-btn" data-del-team="${t._id}" aria-label="Supprimer ${esc(t.name)}">${icon('trash')}</button>` : ''}</div>
          <p class="small muted">${esc(t.description || 'Aucune description.')}</p>
          <div class="foot">${avatarStack(t.members, 4)}<span class="small muted">${state.projects.filter((p) => p.team_id?._id === t._id).length} projet(s)</span></div>
        </div>`).join('') || '<div class="card">'+emptyState('users', 'Aucune sous-équipe', 'Créez une équipe pour organiser vos projets.')+'</div>'}</div>` : ''}
      <p class="small muted" style="margin-top:14px">Rôles : <b>Administrateur</b> gère l’entreprise, les comptes et les projets · <b>Membre</b> crée et modifie les tâches de ses projets · <b>Viewer</b> consulte en lecture seule.</p>`;
    document.getElementById('new-user')?.addEventListener('click', () => userModal());
    view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => userModal(userById(b.dataset.edit))));
    view.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
      const user = userById(b.dataset.delete);
      const ok = await confirmDialog({ title: 'Supprimer ce compte ?', message: `${esc(user.name)} perdra l’accès à l’application. Ses tâches seront désassignées.`, confirmLabel: 'Supprimer' });
      if (!ok) return;
      try {
        await api(`/api/users/${user._id}`, { method: 'DELETE' });
        toast('Utilisateur supprimé.');
        await Promise.all([refreshUsers(), refreshProjects()]);
        renderTeam();
      } catch (err) { toast(err.message, 'error'); }
    }));

    document.getElementById('new-team')?.addEventListener('click', () => teamModal());
    view.querySelectorAll('[data-edit-team]').forEach((b) => b.addEventListener('click', () => {
      teamModal(state.teams.find((t) => t._id === b.dataset.editTeam));
    }));
    view.querySelectorAll('[data-del-team]').forEach((b) => b.addEventListener('click', async () => {
      const team = state.teams.find((t) => t._id === b.dataset.delTeam);
      const ok = await confirmDialog({ title: 'Supprimer l’équipe ?', message: `« ${esc(team.name)} » sera désassociée des projets et des tâches.`, confirmLabel: 'Supprimer' });
      if (!ok) return;
      try {
        await api(`/api/teams/${team._id}`, { method: 'DELETE' });
        await Promise.all([refreshTeams(), refreshProjects()]);
        renderTeam();
        toast('Équipe supprimée.');
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  function teamModal(team = null) {
    const selected = new Set((team?.members || []).map((m) => String(m._id)));
    const color = team?.color || TEAM_COLORS[state.teams.length % TEAM_COLORS.length];
    openModal({
      title: team ? 'Modifier la sous-équipe' : 'Nouvelle sous-équipe',
      wide: true,
      body: `<div class="form-grid">
        <label class="field"><span>Nom de l’équipe</span><input class="input" name="name" required maxlength="80" value="${esc(team?.name)}" placeholder="ex. Dev, BD, Marketing"></label>
        <label class="field"><span>Description</span><textarea class="textarea" name="description" maxlength="500" placeholder="Rôle de l’équipe…">${esc(team?.description)}</textarea></label>
        <div class="field"><span>Couleur</span><div class="color-picker">${TEAM_COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
        <div class="field"><span>Membres</span>
          <div class="member-picker">${state.users.map((u) => `
            <label class="member-option"><input type="checkbox" name="members" value="${u._id}" ${selected.has(String(u._id)) ? 'checked' : ''}>
              ${avatar(u)}<span class="grow"><strong>${esc(u.name)}</strong><br><span class="small muted">${esc(u.job_title || u.email)}</span></span>
              <span class="badge ${ROLE_CLASS[u.role]}">${ROLE_LABEL[u.role]}</span></label>`).join('')}</div>
        </div></div>`,
      footer: `<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">${team ? 'Enregistrer' : 'Créer l’équipe'}</button>`,
      onSubmit: async (form) => {
        const data = formToObject(form);
        data.members = [...form.querySelectorAll('input[name="members"]:checked')].map((i) => i.value);
        if (team) await api(`/api/teams/${team._id}`, { method: 'PUT', body: data });
        else await api('/api/teams', { method: 'POST', body: data });
        await refreshTeams();
        renderTeam();
        toast(team ? 'Équipe mise à jour.' : 'Équipe créée.');
      },
    });
  }

  function userModal(user = null) {
    openModal({
      title: user ? 'Modifier l’utilisateur' : 'Ajouter un utilisateur',
      body: `<div class="form-grid">
        <div class="form-row">
          <label class="field"><span>Nom complet</span><input class="input" name="name" required maxlength="120" value="${esc(user?.name)}"></label>
          <label class="field"><span>Poste</span><input class="input" name="job_title" maxlength="120" value="${esc(user?.job_title)}" placeholder="ex. Développeur"></label>
        </div>
        <label class="field"><span>Adresse email</span><input class="input" type="email" name="email" required value="${esc(user?.email)}"></label>
        <label class="field"><span>Rôle</span><select class="select" name="role">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${(user?.role || 'MEMBER') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>${user ? 'Nouveau mot de passe' : 'Mot de passe temporaire'}</span><input class="input" type="password" name="password" minlength="8" ${user ? '' : 'required'} autocomplete="new-password">
          <small>${user ? 'Laisser vide pour ne pas le changer.' : '8 caractères minimum. À transmettre à la personne avec le code entreprise.'}</small></label>
      </div>`,
      footer: `<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">${user ? 'Enregistrer' : 'Ajouter'}</button>`,
      onSubmit: async (form) => {
        const data = formToObject(form);
        if (user && !data.password) delete data.password;
        if (user) await api(`/api/users/${user._id}`, { method: 'PUT', body: data });
        else await api('/api/users', { method: 'POST', body: data });
        toast(user ? 'Utilisateur modifié.' : `${data.name} a été ajouté(e).`);
        await refreshUsers();
        if (user && user._id === state.me._id) await refreshMe();
        renderTeam();
      },
    });
  }

  function profileModal() {
    const me = state.me;
    openModal({
      title: 'Mon profil',
      body: `<div class="form-grid">
        <div style="display:flex;gap:12px;align-items:center">${avatar(me, 'avatar-lg')}<div><strong>${esc(me.email)}</strong><br><span class="badge ${ROLE_CLASS[me.role]}">${ROLE_LABEL[me.role]}</span></div></div>
        <label class="field"><span>Nom complet</span><input class="input" name="name" required maxlength="120" value="${esc(me.name)}"></label>
        <label class="field"><span>Poste</span><input class="input" name="job_title" maxlength="120" value="${esc(me.job_title)}"></label>
        <label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" name="password" minlength="8" autocomplete="new-password"><small>Laisser vide pour le conserver.</small></label>
      </div>`,
      footer: '<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">Enregistrer</button>',
      onSubmit: async (form) => {
        const data = formToObject(form);
        if (!data.password) delete data.password;
        await api(`/api/users/${me._id}`, { method: 'PUT', body: data });
        await Promise.all([refreshMe(), refreshUsers()]);
        toast('Profil mis à jour.');
        route();
      },
    });
  }

  // ---------- Modèles de projet ----------
  async function renderTemplates() {
    if (!isAdmin()) { location.hash = '#/dashboard'; return; }
    view.innerHTML = `
      <div class="page-head"><div><h1>Modèles de projet</h1><p class="sub">Enregistrez une structure et créez de nouveaux projets en quelques clics.</p></div>
        <div class="actions"><button class="btn btn-primary" id="new-template">${icon('plus')}Nouveau modèle</button></div></div>
      <div class="projects-grid">${state.templates.map((t) => `
        <div class="card project-card" style="--pc:${t.color}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><h3>${esc(t.name)}</h3><span class="badge">${t.tasks.length} tâche${t.tasks.length > 1 ? 's' : ''}</span></div>
          <p class="desc">${esc(t.description || 'Aucune description.')}</p>
          <div class="template-preview">${t.tasks.slice(0, 5).map((task) => `<span class="tag">${esc(task.title)}</span>`).join('') || '<span class="small muted">Aucune tâche initiale</span>'}</div>
          <div class="foot"><button class="btn btn-primary btn-sm" data-create="${t._id}">${icon('plus')}Créer un projet</button>
            <span class="actions"><button class="icon-btn" data-edit-template="${t._id}" aria-label="Modifier le modèle">${icon('edit')}</button>
              <button class="icon-btn" data-del-template="${t._id}" aria-label="Supprimer le modèle">${icon('trash')}</button></span></div>
        </div>`).join('')}</div>
      ${state.templates.length ? '' : `<div class="card">${emptyState('folder', 'Aucun modèle', 'Créez un modèle ou enregistrez la structure d’un projet existant.', '<button class="btn btn-primary" id="new-template-2">Créer un modèle</button>')}</div>`}`;

    view.querySelectorAll('#new-template, #new-template-2').forEach((b) => b.addEventListener('click', () => templateModal()));
    view.querySelectorAll('[data-create]').forEach((b) => b.addEventListener('click', () => {
      templateProjectModal(state.templates.find((t) => t._id === b.dataset.create));
    }));
    view.querySelectorAll('[data-edit-template]').forEach((b) => b.addEventListener('click', () => {
      templateModal(state.templates.find((t) => t._id === b.dataset.editTemplate));
    }));
    view.querySelectorAll('[data-del-template]').forEach((b) => b.addEventListener('click', async () => {
      const template = state.templates.find((t) => t._id === b.dataset.delTemplate);
      const ok = await confirmDialog({ title: 'Supprimer le modèle ?', message: `« ${esc(template.name)} » sera supprimé. Les projets déjà créés ne sont pas affectés.`, confirmLabel: 'Supprimer' });
      if (!ok) return;
      try {
        await api(`/api/templates/${template._id}`, { method: 'DELETE' });
        await refreshTemplates();
        renderTemplates();
        toast('Modèle supprimé.');
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  function templateTaskRow(task = {}) {
    return `<div class="template-task">
      <input class="input" name="task-title" maxlength="200" placeholder="Titre de la tâche" value="${esc(task.title)}">
      <input type="hidden" name="task-description" value="${esc(task.description)}">
      <select class="select" name="task-status" aria-label="Statut initial">${STATUSES.map((s) => `<option value="${s.key}" ${(task.status || 'TODO') === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
      <select class="select" name="task-priority" aria-label="Priorité initiale">${PRIORITIES.map(([k, v]) => `<option value="${k}" ${(task.priority || 'MEDIUM') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input class="input" name="task-tags" placeholder="étiquettes" value="${esc(task.tags?.join(', '))}">
      <button class="icon-btn" type="button" data-remove-task aria-label="Retirer la tâche">${icon('x')}</button>
    </div>`;
  }

  function templateModal(template = null, sourceProject = null) {
    const sourceTasks = template?.tasks || (sourceProject ? board.tasks.map((t) => ({
      title: t.title, description: t.description, status: t.status, priority: t.priority, tags: t.tags,
    })) : []);
    const name = template?.name || (sourceProject ? `${sourceProject.name} (modèle)` : '');
    const description = template?.description ?? sourceProject?.description ?? '';
    const color = template?.color || sourceProject?.color || PROJECT_COLORS[state.templates.length % PROJECT_COLORS.length];
    const form = openModal({
      title: template ? 'Modifier le modèle' : sourceProject ? 'Enregistrer comme modèle' : 'Nouveau modèle',
      wide: true,
      body: `<div class="form-grid">
        <label class="field"><span>Nom du modèle</span><input class="input" name="name" required maxlength="160" value="${esc(name)}" placeholder="ex. Site vitrine"></label>
        <label class="field"><span>Description</span><textarea class="textarea" name="description" maxlength="5000">${esc(description)}</textarea></label>
        <div class="field"><span>Couleur</span><div class="color-picker">${PROJECT_COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
        <div class="field"><span>Tâches initiales</span>
          <div id="template-tasks">${sourceTasks.map(templateTaskRow).join('')}</div>
          <button class="btn btn-ghost btn-sm" id="add-template-task" type="button">${icon('plus')}Ajouter une tâche</button>
          <small>Jusqu’à 50 tâches. Elles seront créées avec le projet.</small>
        </div></div>`,
      footer: `<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">${template ? 'Enregistrer' : 'Créer le modèle'}</button>`,
      onSubmit: async (formElement) => {
        const data = formToObject(formElement);
        data.tasks = [...formElement.querySelectorAll('.template-task')].map((row) => ({
          title: row.querySelector('[name="task-title"]').value,
          description: row.querySelector('[name="task-description"]').value,
          status: row.querySelector('[name="task-status"]').value,
          priority: row.querySelector('[name="task-priority"]').value,
          tags: row.querySelector('[name="task-tags"]').value.split(',').map((s) => s.trim()).filter(Boolean),
        })).filter((t) => t.title.trim());
        if (template) await api(`/api/templates/${template._id}`, { method: 'PUT', body: data });
        else await api('/api/templates', { method: 'POST', body: data });
        await refreshTemplates();
        if (!sourceProject) renderTemplates();
        toast(template ? 'Modèle mis à jour.' : sourceProject ? 'Projet enregistré comme modèle.' : 'Modèle créé.');
      },
    });

    const addTask = () => form.querySelector('#template-tasks').insertAdjacentHTML('beforeend', templateTaskRow());
    form.querySelector('#add-template-task').addEventListener('click', addTask);
    // Délégation : couvre aussi les lignes ajoutées après l'ouverture de la modale.
    form.querySelector('#template-tasks').addEventListener('click', (e) => {
      const button = e.target.closest('[data-remove-task]');
      if (button) button.closest('.template-task').remove();
    });
  }

  function templateProjectModal(template) {
    const selected = new Set([String(state.me._id)]);
    openModal({
      title: `Créer un projet depuis « ${esc(template.name)} »`,
      wide: true,
      body: `<div class="form-grid">
        <label class="field"><span>Nom du projet</span><input class="input" name="name" required maxlength="160" value="${esc(template.name)}"></label>
        <div class="form-row">
          <label class="field"><span>Échéance</span><input class="input" type="date" name="due_date"></label>
          <label class="field"><span>Équipe responsable</span><select class="select" name="team_id"><option value="">Aucune équipe</option>${state.teams.map((t) => `<option value="${t._id}">${esc(t.name)}</option>`).join('')}</select></label>
        </div>
        <div class="field"><span>Membres</span><div class="member-picker">${state.users.map((u) => `
          <label class="member-option"><input type="checkbox" name="members" value="${u._id}" ${selected.has(String(u._id)) ? 'checked' : ''}>
            ${avatar(u)}<span class="grow"><strong>${esc(u.name)}</strong><br><span class="small muted">${esc(u.job_title || u.email)}</span></span></label>`).join('')}</div></div>
        <p class="small muted">${template.tasks.length} tâche${template.tasks.length > 1 ? 's' : ''} initiale${template.tasks.length > 1 ? 's' : ''} sera${template.tasks.length > 1 ? 'ont' : ''} créée${template.tasks.length > 1 ? 's' : ''} avec le projet.</p>
      </div>`,
      footer: `<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-primary" type="submit">Créer le projet</button>`,
      onSubmit: async (form) => {
        const data = formToObject(form);
        data.members = [...form.querySelectorAll('input[name="members"]:checked')].map((i) => i.value);
        data.due_date = data.due_date || null;
        const { project } = await api(`/api/templates/${template._id}/create`, { method: 'POST', body: data });
        await refreshProjects();
        location.hash = `#/projects/${project._id}`;
        toast('Projet créé depuis le modèle.');
      },
    });
  }

  // ---------- Paramètres de l'entreprise ----------
  async function renderSettings() {
    if (!isAdmin()) { location.hash = '#/dashboard'; return; }
    const { company, stats } = await api('/api/company');
    view.innerHTML = `
      <div class="page-head"><div><h1>Entreprise</h1><p class="sub">Informations et paramètres de votre espace.</p></div></div>
      <div class="settings">
        <section class="card card-pad">
          <h2 style="margin-bottom:6px">Code de connexion</h2>
          <p class="muted small" style="margin-bottom:12px">À communiquer aux membres de votre équipe : il leur est demandé à la connexion.</p>
          <div class="code-box"><code id="slug">${esc(company.slug)}</code><button class="btn btn-ghost btn-sm" id="copy-slug">${icon('copy')}Copier</button></div>
          <div class="mini-stats"><div><b>${stats.users}</b><span class="small muted">utilisateurs</span></div><div><b>${stats.projects}</b><span class="small muted">projets</span></div><div><b>${stats.tasks}</b><span class="small muted">tâches</span></div></div>
        </section>
        <section class="card card-pad">
          <h2 style="margin-bottom:16px">Informations</h2>
          <form id="company-form" class="form-grid" novalidate>
            <label class="field"><span>Nom de l’entreprise</span><input class="input" name="name" required maxlength="120" value="${esc(company.name)}"></label>
            <label class="field"><span>Description</span><textarea class="textarea" name="description" maxlength="1000">${esc(company.description)}</textarea></label>
            <p class="form-error" role="alert"></p>
            <div><button class="btn btn-primary" type="submit">Enregistrer</button></div>
          </form>
        </section>
        <section class="card card-pad danger-zone">
          <h2 style="margin-bottom:6px">Zone de danger</h2>
          <p class="muted" style="margin-bottom:14px">Supprimer l’entreprise efface définitivement tous ses utilisateurs, projets et tâches.</p>
          <button class="btn btn-danger" id="delete-company">${icon('trash')}Supprimer l’entreprise</button>
        </section>
      </div>`;

    document.getElementById('copy-slug').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(company.slug); toast('Code copié.'); } catch { toast('Copie impossible, sélectionnez le code manuellement.', 'error'); }
    });
    document.getElementById('company-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const error = form.querySelector('.form-error');
      error.textContent = '';
      const button = form.querySelector('[type="submit"]');
      setBusy(button, true);
      try {
        const { company: updated } = await api('/api/company', { method: 'PUT', body: formToObject(form) });
        state.company = { ...state.company, name: updated.name, description: updated.description };
        Session.set({ ...Session.get(), company: state.company });
        renderSidebar();
        toast('Entreprise mise à jour.');
      } catch (err) { error.textContent = err.message; } finally { setBusy(button, false); }
    });
    document.getElementById('delete-company').addEventListener('click', () => {
      openModal({
        title: 'Supprimer l’entreprise',
        body: `<p class="muted" style="margin-bottom:14px">Cette action est <b>irréversible</b>. Tapez <b>${esc(company.name)}</b> pour confirmer.</p>
               <label class="field"><span>Nom de l’entreprise</span><input class="input" name="confirm" required autocomplete="off"></label>`,
        footer: '<button class="btn btn-ghost" type="button" data-close>Annuler</button><button class="btn btn-danger" type="submit">Supprimer définitivement</button>',
        onSubmit: async (form) => {
          await api('/api/company', { method: 'DELETE', body: { confirm: form.confirm.value } });
          Session.clear();
          window.location.replace('/');
        },
      });
    });
  }

  // ---------- Calendrier des échéances ----------
  let calendar = { cursor: new Date(), tasks: [], priority: '' };
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function calendarTasks() {
    return calendar.priority ? calendar.tasks.filter((t) => t.priority === calendar.priority) : calendar.tasks;
  }

  function openCalendarTask(taskId) {
    const task = calendar.tasks.find((t) => t._id === taskId);
    if (task?.project_id?._id) location.hash = `#/projects/${task.project_id._id}?task=${taskId}`;
  }

  async function renderCalendar(cursor = calendar.cursor) {
    const { tasks } = await api('/api/tasks');
    calendar.cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    calendar.tasks = tasks;

    const year = calendar.cursor.getFullYear();
    const month = calendar.cursor.getMonth();
    const monthLabel = calendar.cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const offset = (new Date(year, month, 1).getDay() + 6) % 7; // semaine commençant le lundi
    const cells = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
    const todayKey = dateKey(new Date());
    const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const byDay = {};
    calendarTasks().forEach((t) => {
      if (!t.due_date) return;
      const key = String(t.due_date).slice(0, 10); // date stockée (UTC), sans décalage lié au fuseau
      (byDay[key] ||= []).push(t);
    });
    Object.values(byDay).forEach((list) => list.sort((a, b) =>
      (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4) || String(a.title).localeCompare(String(b.title))));

    const dayHtml = (date) => {
      const key = dateKey(date);
      const list = byDay[key] || [];
      const classes = ['cal-day'];
      if (date.getMonth() !== month) classes.push('other');
      if (key === todayKey) classes.push('today');
      return `<div class="${classes.join(' ')}">
        <div class="cal-day-n">${date.getDate()}</div>
        ${list.slice(0, 3).map((t) => `
          <button class="cal-task ${t.priority === 'URGENT' ? 'urgent' : ''}" type="button" data-task="${t._id}" title="${esc(t.title)} — ${esc(t.project_id?.name || '')}">
            ${priorityBadge(t.priority)}<span class="cal-task-title">${esc(t.title)}</span>
          </button>`).join('')}
        ${list.length > 3 ? `<span class="cal-more">+ ${list.length - 3} autre${list.length > 4 ? 's' : ''}</span>` : ''}
      </div>`;
    };

    const undated = calendarTasks().filter((t) => !t.due_date);
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Calendrier</h1><p class="sub">Échéances des tâches de vos projets · les priorités Urgentes sont mises en évidence.</p></div>
      </div>
      <div class="toolbar">
        <button class="btn btn-ghost btn-sm" id="cal-today">Aujourd’hui</button>
        <button class="icon-btn" id="cal-prev" type="button" aria-label="Mois précédent">${icon('chevronLeft')}</button>
        <strong id="cal-month">${esc(monthLabel)}</strong>
        <button class="icon-btn" id="cal-next" type="button" aria-label="Mois suivant">${icon('chevronRight')}</button>
        <span class="spacer"></span>
        <select class="select" id="cal-priority" aria-label="Filtrer par priorité"><option value="">Toutes les priorités</option>${PRIORITIES.map(([k, v]) => `<option value="${k}" ${calendar.priority === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="cal-scroll"><div class="cal-grid">
        ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => `<div class="cal-weekday">${d}</div>`).join('')}
        ${Array.from({ length: cells }, (_, i) => dayHtml(new Date(year, month, 1 - offset + i))).join('')}
      </div></div>
      ${undated.length ? `<section class="card cal-undated">
        <div class="section-head"><h2>Sans échéance</h2><span class="badge">${undated.length}</span></div>
        <div class="cal-undated-list">${undated.slice(0, 12).map((t) => `
          <button class="cal-undated-item ${t.priority === 'URGENT' ? 'urgent' : ''}" type="button" data-task="${t._id}">
            ${priorityBadge(t.priority)}<span>${esc(t.title)}</span><span class="small muted">${esc(t.project_id?.name || '')}</span>
          </button>`).join('')}</div>
      </section>` : ''}`;

    view.querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', () => openCalendarTask(b.dataset.task)));
    document.getElementById('cal-prev').addEventListener('click', () => renderCalendar(new Date(year, month - 1, 1)));
    document.getElementById('cal-next').addEventListener('click', () => renderCalendar(new Date(year, month + 1, 1)));
    document.getElementById('cal-today').addEventListener('click', () => renderCalendar(new Date()));
    document.getElementById('cal-priority').addEventListener('change', (e) => {
      calendar.priority = e.target.value;
      renderCalendar(calendar.cursor);
    });
  }

  // ---------- Routeur ----------
  async function route() {
    const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [section, id] = path.split('/');
    const params = new URLSearchParams(query);
    highlightNav();
    document.getElementById('layout').classList.remove('nav-open');
    if (modal.open) modal.close();
    try {
      if (section === 'projects' && id) await renderProject(id, params);
      else if (section === 'projects') renderProjects();
      else if (section === 'calendar') await renderCalendar();
      else if (section === 'team') renderTeam();
      else if (section === 'teams') renderTeam();
      else if (section === 'templates') await renderTemplates();
      else if (section === 'settings') await renderSettings();
      else await renderDashboard();
      document.title = `${view.querySelector('h1')?.textContent || 'Plania'} · Plania`;
    } catch (err) {
      view.innerHTML = `<div class="card">${emptyState('alert', 'Oups', esc(err.message), '<a class="btn btn-ghost" href="#/dashboard">Retour au tableau de bord</a>')}</div>`;
    }
  }

  async function refreshMe() {
    const { user, company } = await api('/api/auth/me');
    state.me = user;
    state.company = company;
    Session.set({ ...Session.get(), user, company });
    renderSidebar();
  }

  // ---------- Démarrage ----------
  document.getElementById('logout').addEventListener('click', () => { Session.clear(); window.location.replace('/'); });
  document.getElementById('me').addEventListener('click', profileModal);
  document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('layout').classList.toggle('nav-open'));
  window.addEventListener('hashchange', route);

  (async () => {
    renderSidebar();
    try {
      await refreshMe(); // rôle à jour même s'il a changé depuis la connexion
      await Promise.all([refreshUsers(), refreshProjects(), refreshTeams(), isAdmin() ? refreshTemplates() : Promise.resolve()]);
    } catch (err) { toast(err.message, 'error'); }
    route();
  })();
})();
