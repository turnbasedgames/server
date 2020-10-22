const jwt = require('jsonwebtoken');

const User = require('src/models/user');

// TODO: setup way to retrieve secret
const JWT_PRIV_KEY = 'secret';
const JWT_ACCESS_EXPIRATION = '15m';
const JWT_REFRESH_EXPIRATION = '365d';
const JWT_TOKEN_TYPE = Object.freeze({ REFRESH: 'REFRESH', ACCESS: 'ACCESS' });

async function signUpLocal(req, res, next) {
  const user = new User(req.body.user);
  await user.save();
  req.user = user;
  next();
}

async function loginLocal(req, res, next) {
  const { username, password } = req.body;
  const user = await User.findOne({ username }).select('+password');
  if (user && await user.authenticate(password)) {
    req.user = user;
    return next();
  }
  throw Error('Invalid username and/or password');
}

async function jwtTokenAuth(type, req, res, next) {
  const rawToken = req.headers && req.headers.authorization.split(' ')[1];
  const token = jwt.verify(rawToken, JWT_PRIV_KEY);
  const expirationDate = new Date(token.exp * 1000);
  if (token.type !== type) {
    throw Error('Invalid token type');
  }
  if (expirationDate < new Date()) {
    throw Error('Expired token');
  }
  const user = await User.findOne({ _id: token.userId });
  if (user) {
    if (user.tokenVersion !== token.version) {
      throw Error('Invalid token version');
    }
    req.user = user;
    return next();
  }
  throw Error('User specified by token does not exist');
}

function jwtAccessTokenAuth(req, res, next) {
  return jwtTokenAuth(JWT_TOKEN_TYPE.ACCESS, req, res, next);
}

function jwtRefreshTokenAuth(req, res, next) {
  return jwtTokenAuth(JWT_TOKEN_TYPE.REFRESH, req, res, next);
}

function issueJWT(doc, options) {
  return jwt.sign(doc, JWT_PRIV_KEY, options);
}

function issueAccessJWT(user) {
  return issueJWT({
    userId: user.id,
    type: JWT_TOKEN_TYPE.ACCESS,
    version: user.tokenVersion,
  }, { expiresIn: JWT_ACCESS_EXPIRATION });
}

function issueRefreshJWT(user) {
  return issueJWT({
    userId: user.id,
    type: JWT_TOKEN_TYPE.REFRESH,
    version: user.tokenVersion,
  }, { expiresIn: JWT_REFRESH_EXPIRATION });
}

module.exports = {
  signUpLocal,
  loginLocal,
  jwtAccessTokenAuth,
  jwtRefreshTokenAuth,
  issueAccessJWT,
  issueRefreshJWT,
};
