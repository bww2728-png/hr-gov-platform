import React, { useEffect, useState } from 'react';
import client from '../api/client';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    client.get('/admin/roles').then(({ data }) => setRoles(data.roles));
    client.get('/admin/permissions/catalog').then(({ data }) => setCatalog(data));
  }, []);

  return (
    <div className="page space-y-4">
      <h1 className="h1">الأدوار والصلاحيات</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-padded">
          <h3 className="h3 mb-3">الأدوار ({roles.length})</h3>
          <div className="space-y-2">
            {roles.map((r) => (
              <button key={r.id} onClick={() => setSelected(r)} className={`w-full text-start p-3 rounded-lg border ${selected?.id === r.id ? 'border-primary-400 bg-primary-50' : 'border-ink-100 hover:bg-ink-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.nameAr}</div>
                    <div className="text-xs text-ink-500">{r.nameEn} • {r.code}</div>
                  </div>
                  <span className="badge-ink">{r._count?.users || 0} مستخدم</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card-padded">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="h3">{selected.nameAr}</h3>
                <span className="badge-primary">{selected.permissions?.length || 0} صلاحية</span>
              </div>
              {selected.description && <p className="muted mb-3">{selected.description}</p>}
              <div className="space-y-2">
                {catalog && Object.entries(catalog.catalog).map(([mod, def]) => {
                  const modPerms = (selected.permissions || []).filter((p) => p.startsWith(mod + '.'));
                  if (modPerms.length === 0) return null;
                  return (
                    <details key={mod} className="border border-ink-100 rounded-lg" open>
                      <summary className="cursor-pointer p-3 font-medium flex items-center justify-between">
                        <span>{def.nameAr}</span>
                        <span className="badge-primary text-xs">{modPerms.length}</span>
                      </summary>
                      <div className="border-t border-ink-100 p-3 space-y-1">
                        {modPerms.map((p) => (
                          <div key={p} className="flex items-center justify-between text-sm">
                            <code className="font-mono text-xs text-ink-700">{p}</code>
                            <span className="muted text-xs">{catalog.catalog[mod].actions[p.split('.')[1]]?.ar}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center text-ink-500 py-10">اختر دور لعرض صلاحياته</div>
          )}
        </div>
      </div>
    </div>
  );
}