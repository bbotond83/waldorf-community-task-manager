import { COPY } from "../../src/identity/copy.ts";
import { SignOutButton } from "./SignOutButton.tsx";

/**
 * Way out of a "Nincs jogosultság" screen: an optional short explanation, then the existing
 * sign-out button. The screens render outside the app shell, so they have no header sign-out.
 */
export function AccessStateExit({ explain }: Readonly<{ explain: boolean }>) {
  return (
    <>
      {explain ? <p data-testid="access-guidance">{COPY.noAccess.guidance}</p> : null}
      <SignOutButton />
    </>
  );
}
