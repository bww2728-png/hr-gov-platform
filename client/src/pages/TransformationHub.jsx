import React from 'react';
import TabShell from '../components/TabShell';
import Maturity from './Maturity';
import Roadmap from './Roadmap';
import Risks from './Risks';
import FiveWhys from './FiveWhys';

export default function TransformationHub() {
  return (
    <TabShell
      tabs={[
        { key: 'maturity', label: 'قياس النضج', component: Maturity, perm: 'maturity.read' },
        { key: 'roadmap', label: 'خارطة الطريق', component: Roadmap, perm: 'roadmap.read' },
        { key: 'risks', label: 'المخاطر', component: Risks, perm: 'risk.read' },
        { key: 'fivewhys', label: '5 Whys', component: FiveWhys, perm: 'fivewhys.read' },
      ]}
    />
  );
}
