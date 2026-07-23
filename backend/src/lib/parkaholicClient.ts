import axios from 'axios';

const parkaholicClient = axios.create({ timeout: 30000, baseURL: 'https://parkaholic.sg' });

export default parkaholicClient;
