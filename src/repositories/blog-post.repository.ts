import { randomUUID } from 'node:crypto';
import prisma from '@/config/database';

export const blogPostRepository = {
  findPublished: () =>
    prisma.blog_posts.findMany({
      where: { status: 'PUBLISHED' },
      include: { blog_categories: true, blog_tags: true },
      orderBy: [{ published_at: 'desc' }, { created_at: 'desc' }],
    }),

  findPublishedById: (id: string) =>
    prisma.blog_posts.findFirst({
      where: { blog_post_id: id, status: 'PUBLISHED' },
      include: { blog_categories: true, blog_tags: true },
    }),

  findPublishedBySlug: (slug: string) =>
    prisma.blog_posts.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { blog_categories: true, blog_tags: true },
    }),

  findById: (id: string) =>
    prisma.blog_posts.findUnique({ where: { blog_post_id: id } }),

  createDraft: (post: { title: string; excerpt: string; content: string }) => {
    const id = randomUUID();
    const baseSlug =
      post.title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 180) || 'blog-post';

    return prisma.blog_posts.create({
      data: {
        blog_post_id: id,
        title: post.title,
        slug: `${baseSlug}-${id.slice(0, 8)}`,
        excerpt: post.excerpt,
        content: post.content,
        status: 'DRAFT',
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: { blog_categories: true, blog_tags: true },
    });
  },

  update: (
    id: string,
    post: { title: string; excerpt: string; content: string },
  ) =>
    prisma.blog_posts.update({
      where: { blog_post_id: id },
      data: { ...post, updated_at: new Date() },
      include: { blog_categories: true, blog_tags: true },
    }),

  publish: (id: string, publishedAt: Date | null) =>
    prisma.blog_posts.update({
      where: { blog_post_id: id },
      data: {
        status: 'PUBLISHED',
        published_at: publishedAt ?? new Date(),
        updated_at: new Date(),
      },
      include: { blog_categories: true, blog_tags: true },
    }),

  delete: (id: string) =>
    prisma.blog_posts.delete({ where: { blog_post_id: id } }),
};
