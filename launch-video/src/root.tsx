import {Composition, Folder} from 'remotion';
import {KryxLaunch} from './video/KryxLaunch';
import {ApprovalScene} from './video/scenes/ApprovalScene';
import {EvidenceScene} from './video/scenes/EvidenceScene';
import {MissionScene} from './video/scenes/MissionScene';
import {OrchestrationScene} from './video/scenes/OrchestrationScene';

export const Root = () => {
  return (
    <>
      <Composition
        id="KryxLaunch"
        component={KryxLaunch}
        durationInFrames={1740}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Editable-scenes">
        <Composition id="Mission" component={MissionScene} durationInFrames={210} fps={30} width={1920} height={1080} />
        <Composition id="Orchestration" component={OrchestrationScene} durationInFrames={330} fps={30} width={1920} height={1080} />
        <Composition id="Evidence" component={EvidenceScene} durationInFrames={270} fps={30} width={1920} height={1080} />
        <Composition id="Approval" component={ApprovalScene} durationInFrames={300} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
