export async function preserveSavedComplaintOnTriageFailure<TComplaint, TResult>(
  complaint: TComplaint,
  runTriage: () => Promise<TResult>,
): Promise<{ complaint: TComplaint; triage: TResult | null }> {
  try {
    return { complaint, triage: await runTriage() }
  } catch {
    return { complaint, triage: null }
  }
}
