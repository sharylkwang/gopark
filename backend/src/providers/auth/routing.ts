export interface CaptchaResponse {
  success: boolean;
  message: string;
}

export const captchaEnabled = process.env.CAPTCHA_ENABLED !== 'false';

export async function captchaVerify(token: string): Promise<CaptchaResponse> {
  if (!captchaEnabled) {
    return { success: true, message: 'Captcha disabled' };
  }

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY || '',
    response: token,
  });

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });

  const data = await res.json();

  if (!data.success) {
    return { success: false, message: 'Captcha verification failed' };
  }

  return { success: true, message: 'Captcha verification successful' };
}
