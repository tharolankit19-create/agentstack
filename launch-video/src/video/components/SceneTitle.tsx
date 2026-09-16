import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, font} from '../tokens';

export const SceneTitle = ({eyebrow, title, note, dark = false, align = 'left'}: {eyebrow?: string; title: string; note?: string; dark?: boolean; align?: 'left' | 'center'}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{fontFamily: font, color: dark ? C.paper : C.ink, textAlign: align, opacity: interpolate(frame, [0, 14], [0, 1], {extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)}), translate: interpolate(frame, [0, 18], ['0px 24px', '0px 0px'], {extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)})}}>
      {eyebrow ? <div style={{fontSize: 22, fontWeight: 700, color: dark ? '#AEBFFF' : C.blue, textTransform: 'uppercase', letterSpacing: '.13em'}}>{eyebrow}</div> : null}
      <div style={{marginTop: eyebrow ? 18 : 0, fontSize: 88, lineHeight: .97, letterSpacing: '-.06em', fontWeight: 770, maxWidth: 1420}}>{title}</div>
      {note ? <div style={{marginTop: 26, fontSize: 34, lineHeight: 1.3, color: dark ? '#B4B4BC' : C.muted, maxWidth: 1080}}>{note}</div> : null}
    </div>
  );
};
