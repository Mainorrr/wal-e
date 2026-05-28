CREATE TABLE IF NOT EXISTS estudiantes (
  carne TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nota  INT  NOT NULL
);

DELETE FROM estudiantes;

INSERT INTO estudiantes (carne, nombre, nota) VALUES
  ('B12345', 'Ana Fernandez', 88),
  ('B67890', 'Carlos Mora',    72),
  ('B54321', 'Laura Solis',   95);
