import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import parkingRouter from './routes/parking';
import geocodeRouter from './routes/geocode';
import tilesRouter from './routes/tiles';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', parkingRouter);
app.use('/api', geocodeRouter);
app.use('/api', tilesRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
