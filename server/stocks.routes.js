// server/stocks.routes.js
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// --- 記憶體快取 ---
const cache = new Map();
const setCache = (key, data, ttl=60000) => cache.set(key, {data, exp: Date.now()+ttl});
const getCache = (key) => {
  const hit = cache.get(key);
  if (!hit || Date.now() > hit.exp) return null;
  return hit.data;
};

// --- 內建清單（可擴充；台股記得 .TW／上櫃 .TWO）---
const SYMBOLS = [
  { symbol: '2330.TW', name: '台積電', exchange: 'TWSE' },
  { symbol: '2317.TW', name: '鴻海', exchange: 'TWSE' },
  { symbol: '2303.TW', name: '聯電', exchange: 'TWSE' },
  { symbol: '2454.TW', name: '聯發科', exchange: 'TWSE' },
  { symbol: '2881.TW', name: '富邦金', exchange: 'TWSE' },
  { symbol: '0050.TW', name: '元大台灣50', exchange: 'TWSE' },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
];

// --- 搜尋（名稱/代號 模糊）---
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const out = SYMBOLS.filter(s =>
    s.symbol.toLowerCase().includes(q) ||
    (s.name || '').toLowerCase().includes(q)
  ).slice(0, 30);
  res.json(out);
});

// --- 報價（Yahoo Finance quote）---
router.get('/quote', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const key = `q:${symbol}`;
    const hit = getCache(key);
    if (hit) return res.json(hit);

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    if (!r.ok) throw new Error('quote fetch failed');
    const j = await r.json();
    const q = j?.quoteResponse?.result?.[0];
    if (!q) return res.json({});

    const data = {
      symbol: q.symbol,
      price: q.regularMarketPrice,
      prevClose: q.regularMarketPreviousClose,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      currency: q.currency,
      exchange: q.fullExchangeName || q.exchange,
      time: q.regularMarketTime ? q.regularMarketTime * 1000 : Date.now()
    };
    setCache(key, data, 60000);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- K 線（Yahoo Finance chart）---
router.get('/candles', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim();
    const range = String(req.query.range || '1mo');      // 1d,5d,1mo,3mo,6mo,1y,5y,max
    const interval = String(req.query.interval || '1d'); // 1m,5m,15m,1d,1wk,1mo
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const key = `c:${symbol}:${range}:${interval}`;
    const hit = getCache(key);
    if (hit) return res.json(hit);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    if (!r.ok) throw new Error('candles fetch failed');
    const j = await r.json();
    const resChart = j?.chart?.result?.[0];
    const ts = resChart?.timestamp || [];
    const q = resChart?.indicators?.quote?.[0] || {};
    const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];

    const out = ts.map((t,i)=>({ t: t*1000, o:o[i]??null, h:h[i]??null, l:l[i]??null, c:c[i]??null, v:v[i]??null }))
                  .filter(d=>d.c!=null);

    setCache(key, out, 60000);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
