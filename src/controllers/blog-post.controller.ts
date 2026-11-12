import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import { blogPostRepository } from '@/repositories/blog-post.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import logger from '@/utils/logger';
import {
  getBlogFeaturedImage,
  NoSuchKey,
  uploadBlogFeaturedImage,
} from '@/services/blog-featured-image.service';

interface WordPressTerm {
  id: number;
  name: string;
}

interface WordPressPostSummary {
  id: number;
  slug: string;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
}

interface WordPressPost extends WordPressPostSummary {
  content: { rendered: string };
}

interface WordPressEmbeddedPost extends WordPressPost {
  _embedded?: {
    author?: Array<{ name?: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
    'wp:term'?: WordPressTerm[][];
  };
}

interface BlogPost {
  id: string;
  slug: string;
  date: string;
  link: string;
  title: string;
  excerpt: string;
  content?: string;
  author: string;
  image: string;
  categories: string[];
  tags: string[];
}

interface CachedBlogPosts {
  data: BlogPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const WORDPRESS_API = 'https://roomreview.co.uk/wp-json/wp/v2';
const BLOG_CACHE_TTL_MS = 5 * 60 * 1000;
const blogPostsCache = new Map<
  string,
  { expiresAt: number; value: CachedBlogPosts }
>();
const blogPostsRequests = new Map<string, Promise<CachedBlogPosts>>();

class WordPressApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

const fetchWordPressJson = async <T>(
  url: URL,
  init?: RequestInit,
): Promise<{ response: Awaited<ReturnType<typeof fetch>>; data: T }> => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new WordPressApiError(
      `WordPress returned ${response.status} for ${url.pathname}`,
      response.status,
    );
  }
  return { response, data: (await response.json()) as T };
};

const uniqueIds = (ids: number[]) => [
  ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
];

const fetchTerms = async (endpoint: 'categories' | 'tags', ids: number[]) => {
  const batches: number[][] = [];
  for (let index = 0; index < ids.length; index += 100) {
    batches.push(ids.slice(index, index + 100));
  }
  const terms = await Promise.all(
    batches.map(async (batch) => {
      const url = new URL(`${WORDPRESS_API}/${endpoint}`);
      url.searchParams.set('include', batch.join(','));
      url.searchParams.set('per_page', '100');
      url.searchParams.set('_fields', 'id,name');
      const result = await fetchWordPressJson<WordPressTerm[]>(url);
      return result.data;
    }),
  );
  return new Map(terms.flat().map((term) => [term.id, term.name]));
};

