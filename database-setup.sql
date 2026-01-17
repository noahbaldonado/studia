-- Tabella per memorizzare i metadati dei PDF caricati per i corsi
CREATE TABLE IF NOT EXISTS course_pdfs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice per migliorare le query per corso
CREATE INDEX IF NOT EXISTS idx_course_pdfs_course_id ON course_pdfs(course_id);

-- Indice per migliorare le query per utente
CREATE INDEX IF NOT EXISTS idx_course_pdfs_user_id ON course_pdfs(user_id);

-- RLS (Row Level Security) policies
ALTER TABLE course_pdfs ENABLE ROW LEVEL SECURITY;

-- Policy: gli utenti possono vedere tutti i PDF dei corsi
CREATE POLICY "Users can view all course PDFs"
  ON course_pdfs FOR SELECT
  USING (true);

-- Policy: gli utenti autenticati possono inserire PDF
CREATE POLICY "Authenticated users can insert PDFs"
  ON course_pdfs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: gli utenti possono eliminare solo i propri PDF
CREATE POLICY "Users can delete their own PDFs"
  ON course_pdfs FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_course_pdfs_updated_at
  BEFORE UPDATE ON course_pdfs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
