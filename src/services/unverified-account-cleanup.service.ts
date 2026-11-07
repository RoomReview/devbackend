import prisma from '@config/database';
import logger from '@/utils/logger';

const ACCOUNT_VERIFICATION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

type DeleteExpiredUsers = (cutoff: Date) => Promise<{ count: number }>;

const deleteExpiredUsers: DeleteExpiredUsers = (cutoff) =>
  prisma.user.deleteMany({
    where: {
      isEmailVerified: false,
      createdAt: { lte: cutoff },
    },
  });

export const cleanupUnverifiedAccounts = async (
  now = new Date(),
  deleteUsers: DeleteExpiredUsers = deleteExpiredUsers,
): Promise<number> => {
  const cutoff = new Date(now.getTime() - ACCOUNT_VERIFICATION_WINDOW_MS);
  const { count } = await deleteUsers(cutoff);
  return count;
};

let workerStarted = false;

export const startUnverifiedAccountCleanupWorker = (): void => {
  if (workerStarted) {
    return;
  }
  workerStarted = true;

  const run = async () => {
    try {
      const deletedCount = await cleanupUnverifiedAccounts();
      if (deletedCount > 0) {
        logger.info(
          { service: 'UnverifiedAccountCleanup', function: 'run' },
          'Expired unverified accounts deleted',
          { deletedCount },
        );
      }
    } catch (error) {
      logger.error(
        { service: 'UnverifiedAccountCleanup', function: 'run' },
        'Unverified account cleanup failed; retry scheduled',
        { error },
      );
    } finally {
      setTimeout(() => {
        void run();
      }, CLEANUP_INTERVAL_MS).unref();
    }
  };

  void run();
};
