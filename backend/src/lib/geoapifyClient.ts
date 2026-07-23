import axios from 'axios';

const base = 'https://api.geoapify.com/v1/geocode';

const geoapifyClient = axios.create({
  baseURL: base,
  params: { apiKey: process.env.GEOAPIFY_KEY || '', filter: 'countrycode:sg', format: 'json' },
  timeout: 30000,
});

export default geoapifyClient;
