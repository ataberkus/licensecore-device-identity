/** S8 — Display / screen characteristics. */
export function collectDisplay(): unknown {
  const s = screen;
  return {
    width: s.width,
    height: s.height,
    availWidth: s.availWidth,
    availHeight: s.availHeight,
    colorDepth: s.colorDepth,
    pixelDepth: s.pixelDepth,
    devicePixelRatio: window.devicePixelRatio,
    orientation:
      s.orientation?.type ??
      (s as Screen & { mozOrientation?: string }).mozOrientation ??
      null,
  };
}
