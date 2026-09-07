import React from 'react';
import TabShell from '../components/TabShell';
import Expat from './Expat';
import Insurance from './Insurance';
import Qiwa from './Qiwa';

export default function ExpatHub() {
  return (
    <TabShell
      tabs={[
        { key: 'iqama', label: 'الإقامات والتأشيرات', component: Expat, perm: 'expat.iqama.read' },
        { key: 'insurance', label: 'التأمين الصحي', component: Insurance, perm: 'insurance.read' },
        { key: 'qiwa', label: 'منصة قوى', component: Qiwa, perm: 'qiwa.read' },
      ]}
    />
  );
}
