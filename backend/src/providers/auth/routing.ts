export interface CaptchaResponse {
  success: boolean;
  message: string;
}

export async function captchaVerify(token: string): Promise<CaptchaResponse> {
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
