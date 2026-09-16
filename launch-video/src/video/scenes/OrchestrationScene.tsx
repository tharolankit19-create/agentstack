import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {AgentMark, type AgentRole} from '../components/AgentMark';
import {C, font} from '../tokens';

const agents: Array<{name: string; role: AgentRole; job: string; x: number; y: number}> = [
  {name: 'Ida', role: 'research', job: 'Market research', x: 250, y: 220},
  {name: 'Rook', role: 'lead', job: 'Lead research', x: 250, y: 620},
  {name: 'Wren', role: 'search', job: 'SEO & AEO', x: 1370, y: 180},
  {name: 'Nell', role: 'conversion', job: 'Conversion', x: 1370, y: 500},
  {name: 'Otis', role: 'content', job: 'Content', x: 1040, y: 790},
];

export const OrchestrationScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.ink, fontFamily: font, overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: 78, left: 0, right: 0, textAlign: 'center', color: '#fff'}}>
        <div style={{fontSize: 22, fontWeight: 700, letterSpacing: '.14em', color: '#AEBFFF'}}>KRYX COORDINATES THE WORK</div>
        <div style={{fontSize: 66, marginTop: 15, fontWeight: 750, letterSpacing: '-.05em'}}>You don’t manage the handoffs.</div>
      </div>
      <svg style={{position:'absolute', inset:0}} width="1920" height="1080" viewBox="0 0 1920 1080" fill="none">
        {agents.map((agent, index) => {
          const cx = agent.x + 100;
          const cy = agent.y + 70;
          const path = `M960 540 C ${960 + (cx - 960) * .35} 540, ${960 + (cx - 960) * .72} ${cy}, ${cx} ${cy}`;
          const active = interpolate(frame, [34 + index * 34, 74 + index * 34], [0,1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
          return <path key={agent.name} d={path} stroke={C.blue} strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1-active} opacity={.26 + active * .74} />;
        })}
      </svg>
      <div style={{position:'absolute', left: 830, top: 430, width: 260, height: 220, borderRadius: 42, background: C.blue, boxShadow: '0 0 0 14px rgba(49,94,251,.12), 0 40px 100px rgba(0,0,0,.4)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#fff', scale: interpolate(frame,[0,26],[.72,1],{extrapolateRight:'clamp', easing:Easing.bezier(.16,1,.3,1)})}}>
        <AgentMark name="Kryx" role="head" size={78} />
        <div style={{fontSize:32, fontWeight:760, marginTop:18}}>Kryx</div>
        <div style={{fontSize:17, opacity:.72, marginTop:4}}>Head agent</div>
      </div>
      {agents.map((agent,index) => {
        const enter = 45 + index * 34;
        const active = frame >= enter + 30;
        return (
          <div key={agent.name} style={{position:'absolute', left:agent.x, top:agent.y, width:300, height:140, borderRadius:24, background:'#17171B', border:`1px solid ${active ? C.blue : '#34343A'}`, padding:'24px 26px', color:'#fff', opacity:interpolate(frame,[enter,enter+16],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}), scale:interpolate(frame,[enter,enter+18],[.88,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)}), boxShadow: active ? '0 16px 50px rgba(49,94,251,.14)' : 'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:16}}><AgentMark name={agent.name} role={agent.role} size={54}/><div><div style={{fontSize:26,fontWeight:720}}>{agent.name}</div><div style={{fontSize:18,color:'#9999A2',marginTop:3}}>{agent.job}</div></div></div>
            <div style={{position:'absolute',right:20,top:20,width:9,height:9,borderRadius:99,background:active?C.blue:'#55555D'}} />
          </div>
        );
      })}
      <div style={{position:'absolute',bottom:55,left:0,right:0,textAlign:'center',fontSize:24,color:'#92929B',opacity:interpolate(frame,[230,252],[0,1],{extrapolateRight:'clamp'})}}>Research · leads · search · content · conversion</div>
    </AbsoluteFill>
  );
};
