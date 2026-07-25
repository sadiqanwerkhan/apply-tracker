import { auth, signIn, signOut } from "@/auth";
import Dashboard from "@/components/Dashboard";
import LandingPage from "@/components/LandingPage";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  async function handleReconnect() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <Dashboard
      userEmail={session.user.email ?? ""}
      onSignOut={handleSignOut}
      onReconnect={handleReconnect}
    />
  );
}