type PracticeReadBannerProps = {
  studentName: string;
};

/** Visible two-model-boundary reminder on every focused practice read. */
export function PracticeReadBanner({ studentName }: PracticeReadBannerProps) {
  return (
    <p className="practice-read-banner" role="status">
      Practice read — doesn&apos;t change {studentName}&apos;s level
    </p>
  );
}
