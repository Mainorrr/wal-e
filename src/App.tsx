import { EngineProvider } from './context/EngineContext';
import { TransactionProvider, useTransaction } from './context/TransactionContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TopBar } from './components/TopBar/TopBar';
import { QueryEditor } from './components/QueryEditor/QueryEditor';
import { TransactionManagerView } from './components/TransactionManager/TransactionManagerView';
import { RecoveryView } from './components/RecoveryView/RecoveryView';

function AppContent() {
  const { activeView } = useTransaction();

  return (
    <div className="bg-background text-on-surface font-body-md overflow-hidden h-screen flex">
      <Sidebar />
      <main className="ml-[240px] flex-1 flex flex-col h-screen overflow-hidden">
        <TopBar />
        <div className="flex-1 flex flex-col p-gutter gap-gutter overflow-hidden">
          {activeView === 'query' && <QueryEditor />}
          {activeView === 'transaction' && <TransactionManagerView />}
          {activeView === 'recovery' && <RecoveryView />}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <EngineProvider>
      <TransactionProvider>
        <AppContent />
      </TransactionProvider>
    </EngineProvider>
  );
}

export default App