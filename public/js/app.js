/* Application principale (SPA légère, routage par hash). */
(() => {
  const session = Session.get();
  if (!session?.token) { window.location.replace('/'); return; }

  // ---------- État global ----------
  const state = { me: session.user, company: session.company, users: [], projects: [] };
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
  const PRIORITY_LABEL = { HIGH: 'Haute', MEDIUM: 'Moyenne', LOW: 'Basse' };
  const PROJECT_STATUS = { ACTIVE: 'Actif', ON_HOLD: 'En pause', ARCHIVED: 'Archivé' };
  const PROJECT_COLORS = ['#ef5b3c', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#d946ef', '#64748b'];

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
  };
  const icon = (name, style = '') => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${style}">${ICONS[name]}</svg>`;

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
  async function refreshProjects() { state.projects = (await api('/api/projects')).projects; renderSidebarProjects(); }

  function renderSidebar() {
    const { me, company } = state;
    document.getElementById('company-name').textContent = company?.name || '—';
    document.getElementById('company-slug').textContent = company?.slug ? `Code : ${company.slug}` : '';
    document.getElementById('company-logo').textContent = initials(company?.name || '?');
    document.getElementById('nav-settings').hidden = !isAdmin();
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
              <span class="badge prio-${t.priority} hide-sm">${PRIORITY_LABEL[t.priority]}</span>
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
          <button class="btn btn-danger-ghost" id="delete-project" aria-label="Supprimer le projet">${icon('trash')}</button>` : ''}
          ${canEdit() ? `<button class="btn btn-primary" id="new-task">${icon('plus')}Nouvelle tâche</button>` : ''}
        </div>
      </div>
      ${canEdit() ? '' : `<div class="readonly-note">${icon('eye')}Vous avez un accès en lecture seule (Viewer) : vous pouvez consulter les tâches sans les modifier.</div>`}
      <div class="toolbar">
        <label class="search"><span class="sr-only">Rechercher</span>${icon('search')}<input class="input" id="f-q" placeholder="Rechercher une tâche…"></label>
        <select class="select" id="f-assignee" aria-label="Filtrer par membre"><option value="">Tous les membres</option><option value="none">Non assignées</option>${project.members.map((m) => `<option value="${m._id}">${esc(m.name)}</option>`).join('')}</select>
        <select class="select" id="f-priority" aria-label="Filtrer par priorité"><option value="">Toutes priorités</option>${Object.entries(PRIORITY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
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
    return `<article class="task-card" tabindex="0" data-id="${t._id}" ${canEdit() ? 'draggable="true"' : ''}>
      <div class="top"><span class="badge prio-${t.priority}">${PRIORITY_LABEL[t.priority]}</span>${t.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join('')}</div>
      <div class="t" style="${done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</div>
      ${t.description ? `<div class="d">${esc(t.description)}</div>` : ''}
      <div class="bottom">
        ${t.due_date ? `<span class="due ${isOverdue(t.due_date) && !done ? 'late' : ''}">${icon('calendar')}${formatDate(t.due_date)}</span>` : '<span></span>'}
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
          <label class="field"><span>Priorité</span><select class="select" name="priority" ${dis}>${Object.entries(PRIORITY_LABEL).map(([k, v]) => `<option value="${k}" ${(task?.priority || 'MEDIUM') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Assignée à</span><select class="select" name="assigned_to" ${dis}><option value="">Personne</option>${project.members.map((m) => `<option value="${m._id}" ${task?.assigned_to?._id === m._id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Échéance</span><input class="input" type="date" name="due_date" value="${toInputDate(task?.due_date)}" ${dis}></label>
        </div>
        <label class="field"><span>Étiquettes</span><input class="input" name="tags" value="${esc(task?.tags?.join(', '))}" ${dis} placeholder="front, urgent, client"><small>Séparées par des virgules (10 max).</small></label>
        ${task ? `<p class="small muted">Créée le ${formatDate(task.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}${creator ? ` par ${esc(creator.name)}` : ''} · modifiée le ${formatDate(task.updatedAt, { day: 'numeric', month: 'long' })}</p>` : ''}
      </div>`,
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
      else if (section === 'team') renderTeam();
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
      await Promise.all([refreshUsers(), refreshProjects()]);
    } catch (err) { toast(err.message, 'error'); }
    route();
  })();
})();
