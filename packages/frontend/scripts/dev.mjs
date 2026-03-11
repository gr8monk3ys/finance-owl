import { spawn } from 'node:child_process';

const frontendPort = process.env.FRONTEND_PORT || process.env.PORT || '3000';

const child = spawn(
  'pnpm',
  ['exec', 'vite', 'dev', '--port', frontendPort, '--strictPort'],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', forwardSignal);
process.on('SIGTERM', forwardSignal);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
