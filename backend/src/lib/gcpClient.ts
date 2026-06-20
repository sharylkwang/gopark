import axios from 'axios';

const gcpClient = axios.create({
  baseURL: 'https://routes.googleapis.com',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_MAPS_KEY || '',
  },
  timeout: 10000,
});

export default gcpClient;
