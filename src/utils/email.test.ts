import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import config from '../config';
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendReviewModerationEmail,
  sendSubscriptionInvoiceEmail,
  sendNewsletterConfirmationEmail,
  sendNewsletterArticleEmail,
  sendAgencyInvitationEmail,
} from './email';

interface CapturedEmail {
  to?: string;
  from?: { email: string; name?: string };
  subject?: string;
  text?: string;
  html?: string;
  template_id?: string;
  categories?: string[];
  personalizations?: Array<{
    to: { email: string; name?: string };
    dynamic_template_data?: Record<string, string>;
  }>;
  tracking_settings?: {
    click_tracking: { enable: boolean; enable_text: boolean };
  };
  mail_settings?: { sandbox_mode: { enable: boolean } };
  asm?: { group_id: number };
}

const emailRequests: Array<{ url: string; init?: RequestInit }> = [];
let responseStatus = 202;
let responseBody = '';

mock.method(globalThis, 'fetch', async (input, init) => {
  emailRequests.push({ url: String(input), init });
  return new Response(responseBody || null, { status: responseStatus });
});

beforeEach(() => {
  emailRequests.length = 0;
  responseStatus = 202;
  responseBody = '';
});

const getLastEmail = (): CapturedEmail => {
  const body = emailRequests.at(-1)?.init?.body;
  assert.equal(typeof body, 'string');
  return JSON.parse(body) as CapturedEmail;
};

describe('sendVerificationEmail', () => {
  it('should send verification email', async () => {
    const toEmail = 'test@example.com';
    const code = '123456';
    const name = 'Test';
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    await sendVerificationEmail(toEmail, code, name);

    const lastCallArgs = getLastEmail();

    assert.deepStrictEqual(lastCallArgs, {
      from: {
        email: config.verificationEmailFrom,
        name: 'RoomReview',
      },
      subject: 'Verify your RoomReview email address',
      text: `Hi ${name},\n\nVerify your email address by opening this link:\n${new URL(`/verify-email?email=${encodeURIComponent(toEmail)}&code=${encodeURIComponent(code)}`, config.frontendUrl)}\n\nOr enter this verification code: ${code}\n\nRoomReview`,
      html: `<p>Hi ${name},</p><p>Verify your email address by clicking the link below:</p><p><a href="${new URL(`/verify-email?email=${encodeURIComponent(toEmail)}&code=${encodeURIComponent(code)}`, config.frontendUrl).toString().replace(/&/g, '&amp;')}">Verify my email address</a></p><p>If the button does not work, enter this verification code on RoomReview:</p><p><strong>${code}</strong></p><p>RoomReview</p>`,
      categories: ['verification'],
      personalizations: [
        {
          to: {
            email: toEmail,
            name: name,
          },
        },
      ],
      mail_settings: {
        sandbox_mode: {
          enable: config.sendGridSandboxMode,
        },
      },
    });

  });

  it('preserves a team invitation through the email verification link', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    await sendVerificationEmail('agent@example.com', '123456', 'Agent', 'invitation-token');
    const data = getLastEmail();
    assert.match(data.text, /teamInviteToken=invitation-token/);
  });

  it('should throw error if toEmail is not defined', async () => {
    const toEmail = '';
    const code = '123456';
    const name = 'Test';
    await assert.rejects(sendVerificationEmail(toEmail, code, name), {
      message: 'toEmail is not defined',
    });
  });

  it('should throw error if code is not defined', async () => {
    const toEmail = 'test@example.com';
    const code = '';
    const name = 'Test';
    await assert.rejects(sendVerificationEmail(toEmail, code, name), {
      message: 'code is not defined',
    });
  });

  it('should throw error if name is not defined', async () => {
    const toEmail = 'test@example.com';
    const code = '123456';
    const name = '';
    await assert.rejects(sendVerificationEmail(toEmail, code, name), {
      message: 'name is not defined',
    });
  });
});

