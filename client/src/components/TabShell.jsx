import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * هيكل تبويبات موحد — يعرض المكوّنات الموجودة كأقسام داخل شاشة واحدة
 * مع إخفاء التبويبات التي لا يملك المستخدم صلاحيتها.
 */
export default function TabShell({ tabs }) {
  const { has } = useAuth();
  const visible = tabs.filter((tb) => !tb.perm || has(tb.perm));
  const [active, setActive] = useState(visible[0]?.key);
  const current = visible.find((tb) => tb.key === active) || visible[0];

  if (!current) {
    return <div className="page"><p className="text-ink-500">لا توجد أقسام متاحة لصلاحياتك</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ink-100 rounded-xl p-1.5 flex flex-wrap gap-1 shadow-sm">
        {visible.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setActive(tb.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              current.key === tb.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div key={current.key}>{React.createElement(current.component)}</div>
    </div>
  );
}
