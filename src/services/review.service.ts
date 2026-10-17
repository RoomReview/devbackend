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
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  author_id: string;
  postcode_id?: string | null;
  borough_id?: string | null;
  created_at: Date;
  updated_at: Date;
  published_at?: Date | null;
  users?: { firstName?: string } | null;
  postcodes?: { code: string } | null;
}

export interface CreateReviewInput {
  title: string;
  content: string;
  safety_rating: number;
  transport_rating: number;
  amenities_rating: number;
  value_rating: number;
  pros: string[];
  cons: string[];
  years_lived: number | null;
  anonymous: boolean;
  postcode_id: string;
  borough_id: string | null;
}

const reviewStore = new Map<string, Review>();

const calculateOverallRating = (data: Partial<Review>) => {
  const values = [
    data.safety_rating,
    data.transport_rating,
    data.amenities_rating,
    data.value_rating,
  ].filter((value): value is number => typeof value === 'number');

  if (values.length === 0) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

export const findAllReviews = async (): Promise<Review[]> => {
  const rows = await prisma.reviews.findMany({
    where: { status: 'APPROVED' },
    orderBy: { created_at: 'desc' },
    include: { users: { select: { firstName: true } } },
  });
  return rows.map((review) => (review.anonymous ? { ...review, users: null } : review));
};

export const findReviewsByAuthor = async (authorId: string): Promise<Review[]> => {
  return prisma.reviews.findMany({
    where: { author_id: authorId },
    orderBy: { created_at: 'desc' },
    include: { postcodes: { select: { code: true } } },
  });
};

export const findPendingReviews = async (): Promise<Review[]> => {
  const reviews = await prisma.reviews.findMany({
    where: { status: 'PENDING' },
    orderBy: { created_at: 'asc' },
    include: {
      postcodes: { select: { code: true } },
      users: { select: { firstName: true } },
    },
  });
  return reviews.map((review) => (review.anonymous ? { ...review, users: null } : review));
};

export const findReviewsForAdmin = async (): Promise<Review[]> => {
  const reviews = await prisma.reviews.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      postcodes: { select: { code: true } },
      users: { select: { firstName: true } },
    },
  });
  return reviews.map((review) => (review.anonymous ? { ...review, users: null } : review));
};

export const moderateReview = async (
  id: string,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string,
): Promise<Review | null> => {
  const now = new Date();
  const result = await prisma.reviews.updateMany({
    where: { review_id: id, status: 'PENDING' },
    data: {
      status,
      rejection_reason: status === 'REJECTED' ? rejectionReason?.trim() ?? null : null,
      published_at: status === 'APPROVED' ? now : null,
      updated_at: now,
    },
  });
  if (result.count === 0) {
    return null;
  }

  const review = await prisma.reviews.findUnique({
    where: { review_id: id },
    include: {
      postcodes: { select: { code: true } },
      users: { select: { firstName: true } },
    },
  });
  return review?.anonymous ? { ...review, users: null } : review;
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

export const findReviewAuthorId = async (id: string): Promise<string | null> => {
  const review = await prisma.reviews.findUnique({
    where: { review_id: id },
    select: { author_id: true },
  });
  return review?.author_id ?? null;
};

export const findApprovedReviewsByPostcode = async (postcodeId: string): Promise<Review[]> => {
  const rows = await prisma.reviews.findMany({
    where: { postcode_id: postcodeId, status: 'APPROVED' },
    orderBy: { created_at: 'desc' },
    include: { users: { select: { firstName: true } } },
  });
  return rows.map((review) => (review.anonymous ? { ...review, users: null } : review));
};

export const createReview = async (
  data: CreateReviewInput,
  authorId: string,
  persist: (review: Review) => Promise<Review> = async (review) => {
    const { users: _users, postcodes: _postcodes, ...reviewData } = review;
    return prisma.reviews.create({ data: reviewData });
  },
): Promise<Review> => {
  const now = new Date();
  const review: Review = {
    review_id: crypto.randomUUID(),
    title: data.title,
    content: data.content,
    safety_rating: data.safety_rating,
    transport_rating: data.transport_rating,
    amenities_rating: data.amenities_rating,
    value_rating: data.value_rating,
    overall_rating: calculateOverallRating(data),
    pros: data.pros,
    cons: data.cons,
    years_lived: data.years_lived,
    anonymous: data.anonymous,
    verified: false,
    status: 'PENDING',
    rejection_reason: null,
    author_id: authorId,
    postcode_id: data.postcode_id,
    borough_id: data.borough_id,
    created_at: now,
    updated_at: now,
    published_at: null,
  };

  return persist(review);
};

export const updateReview = async (id: string, data: Partial<Review>): Promise<Review | null> => {
  const existing = await findReviewById(id);
  if (!existing) {
    return null;
  }

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
  const result = await prisma.reviews.deleteMany({ where: { review_id: id } });
  reviewStore.delete(id);
  return result.count > 0;
};
