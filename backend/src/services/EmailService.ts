/**
 * Email Service
 *
 * Handles all email operations including:
 * - Password reset emails
 * - License expiration notifications
 * - Welcome emails for new tenants
 */

import nodemailer from 'nodemailer';
import { Tenant } from '@prisma/client';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || 'noreply@instantwin.io';

    if (!host || !user || !pass) {
      console.warn('[EmailService] SMTP not configured. Email functionality disabled.');
      console.warn('[EmailService] Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable emails.');
      return;
    }

    this.config = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      from,
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
    });

    this.initialized = true;
    console.log('[EmailService] Initialized successfully');
  }

  isConfigured(): boolean {
    return this.initialized && this.transporter !== null;
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  private getPasswordResetTemplate(
    resetUrl: string,
    username: string,
    tenantName?: string
  ): EmailTemplate {
    const brandName = tenantName || 'Instant Win';

    return {
      subject: `Reimposta la tua password - ${brandName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h1 style="color: #18181b; margin: 0 0 24px; font-size: 24px; font-weight: 600;">
                Reimposta la tua password
              </h1>

              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Ciao <strong>${username}</strong>,
              </p>

              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Abbiamo ricevuto una richiesta di reset della password per il tuo account su ${brandName}.
                Clicca il pulsante qui sotto per creare una nuova password.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}"
                   style="display: inline-block; background: #b42a28; color: white; text-decoration: none;
                          padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Reimposta Password
                </a>
              </div>

              <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                Questo link scadrà tra <strong>1 ora</strong>.
              </p>

              <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 16px 0 0;">
                Se non hai richiesto il reset della password, puoi ignorare questa email.
              </p>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">

              <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
                <a href="${resetUrl}" style="color: #b42a28; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>

            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 24px;">
              ${brandName} - Powered by Instant Win Platform
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Reimposta la tua password - ${brandName}

Ciao ${username},

Abbiamo ricevuto una richiesta di reset della password per il tuo account su ${brandName}.

Clicca il link qui sotto per creare una nuova password:
${resetUrl}

Questo link scadrà tra 1 ora.

Se non hai richiesto il reset della password, puoi ignorare questa email.

${brandName} - Powered by Instant Win Platform
      `.trim(),
    };
  }

  private getLicenseExpirationTemplate(
    tenant: Tenant,
    daysUntilExpiry: number
  ): EmailTemplate {
    const urgency = daysUntilExpiry <= 3 ? 'URGENTE: ' : '';

    return {
      subject: `${urgency}La tua licenza scade tra ${daysUntilExpiry} giorni - ${tenant.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <div style="background: ${daysUntilExpiry <= 3 ? '#fef2f2' : '#fefce8'};
                          border-left: 4px solid ${daysUntilExpiry <= 3 ? '#ef4444' : '#eab308'};
                          padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: ${daysUntilExpiry <= 3 ? '#991b1b' : '#854d0e'}; font-weight: 600;">
                  ${daysUntilExpiry <= 3 ? 'Attenzione! La tua licenza sta per scadere.' : 'Promemoria: la tua licenza scadrà presto.'}
                </p>
              </div>

              <h1 style="color: #18181b; margin: 0 0 24px; font-size: 24px; font-weight: 600;">
                Rinnova la tua licenza
              </h1>

              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                La licenza per <strong>${tenant.name}</strong> scadrà tra <strong>${daysUntilExpiry} giorni</strong>.
              </p>

              <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #71717a; padding: 8px 0;">Tenant:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right;">${tenant.name}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; padding: 8px 0;">Piano:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right;">${tenant.plan}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; padding: 8px 0;">Scadenza:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right;">${tenant.licenseEnd?.toLocaleDateString('it-IT') || 'N/A'}</td>
                  </tr>
                </table>
              </div>

              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Per evitare interruzioni del servizio, ti consigliamo di rinnovare la licenza il prima possibile.
              </p>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">

              <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                Per assistenza contatta il nostro supporto.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Rinnova la tua licenza - ${tenant.name}

La licenza per ${tenant.name} scadrà tra ${daysUntilExpiry} giorni.

Dettagli:
- Tenant: ${tenant.name}
- Piano: ${tenant.plan}
- Scadenza: ${tenant.licenseEnd?.toLocaleDateString('it-IT') || 'N/A'}

Per evitare interruzioni del servizio, ti consigliamo di rinnovare la licenza il prima possibile.

Per assistenza contatta il nostro supporto.
      `.trim(),
    };
  }

  private getWelcomeTenantTemplate(
    tenant: Tenant,
    adminCredentials: { username: string; tempPassword: string }
  ): EmailTemplate {
    const loginUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/admin/login`
      : 'https://instantwin.io/admin/login';

    return {
      subject: `Benvenuto su Instant Win - ${tenant.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h1 style="color: #18181b; margin: 0 0 24px; font-size: 24px; font-weight: 600;">
                Benvenuto su Instant Win!
              </h1>

              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                Il tuo account per <strong>${tenant.name}</strong> è stato creato con successo.
              </p>

              <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 12px; color: #71717a; font-size: 14px;">Credenziali di accesso:</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #71717a; padding: 8px 0;">Username:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; font-family: monospace;">${adminCredentials.username}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; padding: 8px 0;">Password temporanea:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; font-family: monospace;">${adminCredentials.tempPassword}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Importante:</strong> Cambia la password al primo accesso.
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}"
                   style="display: inline-block; background: #b42a28; color: white; text-decoration: none;
                          padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Accedi al Pannello Admin
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">

              <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                Dettagli licenza:
              </p>
              <ul style="color: #a1a1aa; font-size: 12px; margin: 8px 0 0; padding-left: 20px;">
                <li>Piano: ${tenant.plan}</li>
                <li>Max Promozioni: ${tenant.maxPromotions}</li>
                <li>Max Token per Promo: ${tenant.maxTokensPerPromo}</li>
                <li>Max Staff: ${tenant.maxStaffUsers}</li>
              </ul>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Benvenuto su Instant Win - ${tenant.name}

Il tuo account è stato creato con successo.

Credenziali di accesso:
- Username: ${adminCredentials.username}
- Password temporanea: ${adminCredentials.tempPassword}

IMPORTANTE: Cambia la password al primo accesso.

Accedi al pannello admin: ${loginUrl}

Dettagli licenza:
- Piano: ${tenant.plan}
- Max Promozioni: ${tenant.maxPromotions}
- Max Token per Promo: ${tenant.maxTokensPerPromo}
- Max Staff: ${tenant.maxStaffUsers}
      `.trim(),
    };
  }

  // ============================================
  // SEND METHODS
  // ============================================

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    username: string,
    tenantName?: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[EmailService] Email not configured. Password reset email not sent.');
      console.log('[EmailService] Reset URL:', resetUrl);
      return false;
    }

    const template = this.getPasswordResetTemplate(resetUrl, username, tenantName);

    try {
      await this.transporter!.sendMail({
        from: this.config!.from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      console.log(`[EmailService] Password reset email sent to ${to}`);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send password reset email:', error);
      return false;
    }
  }

  async sendLicenseExpirationEmail(
    tenant: Tenant,
    daysUntilExpiry: number
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[EmailService] Email not configured. License expiration email not sent.');
      return false;
    }

    const template = this.getLicenseExpirationTemplate(tenant, daysUntilExpiry);

    try {
      await this.transporter!.sendMail({
        from: this.config!.from,
        to: tenant.adminEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      console.log(`[EmailService] License expiration email sent to ${tenant.adminEmail}`);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send license expiration email:', error);
      return false;
    }
  }

  async sendWelcomeTenantEmail(
    tenant: Tenant,
    adminCredentials: { username: string; tempPassword: string }
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[EmailService] Email not configured. Welcome email not sent.');
      return false;
    }

    const template = this.getWelcomeTenantTemplate(tenant, adminCredentials);

    try {
      await this.transporter!.sendMail({
        from: this.config!.from,
        to: tenant.adminEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      console.log(`[EmailService] Welcome email sent to ${tenant.adminEmail}`);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send welcome email:', error);
      return false;
    }
  }

  // Generic send method for custom emails
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[EmailService] Email not configured.');
      return false;
    }

    try {
      await this.transporter!.sendMail({
        from: this.config!.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      return false;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      await this.transporter!.verify();
      console.log('[EmailService] SMTP connection verified');
      return true;
    } catch (error) {
      console.error('[EmailService] SMTP connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
