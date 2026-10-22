import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128)
    throw new Error('Use uma senha de teste com 12 a 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt);
  return `scrypt:32768:8:3:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [kind, n, r, p, salt, expected] = hash.split(':');
  if (
    kind !== 'scrypt' ||
    n !== '32768' ||
    r !== '8' ||
    p !== '3' ||
    !salt ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !expected ||
    !/^[a-f0-9]{128}$/.test(expected)
  )
    return false;
  const key = await scrypt(password, salt);
  return timingSafeEqual(key, Buffer.from(expected, 'hex'));
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
