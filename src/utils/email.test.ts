import { describe, it, mock } from 'node:test';
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
import sgMail from '@sendgrid/mail';

mock.method(sgMail, 'send', async () => {});
mock.method(sgMail, 'setApiKey', () => {});

describe('sendVerificationEmail', () => {
  it('should send verification email', async () => {
    const toEmail = 'test@example.com';
    const code = '123456';
    const name = 'Test';
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }
    await sendVerificationEmail(toEmail, code, name);

    const mockCalls = (sgMail.send as any).mock.calls;
    const lastCallArgs = mockCalls[mockCalls.length - 1].arguments[0];

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
      mailSettings: {
        sandboxMode: {
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
    const mockCalls = (sgMail.send as any).mock.calls;
    const data = mockCalls[mockCalls.length - 1].arguments[0];
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

    const mockCalls = (sgMail.send as any).mock.calls;
    const lastCallArgs = mockCalls[mockCalls.length - 1].arguments[0];

    assert.deepStrictEqual(lastCallArgs, {
      from: {
        email: config.emailFrom,
        name: 'RoomReview',
      },
      templateId: config.sendResetPasswordCodeV1TemplateId,
      categories: ['reset-password'],
      personalizations: [
        {
          to: {
            email: toEmail,
            name: name,
          },
          dynamicTemplateData: {
            ...config.sendGridTemplateParameters[
              config.sendResetPasswordCodeV1TemplateId
            ],
            reset_pswd_button_link: resetPasswordLink,
            name: name,
          },
        },
      ],
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
      },
      mailSettings: {
        sandboxMode: {
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

    const mockCalls = (sgMail.send as any).mock.calls;
    const data = mockCalls[mockCalls.length - 1].arguments[0];
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

      const mockCalls = (sgMail.send as any).mock.calls;
      const data = mockCalls[mockCalls.length - 1].arguments[0];
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

    const mockCalls = (sgMail.send as any).mock.calls;
    const data = mockCalls[mockCalls.length - 1].arguments[0];
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

    const mockCalls = (sgMail.send as any).mock.calls;
    const data = mockCalls[mockCalls.length - 1].arguments[0];
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

    const mockCalls = (sgMail.send as any).mock.calls;
    const data = mockCalls[mockCalls.length - 1].arguments[0];
    assert.equal(data.asm.groupId, 123);
    assert.match(data.html, /&lt;New article&gt;/);
    assert.match(data.html, /&lt;Summary &amp; details&gt;/);
    assert.match(data.html, /newsletter\/unsubscribe\/token/);
  });
});

// test if sendGridApiKey is not defined
describe('sendEmail', () => {
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
