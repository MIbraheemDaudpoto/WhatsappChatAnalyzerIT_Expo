export class TurnstileService {
  async verifyToken(token: string, ip?: string) {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
      throw new Error("TURNSTILE_SECRET_KEY is not configured");
    }

    const body = new URLSearchParams({
      secret,
      response: token,
    });

    if (ip) {
      body.set("remoteip", ip);
    }

    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { success?: boolean };
      return Boolean(data.success);
    } catch {
      return false;
    }
  }
}
