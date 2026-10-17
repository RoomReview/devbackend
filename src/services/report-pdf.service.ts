import { chromium, type Browser } from 'playwright-core';
import type { AreaReportPdfRequest } from '@/dto/report-pdf.dto';
import { InternalServerError, ValidationError } from '@/utils/custom-error';
import logger, { LogContext } from '@/utils/logger';

const logContext: LogContext = {
  service: 'ReportPdfService',
  function: 'renderAreaReportPdf',
};

const safeHtml = (html: string) => {
  const unsafeMarkup = /<\s*(script|style|iframe|object|embed|base|link|meta|form|input|button|video|audio)\b|(?:\bon[a-z]+\s*=)|javascript\s*:/i;
  const unsafeResource = /(?:src|srcset|href|xlink:href)\s*=\s*(?:["']\s*)?(?:file|https?):|url\(\s*['"]?\s*(?:file|javascript):/i;
  if (unsafeMarkup.test(html) || unsafeResource.test(html)) {
    throw new ValidationError({
      message: 'The report markup contains unsupported content',
      code: 'VALIDATION_ERROR',
    });
  }
  return html;
};

const safeCss = (css: string) => {
  if (/<\/?style\b|url\(\s*['"]?\s*(?:file|javascript):/i.test(css)) {
    throw new ValidationError({
      message: 'The report styles contain unsupported content',
      code: 'VALIDATION_ERROR',
    });
  }
  return css;
};

const printStyles = `
  @page { size: A4 portrait; margin: 12mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .buyer-report-page { width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .buyer-report-document { width: 100% !important; max-width: none !important; margin: 0 !important; overflow: visible !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
  .buyer-report-document > main { padding: 0 !important; }
  .buyer-report-print-control { display: none !important; }
  .buyer-report-document > header,
  .buyer-report-document > main > section:not(.buyer-report-allow-page-break, .buyer-report-page-break-group) {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .buyer-report-document > main > .buyer-report-page-break-group { display: block !important; }
  .buyer-report-document > main > .buyer-report-page-break-group > section {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-bottom: 24px !important;
  }
`;

export const renderAreaReportPdf = async (report: AreaReportPdfRequest): Promise<Buffer> => {
  const html = safeHtml(report.html);
  const css = safeCss(report.css);
  let browser: Browser;
  try {
    browser = await chromium.launch({
      ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (error) {
    logger.error(logContext, 'Could not launch Chromium for PDF generation', { error });
    throw new InternalServerError({
      message: 'PDF generation is temporarily unavailable',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  try {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 704, height: 1032 });
    await page.emulateMedia({ media: 'print' });
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isReportHeroImage = requestUrl.protocol === 'https:'
        && requestUrl.hostname === 'images.unsplash.com'
        && requestUrl.pathname === '/photo-1486406146926-c627a92ad1ab'
        && route.request().resourceType() === 'image';
      if (requestUrl.protocol === 'data:' || isReportHeroImage) {
        await route.continue();
        return;
      }
      await route.abort();
    });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}\n${printStyles}</style></head><body><div class="buyer-report-page">${html}</div></body></html>`,
      { waitUntil: 'load', timeout: 20_000 },
    );
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
  } catch (error) {
    logger.error(logContext, 'Could not render area report PDF', { error });
    throw new InternalServerError({
      message: 'Could not generate the report PDF',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    await browser.close();
  }
};
