import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, font} from '../tokens';
import {KryxMark} from '../components/Brand';

const items = [
  ['Research brief', 'Done'],
  ['Qualified lead list', 'Done'],
  ['Pricing-page rewrite', 'Approved'],
  ['Outreach drafts', 'Ready'],
];

export const ReceiptScene = () => {
  const frame=useCurrentFrame();
  return (
    <AbsoluteFill style={{background:C.ink,fontFamily:font,color:'#fff',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:1320,display:'grid',gridTemplateColumns:'1fr 670px',gap:100,alignItems:'center'}}>
        <div style={{opacity:interpolate(frame,[0,16],[0,1],{extrapolateRight:'clamp'}),translate:interpolate(frame,[0,20],['0px 32px','0px 0px'],{extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})}}>
          <div style={{display:'flex',alignItems:'center',gap:18}}><KryxMark size={58} inverse/><span style={{fontSize:22,color:'#AEBFFF',fontWeight:720,letterSpacing:'.12em'}}>MORNING RECEIPT</span></div>
          <div style={{fontSize:84,lineHeight:.98,fontWeight:760,letterSpacing:'-.06em',marginTop:36}}>Finished work.<br/><span style={{color:'#AEBFFF'}}>With receipts.</span></div>
          <div style={{fontSize:28,color:'#9A9AA4',lineHeight:1.4,marginTop:28}}>The work is done. You only see<br/>what changed—and what needs you.</div>
        </div>
        <div style={{border:'1px solid #34343A',borderRadius:28,background:'#17171B',overflow:'hidden',boxShadow:'0 40px 100px rgba(0,0,0,.38)'}}>
          <div style={{padding:'26px 30px',borderBottom:'1px solid #34343A',fontSize:21,fontWeight:720}}>Since yesterday</div>
          {items.map((item,index)=>{const enter=40+index*24;return <div key={item[0]} style={{height:102,padding:'0 30px',display:'flex',alignItems:'center',borderBottom:index<items.length-1?'1px solid #2B2B31':'none',opacity:interpolate(frame,[enter,enter+14],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:interpolate(frame,[enter,enter+18],['25px 0px','0px 0px'],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><div style={{width:32,height:32,borderRadius:9,background:'#253B84',color:'#AEBFFF',display:'grid',placeItems:'center',fontSize:17}}>✓</div><div style={{fontSize:22,marginLeft:16}}>{item[0]}</div><div style={{marginLeft:'auto',fontSize:17,color:item[1]==='Approved'?'#79D2AE':'#90909A',fontWeight:680}}>{item[1]}</div></div>})}
        </div>
      </div>
    </AbsoluteFill>
  );
};
