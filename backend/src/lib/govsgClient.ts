import axios from 'axios';

const govsgClient = axios.create({
  baseURL: 'https://api.data.gov.sg/v1',
  headers: process.env.DATAGOVSG_KEY
    ? { 'x-api-key': process.env.DATAGOVSG_KEY }
    : {},
  timeout: 30000,
});

export default govsgClient;
