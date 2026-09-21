import { spawn } from 'node:child_process';

if (process.argv.some((argument) => argument.includes('integration.test.ts')) && !process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is required for integration tests. Refusing to run against the default environment database.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...process.argv.slice(2)], {
  env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL, NODE_ENV: 'test' },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
