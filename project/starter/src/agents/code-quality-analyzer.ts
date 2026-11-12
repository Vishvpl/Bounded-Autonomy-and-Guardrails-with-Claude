import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Analyzes ONE changed source file at a time for security vulnerabilities,
 * performance issues, and maintainability concerns, returning a single
 * CodeQualityResult JSON object for that file.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
  'Inspects a single modified source file for security weaknesses, ' +
  'performance inefficiencies, and maintainability problems, returning ' +
  'a CodeQualityResult JSON object for that file. Use this agent for ' +
  'security, performance, and code-health reviews of individual files.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__eslint__lint-files'],
};