// Placeholders while an API answers: soft bars with a moving sheen in the shape of the
// cards they stand in for. Screen readers get one line of status instead.
export const Shimmer = ({ className = '' }: { className?: string }) => <span className={`shimmer ${className}`.trim()} aria-hidden="true" />

export function CardSkeleton({ chart = false, lines = 4 }: { chart?: boolean; lines?: number }) {
  return (
    <section className="card" aria-hidden="true">
      <div className="skeleton">
        <Shimmer className="shimmer-title" />
        {chart ? <Shimmer className="shimmer-chart" /> : Array.from({ length: lines }, (_, index) => <Shimmer key={index} />)}
      </div>
    </section>
  )
}

export function PageSkeleton({ what, chart = true }: { what: string; chart?: boolean }) {
  return (
    <>
      <p className="visually-hidden" role="status">Loading {what}…</p>
      <CardSkeleton chart={chart} />
      <CardSkeleton />
      <CardSkeleton lines={3} />
    </>
  )
}
