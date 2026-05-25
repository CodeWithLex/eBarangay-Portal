import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert 09XXXXXXXXX → +639XXXXXXXXX
function toE164(mobile: string): string | null {
  const digits = mobile.replace(/\D/g, '')
  if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1)
  if (digits.startsWith('639') && digits.length === 12) return '+' + digits
  return null
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { mobile } = await req.json()

    const phone = toE164(mobile)
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Invalid mobile number. Use format 09XXXXXXXXX.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes

    // Store OTP in database (service_role bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: dbError } = await supabase
      .from('otp_store')
      .upsert({ mobile: phone, code: otp, expires_at: expiresAt, attempts: 0 })

    if (dbError) throw dbError

    // Send via Semaphore API
    const semaphoreApiKey = Deno.env.get('SEMAPHORE_API_KEY')
    const senderName = Deno.env.get('SEMAPHORE_SENDER_NAME') || 'eBarangay'

    const formData = new FormData()
    formData.append('apikey', semaphoreApiKey!)
    formData.append('number', phone)
    formData.append('message', `Ang iyong E-Barangay OTP ay: ${otp}. Mag-expire ito sa 5 minuto. Huwag ibahagi sa iba.`)
    formData.append('sendername', senderName)

    const smsRes = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      body: formData,
    })

    const smsData = await smsRes.json()
    if (!smsRes.ok) {
      console.error('Semaphore error:', smsData)
      throw new Error('Failed to send SMS. Check Semaphore API key.')
    }

    console.log(`[OTP] Sent to ${phone} via Semaphore`)

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
