/** SPACE PIXL: SPACE in the product blue, PIXL in white, as in every PIXL name. */
export function Wordmark({ className }: { className?: string }): React.JSX.Element {
  return (
    <span className={`wm${className ? ` ${className}` : ''}`}>
      <em>SPACE</em> PIXL
    </span>
  )
}
