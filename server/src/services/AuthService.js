const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

class AuthService {
  constructor({ userRepository, jwtSecret, jwtExpiresIn }) {
    this.users = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }

  signToken(user) {
    return jwt.sign({ sub: String(user._id), role: user.role, name: user.name }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  async register({ name, email, password, role, phone }) {
    if (await this.users.findByEmail(email)) throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.create({ name, email, passwordHash, role, phone });
    return { user, token: this.signToken(user) };
  }

  async login({ email, password }) {
    const user = await this.users.findByEmail(email, { withPassword: true });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw AppError.unauthorized('Invalid email or password');
    return { user, token: this.signToken(user) };
  }

  async me(userId) {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unauthorized('User no longer exists');
    return user;
  }
}

module.exports = AuthService;
