# Setup Supabase Storage per i PDF

Per far funzionare il caricamento dei PDF, devi configurare Supabase Storage.

## Passo 1: Crea il Bucket

1. Vai su **Supabase Dashboard** → **Storage**
2. Clicca su **"New bucket"** o **"Create bucket"**
3. Configura il bucket:
   - **Name**: `course-pdfs` (deve essere esattamente questo nome)
   - **Public bucket**: ❌ **NO** (deve essere privato)
   - **File size limit**: Puoi lasciare il default o impostare un limite (es. 50MB)
   - **Allowed MIME types**: Puoi lasciare vuoto o aggiungere `application/pdf`
4. Clicca su **"Create bucket"**

## Passo 2: Configura le Storage Policies

Dopo aver creato il bucket, devi configurare le policy per permettere agli utenti autenticati di:
- Caricare file (INSERT)
- Leggere i propri file (SELECT)
- Eliminare i propri file (DELETE)

### Opzione A: Usa l'Editor SQL (Consigliato)

Vai su **SQL Editor** e esegui questo script:

```sql
-- Policy per permettere agli utenti autenticati di caricare file
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-pdfs');

-- Policy per permettere agli utenti autenticati di leggere i file
CREATE POLICY "Authenticated users can read PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-pdfs');

-- Policy per permettere agli utenti di eliminare i propri file
CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Nota**: L'ultima policy per DELETE è più restrittiva. Se vuoi permettere a tutti gli utenti autenticati di eliminare qualsiasi PDF (non solo i propri), usa questa invece:

```sql
-- Policy per permettere agli utenti autenticati di eliminare qualsiasi PDF
CREATE POLICY "Authenticated users can delete PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-pdfs');
```

### Opzione B: Usa l'Editor delle Policy nella Dashboard

1. Vai su **Storage** → **Policies** (o clicca sul bucket `course-pdfs` → **Policies**)
2. Clicca su **"New Policy"**
3. Per ogni operazione (INSERT, SELECT, DELETE), crea una policy:
   - **Policy name**: es. "Authenticated users can upload PDFs"
   - **Allowed operation**: INSERT / SELECT / DELETE
   - **Target roles**: `authenticated`
   - **Policy definition**: 
     - Per INSERT: `bucket_id = 'course-pdfs'`
     - Per SELECT: `bucket_id = 'course-pdfs'`
     - Per DELETE: `bucket_id = 'course-pdfs'` (o più restrittiva come sopra)

## Verifica

Dopo aver completato i passaggi:
1. Prova a caricare un PDF da un corso
2. Se funziona, vedrai il PDF nella lista
3. Se vedi ancora errori, controlla la console del browser e i log del server per messaggi di errore più dettagliati

## Troubleshooting

### Errore: "Bucket not found"
- Verifica che il bucket si chiami esattamente `course-pdfs` (con il trattino)
- Controlla che il bucket sia stato creato correttamente

### Errore: "new row violates row-level security policy"
- Le Storage Policies non sono configurate correttamente
- Verifica che le policy permettano INSERT/SELECT/DELETE per gli utenti `authenticated`

### Errore: "The resource was not found"
- Il bucket non esiste o ha un nome diverso
- Verifica il nome del bucket nella dashboard
