import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';


const createAdmin = async (): Promise<void> => {
  try {
    const existing = await User.findOne({ email: 'admin@example.com' });

    if (existing) {
      return;
    }

    const hashedPassword = await bcrypt.hash('adminpassword', 10);

    const admin: IUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

export default createAdmin;
