/**
 * Workflow type name constants. Temporal identifies workflows by the exported function's name,
 * so each constant here must exactly match the corresponding function in src/workflows/. A unit
 * test (workflow-types.test.ts) asserts this so a rename can't silently break clients that
 * start workflows by name.
 */

export const SMOKE_TEST_WORKFLOW_TYPE = "smokeTestWorkflow";
