import { ArrowUpRight, BookOpen, CircleCheck } from 'lucide-react'
import { getAuthorsForBook, getAvailability } from '../../services/library'
import type { Book, LibraryData } from '../../types/domain'
import { Badge } from '../ui/Primitives'

export function BookCard({ book, data, onSelect }: { book: Book; data: LibraryData; onSelect: (book: Book) => void }) {
  const authors = getAuthorsForBook(book.bookId, data)
  const availability = getAvailability(book.bookId, data)
  const coverTone = ((book.bookId - 1) % 5) + 1
  const retired = book.catalogStatus === 'RETIRED'

  return (
    <button className="book-card" onClick={() => onSelect(book)}>
      <span className={`book-cover book-cover-${coverTone}`} aria-hidden="true">
        <span className="book-cover-mark"><BookOpen size={15} /></span>
        <span className="book-cover-title">{book.title}</span>
        <span className="book-cover-rule" />
        <span className="book-cover-author">{authors[0]?.authorName ?? 'AUTHOR'}</span>
        <span className="book-cover-edition">BOOK / {String(book.bookId).padStart(3, '0')}</span>
      </span>
      <span className="book-card-content">
        <span className="book-card-topline"><span>{book.publicationYear ?? '연도 미상'} · {book.publisher ?? '출판사 미상'}</span><ArrowUpRight size={15} /></span>
        <strong>{book.title}</strong>
        <span className="book-card-author">{authors.map((author) => author.authorName).join(', ') || '저자 미등록'}</span>
        <span className="book-card-isbn">ISBN {book.isbn}</span>
        <span className="book-card-footer">
          <Badge tone={retired ? 'neutral' : availability.available > 0 ? 'green' : 'amber'}>
            {retired ? '제적' : availability.available > 0 ? '대출 가능' : '대출 중'}
          </Badge>
          <span className="book-availability"><CircleCheck size={13} /> {availability.available} / {availability.total}</span>
        </span>
      </span>
    </button>
  )
}
