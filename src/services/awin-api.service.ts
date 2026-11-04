import config from '@config/index';
import { InternalServerError, ValidationError } from '@/utils/custom-error';
import logger from '@/utils/logger';

const AWIN_API_ORIGIN = 'https://api.awin.com';
const MAX_TRANSACTION_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_AWIN_ERROR_DETAILS_LENGTH = 500;

export interface AwinPublisherAccount {
  publisherId: number;
  name: string;
}

export interface AwinTransaction {
  transactionId: string;
  advertiserId: string;
  advertiserName: string;
  clickReference: string | null;
  status: 'pending' | 'approved' | 'declined' | 'deleted';
  commission: number | null;
  currency: string | null;
  transactionAt: Date;
  validationAt: Date | null;
}

export interface AwinPromotion {
  promotionId: number;
  advertiserId: number;
  advertiserName: string;
  joined: boolean;
  title: string;
  description: string;
  terms: string | null;
  trackingUrl: string;
  startsAt: Date;
  endsAt: Date;
  voucherCode: string | null;
}

export type AwinTransactionDateType =
  | 'transaction'
  | 'validation'
  | 'amendment';

interface AwinRequestOptions {
  query?: URLSearchParams;
  method?: 'GET' | 'POST';
  body?: unknown;
  includeAccessTokenQuery?: boolean;
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const asDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const asList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  const record = asRecord(payload);
  if (!record) {
    return [];
  }
  for (const key of [
    'data',
    'offers',
    'promotions',
    'accounts',
    'publishers',
    'transactions',
  ]) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
    if (asRecord(record[key])) {
      const nested = asList(record[key]);
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  return [];
};

const describeAwinPayloadShape = (payload: unknown): JsonRecord => {
  if (Array.isArray(payload)) {
    return {
      rootType: 'array',
      itemCount: payload.length,
      firstItemKeys: asRecord(payload[0])
        ? Object.keys(asRecord(payload[0]) as JsonRecord)
        : [],
    };
  }

  const record = asRecord(payload);
  if (!record) {
    return { rootType: payload === null ? 'null' : typeof payload };
  }

  const arrayFields = Object.entries(record)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => ({
      key,
      itemCount: (value as unknown[]).length,
      firstItemKeys: asRecord((value as unknown[])[0])
        ? Object.keys(asRecord((value as unknown[])[0]) as JsonRecord)
        : [],
    }));
  return {
    rootType: 'object',
    keys: Object.keys(record),
    arrayFields,
  };
};

export const summarizeAwinErrorBody = (
  body: string,
  token: string,
): string | undefined => {
  const redactedBody = token ? body.replaceAll(token, '[REDACTED]') : body;
  let payload: unknown;
  try {
    payload = JSON.parse(redactedBody);
  } catch {
    return (
      redactedBody.trim().slice(0, MAX_AWIN_ERROR_DETAILS_LENGTH) || undefined
    );
  }

  const record = asRecord(payload);
  if (!record) {
    return undefined;
  }
  const details = ['code', 'error', 'message', 'description', 'detail', 'title']
    .flatMap((key) => {
      const value = record[key];
      if (typeof value !== 'string' && typeof value !== 'number') {
        return [];
      }
      return [`${key}: ${String(value)}`];
    })
    .join('; ')
    .slice(0, MAX_AWIN_ERROR_DETAILS_LENGTH);
  return details || undefined;
};

const getApiToken = (): string => {
  const token = config.awinApiToken.trim();
  if (!token) {
    throw new ValidationError({
      message: 'Awin API is not configured on the backend.',
      code: 'VALIDATION_ERROR',
    });
  }
  return token;
};

