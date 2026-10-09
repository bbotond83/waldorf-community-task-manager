import type {
  ApplicationResult,
  NavigationModel,
  RuntimeMode,
  SessionContext,
} from "./contracts.ts";
import type { AuthorizationContract } from "./authorization.ts";
import { denied, success, terminalFailure } from "./results.ts";

export interface SessionGateway {
  resolve(sessionReference: string): Promise<SessionContext | undefined>;
  selectSynthetic(profileId: string): Promise<SessionContext | undefined>;
  switchSynthetic(profileId: string): Promise<SessionContext | undefined>;
  acceptInvitation(
    token: string,
    input: Readonly<Record<string, string>>,
  ): Promise<{ destination: string } | undefined>;
  resendInvitation(identifier: string): Promise<void>;
}

export class SessionApplicationFacade {
  private readonly runtimeMode: RuntimeMode;
  private readonly gateway: SessionGateway;
  private readonly authorization: AuthorizationContract;

  constructor(
    runtimeMode: RuntimeMode,
    gateway: SessionGateway,
    authorization: AuthorizationContract,
  ) {
    this.runtimeMode = runtimeMode;
    this.gateway = gateway;
    this.authorization = authorization;
  }

  async resolve(sessionReference: string): Promise<ApplicationResult<SessionContext>> {
    try {
      const session = await this.gateway.resolve(sessionReference);
      if (!session) return denied("SESSION_REQUIRED");
      const navigation = await this.authorization.navigation(session);
      if (navigation.state === "success") return success(session, "SESSION_RESOLVED");
      return navigation.state === "recovery"
        ? terminalFailure("SESSION_DEPENDENCY_FAILURE")
        : navigation;
    } catch {
      return terminalFailure("SESSION_DEPENDENCY_FAILURE");
    }
  }

  selectSynthetic(profileId: string): Promise<ApplicationResult<SessionContext>> {
    return this.syntheticSession(profileId, "select");
  }

  switchSynthetic(profileId: string): Promise<ApplicationResult<SessionContext>> {
    return this.syntheticSession(profileId, "switch");
  }

  async acceptInvitation(
    token: string,
    input: Readonly<Record<string, string>>,
  ): Promise<ApplicationResult<Readonly<{ destination: string }>>> {
    if (token.trim().length < 16) return denied("INVITATION_INVALID");
    try {
      const outcome = await this.gateway.acceptInvitation(token, input);
      return outcome
        ? success(Object.freeze(outcome), "INVITATION_ACCEPTED")
        : denied("INVITATION_INVALID");
    } catch {
      return terminalFailure("INVITATION_DEPENDENCY_FAILURE");
    }
  }

  async resendInvitation(
    identifier: string,
  ): Promise<ApplicationResult<Readonly<Record<string, never>>>> {
    try {
      if (identifier.trim()) await this.gateway.resendInvitation(identifier.trim());
      return success(Object.freeze({}), "INVITATION_RESEND_ACCEPTED");
    } catch {
      // The public response remains non-enumerating for known, unknown, and faulting identifiers.
      return success(Object.freeze({}), "INVITATION_RESEND_ACCEPTED");
    }
  }

  navigation(session: SessionContext): Promise<ApplicationResult<NavigationModel>> {
    return this.authorization.navigation(session);
  }

  private async syntheticSession(
    profileId: string,
    operation: "select" | "switch",
  ): Promise<ApplicationResult<SessionContext>> {
    if (this.runtimeMode !== "synthetic") return denied("SYNTHETIC_SESSION_UNAVAILABLE");
    try {
      const session =
        operation === "select"
          ? await this.gateway.selectSynthetic(profileId)
          : await this.gateway.switchSynthetic(profileId);
      if (!session) return denied("PROFILE_NOT_AVAILABLE");
      const navigation = await this.authorization.navigation(session);
      if (navigation.state === "success") return success(session, "SYNTHETIC_SESSION_READY");
      return navigation.state === "recovery"
        ? terminalFailure("SESSION_DEPENDENCY_FAILURE")
        : navigation;
    } catch {
      return terminalFailure("SESSION_DEPENDENCY_FAILURE");
    }
  }
}
