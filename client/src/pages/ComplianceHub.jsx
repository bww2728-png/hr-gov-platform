import React from 'react';
import TabShell from '../components/TabShell';
import Compliance from './Compliance';
import ComplianceSA from './ComplianceSA';

export default function ComplianceHub() {
  return (
    <TabShell
      tabs={[
        { key: 'general', label: 'الامتثال العام', component: Compliance, perm: 'compliance.rule.read' },
        { key: 'saudi', label: 'الامتثال السعودي', component: ComplianceSA, perm: 'nitaqat.read' },
      ]}
    />
  );
}
