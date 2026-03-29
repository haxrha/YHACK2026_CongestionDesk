import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/cn";
import {
  DEV_SESSION_COOKIE,
  isDevSessionValue,
} from "@/lib/devAuth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const jar = cookies();
  if (isDevSessionValue(jar.get(DEV_SESSION_COOKIE)?.value)) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <AmbientBackground />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="text-center font-mono text-xs font-medium uppercase tracking-[0.25em] text-accent-bright">
            AIS × Polymarket
          </p>
          <h1 className="mt-4 text-center text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Congestion desk
          </h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-foreground-muted">
            One click opens the desk.
          </p>

          <SpotlightCard contentClassName="mt-10 p-8 md:p-10" className="mt-10">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-bright">
              Enter
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              Sets a short-lived browser cookie so the server trusts this tab.
            </p>
            <a
              href="/api/dev-login"
              className={cn(
                "mt-8 flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-medium transition-[transform,background-color,box-shadow] duration-200 ease-expo",
                "bg-accent text-white shadow-accent-glow hover:bg-accent-bright active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-base"
              )}
            >
              Continue
            </a>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
