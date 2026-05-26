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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'CONFIG_ERROR: Missing Supabase secrets' }, 500)
    }

    const adminClient = createClient(supabaseUrl, serviceKey)

    // 1. Authenticate caller
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json({ error: 'AUTH_ERROR: Missing Authorization header' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token)
    if (authErr || !user) return json({ error: 'AUTH_ERROR: Invalid session' }, 401)

    // 2. Check role
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['staff', 'admin'].includes(profile.role)) {
      return json({ error: `PERMISSION_ERROR: Role '${profile?.role}' not authorized` }, 403)
    }

    // 3. Get requests
    const { data: reqs, error: rErr } = await adminClient
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (rErr) throw rErr

    // 4. Enrich with signed URLs and profiles
    const resIds = [...new Set(reqs?.map((r: any) => r.resident_id) ?? [])]
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name, mobile, purok, barangay')
      .in('id', resIds)

    const profileMap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc }, {})

    // Process each request to add signed URL if file exists
    const enriched = await Promise.all((reqs || []).map(async (r: any) => {
      let signedUrl = null
      if (r.file_url) {
        const { data: sData } = await adminClient.storage
          .from('valid-ids')
          .createSignedUrl(r.file_url, 3600) // 1 hour expiry
        signedUrl = sData?.signedUrl
      }
      return {
        ...r,
        profiles: profileMap[r.resident_id] || null,
        signed_id_url: signedUrl
      }
    }))

    return json({ data: enriched, count: enriched.length })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return json({ error: msg }, 500)
  }
})
