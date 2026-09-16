import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, font} from '../tokens';
import {AppWindow} from '../components/Window';
import {AgentMark} from '../components/AgentMark';
import {Cursor} from '../components/Cursor';

const mission = 'Find the next 20 customers and fix what stops them buying.';

export const MissionScene = () => {
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame, [45, 112], [0, mission.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const sent = frame >= 147;
  return (
    <AbsoluteFill style={{background: C.paper, alignItems: 'center', justifyContent: 'center', fontFamily: font}}>
      <div style={{scale: interpolate(frame, [0, 25, 175, 210], [.88, .94, .94, 1.18], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.16,1,.3,1)}), translate: interpolate(frame, [175, 210], ['0px 0px', '0px 40px'], {extrapolateRight: 'clamp'}), opacity: interpolate(frame, [0, 12, 198, 210], [0,1,1,0], {extrapolateRight: 'clamp'})}}>
        <AppWindow title="The room">
          <div style={{height: 742, display: 'flex', flexDirection: 'column', background: '#FBFBF8'}}>
            <div style={{flex: 1, padding: '62px 74px'}}>
              <div style={{display: 'flex', gap: 18, alignItems: 'flex-start'}}>
                <AgentMark name="Kryx" role="head" size={48} />
                <div>
                  <div style={{fontSize: 20, fontWeight: 720}}>Kryx</div>
                  <div style={{marginTop: 7, fontSize: 27, color: C.muted}}>Give me the outcome. I’ll coordinate the work.</div>
                </div>
              </div>
              {sent ? (
                <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 58, opacity: interpolate(frame, [147, 160], [0,1], {extrapolateRight:'clamp'}), translate: interpolate(frame,[147,160],['0px 18px','0px 0px'],{extrapolateRight:'clamp'})}}>
                  <div style={{background: C.ink, color: '#fff', borderRadius: 22, padding: '20px 26px', fontSize: 26, maxWidth: 860}}>{mission}</div>
                </div>
              ) : null}
            </div>
            <div style={{borderTop: `1px solid ${C.line}`, padding: '24px 34px 30px'}}>
              <div style={{height: 92, borderRadius: 20, border: `1.5px solid ${sent ? C.line : C.blue}`, background: C.surface, padding: '0 104px 0 28px', display: 'flex', alignItems: 'center', fontSize: 26, color: chars ? C.ink : C.faint, boxShadow: sent ? 'none' : '0 0 0 5px rgba(49,94,251,.09)'}}>
                {sent ? 'Ask Kryx anything…' : mission.slice(0, chars)}
                {!sent && frame % 18 < 10 ? <span style={{display:'inline-block', width:2, height:32, background:C.blue, marginLeft:3}} /> : null}
                <div style={{position: 'absolute', right: 43, bottom: 40, width: 62, height: 62, borderRadius: 17, background: C.ink, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 30}}>↑</div>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
      <Cursor from={[1325, 920]} to={[1515, 920]} start={115} end={140} clickAt={145} />
      <div style={{position: 'absolute', top: 54, left: 0, right: 0, textAlign: 'center', fontSize: 24, fontWeight: 680, color: C.blue, opacity: interpolate(frame,[0,18],[0,1],{extrapolateRight:'clamp'})}}>ONE GOAL</div>
    </AbsoluteFill>
  );
};
