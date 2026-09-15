import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {AgentMark} from '../components/AgentMark';
import {AppWindow} from '../components/Window';
import {Cursor} from '../components/Cursor';
import {C, font} from '../tokens';

export const ApprovalScene = () => {
  const frame = useCurrentFrame();
  const approved = frame >= 214;
  return (
    <AbsoluteFill style={{background:C.paper,fontFamily:font,alignItems:'center',justifyContent:'center'}}>
      <div style={{position:'absolute',left:116,top:75,zIndex:5}}>
        <div style={{fontSize:21,fontWeight:720,color:C.blue,letterSpacing:'.12em'}}>CONTROL LAYER</div>
        <div style={{fontSize:61,fontWeight:760,letterSpacing:'-.055em',marginTop:12,color:C.ink}}>Anything consequential waits for you.</div>
      </div>
      <div style={{marginTop:120,scale:interpolate(frame,[0,22,255,300],[.9,.96,.96,1.12],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)}),opacity:interpolate(frame,[0,12,285,300],[0,1,1,0],{extrapolateRight:'clamp'})}}>
        <AppWindow title="Needs you">
          <div style={{height:742,display:'grid',gridTemplateColumns:'470px 1fr'}}>
            <div style={{background:'#FBFBF8',borderRight:`1px solid ${C.line}`,padding:30}}>
              <div style={{fontSize:19,color:C.muted}}>2 things need you</div>
              <div style={{marginTop:24,border:`1.5px solid ${C.blue}`,background:C.blueWash,borderRadius:20,padding:22}}>
                <div style={{display:'flex',gap:14,alignItems:'center'}}><AgentMark name="Dex" role="outreach" size={44}/><div><div style={{fontSize:19,fontWeight:720}}>Dex</div><div style={{fontSize:15,color:C.muted}}>Outreach</div></div></div>
                <div style={{fontSize:23,fontWeight:690,lineHeight:1.2,marginTop:24}}>Cold outreach draft</div>
                <div style={{fontSize:16,color:C.muted,marginTop:9}}>Waiting for approval</div>
              </div>
              <div style={{marginTop:14,border:`1px solid ${C.line}`,borderRadius:20,padding:22,opacity:.58}}><div style={{fontSize:21,fontWeight:680}}>Pricing-page rewrite</div><div style={{fontSize:16,color:C.muted,marginTop:8}}>Needs your decision</div></div>
            </div>
            <div style={{padding:'40px 48px',position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:16}}><AgentMark name="Dex" role="outreach" size={52}/><div><div style={{fontSize:22,fontWeight:720}}>Cold outreach draft</div><div style={{fontSize:16,color:C.muted,marginTop:4}}>Public / outbound action</div></div></div>
              <div style={{marginTop:38,padding:28,border:`1px solid ${C.line}`,borderRadius:20,background:'#FBFBF8'}}>
                <div style={{fontSize:16,fontWeight:720,color:C.faint,textTransform:'uppercase',letterSpacing:'.1em'}}>Why this person, why now</div>
                <div style={{fontSize:22,lineHeight:1.45,color:C.ink,marginTop:13}}>A recent hiring signal matches the workspace ICP. The source and qualification note are attached.</div>
                <div style={{marginTop:18,fontSize:17,color:C.blue,fontWeight:680}}>↗ View evidence</div>
              </div>
              <div style={{marginTop:24,padding:28,border:`1px solid ${C.line}`,borderRadius:20,fontSize:21,lineHeight:1.5,color:C.muted}}>Draft prepared from the saved trigger. Nothing sends until the founder approves.</div>
              <div style={{position:'absolute',left:48,right:48,bottom:34,display:'flex',justifyContent:'flex-end',gap:14}}>
                <button style={{height:58,borderRadius:16,border:`1px solid ${C.line}`,background:C.surface,padding:'0 24px',fontSize:18,fontWeight:680,color:C.ink}}>Ask Kryx</button>
                <button style={{height:58,borderRadius:16,border:'none',background:approved?C.green:C.ink,padding:'0 28px',fontSize:18,fontWeight:720,color:'#fff',minWidth:164}}>{approved?'Approved ✓':'Approve'}</button>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
      <Cursor from={[1350,625]} to={[1635,870]} start={135} end={197} clickAt={210}/>
      {approved ? <div style={{position:'absolute',right:110,top:176,padding:'16px 22px',borderRadius:16,background:C.green,color:'#fff',fontSize:20,fontWeight:720,opacity:interpolate(frame,[214,228],[0,1],{extrapolateRight:'clamp'}),translate:interpolate(frame,[214,228],['0px -12px','0px 0px'],{extrapolateRight:'clamp'})}}>Founder approved</div> : null}
    </AbsoluteFill>
  );
};
