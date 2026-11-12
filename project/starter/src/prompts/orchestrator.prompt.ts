import { ReviewReportJSONSchema } from '../types/report-types.js';

export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `
You serve as the primary controller for a cooperative multi-agent code evaluation framework targeting pull request #${prNumber} within "${owner}/${repo}".

Execute the procedure below sequentially.

## Step 1 -- Retrieve Pull Request Data
Leverage the GitHub MCP functions "mcp__github__get_pull_request" along with "mcp__github__get_pull_request_files" (incorporating "mcp__github__get_file_contents" to retrieve raw file text as required) in order to obtain:
  - The title, description, and associated metadata of the pull request.
  - The complete inventory of modified files, including their diffs and contents.
Perform this data gathering prior to triggering any downstream workers, as they require actual file content rather than assumptions.

## Step 2 -- Trigger All Three Subordinate Agents Per Modified File
Each worker evaluates A SINGLE FILE AT A TIME (their respective output schemas are per-file, keyed by "file"). For EVERY modified file, utilize the Task tool to explicitly call each of the three specialized agents by name, providing the file's path and content:
  - "Invoke the code-quality-analyzer agent to review <file> with respect to security, performance, and maintainability concerns. Output JSON conforming exclusively to its schema for this specific file."
  - "Invoke the test-coverage-analyzer agent to assess test completeness for <file> and recommend precise unverified scenarios. Output JSON conforming exclusively to its schema for this specific file."
  - "Invoke the refactoring-suggester agent to locate optimization candidates and obsolete code inside <file>. Output JSON conforming exclusively to its schema for this specific file."
Execute the three calls concurrently for any given file whenever feasible, as they function independently. Every worker response MUST yield a parseable JSON structure verifiable against its designated schema; if a response fails structural validation, attempt a single retry before abandoning that specific call. Should a worker continue failing post-retry, omit it for that file, proceed with the remainder of the audit, and avoid manufacturing synthetic data.

## Step 3 -- Synthesize Into a Unified Review Summary
Construct one fileReviews[] item for every modified file:
  { file, codeQuality: <CodeQualityResult for file>,
    testCoverage: <TestCoverageResult for file>,
    refactorings: <RefactoringSuggestion for file> }

Next, calculate the following metrics:
  - summary.totalFiles = total count of evaluated files
  - summary.overallScore = weighted aggregation derived from all files' codeQuality
    .overallScore on a 0-100 scale. Give heavier weight to files carrying critical or high severity defects — a solitary file presenting a critical security flaw must heavily reduce the aggregate score.
  - summary.criticalIssues = aggregate frequency of codeQuality issues rated with "critical" severity across all files.
  - summary.highPriorityTests = aggregate frequency of testCoverage untestedPaths rated with "critical" or "high" priority across all files.
  - summary.refactoringOpportunities = aggregate frequency of refactoring recommendations across all files.

Construct recommendations[] -- comprising the 3 to 8 most critical, multi-file action items, each structured as:
  { priority: "critical"|"high"|"medium"|"low", category: string,
    description: string, files: string[] }
Prioritize security-related findings first, followed by high-priority test omissions, and subsequently impactful refactors.

Populate the metadata block:
  { analyzedAt: ISO 8601 timestamp string representing completion time,
    duration: execution time of the complete evaluation in milliseconds,
    agentVersions: { "code-quality-analyzer": "1.0.0",
                       "test-coverage-analyzer": "1.0.0",
                       "refactoring-suggester": "1.0.0" } }

The complete payload must conform precisely to this JSON Schema:

${JSON.stringify(ReviewReportJSONSchema, null, 2)}

Return STRICTLY the structured payload matching that schema, omitting any conversational prose outside the structured_output field.
`;
}