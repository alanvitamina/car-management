import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';

export const notificationRoutes = Router();

notificationRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('msg_notification_log');
    const userId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.find(n => n.recipient_id === userId);
    const total = list.length;
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    list = list.slice((page - 1) * pageSize, page * pageSize);

    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

notificationRoutes.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('msg_notification_log');
    const list = await store.find(n => n.recipient_id === req.user!.id && n.is_read === 0);
    res.json({ code: 0, data: { count: list.length } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

notificationRoutes.put('/:id/read', async (req: Request, res: Response) => {
  try {
    await getStore<any>('msg_notification_log').update(Number(req.params.id), { send_at: new Date().toISOString() });
    res.json({ code: 0, message: '已标记' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
