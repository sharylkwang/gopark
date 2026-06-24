import axios from 'axios';

const parkaholicClient = axios.create({
  baseURL: 'https://parkaholic.sg',
  timeout: 30000,
});

export default parkaholicClient;
