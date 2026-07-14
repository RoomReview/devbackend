import {
  createBlogCategory,
  findBlogCategoryById,
  findBlogCategoryBySlug,
  findAllBlogCategories,
  updateBlogCategory,
  deleteBlogCategory,
} from '@/repositories/blog-category.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateBlogCategoryDto, UpdateBlogCategoryDto } from '@/dto/blog-category.dto';

export const getAllBlogCategories = async () => {
  const categories = await findAllBlogCategories();
  return { data: categories };
};

export const getBlogCategoryById = async (id: string) => {
  const category = await findBlogCategoryById(id);
  if (!category) {
    throw new EntityNotFoundError({
      message: `Blog category with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return category;
};

export const getBlogCategoryBySlug = async (slug: string) => {
  const category = await findBlogCategoryBySlug(slug);
  if (!category) {
    throw new EntityNotFoundError({
      message: `Blog category with slug ${slug} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return category;
};

export const createNewBlogCategory = async (data: CreateBlogCategoryDto) => {
  // Check unique slug constraint
  const existingSlug = await findBlogCategoryBySlug(data.slug);
  if (existingSlug) {
    throw new ValidationError({
      message: `Blog category with slug ${data.slug} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await createBlogCategory({
    name: data.name,
    slug: data.slug,
    description: data.description,
  });
};

export const updateBlogCategoryById = async (id: string, data: UpdateBlogCategoryDto) => {
  await getBlogCategoryById(id); // Throws 404 if missing

  if (data.slug) {
    const existingSlug = await findBlogCategoryBySlug(data.slug);
    if (existingSlug && existingSlug.blogCategoryId !== id) {
      throw new ValidationError({
        message: `Blog category with slug ${data.slug} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateBlogCategory(id, {
    name: data.name,
    slug: data.slug,
    description: data.description,
  });
};

export const deleteBlogCategoryById = async (id: string) => {
  await getBlogCategoryById(id); // Throws 404 if missing
  return await deleteBlogCategory(id);
};
