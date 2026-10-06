import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

interface WordPressTerm {
  name?: string;
}

interface WordPressPost {
  id: number;
  slug: string;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    author?: Array<{ name?: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
    'wp:term'?: WordPressTerm[][];
  };
}

export const getAllBlogPosts = async (req: Request, res: Response): Promise<void> => {
  const requestedPerPage = Number(req.query.per_page) || 100;
  const perPage = Math.min(Math.max(Math.floor(requestedPerPage), 1), 100);
  const requestedPage = Number(req.query.page) || 1;
  const page = Math.max(Math.floor(requestedPage), 1);
  const url = new URL('https://roomreview.co.uk/wp-json/wp/v2/posts');
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('_embed', '1');

  try {
    const wordpressResponse = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!wordpressResponse.ok) {
      res.status(502).json({
        success: false,
        statusCode: 502,
        error: `WordPress returned ${wordpressResponse.status} while loading blog posts`,
      });
      return;
    }

    const posts = await wordpressResponse.json() as WordPressPost[];
    const total = Number(wordpressResponse.headers.get('X-WP-Total') ?? posts.length);
    const totalPages = Number(wordpressResponse.headers.get('X-WP-TotalPages') ?? 1);
    const data = posts.map((post) => ({
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
    }));

    res.status(200).json({
      success: true,
      statusCode: 200,
      data,
      pagination: { page, limit: perPage, total, totalPages },
      message: 'WordPress blog posts fetched successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load WordPress blog posts';
    res.status(502).json({ success: false, statusCode: 502, error: message });
  }
};

export const getBlogPostById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog post fetched successfully' };
  res.status(200).json(response);
};

export const createBlogPost = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Blog post created successfully' };
  res.status(201).json(response);
};

export const updateBlogPost = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog post updated successfully' };
  res.status(200).json(response);
};

export const deleteBlogPost = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog post deleted successfully' };
  res.status(200).json(response);
};
