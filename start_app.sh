#!/bin/bash

# Check if node_modules exists, install dependencies if not
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the application
echo "Starting TuAmigo Desktop..."
npm run dev
