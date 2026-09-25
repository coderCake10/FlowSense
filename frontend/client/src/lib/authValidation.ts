/* Admin sign-in input rules. Mirrors the backend contract in
 * backend/django/apps/authentication (EmailField + 6-digit zero-padded OTP). */

/** Institutional domain; subdomains (e.g. dept.auf.edu.ph) are also accepted. */
export const INSTITUTION_DOMAIN = "auf.edu.ph";
export const OTP_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** Returns an error message, or null when the email is acceptable. */
export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) return "Enter your institutional email address.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (
    domain !== INSTITUTION_DOMAIN &&
    !domain.endsWith(`.${INSTITUTION_DOMAIN}`)
  )
    return `Use your @${INSTITUTION_DOMAIN} email address.`;
  return null;
}

/** Keeps only digits, capped at the OTP length (for controlled inputs). */
export function sanitizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function validateCode(value: string): string | null {
  const code = value.trim();
  if (!code) return "Enter the code from your email.";
  if (!/^\d+$/.test(code)) return "The code contains numbers only.";
  if (code.length !== OTP_LENGTH)
    return `The code is ${OTP_LENGTH} digits long.`;
  return null;
}
