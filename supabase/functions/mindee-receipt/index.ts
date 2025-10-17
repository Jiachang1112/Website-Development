// supabase/functions/mindee-receipt/index.ts
// deno deploy on supabase edge
import { serve } from "https://deno.land/std/http/server.ts";

const MINDEE_KEY = Deno.env.get("MINDEE_API_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { imageBase64 } = await req.json();

    // base64 → binary
    const bin = Uint8Array.from(atob(String(imageBase64).split(",").pop()!), c => c.charCodeAt(0));
    const form = new FormData();
    form.append("document", new Blob([bin], { type: "image/jpeg" }));

    // 呼叫 Mindee Receipts（會自動偵測語系）
    const r = await fetch("https://api.mindee.net/v1/products/mindee/expense_receipts/v4/predict", {
      method: "POST",
      headers: { "Authorization": `Token ${MINDEE_KEY}` },
      body: form
    });

    const json = await r.json();
    const doc = json?.document?.inference?.pages?.[0]?.prediction ?? {};

    const total  = doc.total_amount?.value ?? null;
    const date   = doc.date?.value ?? null;
    const vendor = doc.supplier_name?.value ?? null;
    const items  = (doc.line_items ?? []).map((x: any) => ({
      name: x.description?.value ?? "",
      amount: x.total_amount?.value ?? x.unit_price?.value ?? null,
    }));

    return new Response(JSON.stringify({ ok: true, total, date, vendor, items, raw: json }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: CORS });
  }
});
