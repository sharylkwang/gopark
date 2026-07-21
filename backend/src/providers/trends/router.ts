import { Router, type Request, type Response } from 'express';
import prisma from '../../db/index.js';
import { defaultTrend } from '../../cron/trends/aggregate.js';
import { isPublicHoliday, publicHolidayName } from '../../lib/holidays.js';

const router = Router();

router.get('/carparks/:id/trend', async (req: Request, res: Response) => {
  const carparkId = req.params.id;
  const trend = await prisma.carparkTrend.findUnique({ where: { carparkId } });
  const now = new Date();

  if (!trend) {
    return res.json({
      carparkId,
      weekday: null,
      today: defaultTrend(),
      todaySource: 'default',
      isHoliday: isPublicHoliday(now),
      holidayName: publicHolidayName(now),
      sampleCount: 0,
      computedAt: null,
    });
  }

  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    carparkId,
    weekday: trend.profile,
    today: trend.todayProfile,
    todaySource: trend.todaySource,
    isHoliday: trend.isHoliday,
    holidayName: publicHolidayName(now),
    sampleCount: trend.sampleCount,
    computedAt: trend.computedAt,
  });
});

export default router;
