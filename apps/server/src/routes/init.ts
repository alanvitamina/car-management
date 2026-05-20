import { Router, Request, Response } from 'express';
import { seedIfEmpty } from '../db/seed';

export const initDb = Router();

initDb.post('/db', async (_req: Request, res: Response) => {
  try {
    await seedIfEmpty();
    res.json({ success: true, message: '数据库初始化完成' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});
