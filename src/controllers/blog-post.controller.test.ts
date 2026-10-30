import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { Request, Response } from 'express';
import { getAllBlogPosts, getBlogPostById, getBlogPostBySlug } from './blog-post.controller';

const createRequest = (
  query: Record<string, string> = {},
  id = '',
  slug = '',
) => ({ query, params: { id, slug } }) as unknown as Request;

const createResponse = () => {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as typeof response & Response;
};

const jsonResponse = (body: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status: 200, headers });

describe('blog post controller', () => {
  it('loads lightweight summaries and batches article metadata for the listing', async (context) => {
    const requestedUrls: URL[] = [];
    context.mock.method(
      globalThis,
      'fetch',
      async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        requestedUrls.push(url);
        if (url.pathname.endsWith('/posts')) {
          return jsonResponse(
            [
              {
                id: 90001,
                slug: 'fast-blog-article',
                date: '2026-10-12T00:00:00',
                link: 'https://roomreview.co.uk/blog/fast-blog-article',
                title: { rendered: 'A fast article' },
                excerpt: { rendered: '<p>Short summary</p>' },
                author: 10,
                featured_media: 20,
                categories: [30],
                tags: [40],
              },
            ],
            { 'X-WP-Total': '1', 'X-WP-TotalPages': '1' },
          );
        }
        if (url.pathname.endsWith('/media')) {
          return jsonResponse([
            { id: 20, source_url: 'https://roomreview.co.uk/image.jpg' },
          ]);
        }
        if (url.pathname.endsWith('/categories')) {
          return jsonResponse([{ id: 30, name: 'Guides' }]);
        }
        if (url.pathname.endsWith('/tags')) {
          return jsonResponse([{ id: 40, name: 'Renting' }]);
        }
        if (url.pathname.endsWith('/users')) {
          return jsonResponse([{ id: 10, name: 'RoomReview Team' }]);
        }
        throw new Error(`Unexpected WordPress API URL: ${url}`);
      },
    );

    const response = createResponse();
    await getAllBlogPosts(
      createRequest({ page: '1', per_page: '1' }),
      response,
    );

    assert.equal(response.statusCode, 200);
    const body = response.body as {
      data: Array<Record<string, unknown>>;
      pagination: { total: number };
    };
    assert.equal(body.data[0].content, undefined);
    assert.equal(body.data[0].image, 'https://roomreview.co.uk/image.jpg');
    assert.deepEqual(body.data[0].categories, ['Guides']);
    assert.deepEqual(body.data[0].tags, ['Renting']);
    assert.equal(body.data[0].author, 'RoomReview Team');
    assert.equal(body.pagination.total, 1);

    const postsRequest = requestedUrls.find((url) =>
      url.pathname.endsWith('/posts'),
    );
    assert.ok(postsRequest);
    assert.equal(postsRequest.searchParams.has('_embed'), false);
    assert.equal(
      postsRequest.searchParams.get('_fields')?.includes('content'),
      false,
    );
  });

  it('fetches full WordPress content only for a requested article', async (context) => {
    let requestUrl: URL | undefined;
    context.mock.method(
      globalThis,
      'fetch',
      async (input: URL | RequestInfo) => {
        requestUrl = new URL(input.toString());
        return jsonResponse({
          id: 90002,
          slug: 'full-article',
          date: '2026-10-12T00:00:00',
          link: 'https://roomreview.co.uk/blog/full-article',
          title: { rendered: 'Full article' },
          excerpt: { rendered: '<p>Summary</p>' },
          content: { rendered: '<p>Full article content</p>' },
          author: 10,
          featured_media: 20,
          categories: [30],
          tags: [40],
          _embedded: {
            author: [{ name: 'RoomReview Team' }],
            'wp:featuredmedia': [
              { source_url: 'https://roomreview.co.uk/image.jpg' },
            ],
            'wp:term': [
              [{ id: 30, name: 'Guides' }],
              [{ id: 40, name: 'Renting' }],
            ],
          },
        });
      },
    );

    const response = createResponse();
    await getBlogPostById(createRequest({}, '90002'), response);

    assert.equal(response.statusCode, 200);
    assert.equal(
      (response.body as { data: { content: string } }).data.content,
      '<p>Full article content</p>',
    );
    assert.equal(requestUrl?.pathname, '/wp-json/wp/v2/posts/90002');
    assert.equal(requestUrl?.searchParams.get('_embed'), '1');
  });

  it('rejects non-numeric WordPress article IDs', async () => {
    const response = createResponse();

    await getBlogPostById(createRequest({}, 'not-an-id'), response);

    assert.equal(response.statusCode, 400);
  });

  it('fetches a published article by its slug', async (context) => {
    let requestUrl: URL | undefined;
    context.mock.method(
      globalThis,
      'fetch',
      async (input: URL | RequestInfo) => {
        requestUrl = new URL(input.toString());
        return jsonResponse([{
          id: 90003,
          slug: 'slugged-article',
          date: '2026-10-12T00:00:00',
          link: 'https://roomreview.co.uk/blog/slugged-article',
          title: { rendered: 'Slugged article' },
          excerpt: { rendered: '<p>Summary</p>' },
          content: { rendered: '<p>Full article content</p>' },
          author: 10,
          featured_media: 20,
          categories: [30],
          tags: [40],
        }]);
      },
    );

    const response = createResponse();
    await getBlogPostBySlug(createRequest({}, '', 'slugged-article'), response);

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { data: { slug: string } }).data.slug, 'slugged-article');
    assert.equal(requestUrl?.pathname, '/wp-json/wp/v2/posts');
    assert.equal(requestUrl?.searchParams.get('slug'), 'slugged-article');
  });
});
