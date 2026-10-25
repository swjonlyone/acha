// 公開頁面的預設連線。瀏覽器沒有覆寫時使用這組 anon public key。
export const PUBLIC_SUPABASE_URL = 'https://vtdaecsmwwkbgvpowhup.supabase.co';
export const PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZGFlY3Ntd3drYmd2cG93aHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDM1MjUsImV4cCI6MjEwODUxOTUyNX0.4RDQmIWCxfDCWzvHR7tE54DKzLDA5xPEYZd8HviRs0o';

export function readStoredSupabaseConfig(stored) {
  let parsed = stored;
  if (typeof stored === 'string') {
    try { parsed = JSON.parse(stored); } catch (_) { return null; }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const url = typeof parsed.url === 'string' ? parsed.url.trim().replace(/\/$/, '') : '';
  const key = typeof parsed.key === 'string' ? parsed.key.trim() : '';
  if (!url || !key) return null;
  return { url, key };
}

// 設定裡已存的 url + key 優先；否則用內建公開連線。
export function resolveSupabaseConfig(stored) {
  const override = readStoredSupabaseConfig(stored);
  if (override) return { ...override, source: 'override' };
  return { url: PUBLIC_SUPABASE_URL, key: PUBLIC_SUPABASE_ANON_KEY, source: 'public' };
}
