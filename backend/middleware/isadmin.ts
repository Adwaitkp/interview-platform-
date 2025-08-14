import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Define a custom request type that includes userId and userRole
interface CustomRequest extends Request {
  userId?: string;
  userRole?: string;
}

const isAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token missing or invalid' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      role: string;
    };

    req.userId = decoded.id;
    req.userRole = decoded.role;

    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admins only' });
    }

    next(); // allow to proceed
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export default isAdmin;
