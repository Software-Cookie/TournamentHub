/** Date → "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local"> values. */
export function toIstInput(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);
}
