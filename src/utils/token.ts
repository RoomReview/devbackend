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

export const verifyCode = (
  providedCode: string,
  hashedCode: string,
): boolean => {
  return hashCode(providedCode) === hashedCode;
};

export const isCodeExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};
