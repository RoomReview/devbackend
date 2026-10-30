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

  const senderEmail =
    typeof data.from === 'string' ? data.from : data.from?.email;
  if (!senderEmail) {
    const message = 'Email sender address is not configured';
    logger.error(logContext, message, {});
    throw new Error(message);
  }

  sgMail.setApiKey(config.sendGridApiKey);
  logger.info(logContext, 'Sending email', {
    to: data.personalizations?.[0]?.to,
    templateId: data.templateId,
  });

  try {
    await sgMail.send(data);
    logger.info(logContext, 'Email sent successfully', {
      to: data.personalizations?.[0]?.to,
      templateId: data.templateId,
    });
  } catch (error) {
    const message = 'Failed to send email';
    logger.error(logContext, message, { error });
    throw new Error(message, { cause: error });
  }
};

export const sendVerificationEmail = async (
  toEmail: string,
  code: string,
  name: string,
  teamInviteToken?: string,
) => {
  if (!toEmail) {
    throw new Error('toEmail is not defined');
  }
  if (!code) {
    throw new Error('code is not defined');
  }
  if (!name) {
    throw new Error('name is not defined');
  }
  const verificationBaseUrl =
    config.nodeEnv === 'production'
      ? 'https://roomreview.co.uk'
      : config.frontendUrl;
  const verificationUrl = new URL('/verify-email', verificationBaseUrl);
  verificationUrl.searchParams.set('email', toEmail);
  verificationUrl.searchParams.set('code', code);
  if (teamInviteToken) {
    verificationUrl.searchParams.set('teamInviteToken', teamInviteToken);
  }
  if (
    config.nodeEnv === 'production' &&
    verificationUrl.protocol !== 'https:'
  ) {
    throw new Error('Verification email links must use HTTPS in production');
  }
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const greetingName = escapeHtml(name);
  const linkHref = escapeHtml(verificationUrl.toString());

  const data: MailDataRequired = {
    from: {
      email: config.verificationEmailFrom,
      name: 'RoomReview',
    },
    subject: 'Verify your RoomReview email address',
    text: `Hi ${name},\n\nVerify your email address by opening this link:\n${verificationUrl}\n\nOr enter this verification code: ${code}\n\nRoomReview`,
    html: `<p>Hi ${greetingName},</p><p>Verify your email address by clicking the link below:</p><p><a href="${linkHref}">Verify my email address</a></p><p>If the button does not work, enter this verification code on RoomReview:</p><p><strong>${escapeHtml(code)}</strong></p><p>RoomReview</p>`,
    categories: ['verification'],
    personalizations: [
      {
        to: {
          email: toEmail,
          name,
        },
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

export const sendAgencyInvitationEmail = async (
  toEmail: string,
  inviterName: string,
  agencyName: string,
  invitationToken: string,
) => {
  if (!toEmail || !inviterName || !agencyName || !invitationToken) {
    throw new Error('All agency invitation details are required');
  }
  const invitationUrl = new URL('/team-invite', config.frontendUrl);
  invitationUrl.searchParams.set('token', invitationToken);
  if (config.nodeEnv === 'production' && invitationUrl.protocol !== 'https:') {
    throw new Error('Agency invitation links must use HTTPS in production');
  }
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const safeInviterName = escapeHtml(inviterName);
  const safeAgencyName = escapeHtml(agencyName);
  const safeInvitationUrl = escapeHtml(invitationUrl.toString());
  await sendEmail({
    from: { email: config.emailFrom, name: 'RoomReview' },
    subject: `Join ${agencyName} on RoomReview`,
    text: `${inviterName} has invited you to join ${agencyName} on RoomReview. Accept the invitation: ${invitationUrl}`,
    html: `<p>Hi,</p><p>${safeInviterName} has invited you to join <strong>${safeAgencyName}</strong> on RoomReview.</p><p><a href="${safeInvitationUrl}">Accept invitation</a></p>`,
    categories: ['agency-invitation'],
    personalizations: [{ to: { email: toEmail } }],
    mailSettings: { sandboxMode: { enable: config.sendGridSandboxMode } },
  });
};

export const sendResetPasswordEmail = async (
  toEmail: string,
  name: string,
  resetPasswordLink?: string,
) => {
  const templateData: Record<string, string> = {
    ...config.sendGridTemplateParameters[
      config.sendResetPasswordCodeV1TemplateId
    ],
  };
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
          name,
        },
        dynamicTemplateData: templateData,
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
  };
  await sendEmail(data);
};

export const sendReviewModerationEmail = async (
  toEmail: string,
  name: string,
  reviewTitle: string,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string,
) => {
  if (!toEmail || !name || !reviewTitle) {
    throw new Error('Review notification recipient and title are required');
  }

  const approved = status === 'APPROVED';
  const outcome = approved
    ? 'Your review has been approved and is now published.'
    : `Your review was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
  const subject = approved
    ? 'Your RoomReview review is published'
    : 'An update about your RoomReview review';
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  await sendEmail({
    to: toEmail,
    from: { email: config.emailFrom, name: 'RoomReview' },
    subject,
    text: `Hi ${name},\n\n${outcome}\n\nReview: ${reviewTitle}\n\nRoomReview`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(outcome)}</p><p><strong>Review:</strong> ${escapeHtml(reviewTitle)}</p><p>RoomReview</p>`,
    categories: ['review-moderation'],
    mailSettings: { sandboxMode: { enable: config.sendGridSandboxMode } },
  });
};

