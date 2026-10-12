import { parseArguments, runAsCommand } from "./common.ts";
import { defaultStackDeps, type StackDeps, stopStack } from "./stack.ts";

export const STOP_HELP = `Usage: npm run db:stop

Stops the local stack. The database volumes are kept, so the data is still there after the next
"npm run db:start".`;

export async function main(
  argv: readonly string[],
  deps: StackDeps = defaultStackDeps(),
): Promise<number> {
  if (parseArguments(argv).flags.has("help")) {
    deps.log(STOP_HELP);
    return 0;
  }
  return stopStack(deps);
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
