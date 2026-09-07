import React from 'react';
import TabShell from '../components/TabShell';
import Talent from './Talent';
import Retention from './Retention';

export default function TalentHub() {
  return (
    <TabShell
      tabs={[
        { key: 'talent', label: 'المواهب والتعاقب', component: Talent, perm: 'succession.read' },
        { key: 'retention', label: 'الاحتفاظ', component: Retention, perm: 'retention.read' },
      ]}
    />
  );
}
