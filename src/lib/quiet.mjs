/** Run a command's `run()` without its console output, for commands that call other commands. */
export async function quiet(fn) {
  const log = console.log; console.log = () => {};
  try { return await fn(); } finally { console.log = log; }
}