describe('sendResetPasswordEmail', () => {
  it('should send reset password email', async () => {
    const toEmail = 'test@example.com';
    const name = 'Test';
    const resetPasswordLink = 'https://roomreview.co.uk/reset-password?token=token';
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }

    await sendResetPasswordEmail(toEmail, name, resetPasswordLink);

    const lastCallArgs = getLastEmail();

    assert.deepStrictEqual(lastCallArgs, {
      from: {
        email: config.emailFrom,
        name: 'RoomReview',
      },
      template_id: config.sendResetPasswordCodeV1TemplateId,
      categories: ['reset-password'],
      personalizations: [
        {
          to: {
            email: toEmail,
            name: name,
          },
          dynamic_template_data: {
            ...config.sendGridTemplateParameters[
              config.sendResetPasswordCodeV1TemplateId
            ],
            reset_pswd_button_link: resetPasswordLink,
            name: name,
          },
        },
      ],
      tracking_settings: {
        click_tracking: {
          enable: false,
          enable_text: false,
        },
      },
      mail_settings: {
        sandbox_mode: {
          enable: config.sendGridSandboxMode,
        },
      },
    });
  });

  it('should throw error if toEmail is not defined', async () => {
    const toEmail = '';
    const name = 'Test';
    await assert.rejects(sendResetPasswordEmail(toEmail, name), {
      message: 'toEmail is not defined',
    });
  });

  it('should throw error if name is not defined', async () => {
    const toEmail = 'test@example.com';
    const name = '';
    await assert.rejects(sendResetPasswordEmail(toEmail, name), {
      message: 'name is not defined',
    });
  });
});

describe('sendReviewModerationEmail', () => {
  it('sends a review status email with an escaped rejection reason', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }

    await sendReviewModerationEmail(
      'test@example.com',
      'Test',
      '<Review>',
      'REJECTED',
      '<Please remove private details>',
    );

    const data = getLastEmail();
    assert.equal(data.to, 'test@example.com');
    assert.equal(data.categories[0], 'review-moderation');
    assert.match(data.text, /not approved/i);
    assert.match(data.text, /Please remove private details/);
    assert.match(data.html, /&lt;Review&gt;/);
    assert.match(data.html, /&lt;Please remove private details&gt;/);
    assert.doesNotMatch(data.html, /<Please remove private details>/);
  });
});

describe('sendSubscriptionInvoiceEmail', () => {
  it('sends a paid subscription invoice with an escaped invoice link', async () => {
    const originalEmailFrom = config.emailFrom;
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    if (!config.emailFrom) {
      (config as any).emailFrom = 'billing@example.com';
    }

    try {
      await sendSubscriptionInvoiceEmail(
        'customer@example.com',
        'Test Customer',
        {
          number: '<INV-123>',
          amountPaid: 1750,
          currency: 'gbp',
          hostedInvoiceUrl: 'https://billing.example.com/invoice?id=1&source=stripe',
          invoicePdf: 'https://billing.example.com/invoice.pdf',
        },
      );

      const data = getLastEmail();
      assert.equal(data.to, 'customer@example.com');
      assert.equal(data.from.email, config.emailFrom);
      assert.equal(data.subject, 'Your RoomReview subscription invoice <INV-123>');
      assert.match(data.text, /£17\.50/);
      assert.match(data.text, /https:\/\/billing\.example\.com\/invoice\?id=1&source=stripe/);
      assert.match(data.html, /&lt;INV-123&gt;/);
      assert.match(data.html, /id=1&amp;source=stripe/);
      assert.equal(data.categories[0], 'subscription-invoice');
    } finally {
      (config as any).emailFrom = originalEmailFrom;
    }
  });

  it('rejects invalid invoice amounts', async () => {
    await assert.rejects(
      sendSubscriptionInvoiceEmail('customer@example.com', 'Test Customer', {
        number: 'INV-123',
        amountPaid: -1,
        currency: 'gbp',
        hostedInvoiceUrl: null,
        invoicePdf: null,
      }),
      { message: 'Invoice amount must be a non-negative number' },
    );
  });
});

