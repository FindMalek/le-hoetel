/** Whether `release` is newer than the `deployed` one. Both are `X.Y.Z`. */
export function isUpcoming(release: string, deployed: string): boolean {
  return release.localeCompare(deployed, "en", { numeric: true }) > 0
}
