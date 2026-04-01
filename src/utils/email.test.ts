import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import config from '../config';
import { sendVerificationEmail, sendResetPasswordEmail } from './email';
import sgMail from '@sendgrid/mail';

mock.method(sgMail, 'send', async () => { });
mock.method(sgMail, 'setApiKey', () => { });

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
                email: config.emailFrom,
                name: 'RoomReview',
            },
            templateId: config.sendVerifyEmailCodeV1TemplateId,
            categories: ['verification'],
            personalizations: [
                {
                    to: {
                        email: toEmail,
                        name: name,
                    },
                    dynamicTemplateData: {
                        ...config.sendGridTemplateParameters[config.sendVerifyEmailCodeV1TemplateId],
                        code: code,
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
        await assert.rejects(sendVerificationEmail(toEmail, code, name), { message: 'toEmail is not defined' });
    });

    it('should throw error if code is not defined', async () => {
        const toEmail = 'test@example.com';
        const code = '';
        const name = 'Test';
        await assert.rejects(sendVerificationEmail(toEmail, code, name), { message: 'code is not defined' });
    });

    it('should throw error if name is not defined', async () => {
        const toEmail = 'test@example.com';
        const code = '123456';
        const name = '';
        await assert.rejects(sendVerificationEmail(toEmail, code, name), { message: 'name is not defined' });
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
                        ...config.sendGridTemplateParameters[config.sendResetPasswordCodeV1TemplateId],
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
        await assert.rejects(sendResetPasswordEmail(toEmail, name), { message: 'toEmail is not defined' });
    });

    it('should throw error if name is not defined', async () => {
        const toEmail = 'test@example.com';
        const name = '';
        await assert.rejects(sendResetPasswordEmail(toEmail, name), { message: 'name is not defined' });
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
                new Error('SendGrid API key is not defined')
            );
        } finally {
            // 3. Always restore the original value to prevent breaking other tests
            (config as any).sendGridApiKey = originalApiKey;
        }
    });
});
