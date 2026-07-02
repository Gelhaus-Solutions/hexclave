import { describe, expect, it } from "vitest";
import { SMOKE_TEST_WORKFLOW_TYPE } from "./workflow-types";
import * as workflows from "./workflows";

describe("workflow type constants", () => {
  it("matches the exported workflow function names", () => {
    // Temporal identifies workflows by function name, so a rename of the implementation must be
    // reflected in the constant that clients use to start it by name.
    expect(workflows.smokeTestWorkflow.name).toBe(SMOKE_TEST_WORKFLOW_TYPE);
  });

  it("only exports functions (workflow implementations)", () => {
    for (const [name, value] of Object.entries(workflows)) {
      expect(typeof value, `workflows/index.ts export ${name} should be a workflow function`).toBe("function");
    }
  });
});
