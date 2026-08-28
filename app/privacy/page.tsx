import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Apply Tracker",
  description: "How Apply Tracker accesses, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back</Link>

        <h1 className="mb-2 mt-4 text-2xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

        <div className="space-y-7 text-[15px] leading-relaxed text-foreground/90">
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">What Apply Tracker does</h2>
            <p>
              Apply Tracker helps you keep track of your job applications. With your permission, it
              reads your Gmail to find emails related to jobs you have applied to — application
              confirmations, recruiter replies, interview invitations, assessments, offers, and
              rejections — and organizes them into a single dashboard so you can see where each
              application stands.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">What data we access</h2>
            <p>
              When you connect your Google account, you grant Apply Tracker read-only access to your
              Gmail. The app uses this access only to identify and process job-application emails. It
              does not send email, modify your inbox, or delete anything.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">What we store</h2>
            <p>For each email the app recognizes as job-related, it stores:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/80">
              <li>The sender, subject, and date of the email</li>
              <li>The company and role the email concerns</li>
              <li>The application stage (applied, interview, offer, rejected, etc.)</li>
              <li>A short summary used to display the application&apos;s status</li>
            </ul>
            <p className="mt-2">
              Emails that are not related to a job application are not stored. We do not retain the
              full body of your emails, and we do not read, store, or process personal emails
              unrelated to your job search.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">How your data is protected</h2>
            <p>
              The credentials used to access your Google account (access and refresh tokens) are
              encrypted before they are stored, so they cannot be read directly from our database.
              Your data is scoped to your account: no other user can access it. All data is stored on
              managed cloud infrastructure and transmitted over encrypted connections.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">How your data is used</h2>
            <p>
              Your data is used solely to provide the app&apos;s features to you: organizing your
              applications, analyzing interview notes you choose to add, and answering your questions
              about your own job search. We do not sell your data, share it with advertisers, or use
              it for any purpose other than operating the app for you.
            </p>
            <p className="mt-2">
              To classify emails and generate interview analysis, the app sends the relevant email
              text or the notes you provide to an AI model provider for processing. This is used only
              to produce your results and is not used to train models.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Deleting your data</h2>
            <p>
              You can delete any application (and its associated data) from within the app at any
              time. You can also revoke Apply Tracker&apos;s access to your Google account at any time
              from your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Google Account permissions page
              </a>
              . If you would like all of your stored data removed, contact us using the email below.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Google API disclosure</h2>
            <p>
              Apply Tracker&apos;s use and transfer of information received from Google APIs adheres to
              the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">Contact</h2>
            <p>
              If you have any questions about this policy or your data, contact the developer at{" "}
              <span className="text-foreground">sadiqkhann26@gmail.com</span>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
