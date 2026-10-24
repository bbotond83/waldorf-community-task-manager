import "server-only";

import type { ReactNode } from "react";
import { isProductionMode } from "./production-request.ts";
import { SignOutButton } from "./SignOutButton.tsx";

/**
 * The control the page shell shows next to the person's name: in the production mode the sign-out button of
 * the real session, in the synthetic mode nothing, so the shell keeps its test-profile switcher.
 */
export async function shellHeaderAction(): Promise<ReactNode | undefined> {
  return (await isProductionMode()) ? <SignOutButton /> : undefined;
}
