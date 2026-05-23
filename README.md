# WAL-E — Cliente Integrado de Motores de BD Distribuidas

Proyecto del curso **CI-0141 Bases de Datos Avanzadas** (UCR, I Ciclo 2026).

Cliente de escritorio que se conecta simultáneamente a **PostgreSQL** y **MongoDB**, registra cada operación en una bitácora Write-Ahead (WAL) y simula los cuatro protocolos clásicos de recuperación ante fallos: **No-Undo/No-Redo**, **No-Undo/Redo**, **Undo/No-Redo**, **Undo/Redo**.

## Integrantes

- Mainor Castro Vargas — C21955
- Aaron Santana Valdelomar — C27373
- Diego Ignacio Cerdas Delgado — C21988
- Adrián Rivas Campos — C16457

Profesor: Ing. Sleyter Angulo Chavarría, M.Sc.

## Stack

- **Electron 30** + **React 18** + **TypeScript 5** + **Vite 5**
- **Tailwind CSS** para la UI
- Drivers oficiales: `pg` (PostgreSQL), `mongodb` (MongoDB)
- `node-sql-parser` para análisis sintáctico

## Requisitos previos

- Node.js 20 o superior
- Docker Desktop (para levantar los nodos de BD)
- Git

## Configuración y ejecución

### 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd wal-e
npm install
```

### 2. Levantar los nodos de BD con Docker Compose

```bash
docker-compose up -d
```

Esto crea dos contenedores:

| Nodo | Imagen | Puerto host | Credenciales |
|---|---|---|---|
| `wal-e-postgres` | postgres:17-alpine | 5432 | usuario `postgres` / clave `postgres` / BD `wal_e` |
| `wal-e-mongodb` | mongo:8 | 27017 | usuario `mongo` / clave `mongo` / BD `wal_e` |

URI sugerida para conectarse desde la app:
- PostgreSQL: `localhost:5432`, db `wal_e`, user `postgres`, pass `postgres`
- MongoDB: `mongodb://mongo:mongo@localhost:27017`, db `wal_e`

### 3. Crear la tabla `estudiantes` en PostgreSQL (una sola vez)

```bash
docker exec -it wal-e-postgres psql -U postgres -d wal_e -c "
CREATE TABLE IF NOT EXISTS estudiantes (
  carne TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nota INT NOT NULL
);"
```

Para MongoDB no se requiere setup: la colección `estudiantes` se crea al primer insert.

### 4. Arrancar la aplicación

```bash
npm run dev
```

Esto inicia Vite en modo dev y abre la ventana de Electron.

## Uso rápido

1. **Conectar a un nodo**: Sidebar → seleccionar PostgreSQL nodo-01 o MongoDB nodo-01.
2. **Iniciar transacción**: TopBar → dropdown TID → "+ NEW TRANSACTION", elige protocolo.
3. **Ejecutar queries**: pegalas en el editor o usa el **QUERY LAB** (botón morado en el TopBar) para abrir el catálogo de ejemplos.
4. **Commit / Rollback**: desde la vista **Transaction Manager**.
5. **Simular fallo**: botón **INJECT CRASH** (vacía el buffer de páginas sucias).
6. **Recuperar**: botón **RUN RECOVERY** — navega automáticamente a la vista Recovery con el estado antes/después, los TIDs sometidos a UNDO y a REDO, y un snapshot de las filas/documentos afectados.
7. **Inspeccionar bitácora**: pestaña **Recovery** o desde Query — el `WALConsole` muestra cada entrada en vivo con filtros por TID, tipo y rango temporal.

## Estructura del repositorio

```
wal-e/
├── electron/                    # Proceso main (Node.js)
│   ├── core/
│   │   ├── WalManager.ts        # Bitácora JSON-lines persistente
│   │   ├── TransactionManager.ts# Lógica de los 4 protocolos
│   │   ├── QueryParser.ts       # Parser SQL + Mongo
│   │   └── jsonUtils.ts         # Parser tolerante mongosh
│   ├── engines/
│   │   ├── ConnectionManager.ts
│   │   ├── PostgresEngine.ts
│   │   └── MongoEngine.ts
│   ├── ipcHandlers.ts           # Canales IPC tipados
│   ├── preload.ts               # Puente renderer↔main
│   └── main.ts                  # Entry point Electron
├── src/                         # Proceso renderer (React)
│   ├── components/
│   │   ├── Sidebar/             # Nodos + protocolo + lista TXNs
│   │   ├── TopBar/              # TID + tabs + acciones
│   │   ├── QueryEditor/         # Editor + resultados
│   │   ├── TransactionManager/  # Vista de TXN activa
│   │   ├── WALConsole/          # Visor de bitácora
│   │   ├── RecoveryView/        # Estado pre/post recovery
│   │   └── QueryLab/            # Catálogo de queries demo
│   ├── context/
│   │   ├── EngineContext.tsx
│   │   └── TransactionContext.tsx
│   └── App.tsx
├── docker-compose.yml
├── informe-wal-e.tex            # Documento LaTeX del informe
└── bitacora.log                 # WAL persistente (generado en runtime)
```

## Scripts

- `npm run dev` — Vite + Electron en modo desarrollo (hot reload).
- `npm run build` — `tsc` + `vite build` + `electron-builder`.
- `npm run lint` — ESLint con modo estricto (sin warnings).

## Notas para la presentación

- Para reproducir cada escenario de los 4 protocolos, abre el **Query Lab** (botón morado, icono de matraz) y sigue las categorías "Escenario No-Undo/No-Redo", "Escenario No-Undo/Redo", "Escenario Undo/No-Redo" y "Escenario Undo/Redo".
- El archivo `bitacora.log` es JSON-lines: puedes inspeccionarlo en cualquier momento con `cat bitacora.log` o filtrarlo con `jq`.
- La opción **Clear** del `WALConsole` vacía la bitácora para empezar limpio.

## Compilar el informe LaTeX

Abrir `informe-wal-e.tex` en Overleaf (o compilar local con `pdflatex` dos veces para resolver la tabla de contenidos). No requiere paquetes fuera del set por defecto de Overleaf.
