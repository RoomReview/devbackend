import config from '@/config';
import { randomBytes, scryptSync } from 'node:crypto';

const validateSalt = (salt: string) => {
//   return typeof salt === 'string' && salt.length === config.saltKeyLength * 2; // Each byte is represented by 2 hex characters
  return typeof salt === 'string' && salt.length === config.saltKeyLength * 2; // Each byte is represented by 2 hex characters
};

const generateSalt = (length: number = config.saltKeyLength) => {
  return randomBytes(length).toString('hex');
};

/**
   * Generates a salt and hashes the password.
   * Returns a string in the format "salt:hash" for easy database storage.
*/
export const hashPassword = async (
  password: string,
  salt?: string,
): Promise<string> => {
    if (!salt || !validateSalt(salt)) {
      salt = generateSalt();
    }
    const hash = await scryptSync(password, salt, config.passwordHashLength) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
};

/**
   * Compares a plain-text password against a stored "salt:hash" string.
*/ 
export const comparePassword = async (
  password: string,
  storedHash: string
): Promise<boolean> => {
  const [salt, hash] = storedHash.split(':');
  if (!validateSalt(salt)) {
    return false;
  }
  const hashToCompare = await scryptSync(password, salt, config.passwordHashLength) as Buffer;
  return hashToCompare.toString('hex') === hash;
};