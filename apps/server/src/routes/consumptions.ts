import { Router, Request, Response } from 'express';
import { getStore } from '../db/database';
import { requireRole } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import Tesseract from 'tesseract.js';

export const consumptionRoutes = Router();
const mgmtRoles = ['SYSTEM_ADMIN', 'ADMIN_MANAGER', 'DRIVER'];
const now = () => new Date().toISOString();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

// EXIF 日期提取（纯二进制解析 JPEG，无需外部依赖）
function extractExifDate(buffer: Buffer): string | null {
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;

  let pos = 2;
  while (pos < buffer.length - 3) {
    if (buffer[pos] !== 0xFF) return null;
    const marker = buffer[pos + 1];
    if (marker === 0xD9 || marker === 0xDA) break; // EOI or SOS
    const segLen = buffer.readUInt16BE(pos + 2);
    if (marker === 0xE1) { // APP1 = EXIF
      const tag = buffer.toString('ascii', pos + 4, pos + 10);
      if (tag === 'Exif\x00\x00') {
        const tiffStart = pos + 10;
        const le = buffer.toString('ascii', tiffStart, tiffStart + 2) === 'II';
        const r16 = (o: number) => le ? buffer.readUInt16LE(tiffStart + o) : buffer.readUInt16BE(tiffStart + o);
        const r32 = (o: number) => le ? buffer.readUInt32LE(tiffStart + o) : buffer.readUInt32BE(tiffStart + o);
        if (r16(2) !== 0x002A) return null;
        let ifd = r32(4);
        while (ifd > 0 && ifd < buffer.length - tiffStart - 2) {
          const n = r16(ifd);
          for (let i = 0; i < n; i++) {
            const o = ifd + 2 + i * 12;
            const tag = r16(o);
            if ((tag === 0x9003 || tag === 0x0132) && r16(o + 2) === 2) {
              const cnt = r32(o + 4);
              const strOff = cnt <= 4 ? o + 8 : r32(o + 8);
              return buffer.toString('ascii', tiffStart + strOff, tiffStart + strOff + cnt - 1);
            }
          }
          ifd = r32(ifd + 2 + n * 12);
        }
      }
    }
    pos += 2 + segLen;
  }
  return null;
}

