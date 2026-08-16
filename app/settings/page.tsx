import Link from "next/link";
import { auth, signIn } from "@/auth";
import LandingPage from "@/components/LandingPage";
import { McpTokens } from "@/components/McpTokens";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/settings" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to applications</Link>
        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        </div>
        <McpTokens />
      </div>
    </main>
  );
}
