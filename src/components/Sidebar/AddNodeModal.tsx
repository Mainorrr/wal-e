import React, { useState } from 'react';
import { useEngine } from '../../context/EngineContext';
import { MaterialSymbol } from '../shared/MaterialSymbol';

interface AddNodeModalProps {
  onClose: () => void;
}

export function AddNodeModal({ onClose }: AddNodeModalProps) {
  const { addConfiguredNode, connect } = useEngine();
  const [nodeType, setNodeType] = useState<'relational' | 'nosql'>('relational');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // PostgreSQL Config State
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('wal_e');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('postgres');

  // MongoDB Config State
  const [uri, setUri] = useState('mongodb://mongo:mongo@localhost:27017');
  const [mongoDatabase, setMongoDatabase] = useState('wal_e');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError('Please provide a connection name.');
      return;
    }

    setIsConnecting(true);
    const nodeId = `node-${Date.now()}`;

    try {
      if (nodeType === 'relational') {
        const portNum = parseInt(port, 10);
        if (isNaN(portNum)) {
          setError('Port must be a valid number.');
          setIsConnecting(false);
          return;
        }

        const pgConfig = {
          host: host.trim(),
          port: portNum,
          database: database.trim(),
          user: user.trim(),
          password
        };

        const success = await connect(nodeId, 'relational', pgConfig);
        if (!success) {
          setError('Failed to connect to PostgreSQL. Please verify your settings.');
          setIsConnecting(false);
          return;
        }

        addConfiguredNode({
          label: label.trim(),
          type: 'relational',
          icon: 'database',
          config: pgConfig
        });
      } else {
        const mongoConfig = {
          uri: uri.trim(),
          database: mongoDatabase.trim()
        };

        const success = await connect(nodeId, 'nosql', mongoConfig);
        if (!success) {
          setError('Failed to connect to MongoDB. Please verify your settings.');
          setIsConnecting(false);
          return;
        }

        addConfiguredNode({
          label: label.trim(),
          type: 'nosql',
          icon: 'storage',
          config: mongoConfig
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div 
        className="bg-surface-container border border-outline-variant p-6 rounded-xl w-[460px] shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <MaterialSymbol icon="add_box" size={22} className="text-primary" />
            Add Database Node
          </h2>
          <button 
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-container-high"
          >
            <MaterialSymbol icon="close" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Connection Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Local PostgreSQL Node"
              className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary rounded outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Database Type</label>
            <div className="grid grid-cols-2 gap-2 bg-surface-container-lowest p-1 border border-outline-variant rounded">
              <button
                type="button"
                onClick={() => setNodeType('relational')}
                className={`py-1.5 text-xs font-bold rounded transition-all ${
                  nodeType === 'relational'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                PostgreSQL (Relational)
              </button>
              <button
                type="button"
                onClick={() => setNodeType('nosql')}
                className={`py-1.5 text-xs font-bold rounded transition-all ${
                  nodeType === 'nosql'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                MongoDB (NoSQL)
              </button>
            </div>
          </div>

          {nodeType === 'relational' ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Host</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Port</label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Database Name</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Username</label>
                  <input
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Connection URI</label>
                <input
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="mongodb://localhost:27017"
                  className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-outline font-label-caps uppercase mb-1">Database Name</label>
                <input
                  type="text"
                  value={mongoDatabase}
                  onChange={(e) => setMongoDatabase(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-3 py-1.5 focus:border-primary rounded outline-none"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error-container/20 border border-error text-error text-xs p-3 rounded flex items-center gap-2">
              <MaterialSymbol icon="error" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high rounded transition-all"
              disabled={isConnecting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-primary-container text-on-primary-container hover:opacity-90 rounded transition-all flex items-center gap-1.5"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-on-primary-container/30 border-t-on-primary-container rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <MaterialSymbol icon="bolt" size={14} />
                  Connect Node
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
