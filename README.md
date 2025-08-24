# ExpoSaaS - Next.js with PostgreSQL

A clean Next.js application with PostgreSQL backend integration.

## 🏗️ Project Structure

### Frontend (Next.js)

- **Pages**: `src/pages/` - Your React components that become routes
- **Components**: Can be added in `src/components/` for reusable UI
- **Styles**: `src/styles/` - CSS and styling files

### Backend (API Routes)

- **API Routes**: `src/pages/api/` - Your backend endpoints
- **Database**: `src/lib/db.ts` - PostgreSQL connection utilities
- **Current Endpoints**:
  - `GET /api/users` - Fetch all users
  - `POST /api/users` - Create a new user

## 🗄️ Database Setup

1. **Install PostgreSQL** on your system
2. **Create a database** called `exposaas_db`
3. **Update database credentials** in `.env.local`:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/exposaas_db
   ```
4. **Initialize the database**:
   ```bash
   npm run init-db
   ```

## 🚀 Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   - Copy `.env.local` and update with your PostgreSQL credentials

3. **Initialize database**:

   ```bash
   npm run init-db
   ```

4. **Start development server**:

   ```bash
   npm run dev
   ```

5. **Open your browser** to [http://localhost:3000](http://localhost:3000)

6. **Test the database** by visiting [http://localhost:3000/users](http://localhost:3000/users)

## 📁 File Explanations

- **`src/pages/_app.tsx`** - Root component that wraps all pages
- **`src/pages/index.tsx`** - Home page
- **`src/pages/users.tsx`** - User management page (frontend)
- **`src/pages/api/users.ts`** - User API endpoints (backend)
- **`src/lib/db.ts`** - Database connection and query utilities
- **`scripts/init-db.ts`** - Database initialization script

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run init-db` - Initialize database tables and sample data

## 📚 Next Steps

1. **Learn Next.js fundamentals**:

   - Pages and routing
   - API routes
   - Static and server-side rendering

2. **Extend the database**:

   - Add more tables in `scripts/init-db.ts`
   - Create new API endpoints in `src/pages/api/`

3. **Build features**:
   - User authentication
   - CRUD operations
   - File uploads
   - Email notifications

## 🔗 Useful Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [React Documentation](https://reactjs.org/docs/)
