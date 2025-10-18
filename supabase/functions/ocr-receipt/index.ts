// ocrspace-receipt/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OCRSPACE_KEY = Deno.env.get("OCRSPACE_API_KEY") ?? "";

serve(async (req) => {
  try {
    if (!OCRSPACE_KEY) {
      return new Response(JSON.stringify({ error: "Missing OCRSPACE_API_KEY" }), { status: 500 });
    }

    const { imageBase64, language = "cht" } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), { status: 400 });
    }

    const base64 = String(imageBase64).includes(",")
      ? String(imageBase64).split(",")[1]
      : String(imageBase64);

    const form = new FormData();
    form.append("base64Image", "data:image/jpeg;base64," + base64);
    form.append("language", language);
    form.append("isTable", "true");
    form.append("scale", "true");
    form.append("OCREngine", "2");

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: OCRSPACE_KEY },
      body: form,
    });

    const json = await res.json();
    if (!json || json.OCRExitCode !== 1) {
      return new Response(JSON.stringify({ error: "OCR failed", raw: json }), { status: 502 });
    }

    const text = (json.ParsedResults?.[0]?.ParsedText ?? "").replace(/\r/g, "");
    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
