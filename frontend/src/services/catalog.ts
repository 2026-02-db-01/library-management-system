import type { Book, LibraryData } from "../types/domain";
import { getAuthorsForBook, getAvailability, normalizeIsbn } from "./library";
export interface CatalogFilterValues {
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  yearFrom: string;
  yearTo: string;
  availability: string;
}
export const emptyCatalogFilters: CatalogFilterValues = {
  author: "",
  publisher: "",
  isbn: "",
  category: "",
  yearFrom: "",
  yearTo: "",
  availability: "",
};
export function matchesCatalogFilters(
  book: Book,
  data: Pick<LibraryData, "authors" | "bookAuthors" | "copies" | "loans">,
  f: CatalogFilterValues,
) {
  const authors = getAuthorsForBook(book.bookId, data)
    .map((a) => a.authorName)
    .join(" ")
    .toLowerCase();
  try {
    if (f.isbn.trim() && book.isbn !== normalizeIsbn(f.isbn)) return false;
  } catch {
    return false;
  }
  const available = getAvailability(book.bookId, data).available > 0;
  return (
    authors.includes(f.author.toLowerCase()) &&
    (book.publisher ?? "").toLowerCase().includes(f.publisher.toLowerCase()) &&
    (!f.category || book.categoryCode === f.category) &&
    (!f.yearFrom ||
      (book.publicationYear !== null &&
        book.publicationYear >= Number(f.yearFrom))) &&
    (!f.yearTo ||
      (book.publicationYear !== null &&
        book.publicationYear <= Number(f.yearTo))) &&
    (!f.availability ||
      (f.availability === "available" ? available : !available))
  );
}
