import React, { useEffect, useRef, useState } from 'react';

/**
 * SmartSelect - قائمة منسدلة ذكية
 * - بحث فوري عبر valueAr / valueEn
 * - تعدد (multi)
 * - تبعية (parent) عبر useLookups
 * - إكمال حر (freeSolo) للمدخلات الجديدة
 * - يستخدم useLookups hook لجلب البيانات
 */
export function SmartSelect({
  category,
  parent,
  value,
  onChange,
  multi = false,
  freeSolo = false,
  placeholder = 'اختر...',
  className = '',
  disabled = false,
  codeAsValue = false, // إذا true يرجع code بدلاً من id
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {};
        if (category) params.category = category;
        if (parent) params.parent = parent;
        const res = await fetch(`/api/lookups?${new URLSearchParams(params)}`, { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        setItems(data.lookups || []);
      } catch {} finally { setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [category, parent]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = items.filter((i) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (i.valueAr || '').toLowerCase().includes(s) || (i.valueEn || '').toLowerCase().includes(s) || (i.code || '').toLowerCase().includes(s);
  });

  const isSelected = (item) => {
    if (multi) return Array.isArray(value) && value.includes(codeAsValue ? item.code : item.id);
    return value === (codeAsValue ? item.code : item.id);
  };

  const toggle = (item) => {
    const v = codeAsValue ? item.code : item.id;
    if (multi) {
      const arr = Array.isArray(value) ? [...value] : [];
      const idx = arr.indexOf(v);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(v);
      onChange(arr);
    } else {
      onChange(v);
      setOpen(false);
      setSearch('');
    }
  };

  const selectedLabels = multi
    ? items.filter((i) => isSelected(i)).map((i) => i.valueAr)
    : (() => {
        const found = items.find((i) => isSelected(i));
        return found ? [found.valueAr] : [];
      })();

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="input flex items-center justify-between text-start min-h-[40px] disabled:bg-ink-50"
      >
        <span className={selectedLabels.length ? 'text-ink-900' : 'text-ink-500'}>
          {selectedLabels.length ? selectedLabels.join('، ') : placeholder}
        </span>
        <span className="text-ink-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-ink-300 rounded-lg shadow-pop max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-ink-100">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input py-1.5 text-sm"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && <div className="px-3 py-2 text-ink-500 text-sm">جاري التحميل...</div>}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-2 text-ink-500 text-sm">
                لا توجد نتائج
                {freeSolo && search && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(search);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="block mt-1 text-primary-600 hover:underline"
                  >
                    + إضافة "{search}"
                  </button>
                )}
              </div>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item)}
                className={`w-full text-start px-3 py-2 hover:bg-ink-50 flex items-center justify-between text-sm ${isSelected(item) ? 'bg-primary-50 text-primary-700 font-medium' : ''}`}
              >
                <span>{item.valueAr}</span>
                <span className="text-ink-500 text-xs">{item.valueEn}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SmartText - حقل نصي مع إكمال تلقائي (autocomplete) بسيط
 */
export function SmartText({ value, onChange, suggestions = [], placeholder, type = 'text', className = '', ...props }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const list = Array.isArray(suggestions) ? suggestions : [];
  const filtered = list.filter((s) => {
    if (!value || !open) return false;
    const v = String(value).toLowerCase();
    return String(s).toLowerCase().includes(v);
  }).slice(0, 8);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="input"
        {...props}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-ink-300 rounded-lg shadow-pop max-h-48 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full text-start px-3 py-2 hover:bg-ink-50 text-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}