const requestAwin = async (
  path: string,
  options: AwinRequestOptions = {},
): Promise<unknown> => {
  const url = new URL(path, AWIN_API_ORIGIN);
  const token = getApiToken();
  if (options.query) {
    options.query.forEach((value, key) => url.searchParams.set(key, value));
  }
  if (options.includeAccessTokenQuery) {
    url.searchParams.set('accessToken', token);
  }

  const method = options.method ?? 'GET';
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      method,
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new InternalServerError({
      message: 'Could not connect to the Awin API.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  if (!response.ok) {
    let responseBody: string | undefined;
    try {
      responseBody = await response.text();
    } catch (error) {
      logger.warn(
        { service: 'AwinApi', function: 'requestAwin' },
        'Could not read Awin error response body',
        {
          status: response.status,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }

    logger.error(
      { service: 'AwinApi', function: 'requestAwin' },
      'Awin API request failed',
      {
        method,
        path: url.pathname,
        status: response.status,
        statusText: response.statusText,
        requestId:
          response.headers.get('x-request-id') ??
          response.headers.get('x-correlation-id'),
        responseDetails: responseBody
          ? summarizeAwinErrorBody(responseBody, config.awinApiToken.trim())
          : undefined,
      },
    );
    throw new InternalServerError({
      message: `Awin API GET ${url.pathname} failed with HTTP ${response.status}.`,
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  try {
    return await response.json();
  } catch {
    throw new InternalServerError({
      message: 'Awin API returned an invalid response.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
};

export const parseAwinPublishers = (payload: unknown): AwinPublisherAccount[] =>
  asList(payload).flatMap((value) => {
    const record = asRecord(value);
    if (!record) {
      return [];
    }
    const publisherId = Number(
      record.id ??
        record.publisherId ??
        record.publisher_id ??
        record.accountId ??
        record.account_id,
    );
    const name = asString(
      record.name ??
        record.publisherName ??
        record.publisher_name ??
        record.accountName ??
        record.account_name,
    );
    if (!Number.isSafeInteger(publisherId) || publisherId <= 0 || !name) {
      return [];
    }
    return [{ publisherId, name }];
  });

const isAllowedAwinTrackingUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'awin1.com' ||
        url.hostname.endsWith('.awin1.com') ||
        url.hostname === 'tidd.ly')
    );
  } catch {
    return false;
  }
};

export const parseAwinPromotions = (payload: unknown): AwinPromotion[] =>
  asList(payload).flatMap((value) => {
    const record = asRecord(value);
    const advertiser = asRecord(record?.advertiser);
    const voucher = asRecord(record?.voucher);
    if (!record || !advertiser) {
      return [];
    }

    const promotionId = Number(
      record.promotionId ?? record.promotion_id ?? record.id,
    );
    const advertiserId = Number(
      advertiser.id ?? advertiser.advertiserId ?? advertiser.advertiser_id,
    );
    const advertiserName = asString(advertiser.name);
    const title = asString(record.title);
    const trackingUrl = asString(record.urlTracking ?? record.url_tracking);
    const startsAt = asDate(record.startDate ?? record.start_date);
    const endsAt = asDate(record.endDate ?? record.end_date);
    const description = asString(record.description) ?? title;
    if (
      !Number.isSafeInteger(promotionId) ||
      promotionId <= 0 ||
      !Number.isSafeInteger(advertiserId) ||
      advertiserId <= 0 ||
      !advertiserName ||
      !title ||
      !description ||
      !trackingUrl ||
      !isAllowedAwinTrackingUrl(trackingUrl) ||
      !startsAt ||
      !endsAt ||
      startsAt >= endsAt
    ) {
      return [];
    }

    return [
      {
        promotionId,
        advertiserId,
        advertiserName,
        joined: advertiser.joined === true,
        title,
        description,
        terms: asString(record.terms),
        trackingUrl,
        startsAt,
        endsAt,
        voucherCode: asString(voucher?.code),
      },
    ];
  });

export const parseAwinTransactions = (payload: unknown): AwinTransaction[] =>
  asList(payload)
    .map((value) => {
      const record = asRecord(value);
      if (!record) {
        return null;
      }

      const transactionId = asString(
        record.id ?? record.transactionId ?? record.transaction_id,
      );
      const advertiserId = asString(
        record.advertiserId ?? record.advertiser_id,
      );
      const statusValue = asString(
        record.commissionStatus ?? record.status,
      )?.toLowerCase();
      const transactionAt = asDate(
        record.transactionDate ?? record.transaction_date,
      );
      if (
        !transactionId ||
        !/^\d+$/.test(transactionId) ||
        !advertiserId ||
        !/^\d+$/.test(advertiserId) ||
        !statusValue ||
        !['pending', 'approved', 'declined', 'deleted'].includes(statusValue) ||
        !transactionAt
      ) {
        throw new InternalServerError({
          message:
            'Awin API returned a transaction with an unsupported or incomplete shape.',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }

      const advertiserName =
        asString(record.advertiserName ?? record.advertiser_name) ??
        `Advertiser ${advertiserId}`;
      const currency = asString(
        record.currency ?? record.currencyCode ?? record.commissionCurrency,
      );

      return {
        transactionId,
        advertiserId,
        advertiserName,
        clickReference: asString(
          record.clickRef ?? record.clickReference ?? record.click_ref,
        ),
        status: statusValue as AwinTransaction['status'],
        commission: asAmount(
          record.commissionAmount ?? record.commission_amount,
        ),
        currency:
          currency && /^[A-Za-z]{3}$/.test(currency)
            ? currency.toUpperCase()
            : null,
        transactionAt,
        validationAt: asDate(record.validationDate ?? record.validation_date),
      };
    })
    .filter(
      (transaction): transaction is AwinTransaction => transaction !== null,
    );

const toAwinDateTime = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z');

export const getAwinPublisherAccounts = async (): Promise<
  AwinPublisherAccount[]
> => {
  const response = await requestAwin('/accounts');
  const publishers = parseAwinPublishers(response);
  if (publishers.length === 0) {
    logger.error(
      { service: 'AwinApi', function: 'getAwinPublisherAccounts' },
      'Awin accounts response contained no recognized publisher accounts',
      describeAwinPayloadShape(response),
    );
    throw new InternalServerError({
      message:
        'Awin returned an accounts response with no recognized publisher accounts.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
  return publishers;
};

export const getAwinTransactions = async (
  publisherId: number,
  startDate: Date,
  endDate: Date,
  dateType: AwinTransactionDateType,
): Promise<AwinTransaction[]> => {
  if (!Number.isSafeInteger(publisherId) || publisherId <= 0) {
    throw new ValidationError({
      message: 'A valid Awin publisher ID is required.',
      code: 'VALIDATION_ERROR',
    });
  }
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate >= endDate ||
    endDate.getTime() - startDate.getTime() > MAX_TRANSACTION_RANGE_MS
  ) {
    throw new ValidationError({
      message: 'Choose a valid date range no longer than 31 days.',
      code: 'VALIDATION_ERROR',
    });
  }

  const query = new URLSearchParams({
    startDate: toAwinDateTime(startDate),
    endDate: toAwinDateTime(endDate),
    dateType,
    timezone: 'UTC',
  });
  const path = `/publishers/${publisherId}/transactions/`;
  return parseAwinTransactions(await requestAwin(path, { query }));
};

const AWIN_PROMOTION_PAGE_SIZE = 200;
const MAX_AWIN_PROMOTION_PAGES = 1000;

const getAwinPromotionsByStatus = async (
  publisherId: number,
  status: 'active' | 'upcoming',
): Promise<AwinPromotion[]> => {
  const promotions: AwinPromotion[] = [];
  for (let page = 1; page <= MAX_AWIN_PROMOTION_PAGES; page += 1) {
    const payload = await requestAwin(`/publisher/${publisherId}/promotions`, {
      method: 'POST',
      includeAccessTokenQuery: true,
      body: {
        filters: {
          membership: 'all',
          regionCodes: ['GB'],
          status,
          type: 'all',
        },
        pagination: { page, pageSize: AWIN_PROMOTION_PAGE_SIZE },
      },
    });
    const rows = asList(payload);
    promotions.push(...parseAwinPromotions(rows));
    if (rows.length < AWIN_PROMOTION_PAGE_SIZE) {
      return promotions;
    }
  }
  throw new InternalServerError({
    message: 'Awin returned more promotion pages than the sync limit allows.',
    code: 'INTERNAL_SERVER_ERROR',
  });
};

export const getAwinPromotions = async (
  publisherId: number,
): Promise<AwinPromotion[]> => {
  if (!Number.isSafeInteger(publisherId) || publisherId <= 0) {
    throw new ValidationError({
      message: 'A valid Awin publisher ID is required.',
      code: 'VALIDATION_ERROR',
    });
  }

  const [active, upcoming] = await Promise.all([
    getAwinPromotionsByStatus(publisherId, 'active'),
    getAwinPromotionsByStatus(publisherId, 'upcoming'),
  ]);
  const uniquePromotions = new Map<number, AwinPromotion>();
  for (const promotion of [...active, ...upcoming]) {
    const current = uniquePromotions.get(promotion.promotionId);
    if (!current || promotion.joined) {
      uniquePromotions.set(promotion.promotionId, promotion);
    }
  }
  return [...uniquePromotions.values()];
};
