import express from 'express';
import multer from 'multer';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 🔐 GET /api/documents
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;
    if (!orgId) return res.status(400).json({ error: 'Missing org ID' });

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /documents error:', err.message);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// 🔐 POST /api/documents
router.post('/', upload.single('file'), async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const user = await verifySupabaseToken(token);
    const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;
    const { originalname, buffer } = req.file;
    const title = req.body.title;

    const ext = originalname.split('.').pop();
    const filePath = `documents/${orgId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from('documents').insert([
      {
        title,
        file_path: filePath,
        org_id: orgId,
        uploaded_by: user.id
      }
    ]);

    if (dbError) throw dbError;
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('POST /documents error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

console.log('[document.js] Routes loaded successfully');
export default router;
