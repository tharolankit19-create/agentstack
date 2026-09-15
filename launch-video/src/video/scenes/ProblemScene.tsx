import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, font} from '../tokens';
import {SceneTitle} from '../components/SceneTitle';

const jobs = ['Customer research', 'Lead search', 'SEO audit', 'Launch post', 'Pricing page'];

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.paper, fontFamily: font, padding: '118px 118px'}}>
      <SceneTitle title="You built the product." note="Then marketing became five jobs you have to manage." />
      <div style={{position: 'absolute', left: 118, right: 118, bottom: 98, height: 340}}>
        {jobs.map((job, index) => {
          const enter = 42 + index * 12;
          return (
            <div key={job} style={{position: 'absolute', left: index * 305, top: index % 2 === 0 ? 0 : 70, width: 360, height: 210, borderRadius: 24, border: `1px solid ${C.line}`, background: C.surface, boxShadow: '0 20px 50px rgba(18,18,22,.08)', padding: 28, opacity: interpolate(frame, [enter, enter + 12, 150, 164], [0, 1, 1, .18], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), translate: interpolate(frame, [enter, enter + 18], ['0px 55px', '0px 0px'], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.16,1,.3,1)}), rotate: `${(index - 2) * 1.4}deg`}}>
              <div style={{fontSize: 18, color: C.faint, textTransform: 'uppercase', letterSpacing: '.1em'}}>Open task</div>
              <div style={{marginTop: 34, fontSize: 31, fontWeight: 710, letterSpacing: '-.035em', color: C.ink}}>{job}</div>
              <div style={{marginTop: 38, height: 10, borderRadius: 99, background: C.subtle}}><div style={{width: `${44 + index * 8}%`, height: '100%', borderRadius: 99, background: index === 2 ? C.blue : '#B5B5B8'}} /></div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: 110, top: 108, fontSize: 200, fontWeight: 780, color: '#E7E7E2', letterSpacing: '-.08em'}}>05</div>
    </AbsoluteFill>
  );
};
