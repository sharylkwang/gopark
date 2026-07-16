import axios from 'axios';

const gcpClient = axios.create({
  timeout: 10000,
  baseURL: 'https://routes.googleapis.com',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_MAPS_KEY || '',
  },
});

export default gcpClient;
