import { BlogCategorySelect, BlogCategoryCreateInput, BlogCategoryUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'BlogCategoryRepository',
  function: '',
};

export const createBlogCategory = async (
  category: BlogCategoryCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogCategory.create({ data: category }).catch(err => {
    logContext.function = 'createBlogCategory';
    logger.error(logContext, 'Error in createBlogCategory repository', { error: err });
    throw new Error('DB: blog category create operation failed');
  });
};

export const findBlogCategoryById = async (blogCategoryId: string, select?: BlogCategorySelect) => {
  return await prisma.blogCategory.findUnique({
    where: { blogCategoryId },
    select: select || {
      blogCategoryId: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findBlogCategoryById';
    logger.error(logContext, 'Error in findBlogCategoryById repository', { error: err });
    throw new Error('DB: findBlogCategoryById operation failed');
  });
};

export const findBlogCategoryBySlug = async (slug: string, select?: BlogCategorySelect) => {
  return await prisma.blogCategory.findUnique({
    where: { slug },
    select: select || {
      blogCategoryId: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findBlogCategoryBySlug';
    logger.error(logContext, 'Error in findBlogCategoryBySlug repository', { error: err });
    throw new Error('DB: findBlogCategoryBySlug operation failed');
  });
};

export const findAllBlogCategories = async (select?: BlogCategorySelect) => {
  return await prisma.blogCategory.findMany({
    orderBy: { name: 'asc' },
    select: select || {
      blogCategoryId: true,
      name: true,
      slug: true,
      description: true,
    },
  }).catch(err => {
    logContext.function = 'findAllBlogCategories';
    logger.error(logContext, 'Error in findAllBlogCategories repository', { error: err });
    throw new Error('DB: findAllBlogCategories operation failed');
  });
};

export const updateBlogCategory = async (
  blogCategoryId: string,
  data: BlogCategoryUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogCategory.update({
    where: { blogCategoryId },
    data,
  }).catch(err => {
    logContext.function = 'updateBlogCategory';
    logger.error(logContext, 'Error in updateBlogCategory repository', { error: err });
    throw new Error('DB: blog category update operation failed');
  });
};

export const deleteBlogCategory = async (
  blogCategoryId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogCategory.delete({
    where: { blogCategoryId },
  }).catch(err => {
    logContext.function = 'deleteBlogCategory';
    logger.error(logContext, 'Error in deleteBlogCategory repository', { error: err });
    throw new Error('DB: blog category delete operation failed');
  });
};
