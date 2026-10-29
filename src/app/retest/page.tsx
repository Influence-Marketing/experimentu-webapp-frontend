import { redirect } from "next/navigation";

// The backend's emails link to /retest?token=…; the route is /retest/{token}.
export default async function RetestQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  redirect(value ? `/retest/${encodeURIComponent(value)}` : "/");
}
