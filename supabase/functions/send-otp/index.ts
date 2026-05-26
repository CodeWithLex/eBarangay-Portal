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

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { mobile } = await req.json()

    if (!mobile) {
      return json({ error: 'Mobile number is required.' }, 400)
    }

    const phone = toE164(String(mobile))
    if (!phone) {
      return json({ error: 'Invalid mobile number. Use format 09XXXXXXXXX.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = getServiceRoleKey()
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Server configuration error.' }, 500)
    }

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error: dbError } = await supabase
      .from('otp_store')
      .upsert({ mobile: phone, code: otp, expires_at: expiresAt, attempts: 0 })

    if (dbError) {
      console.error('[send-otp] Database error:', dbError)
      const hint =
        dbError.code === '42P01'
          ? 'Run supabase/migrations/001_initial_schema.sql in Supabase SQL Editor.'
          : dbError.message
      return json({ error: `Database error: ${hint}` }, 500)
    }

    // Free OTP: no SMS — show code on the next screen (pilot / demo mode)
    console.log(`[send-otp] In-app OTP for ${phone}: ${otp}`)

    return json({
      success: true,
      message: 'OTP generated. Ilagay ang code sa susunod na screen.',
      display_otp: otp,
      expires_in_seconds: 300,
    })
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err)
    return json({ error: err?.message ?? 'Failed to send OTP.' }, 500)
  }
})
