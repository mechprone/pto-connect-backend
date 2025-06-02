const express = require('express');
const router = express.Router();
const { supabase, verifySupabaseToken } = require('../../services/supabase');

// GET all drafts for this org
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
    console.error('GET /email-drafts error:', err.message);
    res.status(401).json({ error: err.message });
  }
});

// POST new draft
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
    console.error('POST /email-drafts error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// PUT update draft
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
      .eq('user_id', user.id); // Soft auth check

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /email-drafts/:id error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// DELETE draft
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const user = await verifySupabaseToken(token);
    const draftId = req.params.id;

    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', user.id); // Optional: additional user check

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /email-drafts/:id error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
console.log('[emailDrafts.js] Routes loaded successfully');
