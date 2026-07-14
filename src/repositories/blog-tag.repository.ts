import { BlogTagSelect, BlogTagCreateInput, BlogTagUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'BlogTagRepository',
  function: '',
};

export const createBlogTag = async (
  tag: BlogTagCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogTag.create({ data: tag }).catch(err => {
    logContext.function = 'createBlogTag';
    logger.error(logContext, 'Error in createBlogTag repository', { error: err });
    throw new Error('DB: blog tag create operation failed');
  });
};

export const findBlogTagById = async (blogTagId: string, select?: BlogTagSelect) => {
  return await prisma.blogTag.findUnique({
    where: { blogTagId },
    select: select || {
      blogTagId: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findBlogTagById';
    logger.error(logContext, 'Error in findBlogTagById repository', { error: err });
    throw new Error('DB: findBlogTagById operation failed');
  });
};

export const findBlogTagBySlug = async (slug: string, select?: BlogTagSelect) => {
  return await prisma.blogTag.findUnique({
    where: { slug },
    select: select || {
      blogTagId: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findBlogTagBySlug';
    logger.error(logContext, 'Error in findBlogTagBySlug repository', { error: err });
    throw new Error('DB: findBlogTagBySlug operation failed');
  });
};

export const findAllBlogTags = async (select?: BlogTagSelect) => {
  return await prisma.blogTag.findMany({
    orderBy: { name: 'asc' },
    select: select || {
      blogTagId: true,
      name: true,
      slug: true,
    },
  }).catch(err => {
    logContext.function = 'findAllBlogTags';
    logger.error(logContext, 'Error in findAllBlogTags repository', { error: err });
    throw new Error('DB: findAllBlogTags operation failed');
  });
};

export const updateBlogTag = async (
  blogTagId: string,
  data: BlogTagUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogTag.update({
    where: { blogTagId },
    data,
  }).catch(err => {
    logContext.function = 'updateBlogTag';
    logger.error(logContext, 'Error in updateBlogTag repository', { error: err });
    throw new Error('DB: blog tag update operation failed');
  });
};

export const deleteBlogTag = async (
  blogTagId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.blogTag.delete({
    where: { blogTagId },
  }).catch(err => {
    logContext.function = 'deleteBlogTag';
    logger.error(logContext, 'Error in deleteBlogTag repository', { error: err });
    throw new Error('DB: blog tag delete operation failed');
  });
};
