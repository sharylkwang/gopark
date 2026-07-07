import axios from 'axios';

const datamallClient = axios.create({
  baseURL: 'https://datamall2.mytransport.sg/ltaodataservice',
  headers: { AccountKey: process.env.DATAMALL_API || '' },
  timeout: 30000,
});
export default datamallClient;
