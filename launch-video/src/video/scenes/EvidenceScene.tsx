import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {AgentMark, type AgentRole} from '../components/AgentMark';
import {C, font} from '../tokens';
import {SceneTitle} from '../components/SceneTitle';

const outputs: Array<{name:string;role:AgentRole;title:string;proof:string;status:string}> = [
  {name:'Ida',role:'research',title:'Market brief ready',proof:'Sources attached',status:'Evidence'},
  {name:'Rook',role:'lead',title:'Qualified lead list ready',proof:'Trigger saved for every match',status:'Verified'},
  {name:'Nell',role:'conversion',title:'Pricing-page rewrite ready',proof:'Reasoning and source pages linked',status:'Ready'},
];

export const EvidenceScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background:C.paper,fontFamily:font,padding:'94px 112px'}}>
      <SceneTitle eyebrow="FINISHED WORK" title="Not agent logs. Actual deliverables." note="Every claim can carry its evidence." />
      <div style={{position:'absolute',left:112,right:112,bottom:94,display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:24}}>
        {outputs.map((output,index)=>{
          const enter=46+index*32;
          return (
            <div key={output.name} style={{height:352,borderRadius:28,border:`1px solid ${C.line}`,background:C.surface,padding:30,boxShadow:'0 24px 60px rgba(18,18,22,.08)',opacity:interpolate(frame,[enter,enter+18],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:interpolate(frame,[enter,enter+24],['0px 64px','0px 0px'],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><AgentMark name={output.name} role={output.role} size={54} showName/><span style={{padding:'9px 13px',borderRadius:99,background:C.greenWash,color:C.green,fontSize:16,fontWeight:720}}>{output.status}</span></div>
              <div style={{marginTop:48,fontSize:34,fontWeight:740,letterSpacing:'-.04em',color:C.ink,lineHeight:1.08}}>{output.title}</div>
              <div style={{marginTop:20,fontSize:20,color:C.muted}}>{output.proof}</div>
              <div style={{position:'absolute',left:30,right:30,bottom:30,borderTop:`1px solid ${C.line}`,paddingTop:18,display:'flex',gap:8,color:C.blue,fontSize:17,fontWeight:680}}><span>↗</span><span>View work</span></div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
