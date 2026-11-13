import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useLibraryStore } from './store/libraryStore'
import type { UserRole } from './types/domain'
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
const AdminAuthorsPage = lazy(() => import('./pages/admin/AdminPages').then((module) => ({ default: module.AdminAuthorsPage })))
const AdminStatisticsPage = lazy(() => import('./pages/admin/AdminPages').then((module) => ({ default: module.AdminStatisticsPage })))
const DbConsoleCatalogPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbConsoleCatalogPage })))
const DbTablePage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbTablePage })))
const DbErdPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbErdPage })))
const DbConstraintsPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbConstraintsPage })))
const DbDictionaryPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.DbDictionaryPage })))
const SchemaMetadataPage = lazy(() => import('./pages/db-console/DbConsolePages').then((module) => ({ default: module.SchemaMetadataPage })))
const NotFoundPage = lazy(() => import('./pages/not-found/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))

function RoleRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  const selectedRole = useLibraryStore((state) => state.demoRole)
  const roleSwitchTarget = useLibraryStore((state) => state.roleSwitchTarget)
  const location = useLocation()
  if (roleSwitchTarget && location.pathname !== roleSwitchTarget) return null
  if (selectedRole !== role) return <Navigate to="/" replace state={{ requiredRole: role }} />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="route-loading" role="status">화면을 불러오는 중…</div>}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="user" element={<RoleRoute role="MEMBER"><Navigate to="/user/books" replace /></RoleRoute>} />
            <Route path="user/books" element={<RoleRoute role="MEMBER"><UserBooksPage /></RoleRoute>} />
            <Route path="user/loans" element={<RoleRoute role="MEMBER"><UserLoansPage /></RoleRoute>} />
            <Route path="librarian" element={<RoleRoute role="LIBRARIAN"><LibrarianDashboardPage /></RoleRoute>} />
            <Route path="librarian/checkout" element={<RoleRoute role="LIBRARIAN"><LibrarianCheckoutPage /></RoleRoute>} />
            <Route path="librarian/returns" element={<RoleRoute role="LIBRARIAN"><LibrarianReturnsPage /></RoleRoute>} />
            <Route path="librarian/renewals" element={<RoleRoute role="LIBRARIAN"><LibrarianRenewalsPage /></RoleRoute>} />
            <Route path="librarian/overdue" element={<RoleRoute role="LIBRARIAN"><LibrarianOverduePage /></RoleRoute>} />
            <Route path="admin" element={<RoleRoute role="ADMIN"><AdminDashboardPage /></RoleRoute>} />
            <Route path="admin/members" element={<RoleRoute role="ADMIN"><AdminMembersPage /></RoleRoute>} />
            <Route path="admin/books" element={<RoleRoute role="ADMIN"><AdminBooksPage /></RoleRoute>} />
            <Route path="admin/authors" element={<RoleRoute role="ADMIN"><AdminAuthorsPage /></RoleRoute>} />
            <Route path="admin/statistics" element={<RoleRoute role="ADMIN"><AdminStatisticsPage /></RoleRoute>} />
            <Route path="admin/db-console" element={<RoleRoute role="ADMIN"><Navigate to="/admin/db-console/catalog" replace /></RoleRoute>} />
            <Route path="admin/db-console/catalog" element={<RoleRoute role="ADMIN"><DbConsoleCatalogPage /></RoleRoute>} />
            <Route path="admin/db-console/tables/:tableName" element={<RoleRoute role="ADMIN"><DbTablePage /></RoleRoute>} />
            <Route path="admin/db-console/erd" element={<RoleRoute role="ADMIN"><DbErdPage /></RoleRoute>} />
            <Route path="admin/db-console/constraints" element={<RoleRoute role="ADMIN"><DbConstraintsPage /></RoleRoute>} />
            <Route path="admin/db-console/dictionary" element={<RoleRoute role="ADMIN"><DbDictionaryPage /></RoleRoute>} />
            <Route path="schema/:tableName" element={<SchemaMetadataPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
