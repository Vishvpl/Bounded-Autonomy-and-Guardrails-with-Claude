import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReviewReport } from '../src/types/report-types';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { CodeReviewOrchestrator } from '../src/orchestrator';
import { RateLimiter } from '../src/utils/rate-limiter';

function asyncIterableFrom(messages: unknown[]) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next: async () => {
          if (index < messages.length) {
            return { value: messages[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

const mockReviewReport: ReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [
    {
      file: 'src/index.ts',
      codeQuality: {
        file: 'src/index.ts',
        issues: [
          {
            line: 12,
            severity: 'medium',
            category: 'maintainability',
            description: 'Function is doing too much.',
            suggestion: 'Extract the validation logic into its own function.',
          },
        ],
        overallScore: 82,
        summary: 'Mostly clean, one maintainability nit.',
      },
      testCoverage: {
        file: 'src/index.ts',
        hasTests: true,
        testFiles: ['src/index.test.ts'],
        untestedPaths: [],
        coverageEstimate: 90,
        summary: 'Well covered.',
      },
      refactorings: {
        file: 'src/index.ts',
        suggestions: [],
        summary: 'Nothing notable.',
      },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 85,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [
    {
      priority: 'medium',
      category: 'maintainability',
      description: 'Extract the validation logic in index.ts into its own function.',
      files: ['src/index.ts'],
    },
  ],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 1234,
    agentVersions: {
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0',
    },
  },
};

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
    queryMock.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestratorInstance = new CodeReviewOrchestrator();
      expect(orchestratorInstance).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom rate limit configuration', () => {
      const orchestratorInstance = new CodeReviewOrchestrator({
        rateLimitConfig: { maxConcurrent: 1, maxRequestsPerMinute: 5, maxTokensPerMinute: 2000 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeRateLimiter = (orchestratorInstance as any).rateLimiter as RateLimiter;
      expect(activeRateLimiter).toBeInstanceOf(RateLimiter);

      const currentStatus = activeRateLimiter.getStatus();
      expect(currentStatus.availableRequests).toBe(5);
      expect(currentStatus.availableTokens).toBe(2000);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      queryMock.mockReturnValue(asyncIterableFrom([{ type: 'result', subtype: 'success', structured_output: mockReviewReport }]));

      const orchestratorInstance = new CodeReviewOrchestrator({ rateLimitConfig: {} });
      await orchestratorInstance.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const invocationArgs = queryMock.mock.calls[0][0];
      expect(invocationArgs.options.mcpServers).toHaveProperty('github');
      expect(invocationArgs.options.mcpServers).toHaveProperty('eslint');
      expect(invocationArgs.options.allowedTools).toContain('mcp__github__get_pull_request');
    });

    it('should spawn all 3 subagents in parallel', async () => {
      queryMock.mockReturnValue(asyncIterableFrom([{ type: 'result', subtype: 'success', structured_output: mockReviewReport }]));

      const orchestratorInstance = new CodeReviewOrchestrator({ rateLimitConfig: {} });
      await orchestratorInstance.reviewPullRequest('octocat', 'Hello-World', 1);

      const invocationArgs = queryMock.mock.calls[0][0];
      expect(Object.keys(invocationArgs.options.agents)).toEqual(
        expect.arrayContaining(['code-quality-analyzer', 'test-coverage-analyzer', 'refactoring-suggester'])
      );
      expect(invocationArgs.options.allowedTools).toContain('Task');
      expect(invocationArgs.prompt).toContain('concurrently');
    });

    it('should aggregate results into ReviewReport', async () => {
      queryMock.mockReturnValue(asyncIterableFrom([{ type: 'result', subtype: 'success', structured_output: mockReviewReport }]));

      const orchestratorInstance = new CodeReviewOrchestrator({ rateLimitConfig: {} });
      const computedReport = await orchestratorInstance.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(computedReport.pullRequest).toEqual(mockReviewReport.pullRequest);
      expect(computedReport.fileReviews).toHaveLength(1);
      expect(computedReport.summary.overallScore).toBe(85);
      expect(computedReport.recommendations).toHaveLength(1);
    });

    it('should validate output with Zod schema', async () => {
      const flawedReport = {
        ...mockReviewReport,
        summary: { ...mockReviewReport.summary, overallScore: 'not-a-number' },
      };
      queryMock.mockReturnValue(asyncIterableFrom([{ type: 'result', subtype: 'success', structured_output: flawedReport }]));

      const orchestratorInstance = new CodeReviewOrchestrator({ rateLimitConfig: {} });

      await expect(orchestratorInstance.reviewPullRequest('octocat', 'Hello-World', 1)).rejects.toMatchObject({
        code: 'STRUCTURED_OUTPUT_FAILED',
      });
    });

    it('throws a clear error when the SDK never produces a structured_output', async () => {
      queryMock.mockReturnValue(asyncIterableFrom([{ type: 'assistant', message: { content: [] } }]));

      const orchestratorInstance = new CodeReviewOrchestrator({ rateLimitConfig: { maxConcurrent: 1 } });

      await expect(orchestratorInstance.reviewPullRequest('octocat', 'Hello-World', 1)).rejects.toThrow();
    });
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
    });
  });
});