import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { t } from '../i18n';

export default function Settings() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    client.get('/admin/settings').then(({ data }) => setSettings(data.settings));
  }, []);

  return (
    <div className="page space-y-4">
      <h1 className="h1">إعدادات النظام</h1>

      <div className="card-padded bg-gradient-to-br from-primary-50 to-white">
        <h3 className="h3 mb-3">عن المنصة</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex border-b border-ink-100 pb-2">
            <dt className="w-48 text-ink-500">المالك</dt>
            <dd className="flex-1 font-medium">{t('app.company')}</dd>
          </div>
          <div className="flex border-b border-ink-100 pb-2">
            <dt className="w-48 text-ink-500">اسم النظام</dt>
            <dd className="flex-1 font-medium">{t('app.title')}</dd>
          </div>
          <div className="flex border-b border-ink-100 pb-2">
            <dt className="w-48 text-ink-500">الوصف</dt>
            <dd className="flex-1 font-medium">{t('app.subtitle')}</dd>
          </div>
          <div className="flex pt-2">
            <dt className="w-48 text-ink-500">حقوق النشر</dt>
            <dd className="flex-1 font-medium text-ink-600">{t('app.copyright')}</dd>
          </div>
        </dl>
      </div>

      <div className="card-padded">
        <h3 className="h3 mb-3">معلومات المؤسسة</h3>
        <dl className="space-y-2 text-sm">
          {Object.entries(settings).map(([k, v]) => (
            <div key={k} className="flex border-b border-ink-100 pb-2">
              <dt className="w-48 text-ink-500">{k}</dt>
              <dd className="flex-1 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}