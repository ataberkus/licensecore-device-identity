/** V7 — Pointer / hover media features. */
export function collectPointer(): unknown {
  const mq = (q: string) =>
    typeof matchMedia === 'function' ? matchMedia(q).matches : false;
  return {
    maxTouchPoints: navigator.maxTouchPoints,
    pointerFine: mq('(pointer: fine)'),
    pointerCoarse: mq('(pointer: coarse)'),
    anyPointerFine: mq('(any-pointer: fine)'),
    hoverHover: mq('(hover: hover)'),
    hoverNone: mq('(hover: none)'),
  };
}
