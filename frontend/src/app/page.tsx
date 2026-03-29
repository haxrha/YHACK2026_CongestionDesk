import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Desk } from "@/components/desk/Desk";
import {
  DEV_SESSION_COOKIE,
  isDevSessionValue,
} from "@/lib/devAuth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = cookies();
  if (!isDevSessionValue(jar.get(DEV_SESSION_COOKIE)?.value)) {
    redirect("/login");
  }
  return <Desk userEmail="Signed in" />;
}
