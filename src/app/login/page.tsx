import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/button";
import { ForgetPages } from "@/components/forget-pages";
import { GoogleIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { getSessionUser } from "@/server/auth/session";

const ERRORS: Record<string, string> = {
  not_allowed: "Diese Google-Adresse ist nicht freigeschaltet. Zweisamen ist nur für euch zwei.",
  cancelled: "Anmeldung abgebrochen. Probier's einfach nochmal.",
  state: "Die Anmeldung ist abgelaufen. Bitte nochmal versuchen.",
  oauth: "Bei der Anmeldung mit Google ist etwas schiefgelaufen. Bitte nochmal versuchen.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
      <ForgetPages />

      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-32 items-center justify-center rounded-[34px] bg-surface">
          <LogoMark size={96} title="Zweisamen Logo: eine kleine Pflanze im Topf" />
        </span>
        <h1 className="headline text-[62px]">zweisamen.</h1>
        <p className="text-lg text-muted">Lasst eure Dates aufblühen.</p>
      </div>

      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} />
      </Suspense>

      {/* Plain <a>: this hits a route handler that redirects to Google. */}
      <a href="/api/auth/google" className={buttonClass("primary", "lg", "w-full")}>
        <GoogleIcon />
        Mit Google anmelden
      </a>

      <p className="text-center text-sm font-semibold leading-relaxed text-muted">
        Google zeigt beim ersten Mal „Diese App wurde nicht überprüft“. Das ist okay – Zweisamen gehört euch. Tippe
        auf <strong>Erweitert</strong> und dann auf <strong>Weiter zu Zweisamen</strong>.
      </p>
    </main>
  );
}

async function RedirectIfLoggedIn() {
  const user = await getSessionUser();
  if (user) redirect(!user.coupleId ? "/pair" : user.onboardedAt ? "/" : "/welcome");
  return null;
}

async function LoginError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[20px] bg-rose px-4 py-3 font-semibold text-tinte">
      {message}
    </p>
  );
}
