import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import config from '@config/index';
import { InternalServerError, ValidationError } from '@/utils/custom-error';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BLOG_IMAGE_PREFIX = 'blog_title_image';
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const spaces = config.spaces;
const configured = Boolean(
  spaces.bucket && spaces.accessKeyId && spaces.secretAccessKey,
);
const parsedEndpoint = new URL(spaces.endpoint);
const regionalHost = `${spaces.region}.digitaloceanspaces.com`;
const endpoint =
  parsedEndpoint.hostname === regionalHost
    ? parsedEndpoint.origin
    : `https://${regionalHost}`;
const client = configured
  ? new S3Client({
      region: spaces.region,
      endpoint,
      credentials: {
        accessKeyId: spaces.accessKeyId,
        secretAccessKey: spaces.secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  : null;

const getClient = (): S3Client => {
  if (!client) {
    throw new InternalServerError({
      message: 'Blog image storage is not configured.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
  return client;
};

const matchesImageSignature = (contentType: string, image: Buffer): boolean => {
  if (contentType === 'image/jpeg') {
    return image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return image.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return (
    contentType === 'image/webp' &&
    image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP'
  );
};

export const uploadBlogFeaturedImage = async (
  contentType: string,
  imageBase64: string,
): Promise<string> => {
  const extension = extensions[contentType];
  if (!extension) {
    throw new ValidationError({
      message: 'Unsupported blog image format.',
      code: 'VALIDATION_ERROR',
    });
  }

  const image = Buffer.from(imageBase64, 'base64');
  if (
    image.length === 0 ||
    image.length > MAX_IMAGE_BYTES ||
    image.toString('base64') !== imageBase64 ||
    !matchesImageSignature(contentType, image)
  ) {
    throw new ValidationError({
      message: 'Choose a valid JPEG, PNG, or WebP image under 5 MB.',
      code: 'VALIDATION_ERROR',
    });
  }

  const key = `${BLOG_IMAGE_PREFIX}/${randomUUID()}.${extension}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: spaces.bucket,
      Key: key,
      Body: image,
      ContentLength: image.length,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return `/api/v1/blog/posts/featured-images/${key.split('/').at(-1)}`;
};

export const getBlogFeaturedImage = async (filename: string) => {
  const match = /^([0-9a-f-]{36})\.(jpg|png|webp)$/.exec(filename);
  if (!match) {
    return null;
  }
  const extension = match[2];
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: spaces.bucket,
      Key: `${BLOG_IMAGE_PREFIX}/${filename}`,
    }),
  );
  if (!response.Body) {
    throw new InternalServerError({
      message: 'Stored blog image has no content.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  return {
    body: Buffer.from(await response.Body.transformToByteArray()),
    contentType: extensionsToContentType(extension),
  };
};

const extensionsToContentType = (extension: string): string => {
  switch (extension) {
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      throw new InternalServerError({
        message: 'Unsupported stored blog image format.',
        code: 'INTERNAL_SERVER_ERROR',
      });
  }
};

export { NoSuchKey };
