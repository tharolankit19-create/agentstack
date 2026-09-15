import React from 'react';
import {Composition} from 'remotion';
import {KryxLaunch} from './video';

export const Root: React.FC = () => (
  <Composition
    id="KryxLaunch"
    component={KryxLaunch}
    durationInFrames={3360}
    fps={60}
    width={1920}
    height={1080}
  />
);