const fetchWordPressPosts = async (
  page: number,
  perPage: number,
): Promise<CachedBlogPosts> => {
  const url = new URL(`${WORDPRESS_API}/posts`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set(
    '_fields',
    'id,slug,date,link,title,excerpt,author,featured_media,categories,tags',
  );
  const { response, data: posts } =
    await fetchWordPressJson<WordPressPostSummary[]>(url);

  const [media, categories, tags, authors] = await Promise.all([
    (async () => {
      const ids = uniqueIds(posts.map((post) => post.featured_media));
      if (ids.length === 0) {
        return new Map<number, string>();
      }
      const mediaUrl = new URL(`${WORDPRESS_API}/media`);
      mediaUrl.searchParams.set('include', ids.join(','));
      mediaUrl.searchParams.set('per_page', '100');
      mediaUrl.searchParams.set('_fields', 'id,source_url');
      const result =
        await fetchWordPressJson<Array<{ id: number; source_url: string }>>(
          mediaUrl,
        );
      return new Map(result.data.map((item) => [item.id, item.source_url]));
    })(),
    fetchTerms(
      'categories',
      uniqueIds(posts.flatMap((post) => post.categories)),
    ),
    fetchTerms('tags', uniqueIds(posts.flatMap((post) => post.tags))),
    (async () => {
      const ids = uniqueIds(posts.map((post) => post.author));
      if (ids.length === 0) {
        return new Map<number, string>();
      }
      const authorUrl = new URL(`${WORDPRESS_API}/users`);
      authorUrl.searchParams.set('include', ids.join(','));
      authorUrl.searchParams.set('per_page', '100');
      authorUrl.searchParams.set('_fields', 'id,name');
      const result = await fetchWordPressJson<WordPressTerm[]>(authorUrl);
      return new Map(result.data.map((author) => [author.id, author.name]));
    })(),
  ]);

  return {
    data: posts.map((post) => ({
      id: String(post.id),
      slug: post.slug,
      date: post.date,
      link: post.link,
      title: post.title.rendered,
      excerpt: post.excerpt.rendered,
      author: authors.get(post.author) ?? 'RoomReview Editorial',
      image: media.get(post.featured_media) ?? '',
      categories: post.categories
        .map((id) => categories.get(id))
        .filter((name): name is string => Boolean(name)),
      tags: post.tags
        .map((id) => tags.get(id))
        .filter((name): name is string => Boolean(name)),
    })),
    pagination: {
      page,
      limit: perPage,
      total: Number(response.headers.get('X-WP-Total') ?? posts.length),
      totalPages: Number(response.headers.get('X-WP-TotalPages') ?? 1),
    },
  };
};

const getCachedWordPressPosts = async (page: number, perPage: number) => {
  const key = `${page}:${perPage}`;
  const cached = blogPostsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = blogPostsRequests.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchWordPressPosts(page, perPage)
    .then((value) => {
      blogPostsCache.set(key, {
        value,
        expiresAt: Date.now() + BLOG_CACHE_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      blogPostsRequests.delete(key);
    });
  blogPostsRequests.set(key, request);
  return request;
};

const mapWordPressPost = (post: WordPressEmbeddedPost): BlogPost => ({
  id: String(post.id),
  slug: post.slug,
  date: post.date,
  link: post.link,
  title: post.title.rendered,
  excerpt: post.excerpt.rendered,
  content: post.content.rendered,
  author: post._embedded?.author?.[0]?.name ?? 'RoomReview Editorial',
  image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '',
  categories: (post._embedded?.['wp:term']?.[0] ?? [])
    .map((term) => term.name)
    .filter((name): name is string => Boolean(name)),
  tags: (post._embedded?.['wp:term']?.[1] ?? [])
    .map((term) => term.name)
    .filter((name): name is string => Boolean(name)),
});

const mapDatabasePost = (
  post: NonNullable<
    Awaited<ReturnType<typeof blogPostRepository.findByIdWithRelations>>
  >,
  includeContent = false,
): BlogPost => ({
  id: post.blog_post_id,
  slug: post.slug,
  date: (post.published_at ?? post.created_at).toISOString(),
  link: `https://roomreview.co.uk/blog/${post.slug}`,
  title: post.title,
  excerpt: post.excerpt,
  ...(includeContent ? { content: post.content } : {}),
  author: post.author || 'RoomReview Editorial',
  image: post.featured_image ?? '',
  categories: post.blog_categories ? [post.blog_categories.name] : [],
  tags: post.blog_tags.map((tag) => tag.name),
});

export const getAllBlogPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requestedPerPage = Number(req.query.per_page) || 100;
  const perPage = Math.min(Math.max(Math.floor(requestedPerPage), 1), 100);
  const requestedPage = Number(req.query.page) || 1;
  const page = Math.max(Math.floor(requestedPage), 1);

  let databasePosts: Awaited<
    ReturnType<typeof blogPostRepository.findPublished>
  > = [];
  let databaseError: unknown;
  try {
    databasePosts = await blogPostRepository.findPublished();
  } catch (error) {
    databaseError = error;
    logger.error(
      { service: 'BlogPostController', function: 'getAllBlogPosts' },
      'Could not load RoomReview blog posts',
      { error },
    );
  }
  let wordPressPosts: CachedBlogPosts | null = null;
  let wordPressError: unknown;
  try {
    wordPressPosts = await getCachedWordPressPosts(page, perPage);
  } catch (error) {
    wordPressError = error;
  }

  if (!wordPressPosts && databasePosts.length === 0) {
    const error = wordPressError ?? databaseError;
    const message =
      error instanceof Error ? error.message : 'Unable to load blog posts';
    res.status(502).json({ success: false, statusCode: 502, error: message });
    return;
  }

  const localPosts = databasePosts.map((post) => mapDatabasePost(post));
  const postsBySlug = new Map(
    (wordPressPosts?.data ?? []).map((post) => [post.slug, post]),
  );
  if (page === 1) {
    localPosts.forEach((post) => postsBySlug.set(post.slug, post));
  }
  const mergedPosts = [...postsBySlug.values()].sort(
    (first, second) => Date.parse(second.date) - Date.parse(first.date),
  );
  const total = (wordPressPosts?.pagination.total ?? 0) + databasePosts.length;
  const totalPages = Math.ceil(total / perPage);
  res.status(200).json({
    success: true,
    statusCode: 200,
    data: page === 1 ? mergedPosts.slice(0, perPage) : mergedPosts,
    pagination: {
      page,
      limit: perPage,
      total,
      totalPages,
    },
    message: 'Blog posts fetched successfully',
  });
};

export const getBlogPostById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? (routeId[0] ?? '') : routeId;
  if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    const databasePost = await blogPostRepository.findPublishedById(id);
    if (!databasePost) {
      res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'Blog post not found',
      });
      return;
    }
    res.status(200).json({
      success: true,
      statusCode: 200,
      data: mapDatabasePost(databasePost, true),
      message: 'Blog post fetched successfully',
    });
    return;
  }
  if (!/^\d+$/.test(id)) {
    res
      .status(400)
      .json({ success: false, statusCode: 400, error: 'Invalid blog post ID' });
    return;
  }
  const url = new URL(`${WORDPRESS_API}/posts/${id}`);
  url.searchParams.set('_embed', '1');

  try {
    const { data } = await fetchWordPressJson<WordPressEmbeddedPost>(url);
    const post = mapWordPressPost(data);
    res.status(200).json({
      success: true,
      statusCode: 200,
      data: post,
      message: 'Blog post fetched successfully',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load blog post from WordPress';
    const statusCode =
      error instanceof WordPressApiError ? error.statusCode : 502;
    res.status(statusCode).json({ success: false, statusCode, error: message });
  }
};

export const getDraftBlogPostPreview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? (routeId[0] ?? '') : routeId;
  const draft = await blogPostRepository.findByIdWithRelations(id);
  if (draft?.status !== 'DRAFT') {
    res.status(404).json({
      success: false,
      statusCode: 404,
      error: 'Blog draft not found',
    });
    return;
  }

  res.status(200).json({
    success: true,
    statusCode: 200,
    data: mapDatabasePost(draft, true),
    message: 'Blog draft preview fetched successfully',
  });
};

