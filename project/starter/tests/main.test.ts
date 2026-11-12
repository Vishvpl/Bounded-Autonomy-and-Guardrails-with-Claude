import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = path.dirname(currentFilePath);
const targetMainPath = path.resolve(currentDirectoryPath, '../src/main.ts');

function runCli(
  argumentsList: string[],
  environmentVariables: NodeJS.ProcessEnv,
): { exitCode: number | null; stderr: string } {
  try {
    execFileSync('npx', ['tsx', targetMainPath, ...argumentsList], {
      env: environmentVariables,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
    return { exitCode: 0, stderr: '' };
  } catch (caughtError) {
    const errorDetails = caughtError as { status?: number; stderr?: Buffer | string };
    return {
      exitCode: errorDetails.status ?? null,
      stderr: errorDetails.stderr?.toString() ?? '',
    };
  }
}

describe('CLI environment validation', () => {
  it('exits with a clear configuration error when GITHUB_TOKEN is missing', () => {
    const environmentCopy = { ...process.env };
    // Set to '' instead of deleting: dotenv never overrides a variable that
    // already exists in process.env, so a local .env can't refill it.
    environmentCopy.GITHUB_TOKEN = '';
    environmentCopy.ANTHROPIC_API_KEY = 'test-key-not-used';
    environmentCopy.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

    const { exitCode, stderr } = runCli(['octocat', 'Hello-World', '1'], environmentCopy);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing required environment configuration');
    expect(stderr).toContain('GITHUB_TOKEN');
  }, 30000);

  it('exits with a clear configuration error when ANTHROPIC_MODEL is missing', () => {
    const environmentCopy = { ...process.env };
    environmentCopy.ANTHROPIC_MODEL = '';
    environmentCopy.ANTHROPIC_API_KEY = 'test-key-not-used';
    environmentCopy.GITHUB_TOKEN = 'ghp_test-token-not-used';

    const { exitCode, stderr } = runCli(['octocat', 'Hello-World', '1'], environmentCopy);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing required environment configuration');
    expect(stderr).toContain('ANTHROPIC_MODEL');
  }, 30000);

  it('exits with a usage message when required CLI arguments are missing', () => {
    const environmentCopy = { ...process.env };
    environmentCopy.ANTHROPIC_API_KEY = 'test-key-not-used';
    environmentCopy.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
    environmentCopy.GITHUB_TOKEN = 'ghp_test-token-not-used';

    const { exitCode, stderr } = runCli(['octocat'], environmentCopy);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Usage:');
  }, 30000);

  it('exits with an error when pr-number is not a positive integer', () => {
    const environmentCopy = { ...process.env };
    environmentCopy.ANTHROPIC_API_KEY = 'test-key-not-used';
    environmentCopy.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
    environmentCopy.GITHUB_TOKEN = 'ghp_test-token-not-used';

    const { exitCode, stderr } = runCli(['octocat', 'Hello-World', 'not-a-number'], environmentCopy);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('positive integer');
  }, 30000);
});