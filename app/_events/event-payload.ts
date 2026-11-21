import type { AdminTaskPayload } from "../../src/application/index.ts";
import { parseTaskExtras, type FormErrors } from "../admin/_lib/record-payload.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
};

/**
 * The fields of the event form (BR100 to BR102): the shared task and event fields (group, times, place), then the
 * settings the event page needs: summer event, food sign-up, the sign-up deadline (a day) and the notice lead (1 to 60
 * days). An empty deadline or lead is sent empty so the stored value is cleared; the database checks the day against
 * the event's end.
 */
export function parseEventForm(
  formData: FormData,
  creating: boolean,
): { payload: Partial<AdminTaskPayload>; errors: FormErrors } {
  const { payload, errors } = parseTaskExtras("event", formData, creating);
  const settings: { -readonly [K in keyof AdminTaskPayload]?: AdminTaskPayload[K] } = {
    ...payload,
  };

  settings.isSummer = formData.get("isSummer") === "on";
  settings.foodSignupOn = formData.get("foodSignupOn") === "on";

  const deadline = text(formData, "signupDeadline");
  if (deadline === "") settings.signupDeadline = "";
  else if (DAY.test(deadline)) settings.signupDeadline = deadline;
  else errors.signupDeadline = "Adjon meg érvényes határidőt.";

  const lead = text(formData, "noticeLeadDays");
  if (lead === "") settings.noticeLeadDays = "";
  else {
    const days = Number(lead);
    if (Number.isInteger(days) && days >= 1 && days <= 60) settings.noticeLeadDays = days;
    else errors.noticeLeadDays = "Az értesítés előzetes ideje 1 és 60 nap közötti egész szám.";
  }
  return { payload: settings, errors };
}
