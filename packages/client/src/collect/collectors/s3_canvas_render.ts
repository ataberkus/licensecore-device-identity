/** S3 — Canvas 2D render fingerprint (stable single sample). */
export function collectCanvasRender(): unknown {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 60;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.textBaseline = 'top';
  ctx.font = '16px "Arial"';
  ctx.fillStyle = '#f60';
  ctx.fillRect(0, 0, 240, 60);
  ctx.fillStyle = '#069';
  ctx.fillText('LicenseCore canvas 😊', 4, 8);
  ctx.strokeStyle = 'rgba(0,255,128,0.7)';
  ctx.beginPath();
  ctx.arc(120, 30, 22, 0, Math.PI * 2);
  ctx.stroke();
  return { dataUrl: canvas.toDataURL() };
}
