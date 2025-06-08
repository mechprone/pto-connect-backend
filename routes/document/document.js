import express from 'express';
import multer from 'multer';
import { supabase } from '../util/verifySupabaseToken.js';
import { getUserOrgContext, addUserOrgToBody } from '../middleware/organizationalContext.js';
import { requireVolunteer, canManageDocuments } from '../middleware/roleBasedAccess.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/documents – Get all documents for user's organization
router.get('/', getUserOrgContext, requireVolunteer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching documents for org ${req.orgId}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    console.log(`✅ Retrieved ${data.length} documents for org ${req.orgId}`);
    res.json(data);
  } catch (err) {
    console.error('[document.js] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/documents – Upload document (committee lead+ required)
router.post('/', getUserOrgContext, canManageDocuments, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { title, category, description } = req.body;

    const ext = originalname.split('.').pop();
    const filePath = `documents/${req.orgId}/${Date.now()}.${ext}`;

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error(`❌ Error uploading file for org ${req.orgId}:`, uploadError.message);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Save document metadata to database
    const { data, error: dbError } = await supabase
      .from('documents')
      .insert([{
        title: title || originalname,
        file_path: filePath,
        category,
        description,
        file_size: buffer.length,
        file_type: mimetype,
        org_id: req.orgId,
        uploaded_by: req.user.id
      }])
      .select()
      .single();

    if (dbError) {
      console.error(`❌ Error saving document metadata for org ${req.orgId}:`, dbError.message);
      return res.status(500).json({ error: 'Failed to save document metadata' });
    }

    console.log(`✅ Document uploaded for org ${req.orgId} by user ${req.user.id}`);
    res.status(201).json({
      success: true,
      document: data
    });
  } catch (err) {
    console.error('[document.js] POST error:', err.message);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

console.log('[document.js] Routes loaded successfully');
export default router;