export const getBlogPostBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeSlug = req.params.slug;
  const slug = Array.isArray(routeSlug) ? (routeSlug[0] ?? '') : routeSlug;
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      error: 'Invalid blog post slug',
    });
    return;
  }

  let databasePost: Awaited<
    ReturnType<typeof blogPostRepository.findPublishedBySlug>
  > = null;
  try {
    databasePost = await blogPostRepository.findPublishedBySlug(slug);
  } catch (error) {
    logger.error(
      { service: 'BlogPostController', function: 'getBlogPostBySlug' },
      'Could not load RoomReview blog post',
      { error },
    );
  }
  if (databasePost) {
    res.status(200).json({
      success: true,
      statusCode: 200,
      data: mapDatabasePost(databasePost, true),
      message: 'Blog post fetched successfully',
    });
    return;
  }

  const url = new URL(`${WORDPRESS_API}/posts`);
  url.searchParams.set('slug', slug);
  url.searchParams.set('_embed', '1');

  try {
    const { data } = await fetchWordPressJson<WordPressEmbeddedPost[]>(url);
    const post = data[0];
    if (!post) {
      res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'Blog post not found',
      });
      return;
    }
    res.status(200).json({
      success: true,
      statusCode: 200,
      data: mapWordPressPost(post),
      message: 'Blog post fetched successfully',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load blog post from WordPress';
    const statusCode =
      error instanceof WordPressApiError ? error.statusCode : 502;
    res.status(statusCode).json({ success: false, statusCode, error: message });
  }
};

