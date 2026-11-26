const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');
const connectDB = require('./config/db');
const seedDemo = require('./seed/demo');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// Sonde utilisée par le healthcheck Docker.
app.get('/health', (req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'db_unavailable' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/company', require('./routes/company'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/templates', require('./routes/templates'));

app.use('/api', notFound);
// Toute autre URL renvoie l'interface (routage côté client).
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    if (config.seedDemo) await seedDemo();
    app.listen(config.port, '0.0.0.0', () => console.log(`Serveur démarré sur le port ${config.port}.`));
  } catch (error) {
    console.error('Impossible de démarrer l’application :', error.message);
    process.exit(1);
  }
}

start();
