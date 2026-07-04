import {
  createBorough,
  findBoroughById,
  findBoroughBySlug,
  findAllBoroughs,
  countBoroughs,
  updateBorough,
  deleteBorough,
} from '@/repositories/borough.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateBoroughDto, UpdateBoroughDto } from '@/dto/borough.dto';
import { paginate } from '@/utils/helpers';

export const getAllBoroughs = async (page?: number, limit?: number) => {
  if (page && limit) {
    const { offset } = paginate(page, limit);
    const boroughs = await findAllBoroughs(limit, offset);
    const total = await countBoroughs();
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: boroughs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  const boroughs = await findAllBoroughs();
  return {
    data: boroughs,
    pagination: null,
  };
};

export const getBoroughById = async (id: string) => {
  const borough = await findBoroughById(id);
  if (!borough) {
    throw new EntityNotFoundError({
      message: `Borough with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return borough;
};

export const getBoroughBySlug = async (slug: string) => {
  const borough = await findBoroughBySlug(slug);
  if (!borough) {
    throw new EntityNotFoundError({
      message: `Borough with slug ${slug} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return borough;
};

export const createNewBorough = async (data: CreateBoroughDto) => {
  // Check unique constraints (slug and name)
  const existingSlug = await findBoroughBySlug(data.slug);
  if (existingSlug) {
    throw new ValidationError({
      message: `Borough with slug ${data.slug} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await createBorough({
    name: data.name,
    slug: data.slug,
    description: data.description,
    image: data.image,
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics || {},
  });
};

export const updateBoroughById = async (id: string, data: UpdateBoroughDto) => {
  await getBoroughById(id); // Throws 404 if missing

  if (data.slug) {
    const existingSlug = await findBoroughBySlug(data.slug);
    if (existingSlug && existingSlug.boroughId !== id) {
      throw new ValidationError({
        message: `Borough with slug ${data.slug} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateBorough(id, {
    name: data.name,
    slug: data.slug,
    description: data.description,
    image: data.image,
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics,
  });
};

export const deleteBoroughById = async (id: string) => {
  await getBoroughById(id); // Throws 404 if missing
  return await deleteBorough(id);
};
