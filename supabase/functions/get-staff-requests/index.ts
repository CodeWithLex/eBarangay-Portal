import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  console.log('[get-staff-requests] Invoked')

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      console.error('[get-staff-requests] Missing environment variables')
      return json({ error: 'Server configuration error: missing secrets' }, 500)
    }

    // 1. Verify caller is authenticated
    const authHeader = req.headers.get('authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { authorization: authHeader } }
    })

    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      console.warn('[get-staff-requests] Unauthorized access attempt', authErr)
      return json({ error: 'Unauthorized: No valid session' }, 401)
    }

    console.log('[get-staff-requests] Caller UID:', user.id)

    // 2. Use service role client
    const adminClient = createClient(supabaseUrl, serviceKey)

    // 3. Check caller's role from profiles
    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      console.error('[get-staff-requests] Profile lookup error:', profileErr)
      return json({ error: `Forbidden: Profile lookup failed: ${profileErr.message}` }, 403)
    }

    if (!callerProfile || !['staff', 'admin'].includes(callerProfile.role)) {
      console.warn(`[get-staff-requests] Forbidden role: ${callerProfile?.role} for ${user.id}`)
      return json({ error: `Forbidden: role '${callerProfile?.role}' not authorized` }, 403)
    }

    console.log('[get-staff-requests] Role verified:', callerProfile.role)

    // 4. Fetch all requests
    const { data: reqs, error: reqErr } = await adminClient
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (reqErr) {
      console.error('[get-staff-requests] Requests fetch error:', reqErr)
      throw reqErr
    }

    console.log(`[get-staff-requests] Found ${reqs?.length || 0} requests`)

    // 5. Fetch profiles for these requests
    const resIds = [...new Set(reqs?.map((r: any) => r.resident_id) ?? [])]
    let enriched = reqs || []

    if (resIds.length > 0) {
      const { data: profiles, error: pErr } = await adminClient
        .from('profiles')
        .select('id, full_name, mobile, purok, barangay')
        .in('id', resIds)

      if (pErr) console.error('[get-staff-requests] Profiles fetch error (non-fatal):', pErr)

      const profileMap = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = p
        return acc
      }, {})

      enriched = (reqs || []).map((r: any) => ({
        ...r,
        profiles: profileMap[r.resident_id] || null
      }))
    }

    return json({ data: enriched, count: enriched.length })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown internal error'
    console.error('[get-staff-requests] Fatal error:', msg)
    return json({ error: msg }, 500)
  }
})
