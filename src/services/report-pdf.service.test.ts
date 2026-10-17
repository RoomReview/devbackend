import assert from 'node:assert';
import { describe, it } from 'node:test';
import { renderAreaReportPdf } from './report-pdf.service.ts';

describe('report-pdf.service', () => {
  it('keeps compact report sections together without forcing page breaks', async () => {
    const pdf = await renderAreaReportPdf({
      postcode: 'BR1 1AB',
      html: '<div class="buyer-report-document"><header>RoomReview</header><main><section>Area summary</section><section>Transport</section></main></div>',
      css: 'section { height: 240px; }',
    });
    const pdfText = pdf.toString('latin1');
    const pageCount = pdfText.match(/\/Type\s*\/Page\b/g)?.length ?? 0;

    assert.strictEqual(pageCount, 1);
    assert.match(pdfText, /\/MediaBox\s*\[\s*0\s+0\s+594\.\d+\s+841\.\d+\s*\]/);
  });

  it('flows long report sections across the required number of A4 pages', async () => {
    const pdf = await renderAreaReportPdf({
      postcode: 'BR1 1AB',
      html: '<div class="buyer-report-document"><header>RoomReview</header><main><section>Area summary</section><section>Transport</section></main></div>',
      css: 'section { height: 700px; }',
    });
    const pdfText = pdf.toString('latin1');
    const pageCount = pdfText.match(/\/Type\s*\/Page\b/g)?.length ?? 0;

    assert.strictEqual(pageCount, 2);
  });

  it('rejects active HTML content before rendering', async () => {
    await assert.rejects(
      renderAreaReportPdf({
        postcode: 'BR1 1AB',
        html: '<script>alert(1)</script>',
        css: '',
      }),
      { message: 'The report markup contains unsupported content' },
    );
  });
});
