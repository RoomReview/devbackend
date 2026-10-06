import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '@config/index';

type SpacesSignerConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  mapPrefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  signedUrlTtlSeconds: number;
};

const resolveSpacesOriginEndpoint = (region: string, endpoint: string) => {
  const parsedEndpoint = new URL(endpoint);
  const regionalHost = `${region}.digitaloceanspaces.com`;
  const isRegionalSpacesOrigin = parsedEndpoint.hostname === regionalHost;

  return isRegionalSpacesOrigin
    ? parsedEndpoint.origin
    : `https://${regionalHost}`;
};

export const createSpacesObjectUrlSigner = (settings: SpacesSignerConfig) => {
  const hasCredentials = Boolean(settings.accessKeyId && settings.secretAccessKey);
  const client = hasCredentials
    ? new S3Client({
        region: settings.region,
        endpoint: resolveSpacesOriginEndpoint(settings.region, settings.endpoint),
        credentials: {
          accessKeyId: settings.accessKeyId,
          secretAccessKey: settings.secretAccessKey,
        },
      })
    : null;

  return async (key: string) => {
    if (!client || !settings.bucket) return null;

    const configuredTtl = Number.isFinite(settings.signedUrlTtlSeconds)
      ? Math.floor(settings.signedUrlTtlSeconds)
      : 900;
    const expiresIn = Math.min(Math.max(configuredTtl, 1), 604800);
    const prefix = settings.mapPrefix.replace(/^\/+|\/+$/g, '');
    const keyWithoutLeadingSlashes = key.replace(/^\/+/, '');
    const objectKey = prefix ? `${prefix}/${keyWithoutLeadingSlashes}` : keyWithoutLeadingSlashes;
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: settings.bucket, Key: objectKey }),
      { expiresIn },
    );
  };
};

export const getSignedSpacesObjectUrl = createSpacesObjectUrlSigner(config.spaces);