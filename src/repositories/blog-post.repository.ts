import { BlogPostSelect, BlogPostCreateInput, BlogPostUpdateInput } from '@/generated/prisma/models';
import { BlogStatus } from '@/generated/prisma/enums';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'BlogPostRepository',
  function: '',
};

export const createBlogPost = async (
  post: BlogPostCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogPost.create({ data: post }).catch(err => {
    logContext.function = 'createBlogPost';
    logger.error(logContext, 'Error in createBlogPost repository', { error: err });
    throw new Error('DB: blog post create operation failed');
  });
};

export const findBlogPostById = async (blogPostId: string, select?: BlogPostSelect) => {
  return await prisma.blogPost.findUnique({
    where: { blogPostId },
    select: select || {
      blogPostId: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      featuredImage: true,
      readTime: true,
      status: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      category: {
        select: {
          blogCategoryId: true,
          name: true,
          slug: true,
        },
      },
      tags: {
        select: {
          blogTagId: true,
          name: true,
          slug: true,
        },
      },
    },
  }).catch(err => {
    logContext.function = 'findBlogPostById';
    logger.error(logContext, 'Error in findBlogPostById repository', { error: err });
    throw new Error('DB: findBlogPostById operation failed');
  });
};

export const findBlogPostBySlug = async (slug: string, select?: BlogPostSelect) => {
  return await prisma.blogPost.findUnique({
    where: { slug },
    select: select || {
      blogPostId: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      featuredImage: true,
      readTime: true,
      status: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      category: {
        select: {
          blogCategoryId: true,
          name: true,
          slug: true,
        },
      },
      tags: {
        select: {
          blogTagId: true,
          name: true,
          slug: true,
        },
      },
    },
  }).catch(err => {
    logContext.function = 'findBlogPostBySlug';
    logger.error(logContext, 'Error in findBlogPostBySlug repository', { error: err });
    throw new Error('DB: findBlogPostBySlug operation failed');
  });
};

export interface FindBlogPostsFilter {
  categoryId?: string;
  tagId?: string;
  status?: BlogStatus;
}

export const findAllBlogPosts = async (
  limit: number,
  offset: number,
  filter?: FindBlogPostsFilter,
  select?: BlogPostSelect,
) => {
  const where: any = {};
  if (filter?.categoryId) where.categoryId = filter.categoryId;
  if (filter?.status) where.status = filter.status;
  if (filter?.tagId) {
    where.tags = {
      some: {
        blogTagId: filter.tagId,
      },
    };
  }

  return await prisma.blogPost.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      blogPostId: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      readTime: true,
      status: true,
      categoryId: true,
      createdAt: true,
      publishedAt: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  }).catch(err => {
    logContext.function = 'findAllBlogPosts';
    logger.error(logContext, 'Error in findAllBlogPosts repository', { error: err });
    throw new Error('DB: findAllBlogPosts operation failed');
  });
};

export const countBlogPosts = async (filter?: FindBlogPostsFilter) => {
  const where: any = {};
  if (filter?.categoryId) where.categoryId = filter.categoryId;
  if (filter?.status) where.status = filter.status;
  if (filter?.tagId) {
    where.tags = {
      some: {
        blogTagId: filter.tagId,
      },
    };
  }

  return await prisma.blogPost.count({ where }).catch(err => {
    logContext.function = 'countBlogPosts';
    logger.error(logContext, 'Error in countBlogPosts repository', { error: err });
    throw new Error('DB: countBlogPosts operation failed');
  });
};

export const updateBlogPost = async (
  blogPostId: string,
  data: BlogPostUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogPost.update({
    where: { blogPostId },
    data,
  }).catch(err => {
    logContext.function = 'updateBlogPost';
    logger.error(logContext, 'Error in updateBlogPost repository', { error: err });
    throw new Error('DB: blog post update operation failed');
  });
};

export const deleteBlogPost = async (
  blogPostId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogPost.delete({
    where: { blogPostId },
  }).catch(err => {
    logContext.function = 'deleteBlogPost';
    logger.error(logContext, 'Error in deleteBlogPost repository', { error: err });
    throw new Error('DB: blog post delete operation failed');
  });
};
