#!/bin/bash
# Git Setup Script for Company Management UI

echo "🚀 Setting up Git repository..."

# Initialize Git
echo "📦 Initializing Git repository..."
git init

# Add all files
echo "➕ Adding all project files..."
git add .

# Check if we have files to commit
if git diff --cached --quiet; then
    echo "⚠️  No changes to commit. Repository may already be initialized."
else
    # Commit the project
    echo "💾 Creating initial commit..."
    git commit -m "Initial commit: Design Company Management UI with all fixes"
    echo "✅ Initial commit created successfully!"
fi

echo ""
echo "📝 Next steps:"
echo "1. Go to https://github.com/new"
echo "2. Create a new repository named 'company-management-ui' (or any name)"
echo "3. Keep it Public"
echo "4. Do NOT initialize with README"
echo "5. Then run these commands (replace YOUR_USERNAME and YOUR_REPO_NAME):"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "✅ Git repository initialized successfully!"

