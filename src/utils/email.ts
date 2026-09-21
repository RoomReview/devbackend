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
        const message = 'SendGrid API key is not defined';
        logger.error(logContext, message, {});
        throw new Error(message);
    }

    if (!config.emailFrom) {
        const message = 'Email sender address is not configured';
        logger.error(logContext, message, {});
        throw new Error(message);
    }

    sgMail.setApiKey(config.sendGridApiKey);
    logger.info(logContext, 'Sending email', { to: data.personalizations?.[0]?.to, templateId: data.templateId });

    try {
        await sgMail.send(data);
        logger.info(logContext, 'Email sent successfully', { to: data.personalizations?.[0]?.to, templateId: data.templateId });
    } catch (error) {
        const message = 'Failed to send email';
        logger.error(logContext, message, { error });
        throw new Error(message);
    }
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
