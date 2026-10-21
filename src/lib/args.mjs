// Tiny argument parser: `--key value`, `--flag`, `--key=value`, positionals. No dependencies.
// Flags listed in `bools` never swallow the next token.
export function parseArgs(argv, { bools = [] } = {}) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const [k, inline] = a.slice(2).split(/=(.*)/s, 2);
    if (inline !== undefined) flags[k] = inline;
    else if (bools.includes(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) flags[k] = true;
    else flags[k] = argv[++i];
  }
  return { flags, positional };
}

export class UsageError extends Error {}
