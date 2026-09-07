import React from 'react';
import TabShell from '../components/TabShell';
import Knowledge from './Knowledge';
import Policies from './Policies';
import Decisions from './Decisions';
import Flowcharts from './Flowcharts';

export default function KnowledgeHub() {
  return (
    <TabShell
      tabs={[
        { key: 'docs', label: 'الوثائق', component: Knowledge, perm: 'knowledge.doc.read' },
        { key: 'policies', label: 'السياسات', component: Policies, perm: 'knowledge.policy.read' },
        { key: 'decisions', label: 'سجل القرارات', component: Decisions, perm: 'knowledge.decision.read' },
        { key: 'flowcharts', label: 'مرجع المعاملات', component: Flowcharts, perm: 'knowledge.doc.read' },
      ]}
    />
  );
}
