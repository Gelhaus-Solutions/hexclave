/**
 * The single task queue all Hexclave workflows and activities run on for now.
 *
 * We intentionally start with one queue: per-subsystem queues can be introduced later (child
 * workflows and activities accept a taskQueue option) without renaming this one, and one queue
 * means one worker deployment with no routing complexity.
 */
export const MAIN_TASK_QUEUE = "hexclave-main";
