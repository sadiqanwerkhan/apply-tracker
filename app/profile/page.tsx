import Link from "next/link";
import { auth, signIn } from "@/auth";
import LandingPage from "@/components/LandingPage";
import { ProfileForm } from "@/components/ProfileForm";
import { WorkSection, EducationSection, LanguageSection, CertificationSection } from "@/components/ProfileSections";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/profile" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to applications</Link>
        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The honest record of who you are — used to tailor applications and spot gaps against roles.
          </p>
        </div>
        <div className="space-y-5">
          <ProfileForm />
          <WorkSection />
          <EducationSection />
          <LanguageSection />
          <CertificationSection />
        </div>
      </div>
    </main>
  );
}
