const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE_NAME = 'hr_gov_token';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role?.code || user.roleCode,
      username: user.username,
      tv: user.tokenVersion,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken, COOKIE_NAME };