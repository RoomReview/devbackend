import crypto from 'node:crypto';

interface VerificationCode {
  code: string;
  expiresAt: Date;
  hashedCode: string;
}
const expirationMinutes = 15;

export const hashCode = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

export const generateVerificationCode = (): VerificationCode => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  const hashedCode = hashCode(code);

  return {
    code,
    expiresAt,
    hashedCode,
  };
};

export const generatePasswordResetToken = (): VerificationCode => {
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  const hashedCode = hashCode(code);

  return { code, expiresAt, hashedCode };
};

export const verifyCode = (
  providedCode: string,
  hashedCode: string,
): boolean => {
  const providedHash = Buffer.from(hashCode(providedCode), 'hex');
  if (!/^[a-f0-9]{64}$/i.test(hashedCode)) {
    return false;
  }
  return crypto.timingSafeEqual(providedHash, Buffer.from(hashedCode, 'hex'));
};

export const isCodeExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};
