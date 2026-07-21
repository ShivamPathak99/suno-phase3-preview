import { LoginForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/auth/redirects";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const nextPath = safeNextPath(typeof query.next === "string" ? query.next : undefined);

  return (
    <main className="login-page">
      <section aria-labelledby="login-title" className="login-card">
        <p className="login-wordmark">Suno</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="login-intro">Suno helps teachers hear where every child&apos;s reading is.</p>
        <LoginForm nextPath={nextPath} />
        <div className="login-divider" role="presentation" />
        <button className="login-demo-action" disabled type="button">
          <span>Explore the demo classroom</span>
          <small>No account needed — a full sample class resets nightly.</small>
        </button>
        <p className="login-support">
          Need an account? Suno is onboarding schools through partners — write to us.
        </p>
      </section>
    </main>
  );
}
