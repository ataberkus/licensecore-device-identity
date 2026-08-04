/** S1 — WebGL unmasked renderer / vendor (no permission). */
export async function collectWebglGpu(): Promise<unknown> {
  const canvas = document.createElement('canvas');
  const gl =
    canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
  if (!gl || !(gl instanceof WebGLRenderingContext)) {
    throw new Error('webgl unavailable');
  }
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = dbg
    ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
    : gl.getParameter(gl.VENDOR);
  const renderer = dbg
    ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const version = gl.getParameter(gl.VERSION);
  const shading = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
  const attrs = gl.getContextAttributes();
  return {
    vendor: String(vendor ?? ''),
    renderer: String(renderer ?? ''),
    version: String(version ?? ''),
    shading: String(shading ?? ''),
    attrs,
  };
}
