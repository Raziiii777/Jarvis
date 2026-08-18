import os from "node:os";

export const arch = os.arch();

export function osName(): string {
  const p = os.platform();
  const v = os.release();
  return `macOS (Darwin ${v}) on ${arch}`;
}
