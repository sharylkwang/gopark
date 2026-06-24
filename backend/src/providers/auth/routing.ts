import cloudflarecaptchaClient from '../../lib/cloudflarecaptchaClient';

export interface CaptchaResponse {
  success: boolean;
  message: string;
}

export async function captchaVerify(token: string): Promise<CaptchaResponse> {
  const response = await cloudflarecaptchaClient.post('/turnstile/v0/siteverify', {
    secret: process.env.TURNSTILE_SECRET_KEY || '',
    response: token,
  });

  if (!response.data.success) {
    return { success: false, message: 'Captcha verification failed' };
  }

  return { success: true, message: 'Captcha verification successful' };
}
