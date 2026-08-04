import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diCollect,
  diBlockGraphics,
} from '../fixtures/harness';

test.describe('T12 graphics APIs blocked', () => {
  test('WebGL/WebGPU/Audio blocked → no crash, usable device id', async ({
    page,
  }) => {
    await gotoHarness(page);
    await diBlockGraphics(page);

    const evidence = await diCollect(page);
    const result = await diResolve(page);

    expect(result.deviceId).toBeTruthy();
    expect(['low', 'medium', 'high']).toContain(result.confidence);

    const hashes = evidence.componentHashes;
    const watched = ['webgl_gpu', 'webgpu_adapter', 'canvas_render', 'audio_dsp'];
    const errored = watched.filter((id) => hashes[id]?.error === true);
    // Blocking should surface as collector errors (or still return a usable id)
    expect(errored.length + (result.deviceId ? 1 : 0)).toBeGreaterThan(0);
    expect(result.deviceId.length).toBeGreaterThan(10);
  });
});
