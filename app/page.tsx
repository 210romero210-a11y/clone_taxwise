import { api } from "../convex/_generated/api";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import FormTree from "@/components/FormTree";
import TaxAppShell from "@/components/TaxAppShell";
import DiagnosticPanel from "@/components/DiagnosticPanel";

export default async function Home() {
  // Fetch all user returns (with forms/fields) on the server
  const preloaded = await preloadQuery(api.returns.listUserReturns, {});
  const userReturns = preloadedQueryResult(preloaded);

  // For demo, just show the first return's forms (if any)
  const forms = userReturns?.[0]?.forms
    ? Object.values(userReturns[0].forms)
    : [];

  const firstReturnId = userReturns?.[0]?.returnId;

  return (
    <main className="p-8 flex flex-col gap-8">
      <h1 className="font-semibold text-2xl mb-4">Your Tax Returns</h1>
      {forms.length > 0 ? (
        <TaxAppShell returnId={firstReturnId}>
          <div className="flex gap-6 items-start">
            <FormTree forms={forms} />
            <div className="w-80">
              <DiagnosticPanel returnId={firstReturnId} />
            </div>
          </div>
        </TaxAppShell>
      ) : (
        <div className="text-gray-500">No returns found for your account.</div>
      )}
    </main>
  );
}
