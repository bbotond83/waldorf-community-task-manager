import Link from "next/link";

const TEACHER_HOME_PATH = "/teacher/schedule";

/**
 * "Back" link of a page that has no app shell (denied or error states). It leads to the signed-in
 * person's own default page; the teacher, who has no menu, is told it leads back to Beosztás.
 */
export function BackToHomeLink({
  homePath,
  label,
  testId,
}: Readonly<{ homePath?: string; label: string; testId?: string }>) {
  const isTeacherHome = homePath === TEACHER_HOME_PATH;
  return (
    <Link href={homePath ?? "/"} data-testid={testId}>
      {isTeacherHome ? "Vissza a beosztáshoz" : label}
    </Link>
  );
}
