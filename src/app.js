const path = require('path');
require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const projectRoutes = require('./routes/project');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/auth', authRoutes);
app.use('/company', companyRoutes);
app.use('/projects', projectRoutes);
app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use((error, req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Une erreur interne est survenue.' });
});

async function start() {
  try {
    await connectDB();
    app.listen(port, '0.0.0.0', () => console.log(`Serveur démarré sur le port ${port}.`));
  } catch (error) {
    console.error('Impossible de démarrer l’application :', error.message);
    process.exit(1);
  }
}
start();
