/**
 * Workflow implementations. This module is the worker's `workflowsPath` bundle entry and runs
 * inside Temporal's deterministic workflow sandbox.
 *
 * NEVER import this module (or anything under workflows/) from the backend or any other regular
 * Node code — the backend interacts with workflows exclusively by name/type through the typed
 * helpers in the package root.
 */

export { smokeTestWorkflow } from "./smoke-test";
