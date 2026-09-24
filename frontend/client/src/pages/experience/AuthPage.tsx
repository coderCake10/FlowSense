/* Civic Signal: visitor-facing experiences use edge anchored wayfinding, AUF navy, signal gold route cues, and clear state transitions. */
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BrandMark } from "@/components/FlowSenseShell";
import { ApiError, apiClient, endpointMap, isApiConfigured } from "@/lib/api";
import {
  INSTITUTION_DOMAIN,
  OTP_LENGTH,
  normalizeEmail,
  sanitizeCode,
  validateCode,
  validateEmail,
} from "@/lib/authValidation";

type Step = "email" | "code";

const SERVICE_UNAVAILABLE =
  "The sign-in service is not connected. Contact the FlowSense system administrator.";

/** Maps an API failure to a message that never reveals whether an account exists. */
function describeFailure(error: unknown, step: Step) {
  if (error instanceof ApiError) {
    if (error.status === 429)
      return "Too many attempts. Wait a few minutes, then try again.";
    if (step === "code" && [400, 401, 403].includes(error.status))
      return "That code is incorrect or has expired. Check your email or request a new code.";
    if (error.status === 400) return "Check the email address and try again.";
  }
  return "We couldn't reach the sign-in service. Check your connection and try again.";
}

/** The emailed login link: /auth?email=…&token=… (backend tasks.py). */
function readSignInLink() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email");
  const token = params.get("token");
  return email && token ? { email, token } : null;
}

export function AuthPage() {
  const [link] = useState(readSignInLink);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(link?.email ?? "");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(Boolean(link));

  // Sign in straight from the emailed link, once. The token is removed from
  // the address bar first so it doesn't stay in browser history.
  useEffect(() => {
    if (!link) return;
    window.history.replaceState(null, "", window.location.pathname);
    const verifyLink = async () => {
      if (!isApiConfigured()) {
        setFormError(SERVICE_UNAVAILABLE);
        setPending(false);
        return;
      }
      try {
        await apiClient.post(endpointMap.auth.verify, {
          email: normalizeEmail(link.email),
          token: link.token,
        });
        window.location.assign("/");
      } catch (error) {
        setFormError(
          error instanceof ApiError && error.status === 429
            ? describeFailure(error, "code")
            : "This sign-in link is invalid, already used, or expired. Request a new code below."
        );
        setPending(false);
      }
    };
    void verifyLink();
  }, [link]);

  const requestCode = async () => {
    const problem = validateEmail(email);
    setFieldError(problem);
    setFormError(null);
    if (problem) return;
    if (!isApiConfigured()) {
      setFormError(SERVICE_UNAVAILABLE);
      return;
    }
    setPending(true);
    try {
      await apiClient.post(endpointMap.auth.login, {
        email: normalizeEmail(email),
      });
      setCode("");
      if (step === "code")
        toast.success("A new code was sent if the account exists.");
      setStep("code");
    } catch (error) {
      setFormError(describeFailure(error, "email"));
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async () => {
    const problem = validateCode(code);
    setFieldError(problem);
    setFormError(null);
    if (problem) return;
    if (!isApiConfigured()) {
      setFormError(SERVICE_UNAVAILABLE);
      return;
    }
    setPending(true);
    try {
      await apiClient.post(endpointMap.auth.verify, {
        email: normalizeEmail(email),
        token: code,
      });
      window.location.assign("/");
    } catch (error) {
      setFormError(describeFailure(error, "code"));
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    void (step === "email" ? requestCode() : verifyCode());
  };

  const useAnotherEmail = () => {
    setStep("email");
    setCode("");
    setFieldError(null);
    setFormError(null);
  };

  const fieldId = step === "email" ? "auth-email" : "auth-code";
  const errorId = `${fieldId}-error`;

  return (
    <div className="grid min-h-screen bg-[#f6f8fb] lg:grid-cols-[0.85fr_1.15fr]">
      <div className="relative hidden overflow-hidden bg-[#0b1f3a] p-10 lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(244,197,66,.2) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between">
          <BrandMark />
          <div className="max-w-md pb-12">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f4c542]">
              AUF operations
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.04] tracking-[-0.07em] text-white">
              Make every destination feel closer.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/54">
              FlowSense gives the campus team one dependable view of maps,
              movement, and the signals behind each route.
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
            Angeles University Foundation · 2026
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandMark />
          </div>
          <div className="mb-8">
            <Badge className="border-[#dbe3ed] bg-white text-[#b08412] hover:bg-white">
              <ShieldCheck size={13} className="mr-1.5" />
              Authentication required
            </Badge>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.06em] text-[#102c4d]">
              Log in to access Admin Dashboard
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#718398]">
              {step === "email"
                ? `Enter your @${INSTITUTION_DOMAIN} email to receive a one-time sign-in code.`
                : `If an administrator account exists for ${normalizeEmail(email)}, a ${OTP_LENGTH}-digit code was sent to it. The code expires in 10 minutes.`}
            </p>
          </div>
          <form noValidate onSubmit={submit} className="space-y-5">
            {formError && (
              <div
                role="alert"
                className="flex gap-3 rounded-xl border border-[#f1d4d3] bg-[#fff6f6] p-4 text-sm leading-6 text-[#9f2f2b]"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p>{formError}</p>
              </div>
            )}
            {step === "email" ? (
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-[#40556d]"
              >
                Email address
                <Input
                  id={fieldId}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder={`admin@${INSTITUTION_DOMAIN}`}
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setFieldError(null);
                  }}
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? errorId : undefined}
                  className="mt-2 h-12 border-[#dbe3ed] bg-white"
                />
              </label>
            ) : (
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-[#40556d]"
              >
                Authentication code
                <Input
                  id={fieldId}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={OTP_LENGTH}
                  placeholder={"0".repeat(OTP_LENGTH)}
                  value={code}
                  onChange={e => {
                    setCode(sanitizeCode(e.target.value));
                    setFieldError(null);
                  }}
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? errorId : undefined}
                  className="mt-2 h-12 border-[#dbe3ed] bg-white tracking-[0.4em]"
                />
              </label>
            )}
            {fieldError && (
              <p id={errorId} className="-mt-3 text-xs text-[#b13a36]">
                {fieldError}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending}
              className="h-12 w-full bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              {pending
                ? step === "email"
                  ? "Sending code…"
                  : "Verifying…"
                : step === "email"
                  ? "Send sign-in code"
                  : "Verify and sign in"}
              {!pending && <ArrowRight size={16} className="ml-2" />}
            </Button>
            {step === "code" && (
              <div className="flex items-center justify-between text-xs font-medium">
                <button
                  type="button"
                  disabled={pending}
                  onClick={useAnotherEmail}
                  className="text-[#718398] hover:text-[#17365d]"
                >
                  Use another email
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void requestCode()}
                  className="flex items-center gap-1.5 text-[#b08412] hover:text-[#8a6500]"
                >
                  <Mail size={13} />
                  Send a new code
                </button>
              </div>
            )}
          </form>
          <p className="mt-10 text-center text-xs text-[#96a4b3]">
            FlowSense admin access is limited to authorized AUF administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
