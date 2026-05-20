import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export type SurveyInvitationEmailRecipient = {
  participant_id: number;
  employee_id: number;
  email: string;
  name: string;
  survey_url: string;
  campaign_name: string;
  company_name: string;
};

export type SendGridBatchResult = {
  sent: SurveyInvitationEmailRecipient[];
  failed: {
    recipient: SurveyInvitationEmailRecipient;
    error: string;
  }[];
};

@Injectable()
export class SendGridMailService {
  private readonly logger = new Logger(SendGridMailService.name);
  private readonly sendGridUrl = 'https://api.sendgrid.com/v3/mail/send';

  async sendSurveyInvitations(
    recipients: SurveyInvitationEmailRecipient[],
  ): Promise<SendGridBatchResult> {
    const apiKey = this.getRequiredEnv('SENDGRID_API_KEY');
    const fromEmail = this.getRequiredEnv('SENDGRID_FROM_EMAIL');
    const fromName = process.env.SENDGRID_FROM_NAME?.trim() || 'Laroche 360';
    const replyTo = process.env.SENDGRID_REPLY_TO?.trim() || fromEmail;

    const result: SendGridBatchResult = {
      sent: [],
      failed: [],
    };

    for (const recipient of recipients) {
      try {
        await this.sendSurveyInvitation({
          apiKey,
          fromEmail,
          fromName,
          replyTo,
          recipient,
        });
        result.sent.push(recipient);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erreur inconnue lors de l'envoi SendGrid";

        this.logger.error(
          `SendGrid invitation failed for ${recipient.email}: ${message}`,
        );
        result.failed.push({ recipient, error: message });
      }
    }

    return result;
  }

  private async sendSurveyInvitation(params: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
    replyTo: string;
    recipient: SurveyInvitationEmailRecipient;
  }) {
    const { apiKey, fromEmail, fromName, replyTo, recipient } = params;
    const subject = `Sondage RPS - ${recipient.campaign_name}`;
    const text = this.buildInvitationText(recipient);
    const html = this.buildInvitationHtml(recipient);

    const response = await fetch(this.sendGridUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: recipient.email, name: recipient.name }],
          },
        ],
        from: { email: fromEmail, name: fromName },
        reply_to: { email: replyTo },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new InternalServerErrorException(
        `SendGrid a refuse l'email (${response.status})${
          body ? `: ${body.slice(0, 500)}` : ''
        }`,
      );
    }
  }

  private buildInvitationText(recipient: SurveyInvitationEmailRecipient) {
    return [
      `Bonjour ${recipient.name},`,
      '',
      `Vous etes invite a repondre au sondage RPS "${recipient.campaign_name}" pour ${recipient.company_name}.`,
      '',
      `Lien du sondage : ${recipient.survey_url}`,
      '',
      'Merci de completer le questionnaire lorsque vous serez disponible.',
      '',
      'Laroche 360',
    ].join('\n');
  }

  private buildInvitationHtml(recipient: SurveyInvitationEmailRecipient) {
    const name = this.escapeHtml(recipient.name);
    const campaignName = this.escapeHtml(recipient.campaign_name);
    const companyName = this.escapeHtml(recipient.company_name);
    const surveyUrl = this.escapeHtml(recipient.survey_url);

    return `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <p>Bonjour ${name},</p>
        <p>
          Vous etes invite a repondre au sondage RPS
          <strong>${campaignName}</strong> pour <strong>${companyName}</strong>.
        </p>
        <p>Lien du sondage : <a href="${surveyUrl}">${surveyUrl}</a></p>
        <p>Merci de completer le questionnaire lorsque vous serez disponible.</p>
        <p>Laroche 360</p>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new ServiceUnavailableException(
        `Configuration email manquante: ${name}`,
      );
    }

    return value;
  }
}
