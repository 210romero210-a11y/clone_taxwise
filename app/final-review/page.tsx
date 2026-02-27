import { api } from '../../convex/_generated/api';
import { preloadQuery, preloadedQueryResult } from 'convex/nextjs';
import TaxAppShell from '@/components/TaxAppShell';
import FinalReview from '@/components/FinalReview';

export default async function FinalReviewPage() {
  const preloaded = await preloadQuery(api.returns.listUserReturns, {});
  const userReturns = preloadedQueryResult(preloaded);
  const firstReturnId = userReturns?.[0]?.returnId;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Final Review</h1>
      {firstReturnId ? (
        <TaxAppShell returnId={firstReturnId}>
          <div className="max-w-3xl">
            <FinalReview returnId={firstReturnId} />
          </div>
        </TaxAppShell>
      ) : (
        <div className="text-gray-500">No returns available</div>
      )}
    </main>
  );
}
