import {
  findDownloadHistoryById,
  findAllDownloadHistoryByUserCreditsId,
  countDownloadHistoryByUserCreditsId,
} from '@/repositories/download-history.repository';
import { getUserCreditsByUserId } from '@/services/user-credits.service';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateDownloadHistoryDto } from '@/dto/download-history.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';
import { TransactionType } from '@/generated/prisma/enums';
import prisma from '@config/database';

export const logDownload = async (userId: string, data: CreateDownloadHistoryDto) => {
  const credits = await getUserCreditsByUserId(userId);

  if (credits.creditsBalance < data.creditsUsed) {
    throw new ValidationError({
      message: `Insufficient credit balance. Available: ${credits.creditsBalance}, Required: ${data.creditsUsed}`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Deduct user credits
    const updatedCredits = await tx.userCredits.update({
      where: { userCreditsId: credits.userCreditsId },
      data: {
        creditsBalance: {
          decrement: data.creditsUsed,
        },
      },
    });

    // 2. Create transaction record
    await tx.creditTransaction.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        amount: -data.creditsUsed,
        type: TransactionType.DOWNLOAD,
        description: `Download of ${data.reportType} report in ${data.format} format`,
        balanceAfter: updatedCredits.creditsBalance,
      },
    });

    // 3. Log download history
    return await tx.downloadHistory.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        reportType: data.reportType,
        format: data.format,
        postcode: data.postcode,
        borough: data.borough,
        creditsUsed: data.creditsUsed,
      },
    });
  });
};

export const getDownloadById = async (id: string) => {
  const download = await findDownloadHistoryById(id);
  if (!download) {
    throw new EntityNotFoundError({
      message: `Download history with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return download;
};

export const getUserDownloads = async (userId: string, page: number, limit: number) => {
  const credits = await getUserCreditsByUserId(userId);
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllDownloadHistoryByUserCreditsId(credits.userCreditsId, limit, offset),
    countDownloadHistoryByUserCreditsId(credits.userCreditsId),
  ]);
  return buildPaginatedResult(items, total, page, limit);
};
