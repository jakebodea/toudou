export function getCaptureNoticeMessage(source: string): string {
  const trimmedSource = source.trim();

  if (trimmedSource.length === 0 || trimmedSource === "toudou") {
    return "Added to toudou";
  }

  return `Added to toudou · ${trimmedSource}`;
}
