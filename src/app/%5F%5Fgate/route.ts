import { handleGatePost } from "@/lib/gate";

export async function POST(request: Request) {
  return handleGatePost(request);
}
