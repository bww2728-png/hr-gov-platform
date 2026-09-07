import React from 'react';
import TabShell from '../components/TabShell';
import Recruitment from './Recruitment';
import Candidates from './Candidates';

export default function RecruitmentHub() {
  return (
    <TabShell
      tabs={[
        { key: 'postings', label: 'الوظائف', component: Recruitment, perm: 'lifecycle.posting.read' },
        { key: 'candidates', label: 'المرشحون', component: Candidates, perm: 'lifecycle.candidate.read' },
      ]}
    />
  );
}
