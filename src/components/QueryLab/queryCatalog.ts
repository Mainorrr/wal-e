export interface QueryExample {
  title: string;
  description: string;
  query: string;
  notes?: string;
}

export interface QueryCategory {
  category: string;
  intro?: string;
  items: QueryExample[];
}

export const POSTGRES_CATALOG: QueryCategory[] = [
  {
    category: 'Setup',
    intro: 'Crea la tabla y carga datos iniciales para los demos. Ejecútalas FUERA de transacción (sin TID activo) o seleccionando un TID nuevo.',
    items: [
      {
        title: 'Crear tabla estudiantes',
        description: 'Crea la tabla base con clave primaria carne.',
        query: `CREATE TABLE IF NOT EXISTS estudiantes (
  carne TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nota INT NOT NULL
);`,
        notes: 'No es una mutación tracked por WAL: se ejecuta directo.',
      },
      {
        title: 'Cargar datos de demostración',
        description: 'Inserta 3 estudiantes iniciales para los escenarios.',
        query: `INSERT INTO estudiantes (carne, nombre, nota) VALUES ('B12345', 'Ana Fernandez', 88);
INSERT INTO estudiantes (carne, nombre, nota) VALUES ('B67890', 'Carlos Mora', 72);
INSERT INTO estudiantes (carne, nombre, nota) VALUES ('B54321', 'Laura Solis', 95);`,
        notes: 'Ejecuta cada INSERT por separado dentro de una transacción para ver entradas WAL.',
      },
      {
        title: 'Limpiar tabla',
        description: 'Borra todos los registros sin eliminar la tabla.',
        query: `DELETE FROM estudiantes`,
      },
    ],
  },
  {
    category: 'CRUD básico',
    intro: 'Operaciones que demuestran el registro en bitácora antes de aplicar (Write-Ahead).',
    items: [
      {
        title: 'INSERT con columnas explícitas',
        description: 'Forma recomendada — produce una entrada WAL con after_image completa.',
        query: `INSERT INTO estudiantes (carne, nombre, nota) VALUES ('B99999', 'Pedro Vargas', 80)`,
      },
      {
        title: 'UPDATE de un campo',
        description: 'Genera before_image (SELECT previo) y after_image en la bitácora.',
        query: `UPDATE estudiantes SET nota = 95 WHERE carne = 'B12345'`,
      },
      {
        title: 'UPDATE de varios campos',
        description: 'Actualiza nombre y nota a la vez.',
        query: `UPDATE estudiantes SET nombre = 'Ana M. Fernandez', nota = 100 WHERE carne = 'B12345'`,
      },
      {
        title: 'DELETE con filtro',
        description: 'La before_image guarda el registro completo para permitir UNDO.',
        query: `DELETE FROM estudiantes WHERE carne = 'B99999'`,
      },
      {
        title: 'SELECT todos',
        description: 'Lectura — no genera entrada WAL.',
        query: `SELECT * FROM estudiantes ORDER BY carne`,
      },
    ],
  },
  {
    category: 'Escenario No-Undo / No-Redo',
    intro: 'Política force + no-steal: nada se aplica antes del COMMIT. Si hay crash antes del COMMIT, no hay que hacer nada.',
    items: [
      {
        title: 'Paso 1: UPDATE bufferizado',
        description: 'Selecciona protocolo No-Undo/No-Redo, inicia TXN, corre este UPDATE — no se aplica al motor.',
        query: `UPDATE estudiantes SET nota = 50 WHERE carne = 'B12345'`,
        notes: 'Tras esto pulsa INJECT CRASH (sin COMMIT). El valor en BD debe seguir intacto.',
      },
      {
        title: 'Paso 2 (alternativa): COMMIT',
        description: 'Si en lugar de crash haces COMMIT, el flush ocurre ahora.',
        query: `-- Pulsa el botón COMMIT en Transaction Manager`,
      },
    ],
  },
  {
    category: 'Escenario No-Undo / Redo',
    intro: 'Política no-force: el COMMIT puede ocurrir antes de que los datos estén en el motor. Si hay crash después del COMMIT, RUN RECOVERY ejecuta REDO desde after_image.',
    items: [
      {
        title: 'Paso 1: INSERT + COMMIT',
        description: 'TXN con protocolo No-Undo/Redo. Ejecuta y haz COMMIT.',
        query: `INSERT INTO estudiantes (carne, nombre, nota) VALUES ('B11111', 'Demo Redo', 90)`,
      },
      {
        title: 'Paso 2: INJECT CRASH + RUN RECOVERY',
        description: 'El REDO debe re-insertar la fila B11111 si se hubiera perdido.',
        query: `SELECT * FROM estudiantes WHERE carne = 'B11111'`,
      },
    ],
  },
  {
    category: 'Escenario Undo / No-Redo',
    intro: 'Política steal + force: cambios se aplican inmediato al motor. Si la TXN aborta o crashea sin commit, hay que deshacer con before_image.',
    items: [
      {
        title: 'Paso 1: UPDATE inmediato',
        description: 'Con protocolo Undo/No-Redo, este UPDATE se aplica directo a la BD.',
        query: `UPDATE estudiantes SET nota = 10 WHERE carne = 'B67890'`,
        notes: 'Verifica que la fila ya tiene nota=10 con un SELECT.',
      },
      {
        title: 'Paso 2: INJECT CRASH (sin COMMIT) + RUN RECOVERY',
        description: 'El UNDO debe restaurar la nota original.',
        query: `SELECT * FROM estudiantes WHERE carne = 'B67890'`,
      },
    ],
  },
  {
    category: 'Escenario Undo / Redo',
    intro: 'Política más flexible: steal + no-force. Combina UNDO de transacciones activas y REDO de las commiteadas en una sola pasada.',
    items: [
      {
        title: 'Setup: dos transacciones en paralelo',
        description: 'TXN-A: protocolo Undo/Redo, UPDATE + COMMIT. TXN-B: misma protocolo, UPDATE sin commit.',
        query: `-- En TXN-A:
UPDATE estudiantes SET nota = 99 WHERE carne = 'B12345'
-- COMMIT TXN-A
-- En TXN-B:
UPDATE estudiantes SET nota = 1 WHERE carne = 'B67890'
-- NO commitees TXN-B`,
        notes: 'Después pulsa INJECT CRASH y luego RUN RECOVERY. B12345 debe quedar en 99 (REDO), B67890 con su valor previo (UNDO).',
      },
    ],
  },
];

