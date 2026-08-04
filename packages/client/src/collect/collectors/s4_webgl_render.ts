/** S4 — WebGL triangle render → readPixels digest. */
export async function collectWebglRender(): Promise<unknown> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) throw new Error('webgl unavailable');

  const vsSrc = `
    attribute vec2 a;
    void main(){ gl_Position = vec4(a,0.0,1.0); }
  `;
  const fsSrc = `
    precision mediump float;
    void main(){ gl_FragColor = vec4(0.2,0.55,0.85,1.0); }
  `;
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.8, -0.8, 0.8, -0.8, 0.0, 0.8]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, 64, 64);
  gl.clearColor(0.05, 0.05, 0.08, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const pixels = new Uint8Array(64 * 64 * 4);
  gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) sum = (sum + (pixels[i] ?? 0) * (i % 97)) | 0;
  return {
    sum,
    sample: Array.from(pixels.subarray(0, 64)),
    dataUrl: canvas.toDataURL(),
  };
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('shader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? 'compile');
  }
  return sh;
}
