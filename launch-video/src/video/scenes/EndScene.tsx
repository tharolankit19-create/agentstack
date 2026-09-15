import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {Wordmark} from '../components/Brand';
import {C, font} from '../tokens';

export const EndScene=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:C.paper,fontFamily:font,alignItems:'center',justifyContent:'center'}}>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',opacity:interpolate(frame,[0,18,160,178],[0,1,1,0],{extrapolateRight:'clamp'}),scale:interpolate(frame,[0,26],[.94,1],{extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})}}>
      <Wordmark />
      <div style={{fontSize:96,lineHeight:.96,fontWeight:780,letterSpacing:'-.065em',marginTop:54,color:C.ink}}>One goal in.<br/><span style={{color:C.blue}}>Finished work out.</span></div>
      <div style={{fontSize:31,color:C.muted,marginTop:30}}>You approve what ships.</div>
      <div style={{marginTop:55,borderRadius:18,background:C.ink,color:'#fff',padding:'19px 30px',fontSize:24,fontWeight:720}}>getkryxai.com</div>
    </div>
    <div style={{position:'absolute',left:80,right:80,bottom:48,display:'flex',justifyContent:'space-between',color:C.faint,fontSize:16}}><span>AI agent stack for SaaS marketing</span><span>Research · leads · SEO · content · conversion</span></div>
  </AbsoluteFill>;
};
