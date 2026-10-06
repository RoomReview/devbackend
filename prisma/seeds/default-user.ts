import { parseArgs } from 'node:util';

import prisma from '../../src/config/database';
import logger, { type LogContext } from '../../src/utils/logger';
import { hashPassword } from '../../src/utils/password';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_NAME = 'default-user';

const logCtx: LogContext = { service: 'Seed', function: SEED_NAME };

// ─── CLI args ─────────────────────────────────────────────────────────────────

const options = {
  environment: { type: 'string', default: 'development' },
} as const;

const {
  values: { environment },
} = parseArgs({ options, strict: false });

// ─── Credential resolution ────────────────────────────────────────────────────

function resolveCredentials(): {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
} {
  const email = process.env.DEFAULT_USER_EMAIL?.trim();
  const password = process.env.DEFAULT_USER_PASSWORD;

  if (!email || !password) {
    logger.error(
      logCtx,
      'DEFAULT_USER_EMAIL and DEFAULT_USER_PASSWORD must be set before running this seed.',
    );
    process.exit(1);
  }

  return {
    email,
    password,
    firstName: process.env.DEFAULT_USER_FIRST_NAME?.trim() || 'Admin',
    lastName: process.env.DEFAULT_USER_LAST_NAME?.trim() || 'User',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info(logCtx, 'Seeding default admin user.', { environment });
  if (typeof environment !== 'string') {
    logger.error(logCtx, 'Environment must be a string.');
    process.exit(1);
  }
  const { email, password, firstName, lastName } = resolveCredentials();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    logger.info(logCtx, `Default admin user already exists.`, { email });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
      verifiedAt: new Date(),
    },
    select: {
      userId: true,
      email: true,
      role: true,
    },
  });

  logger.info(logCtx, 'Default admin user created successfully.', { user });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error(logCtx, 'Seed failed.', { error: e });
    await prisma.$disconnect();
    process.exit(1);
  });

export default null;
