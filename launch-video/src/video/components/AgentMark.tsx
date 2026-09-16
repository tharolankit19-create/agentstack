import {C, font} from '../tokens';

export type AgentRole = 'head' | 'research' | 'analytics' | 'content' | 'search' | 'conversion' | 'lead' | 'outreach';

const colors: Record<AgentRole, {fg: string; bg: string}> = {
  head: {fg: '#FFFFFF', bg: C.blue},
  research: {fg: '#7655E7', bg: '#F0ECFF'},
  analytics: {fg: '#078C70', bg: '#E7F7F2'},
  content: {fg: '#D64F70', bg: '#FDEBF0'},
  search: {fg: '#B16B00', bg: '#FFF1D8'},
  conversion: {fg: '#087FB5', bg: '#E5F5FC'},
  lead: {fg: '#D95725', bg: '#FFF0E9'},
  outreach: {fg: '#4D63D8', bg: '#EAEFFF'},
};

const RoleIcon = ({role, color}: {role: AgentRole; color: string}) => {
  if (role === 'head') return <><path d="M4.5 12h5M12.5 8.5l4-4M12.5 12h5M12.5 15.5l4 4"/><path d="m11.7 7.6 4.4 4.4-4.4 4.4L7.3 12l4.4-4.4Z" fill={color} stroke="none"/><circle cx="4" cy="12" r="1.5" fill={color} stroke="none"/></>;
  if (role === 'research') return <><circle cx="10.5" cy="10.5" r="5.2"/><path d="m14.4 14.4 4.1 4.1M10.5 2.8v2.5M2.8 10.5h2.5"/><circle cx="10.5" cy="10.5" r="1.2" fill={color} stroke="none"/></>;
  if (role === 'analytics') return <><path d="M4.5 18.5V14M9.5 18.5V9.5M14.5 18.5V5M19.5 18.5V2.8"/><path d="m4 9 5-3 4 1.5 6-5"/></>;
  if (role === 'content') return <><path d="M4 6.2h16M4 11.8h12M4 17.4h8"/><circle cx="18.5" cy="17.4" r="1.7" fill={color} stroke="none"/></>;
  if (role === 'search') return <><circle cx="12" cy="12" r="8"/><path d="m14.8 9.2-1.6 4-4 1.6 1.6-4 4-1.6Z" fill={color} stroke="none"/></>;
  if (role === 'conversion') return <><path d="M3.5 5h17l-6.3 7v5.2l-4.4 2V12L3.5 5Z"/><path d="m8 8 3.2 3.2L16.5 6"/></>;
  if (role === 'lead') return <><circle cx="12" cy="9" r="3.4"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/><path d="M12 2.5V5M3.8 9H7M17 9h3.2"/></>;
  return <><path d="m3.2 11.5 17.3-7-5.9 16-3.2-6-8.2-3Z"/><path d="m11.4 14.5 3.8-4"/></>;
};

export const AgentMark = ({name, role, size = 64, showName = false}: {name: string; role: AgentRole; size?: number; showName?: boolean}) => {
  const color = colors[role];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: font}}>
      <div style={{width: size, height: size, borderRadius: size * 0.28, background: color.bg, display: 'grid', placeItems: 'center', border: `1px solid ${color.fg}33`}}>
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke={color.fg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <RoleIcon role={role} color={color.fg} />
        </svg>
      </div>
      {showName ? <span style={{fontSize: 27, fontWeight: 700, color: C.ink}}>{name}</span> : null}
    </div>
  );
};
