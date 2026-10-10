#!/usr/bin/env bash
set -e

REPO_NAME="Upgraded-6-side-AOI-under-test"

if [ -z "$1" ]; then
  echo "=========================================================="
  echo " GitHub Push Helper for: $REPO_NAME"
  echo "=========================================================="
  echo "Usage option 1 (Automatic repo creation & push with Token):"
  echo "  ./push_to_github.sh <YOUR_GITHUB_USERNAME> <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>"
  echo ""
  echo "Usage option 2 (Push to existing remote URL):"
  echo "  ./push_to_github.sh <FULL_GIT_REMOTE_URL>"
  echo "  Example: ./push_to_github.sh https://github.com/myuser/$REPO_NAME.git"
  echo "=========================================================="
  exit 1
fi

if [[ "$1" == http* || "$1" == git@* ]]; then
  REMOTE_URL="$1"
  echo "Setting remote to $REMOTE_URL..."
  git remote remove origin 2>/dev/null || true
  git remote add origin "$REMOTE_URL"
  git branch -M main
  git push -u origin main
  echo "Successfully pushed to $REMOTE_URL!"
else
  USERNAME="$1"
  TOKEN="$2"
  if [ -z "$TOKEN" ]; then
    echo "Error: Token missing. Run: ./push_to_github.sh <USERNAME> <TOKEN>"
    exit 1
  fi

  echo "1. Checking/creating GitHub repository '$REPO_NAME' under account '$USERNAME'..."
  HTTP_CODE=$(curl -s -o /tmp/gh_resp.json -w "%{http_code}" \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{\"name\": \"$REPO_NAME\", \"description\": \"Upgraded 6-side AOI - under test\", \"private\": false}")

  if [ "$HTTP_CODE" -eq 201 ]; then
    echo "Repository successfully created on GitHub!"
  elif [ "$HTTP_CODE" -eq 422 ]; then
    echo "Repository '$REPO_NAME' already exists on your GitHub account, proceeding to push..."
  else
    echo "GitHub API returned status $HTTP_CODE:"
    cat /tmp/gh_resp.json
    echo ""
  fi

  REMOTE_URL="https://${USERNAME}:${TOKEN}@github.com/${USERNAME}/${REPO_NAME}.git"
  echo "2. Setting git remote origin..."
  git remote remove origin 2>/dev/null || true
  git remote add origin "$REMOTE_URL"
  git branch -M main
  echo "3. Pushing branch main to GitHub..."
  git push -u origin main
  echo "=========================================================="
  echo " Successfully pushed to https://github.com/${USERNAME}/${REPO_NAME} !"
  echo "=========================================================="
fi
