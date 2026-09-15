import {C, font} from '../tokens';

export const KryxMark = ({size = 56, inverse = false}: {size?: number; inverse?: boolean}) => {
  const stroke = inverse ? '#FFFFFF' : C.blue;
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.27, background: inverse ? C.blue : C.blueWash, display: 'grid', placeItems: 'center'}}>
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 12h5M12.5 8.5l4-4M12.5 12h5M12.5 15.5l4 4" />
        <path d="m11.7 7.6 4.4 4.4-4.4 4.4L7.3 12l4.4-4.4Z" fill={stroke} stroke="none" />
        <circle cx="4" cy="12" r="1.5" fill={stroke} stroke="none" />
      </svg>
    </div>
  );
};

export const Wordmark = ({inverse = false, compact = false}: {inverse?: boolean; compact?: boolean}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: font, color: inverse ? '#FFFFFF' : C.ink}}>
    <KryxMark size={compact ? 46 : 58} inverse={inverse} />
    <span style={{fontSize: compact ? 31 : 42, fontWeight: 760, letterSpacing: '-0.045em'}}>KryxAI</span>
  </div>
);
