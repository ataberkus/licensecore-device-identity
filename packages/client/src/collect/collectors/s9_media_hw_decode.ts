/** S9 — Media decode capability probes (canPlayType / isTypeSupported). */
export function collectMediaHwDecode(): unknown {
  const video = document.createElement('video');
  const audio = document.createElement('audio');
  const types = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4; codecs="hev1.1.6.L93.B0"',
    'video/webm; codecs="vp9"',
    'video/webm; codecs="av01.0.01M.08"',
    'audio/mp4; codecs="mp4a.40.2"',
    'audio/webm; codecs="opus"',
  ];
  const videoSupport: Record<string, string> = {};
  const audioSupport: Record<string, string> = {};
  for (const t of types) {
    if (t.startsWith('video/')) videoSupport[t] = video.canPlayType(t);
    else audioSupport[t] = audio.canPlayType(t);
  }
  const mse =
    typeof MediaSource !== 'undefined' && 'isTypeSupported' in MediaSource
      ? types.map((t) => ({ t, ok: MediaSource.isTypeSupported(t) }))
      : null;
  return { videoSupport, audioSupport, mse };
}
