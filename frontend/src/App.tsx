import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import './App.css'

const HomePage = lazy(() => import('./pages/home/HomePage').then((module) => ({ default: module.HomePage })))
const UserBooksPage = lazy(() => import('./pages/user/UserPages').then((module) => ({ default: module.UserBooksPage })))
const UserLoansPage = lazy(() => import('./pages/user/UserPages').then((module) => ({ default: module.UserLoansPage })))
const LibrarianDashboardPage = lazy(() => import('./pages/librarian/LibrarianPages').then((module) => ({ default: module.LibrarianDashboardPage })))
const LibrarianCheckoutPage = lazy(() => import('./pages/librarian/LibrarianPages').then((module) => ({ default: module.LibrarianCheckoutPage })))
const LibrarianReturnsPage = lazy(() => import('./pages/librarian/LibrarianPages').then((module) => ({ default: module.LibrarianReturnsPage })))
const LibrarianRenewalsPage = lazy(() => import('./pages/librarian/LibrarianPages').then((module) => ({ default: module.LibrarianRenewalsPage })))
const LibrarianOverduePage = lazy(() => import('./pages/librarian/LibrarianPages').then((module) => ({ default: module.LibrarianOverduePage })))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminPages').then((module) => ({ default: module.AdminDashboardPage })))
const AdminMembersPage = lazy(() => import('./pages/admin/AdminPages').then((module) => ({ default: module.AdminMembersPage })))
const AdminBooksPage = lazy(() => import('./pages/admin/AdminPages').then((module) => ({ default: module.AdminBooksPage })))
const AdminStatisticsPage = lazy(() => import('./pages/admin/AdminPages').then((module) => ({ default: module.AdminStatisticsPage })))
const DbConsoleCatalogPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbConsoleCatalogPage })))
const DbTablePage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbTablePage })))
const DbErdPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbErdPage })))
const DbConstraintsPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbConstraintsPage })))
const DbDictionaryPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbDictionaryPage })))
const NotFoundPage = lazy(() => import('./pages/not-found/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="route-loading" role="status">화면을 불러오는 중…</div>}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="user" element={<Navigate to="/user/books" replace />} />
            <Route path="user/books" element={<UserBooksPage />} />
            <Route path="user/loans" element={<UserLoansPage />} />
            <Route path="librarian" element={<LibrarianDashboardPage />} />
            <Route path="librarian/checkout" element={<LibrarianCheckoutPage />} />
            <Route path="librarian/returns" element={<LibrarianReturnsPage />} />
            <Route path="librarian/renewals" element={<LibrarianRenewalsPage />} />
            <Route path="librarian/overdue" element={<LibrarianOverduePage />} />
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/members" element={<AdminMembersPage />} />
            <Route path="admin/books" element={<AdminBooksPage />} />
            <Route path="admin/statistics" element={<AdminStatisticsPage />} />
            <Route path="admin/db-console" element={<Navigate to="/admin/db-console/catalog" replace />} />
            <Route path="admin/db-console/catalog" element={<DbConsoleCatalogPage />} />
            <Route path="admin/db-console/tables/:tableName" element={<DbTablePage />} />
            <Route path="admin/db-console/erd" element={<DbErdPage />} />
            <Route path="admin/db-console/constraints" element={<DbConstraintsPage />} />
            <Route path="admin/db-console/dictionary" element={<DbDictionaryPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
