# Backend API

Node.js + Express backend for Design Company Management System.

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files (DynamoDB client)
│   ├── controllers/     # Request/response handlers
│   ├── middleware/      # Express middleware (auth, error handling)
│   ├── models/          # Data access layer (DynamoDB operations)
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic layer
│   └── utils/           # Utility functions (logger, etc.)
├── server.js            # Main entry point
├── package.json         # Dependencies
└── .env                 # Environment variables (create from .env.example)
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - AWS credentials (or use IAM roles in production)
   - DynamoDB table names
   - Server port

4. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## Environment Variables

See `.env.example` for required environment variables.

## API Endpoints

- `GET /health` - Health check
- `POST /api/auth/login` - User login
- `GET /api/employees` - Get all employees
- `GET /api/expenses` - Get all expenses
- `GET /api/purchases` - Get all purchases
- `GET /api/sales-forecasts` - Get all sales forecasts

(Full API documentation to be added)

## Architecture

This backend follows a clean architecture pattern:

- **Routes**: Define API endpoints
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic layer
- **Models**: Data access layer (DynamoDB operations)
- **Middleware**: Cross-cutting concerns (auth, error handling)


