# Sora Video Downloader

## Overview

A mobile-friendly web application for internal marketing team use to download Sora-generated videos. Users paste Sora public links, view video previews with prompts, and download directly to their device.

## User Preferences

- Preferred communication style: Simple, everyday language
- Primary use case: iPhone/mobile usage
- Internal use only (no onboarding needed)

## Current Implementation Status

**FULLY FUNCTIONAL** - The application is complete with:
- Mobile-first responsive design
- Textarea for pasting multiple Sora URLs
- Automatic URL transformation with prompt fetching
- Compact video list with thumbnails, video IDs, and prompts
- Copy prompt functionality
- Auto-download to device (via backend proxy with Content-Disposition)
- Dark/light mode toggle
- Success/failure status display

### URL Transformation Logic
- Input: `https://sora.chatgpt.com/p/s_6944b4e29038819187a5eecf46545ba7`
- Download: `https://oscdn2.dyysy.com/MP4/s_6944b4e29038819187a5eecf46545ba7.mp4`
- Prompts are fetched from the Sora page metadata

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: Local React state (no server persistence needed)
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite with React plugin and path aliases

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Endpoints**:
  - `GET /api/health` - Health check
  - `GET /api/prompt/:videoId` - Fetch prompt from Sora page
  - `GET /api/download/:videoId` - Proxy download with Content-Disposition header

### Key Components
- **client/src/components/Header.tsx** - App header with theme toggle
- **client/src/components/VideoCard.tsx** - Compact video row with thumbnail, ID, prompt, copy button, download
- **client/src/pages/Home.tsx** - Main page with URL input and video list
- **server/routes.ts** - Backend API routes for prompt fetching and download proxy
- **shared/schema.ts** - SoraVideo interface and URL transformation helpers

### Key Design Decisions

**Mobile-First Design**: Optimized for iPhone usage with compact, touch-friendly layout.

**Backend Proxy for Downloads**: Uses Content-Disposition header to force downloads instead of opening in new window.

**Prompt Fetching**: Scrapes Sora page metadata to extract video prompts.

**No Instructions Panel**: Removed for internal use simplicity.

## Recent Changes

- 2024-12-19: Added mobile-first design, prompt fetching, auto-download
- 2024-12-19: Removed instructions panel for internal use
- 2024-12-19: Added backend proxy endpoints
- 2024-12: Pivoted from watermark removal to Sora video downloader
