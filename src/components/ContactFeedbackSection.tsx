import { FormEvent, useEffect, useRef, useState } from "react";
import { Github, Linkedin, Loader2, Mail, MessageSquareHeart, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const MAX_MESSAGE_LENGTH = 2000;

type ContactFormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
  sendCopy: boolean;
};

const initialState: ContactFormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
  sendCopy: false,
};

const getBrowser = (userAgent: string) => {
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("OPR/") || userAgent.includes("Opera")) return "Opera";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Safari";
  if (userAgent.includes("Firefox/")) return "Firefox";
  return "Unknown";
};

const getOperatingSystem = (userAgent: string) => {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS")) return "macOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Linux")) return "Linux";
  return "Unknown";
};

const getDeviceType = (userAgent: string) => {
  if (/mobile|iphone|android|ipad/i.test(userAgent)) return "Mobile";
  return "Desktop";
};

export const ContactFeedbackSection = () => {
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const pageVisitStartedAtRef = useRef<number>(Date.now());

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  const remainingChars = MAX_MESSAGE_LENGTH - form.message.length;

  const buildMetadata = () => {
    if (typeof window === "undefined") {
      return {};
    }

    const userAgent = navigator.userAgent;
    const firstVisitStorageKey = "contactFirstVisitAtUtc";
    const sessionStorageKey = "contactSessionId";
    const existingFirstVisit = localStorage.getItem(firstVisitStorageKey);
    const firstVisitAtUtc = existingFirstVisit || new Date().toISOString();
    const isReturningVisitor = Boolean(existingFirstVisit);
    if (!existingFirstVisit) {
      localStorage.setItem(firstVisitStorageKey, firstVisitAtUtc);
    }

    let sessionId = sessionStorage.getItem(sessionStorageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(sessionStorageKey, sessionId);
    }

    const url = new URL(window.location.href);
    const getUtmParam = (key: string) => url.searchParams.get(key) || undefined;
    const preferredColorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const timeOnPageSeconds = Math.max(0, Math.round((Date.now() - pageVisitStartedAtRef.current) / 1000));

    return {
      submittedAtLocal: new Date().toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browser: getBrowser(userAgent),
      os: getOperatingSystem(userAgent),
      deviceType: getDeviceType(userAgent),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      referrerUrl: document.referrer || undefined,
      currentPageUrl: window.location.href,
      userAgent,
      firstVisitAtUtc,
      isReturningVisitor,
      sessionId,
      timeOnPageSeconds,
      utmSource: getUtmParam("utm_source"),
      utmMedium: getUtmParam("utm_medium"),
      utmCampaign: getUtmParam("utm_campaign"),
      utmTerm: getUtmParam("utm_term"),
      utmContent: getUtmParam("utm_content"),
      preferredColorScheme,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    };
  };

  useEffect(() => {
    if (!siteKey || !turnstileContainerRef.current || typeof window === "undefined") {
      return;
    }

    const renderWidget = () => {
      if (!window.turnstile || !turnstileContainerRef.current) {
        return;
      }

      if (turnstileWidgetIdRef.current) {
        return;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };

    const scriptId = "cf-turnstile-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.body.appendChild(script);

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  const handleInputChange = (field: keyof ContactFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (!emailRegex.test(form.email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!turnstileToken) {
      toast.error("Please complete the Turnstile verification.");
      return;
    }

    if (!siteKey) {
      toast.error("Turnstile site key is missing. Please configure VITE_TURNSTILE_SITE_KEY.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          turnstileToken,
          metadata: buildMetadata(),
        }),
      });

      const data = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !data.success) {
        toast.error(data.message || "Failed to submit feedback. Please try again.");
        return;
      }

      toast.success(data.message || "Feedback submitted successfully.");
      setForm(initialState);
      setTurnstileToken("");
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-16 rounded-2xl bg-[#0F241F] p-6 text-white shadow-2xl md:p-10 animate-fade-in">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#25D366]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#A4F8C3]">
            <MessageSquareHeart className="h-4 w-4" /> Contact & Feedback
          </p>
          <h2 className="text-3xl font-bold leading-tight">Have suggestions or found a bug?</h2>
          <p className="mt-3 text-sm text-[#C5D8D2]">
            Send feedback directly from this page. We use your message and limited technical metadata to improve reliability,
            prevent spam, and reply when needed.
          </p>

          <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-[#D0E5DD]">
            <p className="font-semibold text-white">Privacy note</p>
            <p>
              We collect your name, email, subject, message, date/time, timezone, browser, OS, device type, screen
              resolution, language, referrer URL, current page URL, user agent, and IP address (captured server-side)
              only for handling feedback, improving the app, and reducing abuse.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <a className="inline-flex items-center gap-2 text-[#A4F8C3] hover:text-white" href="https://github.com/MIbraheemDaudpoto" target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" /> GitHub
            </a>
            <a className="inline-flex items-center gap-2 text-[#A4F8C3] hover:text-white" href="https://www.linkedin.com" target="_blank" rel="noreferrer">
              <Linkedin className="h-4 w-4" /> LinkedIn
            </a>
            <a className="inline-flex items-center gap-2 text-[#A4F8C3] hover:text-white" href="mailto:contact@example.com">
              <Mail className="h-4 w-4" /> Email
            </a>
          </div>
        </div>

        <form className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(event) => handleInputChange("name", event.target.value)}
                className="border-white/20 bg-white/5 text-white placeholder:text-[#9bb2aa]"
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => handleInputChange("email", event.target.value)}
                className="border-white/20 bg-white/5 text-white placeholder:text-[#9bb2aa]"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Subject</label>
            <Input
              value={form.subject}
              onChange={(event) => handleInputChange("subject", event.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-[#9bb2aa]"
              placeholder="Optional subject"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <label className="font-medium">Message *</label>
              <span className={remainingChars < 100 ? "text-amber-300" : "text-[#9bb2aa]"}>{remainingChars} left</span>
            </div>
            <Textarea
              value={form.message}
              onChange={(event) => handleInputChange("message", event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              className="min-h-32 border-white/20 bg-white/5 text-white placeholder:text-[#9bb2aa]"
              placeholder="Tell us your feedback"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="send-copy"
              checked={form.sendCopy}
              onCheckedChange={(checked) => handleInputChange("sendCopy", checked === true)}
            />
            <label htmlFor="send-copy" className="text-sm text-[#D0E5DD]">
              Send me a copy
            </label>
          </div>

          <div>
            <div ref={turnstileContainerRef} className="min-h-16" />
            {!siteKey ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
                <ShieldCheck className="h-3 w-3" /> Set VITE_TURNSTILE_SITE_KEY in your environment.
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !turnstileToken}
            className="w-full bg-[#25D366] text-[#052E16] hover:bg-[#36e179] disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending...
              </span>
            ) : (
              "Send Message"
            )}
          </Button>
        </form>
      </div>
    </section>
  );
};
