import axios from 'axios';

export default axios.create({ baseURL: 'https://www.sgcarmart.com/api/carpark', timeout: 30000 });
