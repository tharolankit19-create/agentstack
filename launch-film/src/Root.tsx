import React from "react";
import {Composition} from "remotion";
import {KryxLaunch} from "./KryxLaunch";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KryxLaunch-16x9"
        component={KryxLaunch}
        durationInFrames={2010}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{vertical:false}}
      />
      <Composition
        id="KryxLaunch-9x16"
        component={KryxLaunch}
        durationInFrames={2010}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{vertical:true}}
      />
    </>
  );
};
