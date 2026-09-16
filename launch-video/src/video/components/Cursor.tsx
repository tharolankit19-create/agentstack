import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {C} from '../tokens';

export const Cursor = ({from, to, start = 0, end = 30, clickAt}: {from: [number, number]; to: [number, number]; start?: number; end?: number; clickAt?: number}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [start, end], [from[0], to[0]], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const y = interpolate(frame, [start, end], [from[1], to[1]], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const clickScale = clickAt === undefined ? 1 : interpolate(frame, [clickAt - 2, clickAt, clickAt + 4], [1, 0.82, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 100, scale: clickScale, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.22))'}}>
      <svg width="38" height="44" viewBox="0 0 38 44" fill="none">
        <path d="M3 2.5v31.2l8.7-8.1 6.8 15.2 7.1-3.2-6.6-14.7h12.4L3 2.5Z" fill="#fff" stroke={C.ink} strokeWidth="2.7" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
