const makeTone = (frequency: number, duration = 0.09, noise = 0) => {
  const sampleRate = 8000;
  const samples = Math.max(1, Math.floor(duration * sampleRate));
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);

  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);

  let seed = 1337;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    seed = (seed * 16807) % 2147483647;
    const rnd = (seed / 2147483647) * 2 - 1;
    const env = Math.pow(1 - i / samples, 2);
    const signal = (Math.sin(2 * Math.PI * frequency * t) * (1 - noise) + rnd * noise) * env * 0.55;
    view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.floor(signal * 32767))), true);
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
};

export const SFX = {
  tick: makeTone(920, 0.055, 0.02),
  pop: makeTone(520, 0.09, 0.12),
  whoosh: makeTone(190, 0.18, 0.72),
  success: makeTone(1100, 0.14, 0.03),
};