export const sendSubscriptionInvoiceEmail = async (
  toEmail: string,
  name: string,
  invoice: {
    number: string | null;
    amountPaid: number;
    currency: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  },
) => {
  if (!toEmail || !name) {
    throw new Error('Invoice recipient email and name are required');
  }
  if (!Number.isFinite(invoice.amountPaid) || invoice.amountPaid < 0) {
    throw new Error('Invoice amount must be a non-negative number');
  }
  if (!/^[a-z]{3}$/i.test(invoice.currency)) {
    throw new Error('Invoice currency must be a valid ISO currency code');
  }

  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: invoice.currency.toUpperCase(),
  }).format(invoice.amountPaid / 100);
  const invoiceNumber = invoice.number ?? 'Subscription invoice';
  const invoiceUrl = invoice.hostedInvoiceUrl ?? invoice.invoicePdf;
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  await sendEmail({
    to: toEmail,
    from: { email: config.emailFrom, name: 'RoomReview' },
    subject: `Your RoomReview subscription invoice ${invoiceNumber}`,
    text: [
      `Hi ${name},`,
      '',
      `Your RoomReview subscription payment of ${amount} has been received.`,
      `Invoice: ${invoiceNumber}`,
      ...(invoiceUrl ? [`View or download your invoice: ${invoiceUrl}`] : []),
      '',
      'Thank you for choosing RoomReview.',
    ].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      `<p>Your RoomReview subscription payment of <strong>${escapeHtml(amount)}</strong> has been received.</p>`,
      `<p>Invoice: ${escapeHtml(invoiceNumber)}</p>`,
      ...(invoiceUrl
        ? [`<p><a href="${escapeHtml(invoiceUrl)}">View or download your invoice</a></p>`]
        : []),
      '<p>Thank you for choosing RoomReview.</p>',
    ].join(''),
    categories: ['subscription-invoice'],
    mailSettings: {
      sandboxMode: {
        enable: config.sendGridSandboxMode,
      },
    },
  });
};

export const sendNewsletterConfirmationEmail = async (
  toEmail: string,
  token: string,
) => {
  const confirmationUrl = new URL(
    `/api/v1/newsletter/confirm/${encodeURIComponent(token)}`,
    config.websiteUrl,
  ).toString();
  await sendEmail({
    to: toEmail,
    from: { email: 'info@roomreview.co.uk', name: 'RoomReview' },
    subject: 'Confirm your RoomReview newsletter subscription',
    text: `Please confirm your newsletter subscription by opening this link:\n${confirmationUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Please confirm your RoomReview newsletter subscription:</p><p><a href="${confirmationUrl}">Confirm subscription</a></p><p>If you did not request this, you can ignore this email.</p>`,
    categories: ['newsletter-confirmation'],
    mailSettings: { sandboxMode: { enable: config.sendGridSandboxMode } },
  });
};

export const sendNewsletterArticleEmail = async (
  toEmail: string,
  title: string,
  summary: string,
  articleUrl: string,
  unsubscribeUrl: string,
  unsubscribeGroupId: number,
) => {
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary);
  const safeArticleUrl = escapeHtml(articleUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  await sendEmail({
    to: toEmail,
    from: { email: 'info@roomreview.co.uk', name: 'RoomReview' },
    subject: `RoomReview article: ${title}`,
    text: `${title}\n\n${summary}\n\nRead the article: ${articleUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
    html: `<h1>${safeTitle}</h1><p>${safeSummary}</p><p><a href="${safeArticleUrl}">Read the article</a></p><p><a href="${safeUnsubscribeUrl}">Unsubscribe from article updates</a></p>`,
    categories: ['newsletter-article'],
    asm: { groupId: unsubscribeGroupId },
    mailSettings: { sandboxMode: { enable: config.sendGridSandboxMode } },
  });
};
