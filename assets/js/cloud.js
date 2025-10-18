// cloud.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export function cloudReady() {
  return !!SUPABASE_URL;               // 只檢查 URL
}

export async function cloudOCR(imageBase64, language = 'eng') {
  if (!cloudReady()) throw new Error('Supabase 未設定');

  const headers = {};
  if (SUPABASE_ANON_KEY) headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`; // 有就帶

  const res = await fetch(SUPABASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageBase64, language }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || '雲端 OCR 失敗');
  return json; // { text: "...", ... }
}
