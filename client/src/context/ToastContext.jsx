import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, type = 'info', ms = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setItems((p) => [...p, { id, message, type }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), ms);
  }, []);

  const api = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error', 5000),
    warn: (m) => push(m, 'warn'),
    info: (m) => push(m, 'info'),
  };

  const colorMap = {
    success: 'bg-green-600',
    error:   'bg-danger-600',
    warn:    'bg-warn-600',
    info:    'bg-primary-700',
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`px-4 py-2 rounded-lg text-white shadow-pop text-sm animate-slide-up ${colorMap[t.type] || 'bg-ink-700'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);