import axios from 'axios';

const onemapClient = axios.create({
  baseURL: 'https://www.onemap.gov.sg/api/public',
  headers: {
    Authorization: process.env.ONEMAP_API || '',
  },
  timeout: 15000,
});

export default onemapClient;
