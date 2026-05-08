// TODO: TEMP DEV MODE — restore bcrypt before production.

export function isBcryptHash(value) {
  return false;
}

export async function hashPassword(password) {
  // TODO: TEMP DEV MODE — restore bcrypt hashing before production.
  return String(password || '');
}

export async function comparePassword(password, hashedPassword) {
  // TODO: TEMP DEV MODE — restore bcrypt compare before production.
  return String(password || '') === String(hashedPassword || '');
}

