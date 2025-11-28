#!/bin/bash
# Complete Git Setup and Push to GitHub Script

echo "🚀 Starting Git setup and GitHub push..."

# Step 1: Initialize Git
echo "📦 Step 1: Initializing Git repository..."
git init

# Step 2: Add all files
echo "➕ Step 2: Adding all project files..."
git add .

# Step 3: Create initial commit
echo "💾 Step 3: Creating initial commit..."
git commit -m "Initial commit: Design Company Management UI with all fixes"

# Step 4: Add remote origin
echo "🔗 Step 4: Adding GitHub remote..."
git remote add origin https://github.com/Specialise-Products/Design-Company-Management.git

# Step 5: Rename branch to main
echo "🌿 Step 5: Renaming branch to main..."
git branch -M main

# Step 6: Push to GitHub
echo "⬆️  Step 6: Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ All done! Your code is now on GitHub at:"
echo "   https://github.com/Specialise-Products/Design-Company-Management.git"