export const MONGO_CATALOG: QueryCategory[] = [
  {
    category: 'Setup',
    intro: 'MongoDB crea la colección al primer insert. Ejecuta fuera de transacción.',
    items: [
      {
        title: 'Insertar datos iniciales',
        description: 'Crea la colección estudiantes con 3 documentos.',
        query: `db.estudiantes.insertOne({ carne: "B12345", nombre: "Ana Fernandez", nota: 88 })`,
        notes: 'Repite con otros dos documentos para tener data.',
      },
      {
        title: 'Limpiar colección',
        description: 'Elimina todos los documentos.',
        query: `db.estudiantes.deleteMany({})`,
      },
    ],
  },
  {
    category: 'CRUD básico',
    intro: 'Operaciones CRUD vía sintaxis db.coleccion.metodo().',
    items: [
      {
        title: 'insertOne',
        description: 'Inserta un documento; after_image en la WAL.',
        query: `db.estudiantes.insertOne({ carne: "B99999", nombre: "Pedro Vargas", nota: 80 })`,
      },
      {
        title: 'updateOne con $set',
        description: 'Antes de aplicar, hace findOne para before_image.',
        query: `db.estudiantes.updateOne({ carne: "B12345" }, { $set: { nota: 95 } })`,
      },
      {
        title: 'deleteOne',
        description: 'before_image conserva el documento eliminado para UNDO.',
        query: `db.estudiantes.deleteOne({ carne: "B99999" })`,
      },
      {
        title: 'findOne',
        description: 'Lectura — sin entrada WAL.',
        query: `db.estudiantes.findOne({ carne: "B12345" })`,
      },
      {
        title: 'find todos',
        description: 'Devuelve array JSON.',
        query: `db.estudiantes.find({})`,
      },
    ],
  },
  {
    category: 'Escenario No-Undo / No-Redo',
    intro: 'Cambios bufferizados; crash antes del COMMIT los descarta.',
    items: [
      {
        title: 'updateOne sin commit',
        description: 'Tras este update, INJECT CRASH y verifica que el documento original sigue intacto.',
        query: `db.estudiantes.updateOne({ carne: "B12345" }, { $set: { nota: 50 } })`,
      },
    ],
  },
  {
    category: 'Escenario No-Undo / Redo',
    intro: 'COMMIT registrado en WAL aunque el cambio aún no haya llegado al motor; RUN RECOVERY rehace.',
    items: [
      {
        title: 'insertOne + COMMIT',
        description: 'Con protocolo No-Undo/Redo, ejecuta y commitea. Luego INJECT CRASH + RUN RECOVERY.',
        query: `db.estudiantes.insertOne({ carne: "B11111", nombre: "Demo Redo", nota: 90 })`,
      },
    ],
  },
  {
    category: 'Escenario Undo / No-Redo',
    intro: 'Cambio aplicado de inmediato; si la TXN no commitea, UNDO restaura.',
    items: [
      {
        title: 'updateOne aplicado',
        description: 'Con Undo/No-Redo este update llega al motor enseguida. INJECT CRASH antes del commit.',
        query: `db.estudiantes.updateOne({ carne: "B67890" }, { $set: { nota: 10 } })`,
      },
    ],
  },
  {
    category: 'Escenario Undo / Redo',
    intro: 'Combina UNDO y REDO.',
    items: [
      {
        title: 'Dos transacciones simultáneas',
        description: 'TXN-A commitea un UPDATE; TXN-B queda activa con otro UPDATE. INJECT CRASH + RUN RECOVERY.',
        query: `// TXN-A: protocolo Undo/Redo
db.estudiantes.updateOne({ carne: "B12345" }, { $set: { nota: 99 } })
// COMMIT TXN-A
// TXN-B: protocolo Undo/Redo
db.estudiantes.updateOne({ carne: "B67890" }, { $set: { nota: 1 } })
// NO commitees TXN-B`,
      },
    ],
  },
];