// OCR 识别里程数（使用 tesseract.js，免费本地运行）
async function ocrMileageFromImage(filepath: string): Promise<{ mileage: number | null; timestamp: string | null; rawText: string }> {
  try {
    const { data } = await Tesseract.recognize(filepath, 'eng', {
      logger: () => {}, // 静默
    });
    const text = (data.text || '').trim();

    // 从 OCR 文本中提取水印日期时间
    let timestamp: string | null = null;
    const dateMatch = text.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
    const timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (dateMatch) {
      const d = dateMatch[1].replace(/\//g, '-');
      const t = timeMatch ? timeMatch[1] : '00:00';
      timestamp = `${d}T${t}:00`;
    }

    // 匹配所有纯数字序列，过滤出里程读数
    const matches = text.match(/\b\d+\b/g);
    let mileage: number | null = null;
    if (matches) {
      const currentYear = new Date().getFullYear();
      const nums = matches
        .map(Number)
        .filter(n => n >= 1000 && n <= 999999)
        .filter(n => n < currentYear - 5 || n > currentYear + 5);

      if (nums.length > 0) {
        const over10k = nums.filter(n => n >= 10000);
        mileage = over10k.length > 0 ? over10k[0] : nums.sort((a, b) => b - a)[0];
      }
    }

    return { mileage, timestamp, rawText: text };
  } catch (e: any) {
    console.warn(`[ocr] 识别失败: ${e.message}`);
    return { mileage: null, timestamp: null, rawText: '' };
  }
}

// 获取可录入消耗的派车记录（本人的 IN_PROGRESS 调度）
consumptionRoutes.get('/my-dispatches', async (req: Request, res: Response) => {
  try {
    const dispatchStore = getStore<any>('car_dispatch_record');
    const appStore = getStore<any>('car_application');

    let dispatches = await dispatchStore.find(d => d.status === 'IN_PROGRESS');
    if (req.user!.role === 'DRIVER') {
      dispatches = dispatches.filter(d => d.driver_id === req.user!.id);
    }

    const enriched = await Promise.all(dispatches.map(async d => {
      const app = await appStore.findById(d.application_id);
      return {
        ...d,
        application_no: app?.application_no || '',
        application_type: app?.application_type || '',
        applicant_name: app?.applicant_name || '',
        origin: app?.origin || '',
        destination: app?.destination || '',
      };
    }));

    res.json({ code: 0, data: enriched });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

consumptionRoutes.post('/', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const appStore = getStore<any>('car_application');
    const store = getStore<any>('car_consumption_record');
    const {
      application_id, dispatch_id,
      actual_departure_at, actual_return_at,
      start_mileage, end_mileage,
      toll_amount, parking_amount, other_amount,
      route_description,
      start_photo_url, end_photo_url,
      is_long_distance,
    } = req.body;

    const app = await appStore.findOne(a => a.id === application_id && a.is_deleted === 0);
    if (!app) { res.status(404).json({ code: 404, message: '申请不存在' }); return; }

    if (app.application_type === 'PRIVATE' && is_long_distance == null) {
      res.status(400).json({ code: 400, message: '私车公用需填写"单程是否超过100公里"' }); return;
    }

    const existing = await store.findOne(c => c.application_id === application_id);
    if (existing) { res.status(400).json({ code: 400, message: '该申请已录入消耗，不可重复填报' }); return; }

    const durationMinutes = actual_departure_at && actual_return_at
      ? Math.round((new Date(actual_return_at).getTime() - new Date(actual_departure_at).getTime()) / 60000)
      : null;

    const totalMileage = (start_mileage != null && end_mileage != null)
      ? Number(end_mileage) - Number(start_mileage)
      : null;

    const totalAmount = (Number(toll_amount) || 0) + (Number(parking_amount) || 0) + (Number(other_amount) || 0);

    const fields: any = {
      application_id, dispatch_id: dispatch_id || null,
      recorded_by: req.user!.id, recorded_by_name: req.user!.name,
      actual_departure_at: actual_departure_at || null,
      actual_return_at: actual_return_at || null,
      duration_minutes: durationMinutes,
      start_mileage: start_mileage != null ? Number(start_mileage) : null,
      end_mileage: end_mileage != null ? Number(end_mileage) : null,
      total_mileage: totalMileage,
      toll_amount: Number(toll_amount) || 0,
      parking_amount: Number(parking_amount) || 0,
      other_amount: Number(other_amount) || 0,
      total_amount: totalAmount,
      route_description: route_description || null,
      start_photo_url: start_photo_url || null,
      end_photo_url: end_photo_url || null,
      is_long_distance: is_long_distance != null ? Boolean(is_long_distance) : null,
      status: 'PENDING_CONFIRM',
      confirmed_by: null, confirmed_by_name: null, confirmed_at: null,
      reject_reason: null,
      created_at: now(), updated_at: now(),
    };

    const record = await store.insert(fields);

    await appStore.update(application_id, { status: 'PENDING_CONFIRM', updated_at: now() });

    const logStore = getStore<any>('car_application_operation_log');
    await logStore.insert({
      application_id, operation: 'RECORD_CONSUMPTION',
      operator_id: req.user!.id, operator_name: req.user!.name,
      from_status: app.status, to_status: 'PENDING_CONFIRM',
      detail: `录入消耗: 里程${totalMileage || 0}km 费用¥${totalAmount}`,
      created_at: now(),
    });

    res.json({ code: 0, data: record });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 上传里程表照片（水印照片）
consumptionRoutes.post('/upload-photo', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) { res.status(400).json({ code: 400, message: '请上传照片' }); return; }

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const ext = image.startsWith('data:image/png') ? '.png' : '.jpg';
    const filename = `odometer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

    const url = `/uploads/${filename}`;
    res.json({ code: 0, data: { url, filename } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 照片智能识别（OCR 提取里程数 + EXIF 提取时间）
consumptionRoutes.post('/ocr-photo', requireRole(...mgmtRoles), async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) { res.status(400).json({ code: 400, message: '请提供照片路径' }); return; }

    const filename = path.basename(url);
    const filepath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filepath)) {
      res.status(404).json({ code: 404, message: '照片文件不存在' });
      return;
    }

    const buffer = fs.readFileSync(filepath);

    const [exifDate, ocrResult] = await Promise.all([
      Promise.resolve(extractExifDate(buffer)),
      ocrMileageFromImage(filepath),
    ]);

    const result: any = {};
    if (exifDate) {
      const ts = exifDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      result.timestamp = ts;
    } else if (ocrResult.timestamp) {
      result.timestamp = ocrResult.timestamp;
    }
    if (ocrResult.mileage != null) {
      result.mileage = ocrResult.mileage;
    }
    result.ocr_text = ocrResult.rawText?.slice(0, 200) || '';

    console.log(`[ocr] ${filename}: mileage=${ocrResult.mileage}, exif=${exifDate || 'none'}, ocr_ts=${ocrResult.timestamp || 'none'}`);
    res.json({ code: 0, data: result });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

consumptionRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_consumption_record');
    const appStore = getStore<any>('car_application');
    const { application_id, status } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    let list = await store.all();
    if (application_id) list = list.filter(r => r.application_id === Number(application_id));
    if (status) list = list.filter(r => r.status === status);

    const total = list.length;
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    list = list.slice((page - 1) * pageSize, page * pageSize);

    const enriched = await Promise.all(list.map(async r => {
      const app = await appStore.findById(r.application_id);
      return { ...r, application_no: app?.application_no || '', application_type: app?.application_type || '' };
    }));

    res.json({ code: 0, data: { list: enriched, total, page, pageSize } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

  // L1 确认：用车人/申请人确认消耗数据
  consumptionRoutes.post('/:id/confirm', async (req: Request, res: Response) => {
    try {
      const store = getStore<any>('car_consumption_record');
      const record = await store.findById(Number(req.params.id));
      if (!record) { res.status(404).json({ code: 404, message: '消耗记录不存在' }); return; }
      if (record.status !== 'PENDING_CONFIRM') { res.status(400).json({ code: 400, message: '当前状态不可确认' }); return; }

      await store.update(record.id, {
        status: 'PENDING_L2_CONFIRM',
        confirmed_by: req.user!.id, confirmed_by_name: req.user!.name, confirmed_at: now(),
        updated_at: now(),
      });

      const logStore = getStore<any>('car_application_operation_log');
      await logStore.insert({
        application_id: record.application_id, operation: 'L1_CONFIRM_CONSUMPTION',
        operator_id: req.user!.id, operator_name: req.user!.name,
        from_status: 'PENDING_CONFIRM', to_status: 'PENDING_L2_CONFIRM',
        detail: '用车人确认消耗', created_at: now(),
      });

      res.json({ code: 0, data: { status: 'PENDING_L2_CONFIRM' } });
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message });
    }
  });

  // L2 确认：行政经理终审
  consumptionRoutes.post('/:id/admin-confirm', requireRole('SYSTEM_ADMIN', 'ADMIN_MANAGER'), async (req: Request, res: Response) => {
    try {
      const store = getStore<any>('car_consumption_record');
      const appStore = getStore<any>('car_application');
      const dispatchStore = getStore<any>('car_dispatch_record');
      const vehicleStore = getStore<any>('car_vehicle');
      const driverStore = getStore<any>('car_driver');

      const record = await store.findById(Number(req.params.id));
      if (!record) { res.status(404).json({ code: 404, message: '消耗记录不存在' }); return; }
      if (record.status !== 'PENDING_L2_CONFIRM') { res.status(400).json({ code: 400, message: '当前状态不可复核' }); return; }

      await store.update(record.id, {
        status: 'CONFIRMED',
        confirmed_by: req.user!.id, confirmed_by_name: req.user!.name, confirmed_at: now(),
        updated_at: now(),
      });

      const pending = await store.find(r => r.application_id === record.application_id && r.status === 'PENDING_L2_CONFIRM');
      if (pending.length === 0) {
        await appStore.update(record.application_id, { status: 'COMPLETED', updated_at: now() });

        const dispatches = await dispatchStore.find(d => d.application_id === record.application_id && d.status === 'IN_PROGRESS');
        for (const d of dispatches) {
          await dispatchStore.update(d.id, { actual_return_at: record.actual_return_at || now(), status: 'COMPLETED', updated_at: now() });
          await vehicleStore.update(d.vehicle_id, { status: 'AVAILABLE', updated_at: now() });
          await driverStore.update(d.driver_id, { status: 'AVAILABLE', updated_at: now() });
        }
      }

      const logStore = getStore<any>('car_application_operation_log');
      await logStore.insert({
        application_id: record.application_id, operation: 'L2_CONFIRM_CONSUMPTION',
        operator_id: req.user!.id, operator_name: req.user!.name,
        from_status: 'PENDING_L2_CONFIRM', to_status: 'CONFIRMED',
        detail: '行政经理复核通过', created_at: now(),
      });

      res.json({ code: 0, data: { status: 'CONFIRMED' } });
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message });
    }
  });

consumptionRoutes.post('/:id/reject', requireRole('SYSTEM_ADMIN', 'ADMIN_MANAGER'), async (req: Request, res: Response) => {
  try {
    const store = getStore<any>('car_consumption_record');
    const { reason } = req.body;
    await store.update(Number(req.params.id), { status: 'REJECTED', reject_reason: reason, updated_at: now() });

    const record = await store.findById(Number(req.params.id));
    if (record) {
      const logStore = getStore<any>('car_application_operation_log');
      await logStore.insert({ application_id: record.application_id, operation: 'REJECT_CONSUMPTION', operator_id: req.user!.id, operator_name: req.user!.name, from_status: 'PENDING_CONFIRM', to_status: 'REJECTED', detail: reason, created_at: now() });
    }

    res.json({ code: 0, data: { status: 'REJECTED' } });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});
