import {
  createBlogPost,
  findBlogPostById,
  findBlogPostBySlug,
  findAllBlogPosts,
  countBlogPosts,
  updateBlogPost,
  deleteBlogPost,
  FindBlogPostsFilter,
} from '@/repositories/blog-post.repository';
import { findBlogCategoryById } from '@/repositories/blog-category.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateBlogPostDto, UpdateBlogPostDto } from '@/dto/blog-post.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';
import { BlogStatus } from '@/generated/prisma/enums';

export const getAllBlogPosts = async (page: number, limit: number, filter?: FindBlogPostsFilter) => {
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllBlogPosts(limit, offset, filter),
    countBlogPosts(filter),
  ]);
  return buildPaginatedResult(items, total, page, limit);
};

export const getBlogPostById = async (id: string) => {
  const post = await findBlogPostById(id);
  if (!post) {
    throw new EntityNotFoundError({
      message: `Blog post with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return post;
};

export const getBlogPostBySlug = async (slug: string) => {
  const post = await findBlogPostBySlug(slug);
  if (!post) {
    throw new EntityNotFoundError({
      message: `Blog post with slug ${slug} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return post;
};

export const createNewBlogPost = async (data: CreateBlogPostDto) => {
  // Validate unique slug
  const existingPost = await findBlogPostBySlug(data.slug);
  if (existingPost) {
    throw new ValidationError({
      message: `Blog post with slug ${data.slug} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate category if provided
  if (data.categoryId) {
    const categoryExists = await findBlogCategoryById(data.categoryId);
    if (!categoryExists) {
      throw new ValidationError({
        message: `Blog category with ID ${data.categoryId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  const publishedAt = data.status === BlogStatus.PUBLISHED ? new Date() : null;

  return await createBlogPost({
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    content: data.content,
    featuredImage: data.featuredImage,
    readTime: data.readTime,
    status: data.status || BlogStatus.DRAFT,
    publishedAt,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    ...(data.categoryId ? { category: { connect: { blogCategoryId: data.categoryId } } } : {}),
    ...(data.tagIds && data.tagIds.length > 0
      ? {
          tags: {
            connect: data.tagIds.map(id => ({ blogTagId: id })),
          },
        }
      : {}),
  });
};

export const updateBlogPostById = async (id: string, data: UpdateBlogPostDto) => {
  const existing = await getBlogPostById(id); // Throws 404 if missing

  if (data.slug) {
    const existingPost = await findBlogPostBySlug(data.slug);
    if (existingPost && existingPost.blogPostId !== id) {
      throw new ValidationError({
        message: `Blog post with slug ${data.slug} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  if (data.categoryId) {
    const categoryExists = await findBlogCategoryById(data.categoryId);
    if (!categoryExists) {
      throw new ValidationError({
        message: `Blog category with ID ${data.categoryId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  // Set publishedAt if transitioning to PUBLISHED
  let publishedAt = existing.publishedAt;
  if (data.status === BlogStatus.PUBLISHED && existing.status !== BlogStatus.PUBLISHED) {
    publishedAt = new Date();
  }

  const updateData: any = {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    content: data.content,
    featuredImage: data.featuredImage,
    readTime: data.readTime,
    status: data.status,
    publishedAt,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
  };

  if (data.categoryId !== undefined) {
    updateData.category = data.categoryId
      ? { connect: { blogCategoryId: data.categoryId } }
      : { disconnect: true };
  }

  if (data.tagIds !== undefined) {
    updateData.tags = {
      set: data.tagIds.map(tagId => ({ blogTagId: tagId })),
    };
  }

  return await updateBlogPost(id, updateData);
};

export const deleteBlogPostById = async (id: string) => {
  await getBlogPostById(id); // Throws 404 if missing
  return await deleteBlogPost(id);
};
