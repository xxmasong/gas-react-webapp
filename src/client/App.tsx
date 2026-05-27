import { runningInGas } from './lib/server';
import { InventoryView } from './features/inventory';
import './styles.css';

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Inventory</h1>
        <span className={`badge ${runningInGas ? 'live' : 'mock'}`}>
          {runningInGas ? 'Sheets backend' : 'local mock'}
        </span>
      </header>
      <InventoryView />
    </div>
  );
}
