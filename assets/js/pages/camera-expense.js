import { SUPABASE_URL } from '../config.js';

/* === 自動提亮 + 灰階增強 === */
function enhanceImage(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const bright = Math.min(255, avg * 1.3);
    data[i] = data[i + 1] = data[i + 2] = bright;
  }
  ctx.putImageData(imgData, 0, 0);
}

/* === 雲端 OCR 呼叫 === */
async function cloudOCR(base64, lang = 'cht') {
  const res = await fetch(SUPABASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, language: lang }),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || 'OCR failed');
  return json.text;
}

/* === 發票資訊解析 === */
function parseReceiptText(text) {
  const vendor = text.match(/(冷石|達麗|7-11|全家|統一超商|星巴克|全聯|家樂福|麥當勞|肯德基)/)?.[0] || '';
  const date =
    text.match(/\d{4}[-\/\.年]\s*\d{1,2}[-\/\.月]\s*\d{1,2}/)?.[0]
      ?.replace(/[年月]/g, '-')
      ?.replace(/[日]/, '') || '';
  const amount =
    text.match(/(\d{1,3}(?:,\d{3})*)(?=\s*(元|TX|總額|NT))/i)?.[1]?.replace(/,/g, '') || '';

  return { vendor, date, amount };
}

/* === 主按鈕動作 === */
document.querySelector('#btnCloudOCR').addEventListener('click', async () => {
  try {
    const canvas = document.querySelector('#cameraCanvas');
    enhanceImage(canvas); // 先提亮
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    const lang = document.querySelector('#ocr-lang').value;

    document.querySelector('#btnCloudOCR').innerText = '辨識中...';
    const text = await cloudOCR(base64, lang);
    const { vendor, date, amount } = parseReceiptText(text);

    if (vendor) document.querySelector('#vendor').value = vendor;
    if (date) document.querySelector('#date').value = date;
    if (amount) document.querySelector('#amount').value = amount;

    document.querySelector('#btnCloudOCR').innerText = '雲端 OCR ✅';
  } catch (err) {
    alert('OCR 辨識失敗：' + err.message);
    document.querySelector('#btnCloudOCR').innerText = '雲端 OCR';
  }
});
