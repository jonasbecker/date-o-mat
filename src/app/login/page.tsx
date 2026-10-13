import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/button";
import { GoogleIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { getSessionUser } from "@/server/auth/session";

const ERRORS: Record<string, string> = {
  not_allowed: "Diese Google-Adresse ist nicht freigeschaltet. Der Date-O-Mat ist nur für euch zwei.",
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

      <div className="flex flex-col items-center gap-4 text-center">
        <span className="sticker flex size-32 items-center justify-center rounded-[34px] bg-zitrone">
          <LogoMark size={104} clipId="login-logo" title="Date-O-Mat Logo: Kaugummiautomat voller Herzen" />
        </span>
        <h1 className="text-5xl font-bold">Date-O-Mat</h1>
        <p className="text-lg font-bold text-muted">Damit aus „wir sollten mal wieder …“ ein echtes Date wird.</p>
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
        Google zeigt beim ersten Mal „Diese App wurde nicht überprüft“. Das ist okay – der Date-O-Mat gehört euch. Tippe
        auf <strong>Erweitert</strong> und dann auf <strong>Weiter zu Date-O-Mat</strong>.
      </p>
    </main>
  );
}

async function RedirectIfLoggedIn() {
  const user = await getSessionUser();
  if (user) redirect(user.coupleId ? "/" : "/pair");
  return null;
}

async function LoginError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[20px] border-2 border-line bg-himbeere-soft px-4 py-3 font-bold text-tinte">
      {message}
    </p>
  );
}
