# Code Analyzer Pro - React UI

A modern, professional React interface for the Code Analyzer application built with Material-UI and TypeScript.

## ✨ Features

- 🎨 **Modern Design**: Material-UI components with custom theming
- 📱 **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- 🎯 **Drag & Drop**: Intuitive file upload with visual feedback
- 🔧 **Advanced Settings**: Multiple extraction methods and custom prompts
- 📊 **Rich Analytics**: Comprehensive code analysis with interactive results
- 🔒 **Security Focus**: Dedicated security vulnerability detection
- ⚡ **Performance Insights**: Performance optimization suggestions
- 🎭 **Beautiful Animations**: Smooth transitions and loading states
- 📋 **Copy-to-Clipboard**: Easy code copying functionality
- 🕰️ **Real-time Status**: Backend connectivity monitoring

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend Setup

Ensure the backend server is running on `http://localhost:5000`

## 🏗️ Project Structure

```
src/
├── components/           # React components
│   ├── CodeAnalyzer.tsx     # Main application component
│   ├── ImageUpload.tsx      # Drag & drop file upload
│   ├── AnalysisSettings.tsx # Extraction methods & prompts
│   ├── AnalysisResults.tsx  # Results display
│   └── BackendStatus.tsx    # Connection status indicator
├── services/
│   └── api.ts               # API service layer
├── types/
│   └── index.ts             # TypeScript definitions
└── App.tsx                  # Main app with theme provider
```

## 🔧 Configuration

Environment Variables in `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 🛠️ Technologies

- **React 18** with TypeScript
- **Material-UI** for components
- **Vite** for build tooling
- **Axios** for API calls
- **React Dropzone** for file upload