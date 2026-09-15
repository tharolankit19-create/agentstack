import type {ReactNode} from 'react';
import {C, font} from '../tokens';
import {Wordmark} from './Brand';

export const AppWindow = ({children, title = 'Mission Control'}: {children: ReactNode; title?: string}) => (
  <div style={{width: 1560, height: 820, background: C.surface, borderRadius: 28, border: `1px solid ${C.line}`, overflow: 'hidden', boxShadow: '0 38px 100px rgba(18,18,22,.18)', fontFamily: font}}>
    <div style={{height: 78, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.line}`, padding: '0 28px', gap: 20}}>
      <Wordmark compact />
      <div style={{width: 1, height: 28, background: C.line}} />
      <span style={{fontSize: 21, color: C.muted, fontWeight: 620}}>{title}</span>
      <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{width: 9, height: 9, borderRadius: 99, background: C.green}} />
        <span style={{fontSize: 17, color: C.muted, fontWeight: 620}}>Agents running</span>
      </div>
    </div>
    {children}
  </div>
);
