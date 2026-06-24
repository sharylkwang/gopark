import axios from 'axios';

const cloudflarecaptchaClient = axios.create({
  baseURL: 'https://challenges.cloudflare.com',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default cloudflarecaptchaClient;
