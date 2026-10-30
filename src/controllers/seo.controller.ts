import type { Request, Response } from 'express';
import prisma from '@config/database';

const WORDPRESS_POSTS_URL = 'https://roomreview.co.uk/wp-json/wp/v2/posts';

const namedHtmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  copy: '©',
  hellip: '…',
  lsquo: '‘',
  ldquo: '“',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  reg: '®',
  rsquo: '’',
  rdquo: '”',
  trade: '™',
};

const decodeHtmlEntities = (value: string) => value.replace(
  /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
  (entity) => {
    const name = entity.slice(1, -1).toLowerCase();
    if (name.startsWith('#')) {
      const codePoint = name.startsWith('#x')
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return namedHtmlEntities[name] ?? entity;
  },
);

const stripHtml = (value: string) => decodeHtmlEntities(value
  .replace(/<[^>]*>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const fetchWordPressPosts = async (): Promise<Array<{
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt: { rendered: string };
}>> => {
  const fetchPage = async (page: number) => {
    const url = new URL(WORDPRESS_POSTS_URL);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('_fields', 'id,slug,title,excerpt');
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`WordPress sitemap source returned HTTP ${response.status}`);
    }
    return response;
  };

  const firstResponse = await fetchPage(1);
  const pageCount = Number(firstResponse.headers.get('X-WP-TotalPages') ?? '1');
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
    throw new Error('WordPress sitemap source returned an invalid page count');
  }

  type WordPressPost = {
    id: number;
    slug: string;
    title: { rendered: string };
    excerpt: { rendered: string };
  };
  const posts = await firstResponse.json() as WordPressPost[];
  for (let firstPage = 2; firstPage <= pageCount; firstPage += 10) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(10, pageCount - firstPage + 1) }, (_, index) =>
        fetchPage(firstPage + index).then((response) => response.json() as Promise<WordPressPost[]>),
      ),
    );
    posts.push(...pages.flat());
  }
  return posts;
};

export const getSitemapData = async (_req: Request, res: Response): Promise<void> => {
  const [postcodes, boroughs, wordpressPosts] = await Promise.all([
    prisma.postcode.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    }),
    prisma.borough.findMany({
      select: { name: true, slug: true, description: true },
      orderBy: { name: 'asc' },
    }),
    fetchWordPressPosts(),
  ]);

  const pages = [
    ...boroughs.map(({ name, slug, description }) => ({
      path: `/borough/${slug}`,
      title: `${name} Borough Guide: Housing, Safety and Local Data | RoomReview`,
      description: `Explore ${name} housing, safety, education and neighbourhood data, with local area insights from RoomReview.`,
      content: stripHtml(description ?? '') || `Explore housing, safety, education and local area insights for ${name}.`,
    })),
    ...postcodes.map(({ code }) => {
      const formattedCode = code.trim().replace(/\s+/g, ' ');
      return {
        path: `/postcode/${formattedCode.replace(/\s+/g, '-').toLowerCase()}`,
        title: `${formattedCode} Postcode Guide and Reviews | RoomReview`,
        description: `Explore reviews, local housing data, safety and neighbourhood insights for postcode ${formattedCode}.`,
        content: `Explore local reviews, housing data, safety information and neighbourhood insights for postcode ${formattedCode}.`,
      };
    }),
    ...wordpressPosts
      .filter(({ id, slug }) => Number.isInteger(id) && id > 0 && /^[a-z0-9-]+$/i.test(slug))
      .map(({ slug, title, excerpt }) => {
        const articleTitle = stripHtml(title.rendered);
        const articleSummary = stripHtml(excerpt.rendered);
        return {
          path: `/blog/${slug}`,
          title: `${articleTitle} | RoomReview`,
          description: articleSummary.slice(0, 160) || `Read ${articleTitle} on the RoomReview blog.`,
          content: articleSummary || `Read ${articleTitle} on the RoomReview blog.`,
        };
      }),
  ];

  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.status(200).json({
    success: true,
    statusCode: 200,
    data: { pages },
  });
};
