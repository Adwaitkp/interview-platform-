
# Tech Stack

# Frontend
- Framework: Angular 18+ (Standalone Components)
- Styling: Tailwind CSS
- HTTP Client: Angular HttpClient
- Routing: Angular Router

# Backend
- Runtime: Node.js (v18+)
- Framework: Express.js
- Language: TypeScript
- Database: MongoDB 
- Authentication: JWT (JSON Web Tokens)
- Password Hashing: bcrypt

# Project Structure

```
interview-platform/
├── README.md                     # Project documentation
├── backend/                      # Node.js/Express backend
│   ├── package.json             # Backend dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   ├── server.ts                # Express server entry point
│   ├── natsClient.ts           # NATS messaging client
│   ├── controllers/             # Request handlers
│   │   ├── aiQuestionController.ts    # AI question management
│   │   ├── aiQuizResultsController.ts # AI quiz results
│   │   ├── quizController.ts          # Standard quiz logic
│   │   └── userController.ts          # User management
│   ├── createadmin/             # Admin creation utilities
│   │   └── createadmin.ts       # Admin user creation script
│   ├── middleware/              # Express middleware
│   │   └── isadmin.ts          # Admin authorization middleware
│   ├── models/                  # MongoDB schemas
│   │   ├── AIQuestions.ts       # AI-generated questions model
│   │   ├── AIResult.ts          # AI quiz results model
│   │   ├── Questions.ts         # Standard questions model
│   │   ├── Result.ts           # Quiz results model
│   │   └── User.ts             # User/candidate model
│   └── routes/                  # API route definitions
│       ├── accepted-questions.ts     # Approved questions routes
│       ├── adminroutes.ts           # Admin-specific routes
│       ├── aiquizroute.ts           # AI quiz routes
│       ├── loginroute.ts            # Authentication routes
│       ├── questionroute.ts         # Question CRUD routes
│       ├── quiz-assignment.ts       # Quiz assignment routes
│       ├── quizroute.ts            # Standard quiz routes
│       ├── ai-routes/              # AI-specific endpoints
│       │   ├── ai-question-generation.ts  # AI question generation
│       │   └── ai-quiz-results.ts         # AI quiz results
│       └── question-crud/          # Question management
│           └── questionCRUD.ts     # Question CRUD operations
├── frontend/                    # Angular frontend
│   ├── angular.json            # Angular workspace configuration
│   ├── package.json           # Frontend dependencies
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── tsconfig.json          # TypeScript configuration
│   ├── tsconfig.app.json      # App-specific TypeScript config
│   ├── tsconfig.spec.json     # Test-specific TypeScript config
│   ├── public/                # Static assets
│   │   ├── favicon.ico        # Website icon
│   │   └── riverstramlogo.png # Company logo
│   └── src/                   # Source code
│       ├── index.html         # Main HTML template
│       ├── main.ts           # Application bootstrap
│       ├── styles.css        # Global styles
│       ├── app/              # Application components
│       │   ├── app.config.ts     # App configuration
│       │   ├── app.html          # Root component template
│       │   ├── app.routes.ts     # Routing configuration
│       │   ├── app.ts            # Root component
│       │   ├── add-interviewee/  # Candidate creation
│       │   │   ├── add-interviewee.html
│       │   │   └── add-interviewee.ts
│       │   ├── admin-dashboard/  # Admin control panel
│       │   │   ├── admin-dashboard.html
│       │   │   └── admin-dashboard.ts
│       │   ├── ai-quiz/          # AI-powered quiz interface
│       │   │   ├── ai-quiz.html
│       │   │   └── ai-quiz.ts
│       │   ├── candidate-management/  # Candidate CRUD operations
│       │   │   ├── candidate-management.html
│       │   │   └── candidate-management.ts
│       │   ├── header/           # Navigation component
│       │   │   ├── header.html
│       │   │   └── header.ts
│       │   ├── login/            # Authentication interface
│       │   │   ├── login.html
│       │   │   └── login.ts
│       │   ├── models/           # TypeScript interfaces
│       │   │   ├── admin.models.ts   # Admin-related types
│       │   │   └── user.model.ts     # User-related types
│       │   ├── questions/        # Question management interface
│       │   │   ├── questions.html
│       │   │   └── questions.ts
│       │   ├── quiz/             # Standard quiz interface
│       │   │   ├── quiz.html
│       │   │   └── quiz.ts
│       │   ├── services/         # Angular services
│       │   │   ├── admin.service.ts              # Admin operations
│       │   │   ├── ai-quiz.service.ts           # AI quiz functionality
│       │   │   └── candidate-management.service.ts  # Candidate operations
│       │   └── unified-question/ # Unified question interface
│       │       ├── unified-questions.html
│       │       └── unified-questions.ts
│       └── environments/         # Environment configurations
│           └── environment.ts    # Development environment
```

# Installation
Clone the Repository

git clone https://github.com/Adwaitkp/interview-platform-.git
cd interview-platform-

or

Download ZIP file 

