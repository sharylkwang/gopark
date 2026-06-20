import axios from 'axios';

const geoapifyClient = axios.create({
  baseURL: 'https://api.geoapify.com/v1/geocode',
  timeout: 30000,
  params: {
    apiKey: process.env.GEOAPIFY_KEY || '',
    filter: 'countrycode:sg',
    format: 'json',
  },
});

export default geoapifyClient;
