import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
  'Inspects a single modified file for opportunities to improve code ' +
  'structure and maintainability, including pattern-based refactoring, ' +
  'language modernization, function extraction, and dead-code cleanup, ' +
  'returning a RefactoringSuggestion JSON object for that file. Use ' +
  'this agent whenever a structural review is needed.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};