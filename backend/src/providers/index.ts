import { Router } from 'express';
import googleRouter from './google/router';
import govsgRouter from './govsg/router';
import geoapifyRouter from './geoapify/router';

const router = Router();

router.use(googleRouter);
router.use(govsgRouter);
router.use(geoapifyRouter);

export default router;
