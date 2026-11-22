const { User } = require('../models/User');

class UserRepository {
  findByEmail(email, { withPassword = false } = {}) {
    const q = User.findOne({ email: String(email).toLowerCase() });
    return withPassword ? q.select('+passwordHash') : q;
  }

  findById(id) {
    return User.findById(id);
  }

  create(data) {
    return User.create(data);
  }

  upsertByEmail(email, data) {
    return User.findOneAndUpdate({ email }, { $set: data }, { upsert: true, returnDocument: 'after' });
  }
}

module.exports = UserRepository;
