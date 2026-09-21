import { auth, signIn } from "@/auth";
import LandingPage from "@/components/LandingPage";
import { SkillsView } from "@/components/SkillsView";

// Thin server page: only the (cheap, cookie-based) auth check runs on the server.
// All the heavy data loading happens on the client via React Query in SkillsView,
// so navigating to this tab is fast and cached after the first visit.
export default async function SkillsPage() {
  const session = await auth();

  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/skills" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  return <SkillsView />;
}
