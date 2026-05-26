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
    // 1. Verify caller is authenticated
    const authHeader = req.headers.get('authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    )

    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // 2. Use service role client (bypasses all RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 3. Check caller's role from profiles
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['staff', 'admin'].includes(callerProfile.role)) {
      return json({ error: `Forbidden: got role '${callerProfile?.role}', need staff or admin` }, 403)
    }

    // 4. Fetch all requests (no join — avoids schema cache issue)
    const { data: requests, error: reqErr } = await adminClient
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (reqErr) throw reqErr

    // 5. Fetch all profiles for the resident IDs in those requests
    const residentIds = [...new Set(requests?.map((r: Record<string, string>) => r.resident_id) ?? [])]
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name, mobile, purok, barangay')
      .in('id', residentIds)

    // 6. Merge profile data into each request
    const profileMap: Record<string, unknown> = {}
    profiles?.forEach((p: Record<string, string>) => { profileMap[p.id] = p })

    const enriched = requests?.map((r: Record<string, unknown>) => ({
      ...r,
      profiles: profileMap[r.resident_id as string] ?? null,
    })) ?? []

    return json({ data: enriched, count: enriched.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[get-staff-requests] error:', message)
    return json({ error: message }, 500)
  }
})
