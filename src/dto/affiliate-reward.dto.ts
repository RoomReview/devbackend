import { boolean, object, string, z } from 'zod';

const awinTrackingUrl = string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      url.protocol === 'https:' &&
      (url.hostname === 'awin1.com' ||
        url.hostname.endsWith('.awin1.com') ||
        url.hostname === 'tidd.ly')
    );
  }, 'A secure Awin tracking URL is required');

const logoUrl = string()
  .url()
  .max(2048)
  .refine(
    (value) => new URL(value).protocol === 'https:',
    'A secure image URL is required',
  )
  .nullable()
  .optional();

export const CreateAffiliateOfferDto = object({
  storeName: string().trim().min(1).max(120),
  advertiserName: string().trim().min(1).max(120),
  logoUrl,
  description: string().trim().min(1).max(2000),
  discountDetails: string().trim().max(1000).nullable().optional(),
  voucherCode: string().trim().max(100).nullable().optional(),
  trackingUrl: awinTrackingUrl,
  awinApproved: boolean(),
  isActive: boolean(),
})
  .strict()
  .refine((offer) => !offer.isActive || offer.awinApproved, {
    message: 'An offer must be approved by Awin before it can be activated',
    path: ['isActive'],
  });

export const RedeemReviewRewardDto = object({
  offerId: z.uuid(),
}).strict();

export type AffiliateOfferInput = z.infer<typeof CreateAffiliateOfferDto>;
