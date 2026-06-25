import { auth, signIn, signOut } from "@/auth";

export default async function LoginTest() {
  const session = await auth();

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 520, margin: "80px auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Auth test</h1>
      {session?.user ? (
        <div style={{ marginTop: 16 }}>
          <p>Signed in as <strong>{session.user.email}</strong></p>
          {session.user.name && <p>Name: {session.user.name}</p>}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login-test" });
            }}
          >
            <button type="submit" style={{ marginTop: 12, padding: "10px 18px", borderRadius: 8, background: "#111", color: "#fff", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p>You are not signed in.</p>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/login-test" });
            }}
          >
            <button type="submit" style={{ marginTop: 12, padding: "10px 18px", borderRadius: 8, background: "#4F46E5", color: "#fff", border: "none", cursor: "pointer" }}>
              Sign in with Google
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
