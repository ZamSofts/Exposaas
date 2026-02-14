# Exposaas

AI-powered invoice data extraction for Japanese car exporters. Upload auction invoice PDFs, extract vehicle and charge data with Gemini AI, review and correct with human-in-the-loop, and track payments.

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Azure Blob Storage account
- Google Gemini API key

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up database:**
   ```bash
   npx prisma migrate dev
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   This starts Next.js + all workers + WebSocket server concurrently.

5. Open [http://localhost:3000](http://localhost:3000)

## Production Deployment (Docker)

1. **Prepare environment file:**
   ```bash
   cp .env.example .env.docker
   # Edit .env.docker with production values:
   #   - DATABASE_URL → production PostgreSQL
   #   - GEMINI_API_KEY → production key
   #   - AZURE_* → production storage
   #   - NEXT_PUBLIC_WS_URL → ws://<server-ip>:5000
   #   - NEXTAUTH_SECRET → generate with: openssl rand -base64 32
   ```

2. **Build and start:**
   ```bash
   docker-compose up --build -d
   ```

3. **Verify:**
   ```bash
   docker logs exposaas
   ```

## Updating Production

```bash
git pull origin main
docker-compose up --build -d
```

## Rollback

```bash
docker-compose down
git checkout <previous-commit>
docker-compose up --build -d
```

## Database Backup

```bash
pg_dump -h <host> -U <user> -d exposaas > backup_$(date +%Y%m%d).sql
```

## Tech Stack

- **Next.js 15** - Full-stack framework (pages + API routes)
- **Prisma** - ORM with PostgreSQL
- **pg-boss** - PostgreSQL-based job queue
- **Azure Blob Storage** - PDF file storage
- **Google Gemini AI** - Invoice data extraction
- **WebSocket** - Real-time job status updates
