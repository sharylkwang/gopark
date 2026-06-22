import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import prisma from '../../db/index.js';

const router = Router();

router.get('/favorites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const favs = await prisma.fav.findMany({
      where: { userId: req.user!.id },
      select: { carparkId: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(favs.map(f => f.carparkId));
  } catch {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/favorites/:carparkId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const carparkId = req.params.carparkId;
    await prisma.fav.upsert({
      where: { userId_carparkId: { userId, carparkId } },
      create: { userId, carparkId },
      update: {},
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/favorites/:carparkId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const carparkId = req.params.carparkId;
    await prisma.fav.deleteMany({
      where: { userId, carparkId },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
