#!/bin/bash

# Multi-Store Query Mediator - Setup and Start Script

echo "🚀 Multi-Store Query Mediator - Setup & Start"
echo "================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install root dependencies
echo ""
echo "📦 Installing root dependencies..."
npm install --silent

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install --silent
cd ..

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

# Create data directory
echo ""
echo "📁 Creating data directory..."
mkdir -p data

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 To start the application, run:"
echo "   npm run dev          (Both backend & frontend)"
echo "   npm run backend:dev  (Backend only)"
echo "   npm run frontend:dev (Frontend only)"
echo ""
echo "🌐 Frontend will be available at: http://localhost:5173"
echo "🔌 Backend API at: http://localhost:5000/api"
echo ""
