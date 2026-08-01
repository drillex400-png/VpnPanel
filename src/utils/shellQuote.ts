/**
 * Shell-argument escaping for commands built client-side and sent to the backend's
 * `execCommand` (which runs them verbatim over an SSH exec channel -- see
 * server/routes/ssh.ts POST /exec). Every value that originates from user input or
 * from parsed remote output (file names, paths, unit names, chmod modes, cron
 * expressions, etc.) MUST be run through `shQuote` before being interpolated into a
 * shell command string built in the frontend.
 *
 * IMPORTANT: double quotes are NOT safe for this. `"${path}"` still lets through
 * command substitution ($(...), backticks) and variable expansion ($VAR) -- only
 * single quotes fully neutralize all shell metacharacters (globbing, word-splitting,
 * substitution, expansion). The only character that needs special handling inside
 * single quotes is a literal single quote itself, via the standard POSIX trick:
 * close the quote, emit an escaped quote, reopen the quote -- `'\''`.
 */
export function shQuote(value: string): string {
  return "'" + String(value ?? "").replace(/'/g, `'\\''`) + "'";
}

/**
 * Builds a `cat <<'DELIM' > path` heredoc-write command that's safe against both:
 *  - shell metacharacters in the target path (path is single-quote-escaped)
 *  - the heredoc terminator ever colliding with a line inside the file's own
 *    content (the delimiter is randomized per call instead of a predictable
 *    literal like "EOF", which a file containing a line "EOF" could otherwise
 *    truncate against)
 * The delimiter itself is quoted (`<<'DELIM'`), which -- same as single-quoting a
 * normal argument -- disables all expansion inside the heredoc body, so file
 * content containing `$(...)`, backticks, or `$VAR` is written completely literally.
 */
export function buildHeredocWriteCommand(path: string, content: string): string {
  const delimiter =
    "PANELVPN_EOF_" +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2);
  // Guard against the astronomically unlikely case the random delimiter appears
  // verbatim in the content -- regenerate defensively isn't needed in practice,
  // but strip any occurrence of the exact token from content as a last resort so
  // it can never prematurely terminate the heredoc.
  const safeContent = content.split(delimiter).join(`${delimiter}_`);
  return `cat <<'${delimiter}' > ${shQuote(path)}\n${safeContent}\n${delimiter}`;
}
