import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

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
): Promise<{ response: Awaited<ReturnType<typeof fetch>>; data: T }> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
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

export const getAllBlogPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requestedPerPage = Number(req.query.per_page) || 100;
  const perPage = Math.min(Math.max(Math.floor(requestedPerPage), 1), 100);
  const requestedPage = Number(req.query.page) || 1;
  const page = Math.max(Math.floor(requestedPage), 1);

  try {
    const result = await getCachedWordPressPosts(page, perPage);
    res.status(200).json({
      success: true,
      statusCode: 200,
      data: result.data,
      pagination: result.pagination,
      message: 'WordPress blog posts fetched successfully',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load blog posts from WordPress';
    res.status(502).json({ success: false, statusCode: 502, error: message });
  }
};

export const getBlogPostById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? routeId[0] ?? '' : routeId;
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
    const statusCode = error instanceof WordPressApiError ? error.statusCode : 502;
    res.status(statusCode).json({ success: false, statusCode, error: message });
  }
};

export const getBlogPostBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const routeSlug = req.params.slug;
  const slug = Array.isArray(routeSlug) ? routeSlug[0] ?? '' : routeSlug;
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    res.status(400).json({ success: false, statusCode: 400, error: 'Invalid blog post slug' });
    return;
  }

  const url = new URL(`${WORDPRESS_API}/posts`);
  url.searchParams.set('slug', slug);
  url.searchParams.set('_embed', '1');

  try {
    const { data } = await fetchWordPressJson<WordPressEmbeddedPost[]>(url);
    const post = data[0];
    if (!post) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Blog post not found' });
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
    const statusCode = error instanceof WordPressApiError ? error.statusCode : 502;
    res.status(statusCode).json({ success: false, statusCode, error: message });
  }
};

export const createBlogPost = (
  _req: Request,
  res: Response,
): void => {
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 201,
    data: null,
    message: 'Blog post created successfully',
  };
  res.status(201).json(response);
};

export const updateBlogPost = (
  _req: Request,
  res: Response,
): void => {
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Blog post updated successfully',
  };
  res.status(200).json(response);
};

export const deleteBlogPost = (
  _req: Request,
  res: Response,
): void => {
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Blog post deleted successfully',
  };
  res.status(200).json(response);
};
