import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getStore } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'govcar-dev-secret-key-change-in-production';
const JWT_EXPIRES = '24h';

export function generateToken(payload: { id: number; open_id: string; name: string; role: string; department_id: number }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 开发模式：header 里带 x-user-id 模拟登录（生产环境禁用）
  const isDev = process.env.NODE_ENV !== 'production';
  const devUserId = req.headers['x-user-id'] as string | undefined;
  if (devUserId && isDev) {
    const store = getStore<any>('sys_user');
    const user = await store.findOne((u: any) => u.id === Number(devUserId) && u.is_deleted === 0);
    if (user) {
      req.user = { id: user.id, open_id: user.open_id, name: user.name, role: user.role, department_id: user.department_id };
      next();
      return;
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未登录' });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const store = getStore<any>('sys_user');
    const user = await store.findOne((u: any) => u.id === decoded.id && u.is_deleted === 0);
    if (!user) { res.status(401).json({ code: 401, message: '用户不存在或已禁用' }); return; }
    req.user = {
      id: user.id, open_id: user.open_id, name: user.name,
      role: user.role, department_id: user.department_id,
    };
    next();
  } catch {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ code: 401, message: '未登录' }); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({ code: 403, message: '无权限' }); return; }
    next();
  };
}
