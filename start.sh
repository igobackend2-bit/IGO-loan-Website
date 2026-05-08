#!/bin/bash

# IGO Website Startup Script for Hostinger
# This script starts the Node.js server using PM2

echo "🚀 Starting IGO Website Server..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# Start the server with PM2
echo "🔥 Starting server with PM2..."
pm2 start server.js --name "igo-website" --restart-delay=3000

# Save PM2 config
pm2 save

echo "✅ Server started successfully!"
echo "📡 Check status: pm2 status"
echo "📋 View logs: pm2 logs igo-website"
echo "🛑 Stop server: pm2 stop igo-website"
echo "🔄 Restart server: pm2 restart igo-website"
