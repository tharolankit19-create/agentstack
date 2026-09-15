import React from "react";
import {Composition} from "remotion";
import {KryxLaunch} from "./KryxLaunch";

export const Root: React.FC = () => (
  <Composition id="KryxLaunch" component={KryxLaunch} durationInFrames={3600} fps={60} width={1920} height={1080} />
);
