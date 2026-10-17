import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import config from '../config';
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendReviewModerationEmail,
  sendNewsletterConfirmationEmail,
  sendNewsletterArticleEmail,
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
    if (!config.sendGridApiKey) {
      (config as any).sendGridApiKey = 'test';
    }

    await sendResetPasswordEmail(toEmail, name);

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
