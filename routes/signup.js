const express = require('express')
const router = express.Router()

const { createClient } = require('@supabase/supabase-js')
const { verifySupabaseToken } = require('../services/supabase')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

router.post('/complete', async (req, res) => {
  const {
    sessionId,
    ptoName,
    schoolName,
    districtName,
    adminName,
    adminEmail,
    adminPassword
  } = req.body

  if (!ptoName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Missing required fields.' })
  }

  try {
    let { data: district, error: districtError } = await supabase
      .from('districts')
      .select('id')
      .eq('name', districtName)
      .single()

    if (districtError || !district) {
      const { data: newDistrict, error } = await supabase
        .from('districts')
        .insert({ name: districtName })
        .select()
        .single()
      if (error) throw error
      district = newDistrict
    }

    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

    const { data: pto, error: ptoError } = await supabase
      .from('ptos')
      .insert({
        name: ptoName,
        school_name: schoolName,
        district_id: district.id,
        invite_code: inviteCode,
        subscription_plan: 'monthly',
        stripe_customer_id: null,
        stripe_subscription_id: null
      })
      .select()
      .single()

    if (ptoError) throw ptoError

    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    })

    if (userError) throw userError

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.user.id,
        full_name: adminName,
        email: adminEmail,
        role: 'admin',
        pto_id: pto.id
      })

    if (profileError) throw profileError

    return res.json({ success: true })
  } catch (err) {
    console.error('Signup error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
