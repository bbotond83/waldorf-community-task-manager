import { parseArguments, runAsCommand } from "./common.ts";
import {
  ACKNOWLEDGE_ALL_INTERFACES,
  defaultStackDeps,
  type StackDeps,
  startStack,
} from "./stack.ts";

export const START_HELP = `Usage: npm run db:start [-- --allow-all-interfaces]

Starts the local stack (Postgres, sign-in service, data API gateway, mail catcher) with Docker and
waits until it is healthy. It then checks that only those services run and that the published
ports are not reachable on any of this machine's IPv4 or IPv6 addresses, and writes the git-ignored files .env.database.local
(address and public key) and .env.service.local (tooling values). Prints a final timing.

The Supabase CLI publishes its ports on all interfaces and the stack uses well-known default keys.
If the ports are reachable from the network the command stops the stack and fails. Block inbound
connections to the ports with a host firewall rule and acknowledge it with
${ACKNOWLEDGE_ALL_INTERFACES}=1 (or --allow-all-interfaces).`;

export async function main(
  argv: readonly string[],
  deps: StackDeps = defaultStackDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(START_HELP);
    return 0;
  }
  const allowAllInterfaces =
    flags.has("allow-all-interfaces") || deps.environment[ACKNOWLEDGE_ALL_INTERFACES] === "1";
  return startStack(deps, { allowAllInterfaces });
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
