/** VM / hypervisor GPU string markers (advisory). */
export function detectVmMarkers(
  raw: Readonly<Record<string, unknown>>,
): { vm: boolean; details: Record<string, unknown> } {
  const hardFlags: string[] = [];
  /** Software GL common in CI/headless — advisory only, does not trip vmMarkers. */
  const softFlags: string[] = [];
  const gpu = raw['webgl_gpu'] as { vendor?: string; renderer?: string } | undefined;
  const blob = `${gpu?.vendor ?? ''} ${gpu?.renderer ?? ''}`.toLowerCase();

  const hard = [
    'vmware',
    'virtualbox',
    'vbox',
    'qemu',
    'hyper-v',
    'parallels',
    'virgl',
  ];
  const soft = ['llvmpipe', 'swiftshader', 'microsoft basic render'];

  for (const m of hard) {
    if (blob.includes(m)) hardFlags.push(m);
  }
  for (const m of soft) {
    if (blob.includes(m)) softFlags.push(m);
  }

  const cpu = raw['cpu_mem'] as { hardwareConcurrency?: number | null } | undefined;
  if (cpu?.hardwareConcurrency === 1 && hardFlags.length > 0) {
    hardFlags.push('single_core_with_vm_gpu');
  }

  return {
    vm: hardFlags.length > 0,
    details: { flags: hardFlags, softFlags },
  };
}
