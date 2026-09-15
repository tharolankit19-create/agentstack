import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {IntroScene} from './scenes/IntroScene';
import {ProblemScene} from './scenes/ProblemScene';
import {MissionScene} from './scenes/MissionScene';
import {OrchestrationScene} from './scenes/OrchestrationScene';
import {EvidenceScene} from './scenes/EvidenceScene';
import {ApprovalScene} from './scenes/ApprovalScene';
import {ReceiptScene} from './scenes/ReceiptScene';
import {EndScene} from './scenes/EndScene';

export const KryxLaunch=()=>{
  return <AbsoluteFill style={{background:'#0B0B0D'}}>
    <Sequence from={0} durationInFrames={75} name="01 — Introducing KryxAI"><IntroScene/></Sequence>
    <Sequence from={75} durationInFrames={165} name="02 — Founder problem"><ProblemScene/></Sequence>
    <Sequence from={240} durationInFrames={210} name="03 — One goal"><MissionScene/></Sequence>
    <Sequence from={450} durationInFrames={330} name="04 — Orchestration"><OrchestrationScene/></Sequence>
    <Sequence from={780} durationInFrames={270} name="05 — Finished work and evidence"><EvidenceScene/></Sequence>
    <Sequence from={1050} durationInFrames={300} name="06 — Founder approval"><ApprovalScene/></Sequence>
    <Sequence from={1350} durationInFrames={210} name="07 — Morning receipt"><ReceiptScene/></Sequence>
    <Sequence from={1560} durationInFrames={180} name="08 — End card"><EndScene/></Sequence>

    <Sequence from={0} durationInFrames={45}><Audio src={staticFile('sfx/intro-hit.wav')} volume={0.8}/></Sequence>
    <Sequence from={83} durationInFrames={125}><Audio src={staticFile('sfx/paper-rise.wav')} volume={0.34}/></Sequence>
    <Sequence from={283} durationInFrames={112}><Audio src={staticFile('sfx/typing.wav')} volume={0.32}/></Sequence>
    <Sequence from={380} durationInFrames={32}><Audio src={staticFile('sfx/click.wav')} volume={0.76}/></Sequence>
    {[500,534,568,602,636].map((from)=><Sequence key={from} from={from} durationInFrames={26}><Audio src={staticFile('sfx/route-tick.wav')} volume={0.45}/></Sequence>)}
    {[832,864,896].map((from)=><Sequence key={from} from={from} durationInFrames={28}><Audio src={staticFile('sfx/card-pop.wav')} volume={0.48}/></Sequence>)}
    <Sequence from={1254} durationInFrames={32}><Audio src={staticFile('sfx/click.wav')} volume={0.8}/></Sequence>
    <Sequence from={1266} durationInFrames={55}><Audio src={staticFile('sfx/confirm.wav')} volume={0.66}/></Sequence>
    <Sequence from={1560} durationInFrames={55}><Audio src={staticFile('sfx/end-hit.wav')} volume={0.68}/></Sequence>
  </AbsoluteFill>;
};
