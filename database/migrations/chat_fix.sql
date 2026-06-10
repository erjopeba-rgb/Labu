-- Fix: agregar tipo 'directo' al CHECK constraint de conversaciones
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS conversaciones_tipo_check;
ALTER TABLE conversaciones ADD CONSTRAINT conversaciones_tipo_check
  CHECK (tipo IN ('trabajo', 'disputa', 'tienda', 'general', 'directo'));
