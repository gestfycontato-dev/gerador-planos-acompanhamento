export function Toast({ message }: { message: string }) {
  if (!message) return null
  return <div className="toast"><span>✓</span>{message}</div>
}
