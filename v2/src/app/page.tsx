import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

const COOKIE_NAME = "hedgelab-token";

export default async function Home() {
  // Check if any org exists
  const org = await queryOne<{ id: string }>(
    `SELECT id FROM organizations WHERE is_active = true LIMIT 1`
  );

  if (!org) {
    redirect("/setup");
  }

  // Check if user is authenticated
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    await verifyToken(token);
    redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}
