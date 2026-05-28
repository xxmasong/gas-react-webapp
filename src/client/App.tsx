import { Layout } from './components/layout';
import { useView } from './providers';
import { DashboardView } from './features/dashboard';
import { InventoryItemsView } from './features/inventory';
import { CategoriesView } from './features/categories';
import './styles.css';

function ActiveView() {
  const { view } = useView();
  switch (view) {
    case 'dashboard':
      return <DashboardView />;
    case 'inventory':
      return <InventoryItemsView />;
    case 'categories':
      return <CategoriesView />;
  }
}

export default function App() {
  return (
    <Layout>
      <ActiveView />
    </Layout>
  );
}
