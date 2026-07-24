import nodemailer from "nodemailer";
import { ContactSubmissionRecord } from "../types/contact";

const optional = (value?: string | number | boolean) => {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return String(value);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const row = (label: string, value: string | number | boolean | undefined) => `
  <tr>
    <td style="padding:8px 12px;font-weight:600;color:#0F241F;border-bottom:1px solid #E8EFEA;">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;color:#1E293B;border-bottom:1px solid #E8EFEA;">${escapeHtml(optional(value))}</td>
  </tr>
`;

const formatHtmlEmail = (submission: ContactSubmissionRecord, logoUrl: string) => {
  const metadata = submission.metadata;

  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#F3F4F6;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;border:1px solid #DCE4DF;">
      <div style="background:#075E54;color:white;padding:20px 24px;display:flex;align-items:center;gap:12px;">
        <img src="${escapeHtml(logoUrl)}" alt="Project Logo" style="height:40px;width:40px;border-radius:8px;background:white;object-fit:contain;" />
        <div>
          <p style="margin:0;font-size:12px;opacity:.85;letter-spacing:.08em;text-transform:uppercase;">WhatsApp Chat Analyzer</p>
          <h2 style="margin:4px 0 0;font-size:20px;">New Contact Submission</h2>
        </div>
      </div>

      <div style="padding:22px;">
        <div style="border:1px solid #E8EFEA;border-radius:10px;padding:16px;margin-bottom:14px;">
          <h3 style="margin:0 0 10px;color:#0F241F;font-size:16px;">Contact Information</h3>
          <table style="width:100%;border-collapse:collapse;">${row("Name", submission.name)}${row("Email", submission.email)}${row("Subject", submission.subject)}${row("Send Copy", submission.sendCopy ? "Yes" : "No")}</table>
        </div>

        <div style="border:1px solid #E8EFEA;border-radius:10px;padding:16px;margin-bottom:14px;">
          <h3 style="margin:0 0 10px;color:#0F241F;font-size:16px;">Message</h3>
          <div style="white-space:pre-wrap;background:#F8FAF9;border:1px solid #E8EFEA;border-radius:8px;padding:12px;color:#1F2937;">${escapeHtml(submission.message)}</div>
        </div>

        <div style="border:1px solid #E8EFEA;border-radius:10px;padding:16px;">
          <h3 style="margin:0 0 10px;color:#0F241F;font-size:16px;">Visitor Information</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${row("Submitted (UTC)", submission.submittedAtUtc)}
            ${row("Submitted (Local)", metadata.submittedAtLocal)}
            ${row("First Visit (UTC)", metadata.firstVisitAtUtc)}
            ${row("Returning Visitor", metadata.isReturningVisitor ? "Yes" : "No")}
            ${row("Session ID", metadata.sessionId)}
            ${row("Time on Page (seconds)", metadata.timeOnPageSeconds)}
            ${row("Browser", metadata.browser)}
            ${row("Device", metadata.deviceType)}
            ${row("OS", metadata.os)}
            ${row("IP", submission.ipAddress)}
            ${row("Timezone", metadata.timezone)}
            ${row("Language", metadata.language)}
            ${row("Preferred Color Scheme", metadata.preferredColorScheme)}
            ${row("Viewport Size", metadata.viewportSize)}
            ${row("UTM Source", metadata.utmSource)}
            ${row("UTM Medium", metadata.utmMedium)}
            ${row("UTM Campaign", metadata.utmCampaign)}
            ${row("UTM Term", metadata.utmTerm)}
            ${row("UTM Content", metadata.utmContent)}
            ${row("Current Page", metadata.currentPageUrl)}
            ${row("Referrer", metadata.referrerUrl)}
            ${row("User Agent", metadata.userAgent)}
          </table>
        </div>
      </div>
    </div>
  </div>
  `;
};

const formatTextEmail = (submission: ContactSubmissionRecord) => {
  const metadata = submission.metadata;

  return `
New Contact & Feedback submission

Name: ${submission.name}
Email: ${submission.email}
Subject: ${optional(submission.subject)}
Message:
${submission.message}

Send Copy: ${submission.sendCopy ? "Yes" : "No"}
Submitted UTC: ${submission.submittedAtUtc}
Submitted Local: ${optional(metadata.submittedAtLocal)}
First Visit UTC: ${optional(metadata.firstVisitAtUtc)}
Returning Visitor: ${optional(metadata.isReturningVisitor ? "Yes" : "No")}
Session ID: ${optional(metadata.sessionId)}
Time On Page (seconds): ${optional(metadata.timeOnPageSeconds)}
Browser: ${optional(metadata.browser)}
OS: ${optional(metadata.os)}
Device Type: ${optional(metadata.deviceType)}
Screen Resolution: ${optional(metadata.screenResolution)}
Language: ${optional(metadata.language)}
Preferred Color Scheme: ${optional(metadata.preferredColorScheme)}
Viewport Size: ${optional(metadata.viewportSize)}
UTM Source: ${optional(metadata.utmSource)}
UTM Medium: ${optional(metadata.utmMedium)}
UTM Campaign: ${optional(metadata.utmCampaign)}
UTM Term: ${optional(metadata.utmTerm)}
UTM Content: ${optional(metadata.utmContent)}
Referrer URL: ${optional(metadata.referrerUrl)}
Current Page URL: ${optional(metadata.currentPageUrl)}
User Agent: ${optional(metadata.userAgent)}
IP Address: ${optional(submission.ipAddress)}
`;
};

export class EmailService {
  private readonly transporter;
  private readonly fromEmail?: string;
  private readonly toEmail?: string;
  private readonly projectLogoUrl: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    this.fromEmail = user;
    this.toEmail = process.env.EMAIL_TO;
    this.projectLogoUrl =
      process.env.PROJECT_LOGO_URL ||
      "https://raw.githubusercontent.com/MIbraheemDaudpoto/WhatsappChatAnalyzerIT_Expo/main/public/favicon.ico";

    if (!host || !user || !pass || !this.toEmail) {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendNotifications(submission: ContactSubmissionRecord) {
    if (!this.transporter || !this.fromEmail || !this.toEmail) {
      return { delivered: false };
    }

    const text = formatTextEmail(submission);
    const html = formatHtmlEmail(submission, this.projectLogoUrl);

    await this.transporter.sendMail({
      from: this.fromEmail,
      to: this.toEmail,
      subject: `New Contact Submission: ${submission.subject || "(No Subject)"}`,
      text,
      html,
    });

    if (submission.sendCopy) {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: submission.email,
        subject: "We received your message",
        text: `Thanks for your feedback. A copy of your message is below:\n\n${text}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;background:#F3F4F6;padding:20px;">
            <div style="max-width:680px;margin:0 auto;background:white;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;">
              <div style="background:#075E54;color:white;padding:16px 20px;">
                <h2 style="margin:0;font-size:18px;">Thanks for contacting us</h2>
                <p style="margin:6px 0 0;font-size:13px;opacity:.9;">Here is a copy of your submission.</p>
              </div>
              <div style="padding:20px;">
                <p style="margin-top:0;color:#334155;">Hi ${escapeHtml(submission.name)},</p>
                <p style="color:#334155;">We have received your message and will get back to you soon.</p>
                <div style="white-space:pre-wrap;background:#F8FAF9;border:1px solid #E8EFEA;border-radius:8px;padding:12px;color:#1F2937;">${escapeHtml(submission.message)}</div>
                <p style="margin:14px 0 0;color:#64748B;font-size:13px;">Submitted on ${escapeHtml(submission.submittedAtUtc)} (UTC)</p>
              </div>
            </div>
          </div>
        `,
      });
    }

    return { delivered: true };
  }
}
