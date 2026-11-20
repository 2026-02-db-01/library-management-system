import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

/**
 * 실제 Full-stack E2E 오케스트레이터.
 *  1) 격리된 PostgreSQL 16 스택을 별도 compose 프로젝트로 기동
 *  2) 실제 FastAPI + Vite를 상대로 e2e/live Playwright 테스트 실행
 *  3) 이 런이 만든 테스트 스택만 정리 (운영 DB/볼륨은 건드리지 않음)
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const frontend = path.resolve(here, '..');
const envPath = path.join(root, 'database', '.env');
const project = `chaekdam-live-e2e-${Date.now()}`;

function run(command) {
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, COMPOSE_PROJECT_NAME: project },
  });
  if (result.status !== 0) throw new Error(`command failed (${result.status}): ${command}`);
}

const hadEnv = existsSync(envPath);
const previousEnv = hadEnv ? readFileSync(envPath, 'utf8') : null;
const appPassword = crypto.randomBytes(24).toString('hex');

try {
  writeFileSync(
    envPath,
    [
      'POSTGRES_USER=postgres',
      `POSTGRES_PASSWORD=${crypto.randomBytes(24).toString('hex')}`,
      'POSTGRES_DB=library',
      `LIBRARY_APP_PASSWORD=${appPassword}`,
      `LIBRARY_READONLY_PASSWORD=${crypto.randomBytes(24).toString('hex')}`,
      '',
    ].join('\n'),
    'utf8',
  );

  run(`docker compose -p ${project} -f database/compose.yml up -d --wait --wait-timeout 90`);

  const venvPython = path.join(
    root,
    'backend',
    process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
  );
  const python = existsSync(venvPython) ? venvPython : 'python';
  const seedSql = readFileSync(path.join(root, 'database', 'seed.sql'), 'utf8');
  const seedPassword = process.env.LIVE_SEED_PASSWORD ?? seedSql.match(/:\s*([^ ]*)\s*\(bcrypt, cost/)?.[1] ?? 'demo-library-2026';

  const childEnv = {
    ...process.env,
    DATABASE_URL: `postgresql+psycopg://library_app:${appPassword}@127.0.0.1:5433/library`,
    SECRET_KEY: crypto.randomBytes(32).toString('hex'),
    LIVE_SEED_PASSWORD: seedPassword,
    LIVE_PYTHON: python,
    LIVE_API_ORIGIN: 'http://127.0.0.1:8001',
    LIVE_API_BASE_URL: 'http://127.0.0.1:8001/api/v1',
    LIVE_WEB_BASE_URL: 'http://127.0.0.1:5175',
    DEBUG: 'true',
  };
  const test = spawnSync(
    process.platform === 'win32' ? 'npx.cmd playwright test --config playwright.live.config.ts' : 'npx playwright test --config playwright.live.config.ts',
    { cwd: frontend, shell: true, stdio: 'inherit', env: childEnv },
  );
  if (test.status !== 0) process.exitCode = test.status ?? 1;
} finally {
  try {
    run(`docker compose -p ${project} -f database/compose.yml down --volumes`);
  } catch (error) {
    console.error(`test stack cleanup failed: ${error.message}`);
  }
  if (previousEnv !== null) writeFileSync(envPath, previousEnv, 'utf8');
  else if (hadEnv === false && existsSync(envPath)) unlinkSync(envPath);
}
