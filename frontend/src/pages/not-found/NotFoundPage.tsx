import { ArrowLeft, House } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Primitives'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <main className="not-found-page">
      <div className="not-found-code">404 <span>· PAGE NOT FOUND</span></div>
      <h1>요청한 페이지를 찾을 수 없습니다</h1>
      <p>주소를 확인하거나 도서관 홈으로 돌아가 다시 탐색해 주세요.</p>
      <div className="not-found-actions">
        <Button variant="secondary" icon={<ArrowLeft size={15} />} onClick={() => navigate(-1)}>이전 화면</Button>
        <Link className="button button-primary" to="/"><House size={15} /><span>홈으로 이동</span></Link>
      </div>
    </main>
  )
}
