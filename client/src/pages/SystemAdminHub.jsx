import React from 'react';
import TabShell from '../components/TabShell';
import LookupAdmin from './LookupAdmin';
import Integrations from './Integrations';

export default function SystemAdminHub() {
  return (
    <TabShell
      tabs={[
        { key: 'lookups', label: 'إدارة القوائم', component: LookupAdmin, perm: 'admin.lookup.read' },
        { key: 'integrations', label: 'التكاملات', component: Integrations, perm: 'admin.integration.read' },
      ]}
    />
  );
}
