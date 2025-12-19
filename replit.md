# Sora Video Downloader

## Overview

A web application for marketing teams to easily download Sora-generated videos. Users paste Sora public links, and the app generates direct download URLs with video previews.

## User Preferences

Preferred communication style: Simple, everyday language.

## Current Implementation Status

**FULLY FUNCTIONAL** - The application is complete with:
- Textarea for pasting multiple Sora URLs
- Automatic URL transformation (sora.chatgpt.com → oscdn2.dyysy.com)
- Video preview grid with playback controls
- Individual and bulk download options
- Select all / remove functionality
- Dark/light mode toggle
- Collapsible instructions panel
- Auto-paste from clipboard feature

### URL Transformation Logic
- Input: `https://sora.chatgpt.com/p/s_6944b4e29038819187a5eecf46545ba7`
- Output: `https://oscdn2.dyysy.com/MP4/s_6944b4e29038819187a5eecf46545ba7.mp4`

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
- **Minimal Backend**: Only serves health check endpoint - all logic is client-side
- **No Database Required**: URL transformation is stateless

### Key Components
- **client/src/components/Header.tsx** - App header with theme toggle
- **client/src/components/VideoCard.tsx** - Individual video preview with download
- **client/src/pages/Home.tsx** - Main page with URL input and video grid
- **shared/schema.ts** - SoraVideo interface and URL transformation helpers

### Key Design Decisions

**Frontend-Only Processing**: All URL transformation happens client-side. No server processing or storage required.

**Video Preview**: Uses HTML5 video element with the transformed download URL as source.

**Bulk Operations**: Support for select all, remove selected, and download all/selected.

## Recent Changes

- 2024-12: Pivoted from watermark removal to Sora video downloader
- Simplified architecture to frontend-only URL transformation
- Removed FFmpeg, file upload, and keyframe infrastructure
