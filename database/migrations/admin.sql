-- Panel de administración: campo es_admin en usuarios y resolucion en reportes

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS es_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Agrega columna resolucion para distinguir resolver vs desestimar
ALTER TABLE reportes
  ADD COLUMN IF NOT EXISTS resolucion VARCHAR(20)
    CHECK (resolucion IN ('resuelto', 'desestimado'));
