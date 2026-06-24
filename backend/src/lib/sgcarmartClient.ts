import axios from 'axios';

const sgcarmartClient = axios.create({
  baseURL: 'https://www.sgcarmart.com/api/carpark',
  timeout: 30000,
});

export default sgcarmartClient;
