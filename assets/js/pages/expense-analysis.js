// ---- 新增：欄位正規化工具 ----
function normalizeType(t) {
  const s = String(t || '').trim().toLowerCase();
  if (['income', 'in', 'i', '收入', '入'].includes(s)) return 'income';
  if (['expense', 'out', 'ex', 'e', '支出', '出'].includes(s)) return 'expense';
  return '';
}

function pickDateField(x) {
  // 依序嘗試：date / timestamp / createdAt
  const v = x?.date ?? x?.timestamp ?? x?.createdAt ?? null;
  if (!v) return null;

  // Firestore Timestamp
  if (v && typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
  // Date 物件
  if (v instanceof Date) return v;
  // 數字（毫秒）
  if (typeof v === 'number') return new Date(v);
  // 字串（ISO/Y-M-D/…）
  if (typeof v === 'string') return new Date(v);

  return null;
}

function toYM(dateLike) {
  const d = pickDateField({ date: dateLike }) || (dateLike instanceof Date ? dateLike : null);
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getYMFromRow(x) {
  // 從 row 的多種欄位自動取年月
  const d = pickDateField(x);
  if (!d) return '';
  return toYM(d);
}

function pickCategoryName(x) {
  if (x?.cat) return x.cat;
  if (typeof x?.category === 'string') return x.category;
  if (x?.category?.name) return x.category.name;
  if (x?.category?.label) return x.category.label;
  if (x?.categoryName) return x.categoryName;
  return '其他';
}

function pickAmount(x) {
  const n = Number(x?.amount);
  return Number.isFinite(n) ? n : 0;
}

// ---- 新增：讀取資料（支援多資料源）----
async function loadListByMode(mode) {
  // 1) 先試分開集合
  try {
    const name = mode === 'out' ? 'expenses' : 'incomes';
    const arr = await getAll(name);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch (_) {}

  // 2) 再試合併集合 transactions
  try {
    const tx = await getAll('transactions');
    if (Array.isArray(tx) && tx.length) {
      const want = mode === 'out' ? 'expense' : 'income';
      return tx.filter((x) => normalizeType(x?.type) === want);
    }
  } catch (_) {}

  // 3) 再退：常見其他命名（避免你的 db.js 實際命名不同）
  const candidates = mode === 'out'
    ? ['expense', 'expense_records']
    : ['income', 'income_records'];
  for (const c of candidates) {
    try {
      const arr = await getAll(c);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (_) {}
  }

  return [];
}
