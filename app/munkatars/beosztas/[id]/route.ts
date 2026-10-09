import { compatibilityLocation } from "../../../teacher/_lib/compatibility.ts";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const query = new URL(request.url).searchParams;
  const params = Object.fromEntries(
    [...new Set(query.keys())].map((key) => [
      key,
      query.getAll(key).length > 1 ? query.getAll(key) : query.get(key)!,
    ]),
  );
  const { id } = await context.params;
  return new Response(null, {
    status: 307,
    headers: { Location: compatibilityLocation(params, id) },
  });
}
