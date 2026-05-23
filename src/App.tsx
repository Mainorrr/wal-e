import { EngineProvider } from './context/EngineContext';
import { TransactionProvider } from './context/TransactionContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TopBar } from './components/TopBar/TopBar';
import { QueryEditor } from './components/QueryEditor/QueryEditor';
import { WALConsole } from './components/WALConsole/WALConsole';

function App() {
  return (
    <EngineProvider>
      <TransactionProvider>
        <div className="bg-background text-on-surface font-body-md overflow-hidden h-screen flex">
          <Sidebar />
          <main className="ml-[240px] flex-1 flex flex-col h-screen overflow-hidden">
            <TopBar />
            <div className="flex-1 flex flex-col p-gutter gap-gutter overflow-hidden">
              <QueryEditor />
              <WALConsole />
            </div>
          </main>
        </div>
      </TransactionProvider>
    </EngineProvider>
  );
}

export default App