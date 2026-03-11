export const getCustomMorganFormat = (tokens: any, req: any, res: any) => {
  const logParts = {
    requestId: req.id ?? '-',
    remoteAddr: tokens['remote-addr']?.(req, res) ?? '-',
    remoteUser: tokens['remote-user']?.(req, res) ?? '-',
    timestamp: tokens['date']?.(req, res, 'iso') ?? '-',
    method: tokens['method']?.(req, res) ?? '-',
    url: tokens['url']?.(req, res) ?? '-',
    httpVersion: tokens['http-version']?.(req, res) ?? '-',
    statusCode: tokens['status']?.(req, res) ?? '-',
    responseTime: `${tokens['response-time']?.(req, res) ?? '-'} ms`,
    contentLength: tokens['res']?.(req, res, 'content-length') ?? '-',
    referrer: tokens['referrer']?.(req, res) ?? '-',
    userAgent: tokens['user-agent']?.(req, res) ?? '-',
  };

  return `${logParts.requestId} [${logParts.timestamp}] ${logParts.remoteAddr} - ${logParts.remoteUser} "${logParts.referrer}" "${logParts.userAgent}" "${logParts.method} ${logParts.url} HTTP/${logParts.httpVersion}" ${logParts.statusCode} ${logParts.responseTime} ${logParts.contentLength} bytes`;
};
