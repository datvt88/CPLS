import ProtectedRoute from '../../components/ProtectedRoute'

export default function SignalsPage(){
  return (
    <ProtectedRoute requireVIP>
      <div>
        <h1 className="text-2xl font-bold mb-4">AI Analysis (VIP)</h1>
        <p className="text-[--muted]">Only VIP users can see this page.</p>
      </div>
    </ProtectedRoute>
  )
}
