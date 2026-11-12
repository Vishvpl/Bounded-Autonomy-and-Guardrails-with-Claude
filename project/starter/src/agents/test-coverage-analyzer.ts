import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
  'Identifies gaps in test coverage for a single changed file, including ' +
  'untested functions, methods, edge cases, and branches, and provides ' +
  'concrete test recommendations with meaningful assertions, returning a ' +
  'TestCoverageResult JSON object for that file. Use this agent whenever ' +
  'a file requires a test coverage or test-completeness review.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};