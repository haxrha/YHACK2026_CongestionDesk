import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmissionsDashboard } from "@/components/emissions/EmissionsDashboard";
import {
  DEV_SESSION_COOKIE,
  isDevSessionValue,
} from "@/lib/devAuth";

export const metadata: Metadata = {
  title: "CO₂ emissions · Congestion desk",
  description:
    "Port congestion CO₂ from AIS delay signals and IMO-style HFO factors.",
};

export const dynamic = "force-dynamic";

export default function EmissionsPage() {
  const jar = cookies();
  if (!isDevSessionValue(jar.get(DEV_SESSION_COOKIE)?.value)) {
    redirect("/login");
  }
  return <EmissionsDashboard />;
}
