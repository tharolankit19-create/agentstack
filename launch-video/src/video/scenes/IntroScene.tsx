import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {Wordmark} from '../components/Brand';
import {C, font} from '../tokens';

export const IntroScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.ink, alignItems: 'center', justifyContent: 'center', fontFamily: font}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: interpolate(frame, [0, 12, 62, 74], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), scale: interpolate(frame, [0, 22], [.94, 1], {extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)})}}>
        <div style={{fontSize: 31, color: '#A8A8B1', letterSpacing: '.08em', marginBottom: 30}}>INTRODUCING</div>
        <Wordmark inverse />
      </div>
      <div style={{position: 'absolute', width: 520, height: 2, background: C.blue, scale: `${interpolate(frame, [8, 42], [0, 1], {extrapolateRight: 'clamp', easing: Easing.bezier(.16,1,.3,1)})} 1`, bottom: 310}} />
    </AbsoluteFill>
  );
};