export const createBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const title = req.body.title as string;
  const content = req.body.content as string;
  const post = await blogPostRepository.createDraft({
    title,
    author: (req.body.author as string | undefined) ?? 'RoomReview Editorial',
    excerpt: (req.body.excerpt as string | undefined) ?? content.slice(0, 300),
    content,
    featuredImage: (req.body.featuredImage as string | null | undefined) ?? null,
  });

  blogPostsCache.clear();
  const response: ApiResponse<BlogPost> = {
    success: true,
    statusCode: 201,
    data: mapDatabasePost(post, true),
    message: 'Blog post saved as a draft in RoomReview',
  };
  res.status(201).json(response);
};

export const publishBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? (routeId[0] ?? '') : routeId;
  const existingPost = await blogPostRepository.findById(id);
  if (!existingPost) {
    throw new EntityNotFoundError({
      message: 'Blog post not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const post = await blogPostRepository.publish(id, existingPost.published_at);
  blogPostsCache.clear();
  const response: ApiResponse<BlogPost> = {
    success: true,
    statusCode: 200,
    data: mapDatabasePost(post, true),
    message: 'Blog post published successfully',
  };
  res.status(200).json(response);
};

export const updateBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? (routeId[0] ?? '') : routeId;
  const existingPost = await blogPostRepository.findById(id);
  if (!existingPost) {
    throw new EntityNotFoundError({
      message: 'Blog post not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const post = await blogPostRepository.update(id, {
    title: req.body.title as string,
    author: (req.body.author as string | undefined) ?? existingPost.author,
    excerpt:
      (req.body.excerpt as string | undefined) ??
      (req.body.content as string).slice(0, 300),
    content: req.body.content as string,
    featuredImage:
      req.body.featuredImage === undefined
        ? existingPost.featured_image
        : (req.body.featuredImage as string | null),
  });
  blogPostsCache.clear();
  const response: ApiResponse<BlogPost> = {
    success: true,
    statusCode: 200,
    data: mapDatabasePost(post, true),
    message: 'Blog post updated successfully',
  };
  res.status(200).json(response);
};

export const uploadBlogPostFeaturedImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { contentType, imageBase64 } = req.body as {
    contentType: string;
    imageBase64: string;
  };
  const image = await uploadBlogFeaturedImage(contentType, imageBase64);
  res.status(201).json({
    success: true,
    statusCode: 201,
    data: { image },
    message: 'Blog featured image uploaded successfully',
  });
};

export const getBlogPostFeaturedImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeFilename = req.params.filename;
  const filename = Array.isArray(routeFilename)
    ? (routeFilename[0] ?? '')
    : routeFilename;
  try {
    const image = await getBlogFeaturedImage(filename);
    if (!image) {
      res.status(404).end();
      return;
    }
    res
      .status(200)
      .type(image.contentType)
      .set('X-Content-Type-Options', 'nosniff')
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .send(image.body);
  } catch (error) {
    if (error instanceof NoSuchKey) {
      res.status(404).end();
      return;
    }
    throw error;
  }
};

export const deleteBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? (routeId[0] ?? '') : routeId;
  const existingPost = await blogPostRepository.findById(id);
  if (!existingPost) {
    throw new EntityNotFoundError({
      message: 'Blog post not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }
  await blogPostRepository.delete(id);
  blogPostsCache.clear();
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Blog post deleted successfully',
  };
  res.status(200).json(response);
};

export const cancelBlogPostDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? (routeId[0] ?? '') : routeId;
  const result = await blogPostRepository.deleteDraft(id);
  if (result.count === 0) {
    throw new EntityNotFoundError({
      message: 'Blog draft not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  blogPostsCache.clear();
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Blog draft cancelled successfully',
  };
  res.status(200).json(response);
};
