import sgMail, { MailDataRequired } from '@sendgrid/mail';
import config from '../config';
import logger, { LogContext } from './logger';

const logContext: LogContext = {
    service: 'email.service',
    function: '',
};

const sendEmail = async (data: MailDataRequired) => {
    logContext.function = 'sendEmail';
    if (!config.sendGridApiKey) {
        logger.error(logContext, 'SendGrid API key is not defined', {});
        throw new Error('SendGrid API key is not defined');
    }
    sgMail.setApiKey(config.sendGridApiKey);
    logger.debug(logContext, 'Sending email', { data });
    await sgMail.send(data).catch((error) => {
        logger.error(logContext, 'Failed to send email', JSON.stringify(error, null, 2));
        throw new Error('Failed to send email');
    });
};


export const sendVerificationEmail = async (toEmail: string, code: string, name: string) => {
    let templateData: Record<string, string> = { ...config.sendGridTemplateParameters[config.sendVerifyEmailCodeV1TemplateId] };
    if (!toEmail) {
        throw new Error('toEmail is not defined');
    }
    if (!code) {
        throw new Error('code is not defined');
    }
    if (!name) {
        throw new Error('name is not defined');
    }
    templateData.code = code;
    templateData.name = name;

    const data: MailDataRequired = {
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
                dynamicTemplateData: templateData,
            },
        ],
        mailSettings: {
            sandboxMode: {
                enable: config.sendGridSandboxMode,
            },
        },
    };
    await sendEmail(data);
};

export const sendResetPasswordEmail = async (toEmail: string, name: string, resetPasswordLink?: string) => {
    let templateData: Record<string, string> = { ...config.sendGridTemplateParameters[config.sendResetPasswordCodeV1TemplateId] };
    if (!toEmail) {
        throw new Error('toEmail is not defined');
    }
    if (!name) {
        throw new Error('name is not defined');
    }
    if (resetPasswordLink) {
        templateData.reset_pswd_button_link = resetPasswordLink;
    }
    templateData.name = name;

    const data: MailDataRequired = {
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
                dynamicTemplateData: templateData,
            },
        ],
        mailSettings: {
            sandboxMode: {
                enable: config.sendGridSandboxMode,
            },
        },
    };
    await sendEmail(data);
};