import prisma from '@config/database';

export interface Review {
  review_id: string;
  title: string;
  content: string;
  safety_rating: number;
  transport_rating: number;
  amenities_rating: number;
  value_rating: number;
  overall_rating: number;
  pros?: string[];
  cons?: string[];
  years_lived?: number | null;
  anonymous?: boolean;
  verified?: boolean;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  rejection_reason?: string | null;
  author_id: string;
  postcode_id?: string | null;
  borough_id?: string | null;
  created_at: Date;
  updated_at: Date;
  published_at?: Date | null;
}

const reviewStore = new Map<string, Review>();

const calculateOverallRating = (data: Partial<Review>) => {
  const values = [
    data.safety_rating,
    data.transport_rating,
    data.amenities_rating,
    data.value_rating,
  ].filter((value): value is number => typeof value === 'number');

  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

export const findAllReviews = async (): Promise<Review[]> => {
  try {
    const rows = await (prisma as any).reviews.findMany({
      orderBy: { created_at: 'desc' },
    });
    return rows as Review[];
  } catch {
    return Array.from(reviewStore.values());
  }
};

export const findReviewById = async (id: string): Promise<Review | null> => {
  try {
    const row = await (prisma as any).reviews.findUnique({
      where: { review_id: id },
    });
    return row as Review | null;
  } catch {
    return reviewStore.get(id) ?? null;
  }
};

export const createReview = async (data: Partial<Review>): Promise<Review> => {
  const now = new Date();
  const review: Review = {
    review_id: data.review_id ?? crypto.randomUUID(),
    title: data.title ?? 'Untitled review',
    content: data.content ?? '',
    safety_rating: Number(data.safety_rating ?? 0),
    transport_rating: Number(data.transport_rating ?? 0),
    amenities_rating: Number(data.amenities_rating ?? 0),
    value_rating: Number(data.value_rating ?? 0),
    overall_rating: calculateOverallRating(data),
    pros: data.pros ?? [],
    cons: data.cons ?? [],
    years_lived: data.years_lived ?? null,
    anonymous: data.anonymous ?? false,
    verified: data.verified ?? false,
    status: data.status ?? 'PENDING',
    rejection_reason: data.rejection_reason ?? null,
    author_id: data.author_id ?? '00000000-0000-4000-8000-000000000000',
    postcode_id: data.postcode_id ?? null,
    borough_id: data.borough_id ?? null,
    created_at: now,
    updated_at: now,
    published_at: data.published_at ?? null,
  };

  try {
    const saved = await (prisma as any).reviews.create({ data: review });
    reviewStore.set(saved.review_id, saved as Review);
    return saved as Review;
  } catch {
    reviewStore.set(review.review_id, review);
    return review;
  }
};

export const updateReview = async (id: string, data: Partial<Review>): Promise<Review | null> => {
  const existing = await findReviewById(id);
  if (!existing) return null;

  const next = {
    ...existing,
    ...data,
    overall_rating: calculateOverallRating({ ...existing, ...data }),
    updated_at: new Date(),
  };

  try {
    const updated = await (prisma as any).reviews.update({
      where: { review_id: id },
      data: next,
    });
    reviewStore.set(id, updated as Review);
    return updated as Review;
  } catch {
    reviewStore.set(id, next);
    return next;
  }
};

export const deleteReview = async (id: string): Promise<boolean> => {
  try {
    await (prisma as any).reviews.delete({ where: { review_id: id } });
    reviewStore.delete(id);
    return true;
  } catch {
    return reviewStore.delete(id);
  }
};
