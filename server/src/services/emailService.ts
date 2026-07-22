import nodemailer from "nodemailer";
import { ContactSubmissionRecord } from "../types/contact";

const optional = (value?: string) => value?.trim() || "N/A";

const formatEmailBody = (submission: ContactSubmissionRecord) => `
New Contact & Feedback submission

Name: ${submission.name}
Email: ${submission.email}
Subject: ${optional(submission.subject)}
Message:
${submission.message}

Send Copy: ${submission.sendCopy ? "Yes" : "No"}
Submitted UTC: ${submission.submittedAtUtc}
Timezone: ${optional(submission.metadata.timezone)}
Browser: ${optional(submission.metadata.browser)}
OS: ${optional(submission.metadata.os)}
Device Type: ${optional(submission.metadata.deviceType)}
Screen Resolution: ${optional(submission.metadata.screenResolution)}
Language: ${optional(submission.metadata.language)}
Referrer URL: ${optional(submission.metadata.referrerUrl)}
Current Page URL: ${optional(submission.metadata.currentPageUrl)}
User Agent: ${optional(submission.metadata.userAgent)}
IP Address: ${optional(submission.ipAddress)}
`;

export class EmailService {
  private readonly transporter;
  private readonly fromEmail?: string;
  private readonly toEmail?: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    this.fromEmail = user;
    this.toEmail = process.env.EMAIL_TO;

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

    const body = formatEmailBody(submission);

    await this.transporter.sendMail({
      from: this.fromEmail,
      to: this.toEmail,
      subject: `New Contact Submission: ${submission.subject || "(No Subject)"}`,
      text: body,
    });

    if (submission.sendCopy) {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: submission.email,
        subject: "We received your message",
        text: `Thanks for your feedback. A copy of your message is below:\n\n${body}`,
      });
    }

    return { delivered: true };
  }
}
