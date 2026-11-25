// Jeu de données de démonstration, créé au démarrage si SEED_DEMO=true et si la base est vide.
// Deux entreprises sont créées pour pouvoir vérifier l'isolation entre elles.
const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');

const PASSWORD = 'demo1234';
const day = (n) => new Date(Date.now() + n * 86400000);

async function createCompany({ name, slug, description, users, projects }) {
  const company = await Company.create({ name, slug, description });
  const hash = await bcrypt.hash(PASSWORD, 10);
  const created = await User.insertMany(users.map((u) => ({ ...u, company_id: company._id, password_hash: hash })));
  const byKey = Object.fromEntries(created.map((u, i) => [users[i].key || u.email, u]));
  const admin = created[0];

  for (const p of projects) {
    // eslint-disable-next-line no-await-in-loop
    const project = await Project.create({
      company_id: company._id,
      name: p.name,
      description: p.description,
      color: p.color,
      status: p.status || 'ACTIVE',
      due_date: p.due_date || null,
      members: p.members.map((k) => byKey[k]._id),
      created_by: admin._id,
    });
    const positions = {};
    // eslint-disable-next-line no-await-in-loop
    await Task.insertMany(p.tasks.map((t) => {
      positions[t.status] = (positions[t.status] ?? -1) + 1;
      return {
        company_id: company._id,
        project_id: project._id,
        title: t.title,
        description: t.description || '',
        status: t.status,
        priority: t.priority || 'MEDIUM',
        assigned_to: t.to ? byKey[t.to]._id : null,
        due_date: t.due ?? null,
        tags: t.tags || [],
        position: positions[t.status],
        created_by: admin._id,
      };
    }));
  }
}

async function seedDemo() {
  if (await Company.estimatedDocumentCount() > 0) return;
  console.log('Base vide : création des données de démonstration…');

  await createCompany({
    name: 'Acme Studio',
    slug: 'acme',
    description: 'Agence web de démonstration.',
    users: [
      { key: 'alice', name: 'Alice Martin', email: 'alice@acme.fr', role: 'ADMIN', job_title: 'Cheffe de projet' },
      { key: 'bob', name: 'Bob Leroy', email: 'bob@acme.fr', role: 'MEMBER', job_title: 'Développeur back-end' },
      { key: 'chloe', name: 'Chloé Bernard', email: 'chloe@acme.fr', role: 'MEMBER', job_title: 'Designer UI' },
      { key: 'david', name: 'David Petit', email: 'david@acme.fr', role: 'VIEWER', job_title: 'Client' },
    ],
    projects: [
      {
        name: 'Application mobile',
        description: 'Première version de l’application de prise de rendez-vous.',
        color: '#6366f1',
        members: ['alice', 'bob'],
        tasks: [
          { title: 'Choisir le framework (Flutter / React Native)', status: 'DONE', to: 'bob' },
          { title: 'API d’authentification', status: 'IN_PROGRESS', priority: 'HIGH', to: 'bob', due: day(-1), tags: ['back'] },
          { title: 'Écran de connexion', status: 'TODO', to: 'alice' },
        ],
      },
      {
        name: 'Refonte du site vitrine',
        description: 'Nouvelle charte graphique et migration vers un site responsive.',
        color: '#ef5b3c',
        due_date: day(30),
        members: ['alice', 'bob', 'chloe', 'david'],
        tasks: [
          { title: 'Atelier de cadrage avec le client', status: 'DONE', priority: 'HIGH', to: 'alice', tags: ['cadrage'] },
          { title: 'Maquettes de la page d’accueil', status: 'REVIEW', priority: 'HIGH', to: 'chloe', due: day(2), tags: ['design'] },
          { title: 'Intégration du header et du footer', status: 'IN_PROGRESS', to: 'bob', due: day(5), tags: ['front'] },
          { title: 'Formulaire de contact', description: 'Validation côté serveur + envoi d’un email.', status: 'TODO', to: 'bob', due: day(9), tags: ['back'] },
          { title: 'Optimiser les images', status: 'TODO', priority: 'LOW', tags: ['perf'] },
          { title: 'Recette sur mobile', status: 'TODO', to: 'chloe', due: day(14) },
        ],
      },
    ],
  });

  await createCompany({
    name: 'Globex',
    slug: 'globex',
    description: 'Seconde entreprise pour tester l’isolation des données.',
    users: [
      { key: 'emma', name: 'Emma Durand', email: 'emma@globex.fr', role: 'ADMIN', job_title: 'CTO' },
      { key: 'alice2', name: 'Alice Martin', email: 'alice@acme.fr', role: 'MEMBER', job_title: 'Consultante' },
    ],
    projects: [
      {
        name: 'Migration ERP',
        description: 'Projet interne confidentiel de Globex.',
        color: '#16a34a',
        members: ['emma', 'alice2'],
        tasks: [
          { title: 'Inventaire des données existantes', status: 'IN_PROGRESS', to: 'emma' },
          { title: 'Plan de migration', status: 'TODO', to: 'alice2' },
        ],
      },
    ],
  });

  console.log(`Données de démo créées (mot de passe : ${PASSWORD}).`);
}

module.exports = seedDemo;
