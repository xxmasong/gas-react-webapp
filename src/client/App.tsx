import { Layout } from './components/layout';
import { useView, useAuth } from './providers';
import { LoginScreen, UsersView } from './features/auth';
import { DashboardView } from './features/dashboard';
import { InventoryItemsView } from './features/inventory';
import { CategoriesView } from './features/categories';
import './styles.css';

function ActiveView() {
  const { view } = useView();
  const { hasRole } = useAuth();
  switch (view) {
    case 'dashboard':
      return <DashboardView />;
    case 'inventory':
      return <InventoryItemsView />;
    case 'categories':
      // Supervisor+ only; staff who somehow land here see a notice.
      return hasRole('supervisor') ? <CategoriesView /> : <NoAccess />;
    case 'users':
      return hasRole('admin') ? <UsersView /> : <NoAccess />;
  }
}

function NoAccess() {
  return <p className="muted">You don't have permission to view this section.</p>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="reseed-spinner" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <Layout>
      <ActiveView />
    </Layout>
  );
}