### 2. Install Backend Dependencies
```bash
cd backend
npm init -y
npm install express cors mongoose bcryptjs jsonwebtoken axios uuid nats openai @copilotkit/runtime
npm install -D typescript ts-node ts-node-dev @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken
npx tsc --init
npm run dev



# 3. Install Frontend Dependencies
npm install -g @angular/cli
ng new frontend
cd frontend
npm install
#Install Tailwind
npm install tailwindcss @tailwindcss/postcss postcss --force
Configure PostCSS Plugins
Create a .postcssrc.json
 {
 "plugins": {
    "@tailwindcss/postcss": {}
  }
  
@import "tailwindcss";
import this in style.css

# Configuration
# Backend Configuration

1. *Create Environment File**
   bash
   cd backend`
   Create a .env file in the backend directory:
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/interview-platform

   # JWT Configuration
   JWT_SECRET=your-secret-jwt-key

   # CORS Configuration (Frontend URL)
   FRONTEND_URL=http://localhost:4200
   ```

2. **Update MongoDB Connection**
   - If using MongoDB Atlas, replace MONGODB_URI with your connection string
   - For local MongoDB, ensure the service is running

# Frontend Configuration

1. Update API URL*

   create frontend/src/environments/environment.ts:
   
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:3000/api'
   };


Terminal 1 - Backend:

cd backend
npm run dev

Backend will run on `http://localhost:3000`

Terminal 2 - Frontend:

cd frontend
npm start
# or
ng serve --host 0.0.0.0 --port 4200

Frontend will run on `http://localhost:4200`


#Key Functionalities

#1 *User Authentication*
- Secure JWT-based authentication
- Role-based access control (Admin/Interviewee)
- Token expiration handling
- Password hashing with bcrypt

#2 *Candidate Management*
- Add Candidate: Create new interviewee profiles with skills and levels
- Edit Candidate: 
  1 Update skills and levels
  2 Automatically clears assigned questions when skills are removed
  3 Maintains data integrity
- Delete Candidate: Removes candidate and all associated quiz data
- Search & Filter: Find candidates by name or email

#3 *Quiz Assignment*
# Normal Quiz
- Select from question bank based on skill and level
- Configure question type distribution:
  - Multiple Choice
  - Single Choice (radio buttons)
  - True/False
- Set total questions per skill-level combination
- Questions stored in `assignedQuestions` map for consistency

# AI Quiz
- Generate questions dynamically using AI
- Review and approve questions before assignment
- Organize questions into sets for reusability
- Use existing sets or create new ones

#4 *Question Management*
- Create: Add questions with options and correct answers
- Edit: Update question content, options, or difficulty
- Delete: Remove questions from the bank
- Approve: Review AI-generated questions
- Categorize: Organize by skill (Node.js, React, Angular, etc.) and level (Beginner, Intermediate, Advanced)

5. Quiz Taking Experience
- Timer System: 
  1 Beginner: 90 seconds per question
  2 Intermediate: 120 seconds per question
  3 Advanced: 150 seconds per question
- Questions lock when time expires

#6 *Results & Analytics*
- Overall Score: Percentage and total correct/incorrect
- Skill-Level Breakdown: Performance by skill and difficulty
- Attempt History: Track multiple quiz attempts
- Detailed Responses: View question-by-question analysis
- Export Capabilities: Download results for reporting

#7 *Retest Functionality*
- Reset quiz while preserving attempt history
- Increment attempt number automatically
- Clear assigned questions for fresh start
- Maintain result records for comparison

---

# API Documentation

 POST  `/api/auth/login`  User login , Admin login
 GET  `/api/auth/me`  (JWT) 

# Admin Endpoints

GET  `/api/admin/users`  Get all candidates  (Admin)
POST  `/api/admin/users`  Create candidate (Admin)
PATCH  `/api/admin/users/:id`  Update candidate (Admin) 
DELETE  `/api/admin/users/:id`  Delete candidate (Admin) 
PATCH `/api/admin/users/update/:id` Reset password (Admin)
PATCH `/api/admin/users/cascade-delete/:id` Update with cascade (Admin)
POST `/api/admin/users/retest/:id` Reset quiz (Admin) 

# Question Endpoints

GET `/api/questions` Get questions 
POST `/api/questions` Create question (Admin)
GET `/api/questions/:id` Get single question
PUT `/api/questions/:id` Update question (Admin)
DELETE `/api/questions/:id` Delete question (Admin)
PUT `/api/questions/users/:userId/question-type-config` Update config (Admin)

# Quiz Endpoints

POST `/api/quiz/submit` Submit normal quiz 
GET `/api/quiz/results` Get all results (Admin)
GET `/api/quiz/result/:resultId` Get detailed result
GET `/api/quiz/check-status` Check quiz status

# AI Quiz Endpoints

POST `/api/ai-quiz/generate-ai-questions` Generate AI questions (Admin) 
GET `/api/ai-quiz/approved-ai-questions-by-set/:userId` Get approved questions
POST `/api/ai-quiz/submit-ai-quiz` Submit AI quiz
GET `/api/ai-quiz/user-sets/:userId` Get user's question sets (Admin)

# Quiz Assignment Endpoints

POST `/api/quiz-assignment/assign-quiz-type` Assign quiz type (Admin)
GET `/api/quiz-assignment/quiz-type/:userId` Get assigned quiz type

#  User Roles

# Admini
- Full access to all features
- Manage candidates (CRUD operations)
- Manage questions (CRUD operations)
- Assign quizzes (Normal/AI)
- View and analyze results
- Reset quizzes for retests
- Approve/reject AI-generated questions

*Default Admin Credentials*
- Create admin using: `npm run create-admin` in backend directory
- Follow prompts to set name, email, and password

# Interviewee (Candidate)

- Take assigned quizzes
- View their own quiz interface
- Cannot access admin features
- Cannot view other candidates' data
- Can resume incomplete quizzes after logout

