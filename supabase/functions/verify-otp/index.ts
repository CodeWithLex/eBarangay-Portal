import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function toE164(mobile: string): string | null {
  const digits = mobile.replace(/\D/g, '')
  if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1)
  if (digits.startsWith('639') && digits.length === 12) return '+' + digits
  if (digits.startsWith('63') && digits.length === 11) return '+63' + digits.slice(2)
  return null
}

function phoneToAuthEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@phone.ebarangay.app`
}

function getServiceRoleKey(): string | undefined {
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    (() => {
      try {
        const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
        return keys ? JSON.parse(keys).default : undefined
      } catch {
        return undefined
      }
    })()
  )
}

const MAX_ATTEMPTS = 5

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { mobile, otp } = await req.json()

    const phone = toE164(String(mobile))
    if (!phone) {
      return json({ error: 'Invalid mobile number format.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = getServiceRoleKey()
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Server configuration error.' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: record, error: fetchErr } = await supabase
      .from('otp_store')
      .select('*')
      .eq('mobile', phone)
      .single()

    if (fetchErr || !record) {
      return json({ error: 'OTP not found. Please request a new code.' }, 400)
    }

    if (new Date(record.expires_at) < new Date()) {
      await supabase.from('otp_store').delete().eq('mobile', phone)
      return json({ error: 'OTP has expired. Please request a new code.' }, 400)
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await supabase.from('otp_store').delete().eq('mobile', phone)
      return json({ error: 'Too many attempts. Please request a new OTP.' }, 429)
    }

    await supabase.from('otp_store').update({ attempts: record.attempts + 1 }).eq('mobile', phone)

    if (record.code !== String(otp)) {
      return json({ error: 'Invalid OTP. Please try again.' }, 400)
    }

    await supabase.from('otp_store').delete().eq('mobile', phone)

    const authEmail = phoneToAuthEmail(phone)

    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const existingUser = listData?.users?.find(
      (u) =>
        u.email === authEmail ||
        u.phone === phone ||
        u.user_metadata?.mobile === phone
    )

    let userId: string
    let isNewUser = false

    if (existingUser) {
      userId = existingUser.id
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: authEmail,
        email_confirm: true,
        user_metadata: { mobile: phone },
      })
      if (createErr) throw createErr
      userId = newUser.user!.id
      isNewUser = true
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    // Issue a real Supabase session so RLS (auth.uid()) works in the browser
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })
    if (linkErr) throw linkErr

    const tokenHash = linkData.properties?.hashed_token
    if (!tokenHash) {
      throw new Error('Could not create login session.')
    }

    const { data: sessionData, error: sessionErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    })
    if (sessionErr) throw sessionErr

    return json({
      success: true,
      userId,
      phone,
      isNewUser,
      hasProfile: !!profile,
      access_token: sessionData.session?.access_token,
      refresh_token: sessionData.session?.refresh_token,
    })
  } catch (err) {
    console.error('[verify-otp] error:', err)
    return json({ error: err?.message || 'Verification failed.' }, 500)
  }
})
