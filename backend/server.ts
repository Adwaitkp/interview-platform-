import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import createAdmin from './createadmin/createadmin';

// Import routes
import adminRoutes from './routes/adminroutes';
import loginRoutes from './routes/loginroute';
import questionRoutes from './routes/questionroute';
import quizRoutes from './routes/quizroute';
import aiQuizRoutes from './routes/aiquizroute';
import acceptedQuestionsRoutes from './routes/accepted-questions';
import quizAssignmentRoutes from './routes/quiz-assignment';

dotenv.config(); // Load environment variables

const app = express();

// ✅ Fix TypeScript number conversion
const PORT: number = Number(process.env.PORT) || 5000;
const MONGO_URI: string = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

// ✅ Replace with your actual IP
const YOUR_LOCAL_IP = '192.168.0.63';

// ✅ Allowed CORS origins
const allowedOrigins = [
  'http://localhost:4200',
  `http://${YOUR_LOCAL_IP}:4200`,  // Angular frontend from phone
  `http://${YOUR_LOCAL_IP}:5000`,  // Backend access from phone
  'https://0pr151wk-4200.inc1.devtunnels.ms' // tunnel if used
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ✅ Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB Connected');

    // Create default admin if not exists
    await createAdmin();

    // Start server on all interfaces (LAN-accessible)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at: http://${YOUR_LOCAL_IP}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', loginRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/ai-quiz', aiQuizRoutes);
app.use('/api/accepted-questions', acceptedQuestionsRoutes);
app.use('/api/quiz-assignment', quizAssignmentRoutes);
