import axios from 'axios';

const govsgClient = axios.create({
  baseURL: 'https://api.data.gov.sg/v1',
  timeout: 30_000,
  headers: process.env.DATAGOVSG_KEY ? { 'x-api-key': process.env.DATAGOVSG_KEY } : {},
});

export default govsgClient;
