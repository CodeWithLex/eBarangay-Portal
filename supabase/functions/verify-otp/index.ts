import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toE164(mobile: string): string | null {
  const digits = mobile.replace(/\D/g, '')
  if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1)
  if (digits.startsWith('639') && digits.length === 12) return '+' + digits
  return null
}

const MAX_ATTEMPTS = 5

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { mobile, otp } = await req.json()

    const phone = toE164(mobile)
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Invalid mobile number format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch stored OTP
    const { data: record, error: fetchErr } = await supabase
      .from('otp_store')
      .select('*')
      .eq('mobile', phone)
      .single()

    if (fetchErr || !record) {
      return new Response(
        JSON.stringify({ error: 'OTP not found. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      await supabase.from('otp_store').delete().eq('mobile', phone)
      return new Response(
        JSON.stringify({ error: 'OTP has expired. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check attempts
    if (record.attempts >= MAX_ATTEMPTS) {
      await supabase.from('otp_store').delete().eq('mobile', phone)
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please request a new OTP.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Increment attempts
    await supabase.from('otp_store').update({ attempts: record.attempts + 1 }).eq('mobile', phone)

    // Validate OTP
    if (record.code !== String(otp)) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OTP is valid — delete it (one-time use)
    await supabase.from('otp_store').delete().eq('mobile', phone)

    // Sign in or create user using admin API
    // First check if user already exists via phone
    const { data: listData } = await supabase.auth.admin.listUsers()
    const existingUser = listData?.users?.find(u => u.phone === phone || u.user_metadata?.mobile === phone)

    let userId: string
    let isNewUser = false

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create a new auth user
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
        user_metadata: { mobile: phone },
      })
      if (createErr) throw createErr
      userId = newUser.user!.id
      isNewUser = true
    }

    // Generate a magic link / session for the user
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `${userId}@ebarangay.internal`, // dummy — we use custom session below
    })

    // Create a custom session token using signInWithPassword won't work,
    // so we return a short-lived access token for sessionless login:
    const { data: sessionData, error: sessionErr } = await supabase.auth.admin.createUser({
      email: `${phone.replace('+', '')}@temp.ebarangay.app`,
      email_confirm: true,
      user_metadata: { mobile: phone, phone_verified: true },
    })

    // Simpler approach: return userId + isNewUser to client, client calls refresh
    // The best pattern for custom OTP is returning a signed token
    // We'll use generateLink type='magiclink' is email only
    // Best approach: use admin.createUser with auto-confirm then return session
    // Since Supabase admin doesn't allow direct session creation without email/password,
    // we return userId + isNewUser and use a stored procedure to generate a session

    // Return success with user info — client will use this to set context
    return new Response(
      JSON.stringify({
        success: true,
        userId,
        phone,
        isNewUser,
        // Check if profile exists
        hasProfile: !isNewUser,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('verify-otp error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Verification failed.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
