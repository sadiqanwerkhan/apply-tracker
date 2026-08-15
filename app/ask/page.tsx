import Link from "next/link";
import { auth, signIn } from "@/auth";
import LandingPage from "@/components/LandingPage";
import { AskChat } from "@/components/AskChat";

export default async function AskPage() {
  const session = await auth();

  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/ask" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to applications</Link>
        <div className="mb-5 mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ask</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Ask questions about your applications and interviews in plain language.
          </p>
        </div>
        <AskChat />
      </div>
    </main>
  );
}
