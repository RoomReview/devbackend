import { createRequire } from 'node:module';

const domains: unknown = createRequire(import.meta.url)('disposable-email-domains');
if (!Array.isArray(domains)) {
  throw new Error('Unable to load disposable email domain list');
}

const disposableDomains = new Set(
  domains.filter((domain): domain is string => typeof domain === 'string').map((domain) => domain.toLowerCase()),
);

export const isDisposableEmail = (emailAddress: string): boolean => {
  const domain = emailAddress.slice(emailAddress.lastIndexOf('@') + 1).toLowerCase();
  const labels = domain.split('.');
  return labels.some((_, index) => disposableDomains.has(labels.slice(index).join('.')));
};
