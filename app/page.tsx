import { auth, signIn, signOut } from "@/auth";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Apply Tracker</h1>
          <p className="text-gray-500 mb-6">
            Sign in with Google to track your job applications. We read your inbox only to find
            application emails, and your data is private to your account.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl transition"
            >
              Sign in with Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  // Re-runs the Google consent flow, which writes a fresh access + refresh token
  // over the expired one. Because allowDangerousEmailAccountLinking is on, this
  // links cleanly to the existing user — no Account-row deletion needed.
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