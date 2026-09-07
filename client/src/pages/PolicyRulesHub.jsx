import React from 'react';
import TabShell from '../components/TabShell';
import PoliciesCenter from './PoliciesCenter';
import FormulaCenter from './FormulaCenter';

export default function PolicyRulesHub() {
  return (
    <TabShell
      tabs={[
        { key: 'parameters', label: 'المعايير والسياسات', component: PoliciesCenter, perm: 'policies.read' },
        { key: 'formulas', label: 'المعادلات', component: FormulaCenter, perm: 'formulas.read' },
      ]}
    />
  );
}
