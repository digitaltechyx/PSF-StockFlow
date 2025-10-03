# 🚀 PSF StockFlow - Inventory Management System

A modern, real-time inventory management system built with Next.js 15, Firebase, and TypeScript. PSF StockFlow provides role-based access control for admins and users to manage inventory and track shipments efficiently.

![PSF StockFlow](https://img.shields.io/badge/Next.js-15.3.3-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-11.9.1-orange?style=for-the-badge&logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?style=for-the-badge&logo=tailwind-css)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🔐 Authentication & Authorization
- **Secure Authentication** - Firebase Authentication with email/password
- **Role-Based Access Control** - Admin and User roles with different permissions
- **Unified Login** - Single login page for both admin and regular users
- **Protected Routes** - Automatic redirection based on user role

### 👥 User Management
- **Admin Dashboard** - Complete user management interface
- **User Search & Filter** - Find users by name, email, or phone
- **User Cards** - Clean, responsive user display with role badges
- **Real-time Updates** - Live user data synchronization

### 📦 Inventory Management
- **Add Inventory** - Admins can add inventory items for any user
- **Track Products** - Product name, quantity, date added, and status
- **Status Management** - In Stock/Out of Stock status tracking
- **Real-time Sync** - Live inventory updates across all users

### 🚚 Shipping System
- **Ship Inventory** - Admins can ship items from user inventory
- **Atomic Transactions** - Safe inventory updates with rollback capability
- **Pack Options** - Flexible pack sizes (1, 2, 3, 5, 10)
- **Shipping Tracking** - Date, quantity, and remarks for each shipment

### 📱 User Experience
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Modern UI** - Clean interface built with Tailwind CSS and Radix UI
- **Loading States** - Skeleton loaders and smooth transitions
- **Toast Notifications** - Real-time feedback for user actions

## 🛠 Tech Stack

### Frontend
- **Next.js 15.3.3** - React framework with App Router
- **React 18.3.1** - UI library
- **TypeScript 5.9.3** - Type safety and better development experience
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives

### Backend & Database
- **Firebase 11.9.1** - Backend-as-a-Service
- **Firebase Authentication** - User authentication
- **Firestore** - NoSQL database with real-time updates
- **Firebase Security Rules** - Database security

### Development Tools
- **React Hook Form** - Form handling and validation
- **Zod** - Schema validation
- **Lucide React** - Icon library
- **Date-fns** - Date manipulation
- **Recharts** - Data visualization

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**
- **Firebase account** (free tier available)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/digitaltechyx/PSF-StockFlow.git
   cd PSF-StockFlow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your Firebase configuration (see [Configuration](#-configuration))

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration

### Firebase Setup

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Create a project"
   - Follow the setup wizard

2. **Enable Authentication**
   - Go to Authentication → Sign-in method
   - Enable "Email/Password" provider

3. **Create Firestore Database**
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (for development)

4. **Get Firebase Configuration**
   - Go to Project Settings → General
   - Scroll down to "Your apps"
   - Click "Add app" → Web app
   - Copy the configuration object

5. **Update Environment Variables**
   ```bash
   # .env.local
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

### Firebase Security Rules

Deploy the security rules to your Firestore database:

```bash
firebase deploy --only firestore:rules
```

Or manually copy the rules from `firestore.rules` to your Firebase Console.

## 🎯 Usage

### Creating Your First Admin User

1. **Register a regular user**
   - Go to `/register`
   - Fill in the registration form
   - Complete the registration

2. **Promote to admin**
   - Go to Firebase Console → Firestore Database
   - Find your user document in the "users" collection
   - Edit the document and change `role: "user"` to `role: "admin"`
   - Save the changes

3. **Login as admin**
   - Go to `/login`
   - Use your admin credentials
   - You'll be redirected to the admin dashboard

### User Workflow

1. **Register** → Create account with email and password
2. **Login** → Access your personal dashboard
3. **View Inventory** → See assigned inventory items
4. **Track Shipments** → Monitor shipped orders

### Admin Workflow

1. **Login** → Access admin dashboard
2. **Manage Users** → Search and select users
3. **Add Inventory** → Add items to user inventory
4. **Ship Items** → Process shipments and update inventory

## 📁 Project Structure

```
PSF-StockFlow/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/             # Admin-specific pages
│   │   │   └── dashboard/      # Admin dashboard
│   │   ├── dashboard/          # User dashboard
│   │   ├── login/              # Authentication pages
│   │   └── register/
│   ├── components/             # React components
│   │   ├── admin/              # Admin-specific components
│   │   ├── dashboard/          # Dashboard components
│   │   └── ui/                 # Reusable UI components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility libraries
│   ├── types/                  # TypeScript type definitions
│   └── ai/                     # AI/Genkit integration
├── docs/                       # Documentation
├── firestore.rules            # Database security rules
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── package.json               # Dependencies and scripts
```

## 🔌 API Reference

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Data Models

#### User Profile
```typescript
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'user';
}
```

#### Inventory Item
```typescript
interface InventoryItem {
  id: string;
  productName: string;
  quantity: number;
  dateAdded: Date | string;
  status: 'In Stock' | 'Out of Stock';
}
```

#### Shipped Item
```typescript
interface ShippedItem {
  id: string;
  productName: string;
  date: Date | string;
  shippedQty: number;
  remainingQty: number;
  packOf: number;
  remarks?: string;
}
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Set environment variables**
   - Add your Firebase configuration in Vercel dashboard
   - Set all `NEXT_PUBLIC_FIREBASE_*` variables

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Build the project**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   firebase init hosting
   firebase deploy
   ```

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- **Netlify**
- **Railway**
- **Render**
- **DigitalOcean App Platform**

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Use meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. **Check the documentation** - Review this README and the docs folder
2. **Search existing issues** - Look through GitHub issues
3. **Create a new issue** - Provide detailed information about your problem
4. **Contact support** - Reach out to the development team

## 🙏 Acknowledgments

- **Next.js Team** - For the amazing React framework
- **Firebase Team** - For the comprehensive backend services
- **Radix UI Team** - For the accessible component primitives
- **Tailwind CSS Team** - For the utility-first CSS framework

---

**Made with ❤️ by the PSF StockFlow Team**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github)](https://github.com/digitaltechyx/PSF-StockFlow)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit-green?style=for-the-badge&logo=vercel)](https://psf-stockflow.vercel.app)