describe('sendAgencyInvitationEmail', () => {
  it('sends an invitation link and escapes agency details in the email body', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    await sendAgencyInvitationEmail(
      'agent@example.com',
      '<Founder>',
      'A&B Agency',
      'invitation-token',
    );

    const data = getLastEmail();
    assert.equal(data.personalizations[0].to.email, 'agent@example.com');
    assert.match(data.text, /invited you to join A&B Agency on RoomReview/);
    assert.match(data.html, /&lt;Founder&gt;/);
    assert.match(data.html, /A&amp;B Agency/);
    assert.match(data.html, /team-invite\?token=invitation-token/);
    assert.equal(data.categories[0], 'agency-invitation');
  });
});

describe('newsletter email helpers', () => {
  it('sends a double-opt-in link to the configured website', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    await sendNewsletterConfirmationEmail(
      'reader@example.com',
      'confirmation-token',
    );

    const data = getLastEmail();
    assert.equal(data.from.email, 'info@roomreview.co.uk');
    assert.match(
      data.text,
      new RegExp(
        `${config.websiteUrl}/api/v1/newsletter/confirm/confirmation-token`,
      ),
    );
  });

  it('includes escaped article content, group suppression and a direct unsubscribe link', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    await sendNewsletterArticleEmail(
      'reader@example.com',
      '<New article>',
      '<Summary & details>',
      'https://roomreview.co.uk/blog/new-article',
      'https://roomreview.co.uk/api/v1/newsletter/unsubscribe/token',
      123,
    );

    const data = getLastEmail();
    assert.equal(data.asm?.group_id, 123);
    assert.match(data.html, /&lt;New article&gt;/);
    assert.match(data.html, /&lt;Summary &amp; details&gt;/);
    assert.match(data.html, /newsletter\/unsubscribe\/token/);
  });
});

// test if sendGridApiKey is not defined
describe('sendEmail', () => {
  it('posts the email payload to SendGrid with bearer authorization', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }

    await sendVerificationEmail('test@example.com', '123456', 'Test');

    const request = emailRequests.at(-1);
    assert.ok(request);
    assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(request.init?.method, 'POST');
    const headers = new Headers(request.init?.headers);
    assert.equal(headers.get('authorization')?.startsWith('Bearer '), true);
    assert.equal(headers.get('content-type'), 'application/json');
  });

  it('surfaces SendGrid HTTP failures', async () => {
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    responseStatus = 400;
    responseBody = JSON.stringify({
      errors: [
        {
          message:
            'The sender sender@example.com is not authorized.',
          field: 'from.email',
        },
      ],
    });
    const loggedErrors: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      loggedErrors.push(
        args
          .map((argument) =>
            typeof argument === 'string' ? argument : JSON.stringify(argument),
          )
          .join(' '),
      );
    };

    try {
      await assert.rejects(
        sendVerificationEmail('test@example.com', '123456', 'Test'),
        { message: 'Failed to send email' },
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.match(loggedErrors.join('\n'), /The sender \[redacted email\] is not authorized/);
    assert.doesNotMatch(loggedErrors.join('\n'), /sender@example\.com/);
  });

  it('should throw error if sendGridApiKey is not defined', async () => {
    const toEmail = 'test@example.com';
    const code = '123456';
    const name = 'Test';

    // 1. Save original value
    const originalApiKey = config.sendGridApiKey;
    // 2. Override for this test case
    (config as any).sendGridApiKey = '';

    try {
      await assert.rejects(
        sendVerificationEmail(toEmail, code, name),
        new Error('SendGrid API key is not defined'),
      );
    } finally {
      // 3. Always restore the original value to prevent breaking other tests
      (config as any).sendGridApiKey = originalApiKey;
    }
  });
});
