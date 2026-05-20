import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';

export const configRoutes = Router();

configRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await getStore<any>('sys_config').all();
    res.json({ code: 0, data: list });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

configRoutes.put('/:key', requireRole('SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('sys_config');
    const { config_value, config_type, description } = req.body;
    const existing = await store.findOne(c => c.config_key === req.params.key);

    if (existing) {
      await store.update(existing.id, { config_value, config_type: config_type || 'STRING', description, updated_by: req.user!.id, updated_at: new Date().toISOString() });
    } else {
      await store.insert({ config_key: req.params.key, config_value, config_type: config_type || 'STRING', description, updated_by: req.user!.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }

    res.json({ code: 0, data: { config_key: req.params.key, config_value } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
