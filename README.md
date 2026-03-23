# CerebroScan — Frontend

A React-based web interface for CerebroScan, an educational tool for Alzheimer's disease stage classification using deep learning analysis of brain MRI scans.

## What It Does

- Upload brain MRI images via drag & drop, file picker, or paste (Ctrl+V)
- Select from multiple CNN models (Atlas, Orion, Pulse) for classification
- Classifies scans into 4 stages: Normal, Very Mild, Mild, and Moderate Dementia
- Displays confidence scores and flags low-confidence results as "Uncertain"
- Shows all prediction probabilities for uncertain results

> **Disclaimer:** For educational purposes only. Not intended for clinical diagnosis. Always consult a healthcare professional.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

## Getting Started

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The frontend expects the backend API to be running. Configure the API base URL in `src/config.ts`.

## Team

| Name | Role |
|---|---|
| Fatma Al-Zahraa Emad | Developer |
| Gehad Mohamed | Developer |
| Hebatullah El Gazoly | Developer |
| Mohamed Assem | Developer |
| Mohamed Sameh | Developer |

**Supervisor:** Prof. Muhammad Sayed Hammad
**Teaching Assistant:** Eng. Heidi Ahmed
