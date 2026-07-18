import { Router } from 'express';
import googleRouter from './google/router.js';
import govsgRouter from './govsg/router.js';
import geoapifyRouter from './geoapify/router.js';
import carparksRouter from './carparks/router.js';
import onemapRouter from './onemap/router.js';
import osmBuildingsRouter from './osm/buildings.js';
import favoritesRouter from './favorites/router.js';

const router = Router();

router.use(googleRouter);
router.use(govsgRouter);
router.use(geoapifyRouter);
router.use(carparksRouter);
router.use(onemapRouter);
router.use(favoritesRouter);

export default router;
