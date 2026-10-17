import prisma from '@config/database';
import logger, { LogContext } from '@/utils/logger';
import { InternalServerError } from '@/utils/custom-error';

const logContext: LogContext = {
  service: 'SsoLoginCodeRepository',
  function: '',
};

export const createSsoLoginCode = async (
  codeHash: string,
  userId: string,
  expiresAt: Date,
): Promise<void> => {
  logContext.function = 'createSsoLoginCode';
  try {
    await prisma.$executeRaw`
      DELETE FROM "sso_login_codes" WHERE "expires_at" <= CURRENT_TIMESTAMP
    `;
    await prisma.$executeRaw`
      INSERT INTO "sso_login_codes" ("code_hash", "user_id", "expires_at", "created_at", "updated_at")
      VALUES (${codeHash}, ${userId}, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
  } catch (error) {
    logger.error(logContext, 'Error creating SSO login code', { error });
    throw new InternalServerError({
      message: 'Unable to create SSO login code',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
};

export const consumeSsoLoginCode = async (
  codeHash: string,
): Promise<string | null> => {
  logContext.function = 'consumeSsoLoginCode';
  try {
    return await prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ userId: string }>>`
        SELECT "user_id" AS "userId"
        FROM "sso_login_codes"
        WHERE "code_hash" = ${codeHash}
          AND "expires_at" > CURRENT_TIMESTAMP
        FOR UPDATE
      `;
      const code = rows[0];
      if (!code) {
        return null;
      }

      const deleted = await transaction.$executeRaw`
        DELETE FROM "sso_login_codes" WHERE "code_hash" = ${codeHash}
      `;
      return deleted === 1 ? code.userId : null;
    });
  } catch (error) {
    logger.error(logContext, 'Error consuming SSO login code', { error });
    throw new InternalServerError({
      message: 'Unable to exchange SSO login code',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
};
