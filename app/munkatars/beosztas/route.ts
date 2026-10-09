import { compatibilityLocation } from "../../teacher/_lib/compatibility.ts";
export function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const params = Object.fromEntries(
    [...new Set(query.keys())].map((key) => [
      key,
      query.getAll(key).length > 1 ? query.getAll(key) : query.get(key)!,
    ]),
  );
  return new Response(null, { status: 307, headers: { Location: compatibilityLocation(params) } });
}
