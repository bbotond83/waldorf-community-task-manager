import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { ToolingError } from "./common.ts";

/**
 * The operator's terminal: a visible question and a question whose answer is not echoed (BR2.18). The
 * answer to the second kind is never an argument, a file or an environment variable, so there is no
 * non-interactive way to supply it: without a terminal the command stops.
 */
export interface Terminal {
  ask(question: string): Promise<string>;
  askSecret(question: string): Promise<string>;
}

type Input = Readable & { isTTY?: boolean; setRawMode?: (mode: boolean) => unknown };
type Output = Writable & { isTTY?: boolean };

export function createTerminal(
  input: Input = process.stdin,
  output: Output = process.stdout,
): Terminal {
  const requireTerminal = () => {
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      throw new ToolingError(
        "terminal",
        "This command needs an interactive terminal: the password is typed, never read from a pipe, a file, an argument or the environment.",
      );
    }
  };

  return {
    async ask(question) {
      requireTerminal();
      const lines = createInterface({ input, output, terminal: true });
      try {
        return await new Promise<string>((resolve) => lines.question(question, resolve));
      } finally {
        lines.close();
      }
    },
    async askSecret(question) {
      requireTerminal();
      return new Promise<string>((resolve, reject) => {
        output.write(question);
        let answer = "";
        const finish = (done: () => void) => {
          input.off("data", onData);
          input.setRawMode?.(false);
          input.pause();
          output.write("\n");
          done();
        };
        const onData = (chunk: Buffer | string) => {
          for (const character of String(chunk)) {
            if (character === "\r" || character === "\n") return finish(() => resolve(answer));
            if (character === "\u0003") {
              return finish(() =>
                reject(new ToolingError("terminal", "Cancelled by the operator.")),
              );
            }
            if (character === "\u007f" || character === "\b") answer = answer.slice(0, -1);
            else answer += character;
          }
        };
        input.setRawMode?.(true);
        input.setEncoding("utf8");
        input.resume();
        input.on("data", onData);
      });
    },
  };
}
