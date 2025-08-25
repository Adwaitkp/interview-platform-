import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';

// This script creates a default admin user if one doesn't already exist.
// For security, it's recommended to use environment variables for credentials.
// Before running this script, set the following environment variables:
// export ADMIN_EMAIL=your_admin_email@example.com
// export ADMIN_PASSWORD=your_strong_password

const createAdmin = async (): Promise<void> => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
      console.log('Admin user already exists.');
      return;
    }

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn('Warning: Using default admin credentials. Please set ADMIN_EMAIL and ADMIN_PASSWORD environment variables for production.');
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin: IUser = new User({
      name: 'Admin User',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();
    console.log('Admin user created successfully.');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

export default createAdmin;
