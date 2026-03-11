import { spawn, spawnSync } from 'node:child_process';

const backendPort = process.env.BACKEND_PORT || process.env.PORT || '4000';

const build = spawnSync(
  'pnpm',
  ['run', 'build'],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

if (build.error) {
  console.error(build.error.message);
  process.exit(1);
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const child = spawn(
  'node',
  ['dist/main.js'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: backendPort,
    },
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
