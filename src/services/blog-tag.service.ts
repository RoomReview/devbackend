import {
  createBlogTag,
  findBlogTagById,
  findBlogTagBySlug,
  findAllBlogTags,
  updateBlogTag,
  deleteBlogTag,
} from '@/repositories/blog-tag.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateBlogTagDto, UpdateBlogTagDto } from '@/dto/blog-tag.dto';

export const getAllBlogTags = async () => {
  const tags = await findAllBlogTags();
  return { data: tags };
};

export const getBlogTagById = async (id: string) => {
  const tag = await findBlogTagById(id);
  if (!tag) {
    throw new EntityNotFoundError({
      message: `Blog tag with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return tag;
};

export const getBlogTagBySlug = async (slug: string) => {
  const tag = await findBlogTagBySlug(slug);
  if (!tag) {
    throw new EntityNotFoundError({
      message: `Blog tag with slug ${slug} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return tag;
};

export const createNewBlogTag = async (data: CreateBlogTagDto) => {
  // Check unique slug constraint
  const existingSlug = await findBlogTagBySlug(data.slug);
  if (existingSlug) {
    throw new ValidationError({
      message: `Blog tag with slug ${data.slug} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await createBlogTag({
    name: data.name,
    slug: data.slug,
  });
};

export const updateBlogTagById = async (id: string, data: UpdateBlogTagDto) => {
  await getBlogTagById(id); // Throws 404 if missing

  if (data.slug) {
    const existingSlug = await findBlogTagBySlug(data.slug);
    if (existingSlug && existingSlug.blogTagId !== id) {
      throw new ValidationError({
        message: `Blog tag with slug ${data.slug} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateBlogTag(id, {
    name: data.name,
    slug: data.slug,
  });
};

export const deleteBlogTagById = async (id: string) => {
  await getBlogTagById(id); // Throws 404 if missing
  return await deleteBlogTag(id);
};
