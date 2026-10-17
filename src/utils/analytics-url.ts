const sensitiveQueryParameters = new Set([
  'accesstoken',
  'refreshtoken',
  'token',
  'idtoken',
  'code',
  'authorization',
  'clientsecret',
]);

export const redactAnalyticsUrl = (value: string): string => {
  const fragmentIndex = value.indexOf('#');
  const withoutFragment = fragmentIndex === -1 ? value : value.slice(0, fragmentIndex);
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex === -1) {
    return withoutFragment;
  }

  const path = withoutFragment.slice(0, queryIndex);
  const parameters = new URLSearchParams(withoutFragment.slice(queryIndex + 1));
  for (const key of parameters.keys()) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    if (
      sensitiveQueryParameters.has(normalizedKey) ||
      normalizedKey.endsWith('token') ||
      normalizedKey.endsWith('secret')
    ) {
      parameters.set(key, '[REDACTED]');
    }
  }
  const query = parameters.toString();
  return query ? `${path}?${query}` : path;
};
