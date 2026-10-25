import "server-only";

import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton.tsx";

/** The control the page shell shows next to the person's name: the sign-out button of the real session. */
export async function shellHeaderAction(): Promise<ReactNode> {
  return <SignOutButton />;
}
