import express from 'express';
import { supabase, verifySupabaseToken } from '../util/verifySupabaseToken.js';

const router = express.Router();

// 🔐 GET /api/communication/email-drafts – all drafts for org
router.get('/', async (req, res) => {
  try {
    const user = await verifySupabaseToken(req.headers.authorization?.split('Bearer ')[1]);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('org_id', profile.org_id);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('[emailDraft.js] GET error:', err.message);
    res.status(401).json({ error: err.message });
  }
});

// 🔐 POST /api/communication/email-drafts – new draft
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const user = await verifySupabaseToken(token);
    const { subject, html_content, design_json, status } = req.body;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const { data, error } = await supabase.from('email_drafts').insert([{
      subject,
      html_content,
      design_json,
      status,
      user_id: user.id,
      org_id: profile.org_id
    }]).select().single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[emailDraft.js] POST error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 🔐 PUT /api/communication/email-drafts/:id – update draft
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const user = await verifySupabaseToken(token);
    const { subject, html_content, design_json, status } = req.body;
    const draftId = req.params.id;

    const { error } = await supabase
      .from('email_drafts')
      .update({
        subject,
        html_content,
        design_json,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[emailDraft.js] PUT error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 🔐 DELETE /api/communication/email-drafts/:id – delete
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const user = await verifySupabaseToken(token);
    const draftId = req.params.id;

    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[emailDraft.js] DELETE error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
