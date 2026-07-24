import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', userData.user.id)
    .single();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'No account found' }, { status: 404 });
  }

  if (profile.account_role !== 'admin' && profile.account_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('ai_providers')
    .select('id, provider, api_key, is_active')
    .eq('account_id', profile.account_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ providers: data || [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', userData.user.id)
    .single();

  if (!profile?.account_id) {
    return NextResponse.json({ error: 'No account found' }, { status: 404 });
  }

  if (profile.account_role !== 'admin' && profile.account_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { provider, api_key, is_active } = await req.json();

    if (!provider || !['openai', 'openrouter', 'sarvam', 'cohere'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const { error } = await supabase
      .from('ai_providers')
      .upsert(
        {
          account_id: profile.account_id,
          provider,
          api_key,
          is_active: is_active ?? true,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'account_id, provider' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 }
    );
  }
}
