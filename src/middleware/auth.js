const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { httpError } = require('../utils/http');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), company_id: user.company_id.toString(), role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// Vérifie le JWT puis recharge l'utilisateur en base : un compte supprimé ou dont le rôle
// a changé est pris en compte immédiatement, sans attendre l'expiration du jeton.
async function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.get('authorization') || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw httpError(401, 'Authentification requise.');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (_error) {
      throw httpError(401, 'Session expirée, merci de vous reconnecter.');
    }

    const user = await User.findOne({ _id: payload.sub, company_id: payload.company_id });
    if (!user) throw httpError(401, 'Ce compte n’existe plus.');

    // req.auth est la seule source du company_id pour toutes les requêtes : isolation des entreprises.
    req.auth = { userId: user._id, companyId: user.company_id, role: user.role };
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) {
      return next(httpError(403, 'Vous n’avez pas les droits nécessaires pour cette action.'));
    }
    return next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
