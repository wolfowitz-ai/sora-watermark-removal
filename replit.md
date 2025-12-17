# Watermark Remover

## Overview

A web application designed for marketing teams to remove Sora watermarks from in-house generated video content. Users upload video files through a drag-and-drop interface, the system processes them using FFmpeg to remove watermarks, and provides downloadable results. The application emphasizes workflow clarity, professional polish, and minimal clicks from upload to download.

## User Preferences

Preferred communication style: Simple, everyday language.

## Current Implementation Status

**FULLY FUNCTIONAL** - The application is complete with:
- Drag-and-drop video upload interface
- **Manual keyframe marking system** for precise watermark region selection
- Video preview with timeline scrubbing and bounding box drawing
- FFmpeg-based watermark removal with time-based position segments
- Real-time processing status with progress tracking
- Download processed videos
- Job queue with concurrency limiting (max 2 concurrent jobs)
- Dark/light mode toggle
- Error handling with retry functionality

### Manual Keyframe System
The application uses a manual keyframe approach for accurate watermark removal:
1. User uploads video - job goes to "Ready to edit" state
2. User opens VideoEditor to preview video with timeline controls
3. User draws bounding boxes on frames where watermark appears
4. Each keyframe stores: start time, end time, x, y, width, height
5. Processing generates time-based FFmpeg delogo filters from keyframes
6. Each keyframe region is removed only during its specified time range

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state with automatic polling (2-second intervals for job status updates)
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite with React plugin and path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **File Handling**: Multer for multipart file uploads with disk storage
- **Processing Queue**: In-memory queue with configurable max concurrent jobs (MAX_CONCURRENT_JOBS = 2)
- **Video Processing**: FFmpeg via child process spawning

### API Structure
- `POST /api/upload` - Upload video files (accepts MP4, MOV, AVI, WebM up to 500MB)
- `GET /api/jobs` - List all video processing jobs
- `GET /api/jobs/:id` - Get specific job status
- `GET /api/jobs/:id/video` - Stream original video for preview/editing
- `DELETE /api/jobs/:id` - Cancel/delete a job
- `GET /api/jobs/:id/download` - Download processed video
- `POST /api/jobs/:id/retry` - Retry a failed job
- `GET /api/jobs/:id/keyframes` - Get keyframes for a job
- `POST /api/jobs/:id/keyframes` - Create a new keyframe
- `PUT /api/keyframes/:id` - Update a keyframe
- `DELETE /api/keyframes/:id` - Delete a keyframe
- `POST /api/jobs/:id/process` - Start processing with manual keyframes

### Data Storage
- **Schema**: Drizzle ORM with PostgreSQL dialect (shared/schema.ts)
- **Current Storage**: In-memory storage implementation (MemStorage class in server/storage.ts)
- **File Storage**: Local filesystem (uploads/ and processed/ directories)

### Key Components
- **client/src/components/Header.tsx** - App header with theme toggle
- **client/src/components/UploadDropzone.tsx** - Drag-and-drop file upload
- **client/src/components/FileCard.tsx** - Individual job status display with edit button
- **client/src/components/VideoEditor.tsx** - Video preview with keyframe drawing UI
- **client/src/components/EmptyState.tsx** - Empty queue state
- **client/src/pages/Home.tsx** - Main page with all functionality
- **server/routes.ts** - All API endpoints and FFmpeg processing
- **shared/schema.ts** - Data models including WatermarkKeyframe

### Key Design Decisions

**Monorepo Structure**: Client, server, and shared code in a single repository with path aliases for clean imports.

**In-Memory Storage**: Uses in-memory storage for simplicity. Database schema defined for future persistence if needed.

**Job Queue System**: Simple queue with concurrency limits (2 max) to prevent server overload. Jobs track status and progress.

**Real-time Updates**: Frontend polls /api/jobs every 2 seconds for status updates.

## External Dependencies

### System
- **FFmpeg**: Required for video processing (installed via Nix)
- **Python 3.11**: With OpenCV for watermark detection

### Frontend Libraries
- **@tanstack/react-query**: Server state management with polling
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library

### Backend Libraries
- **multer**: File upload handling with disk storage
- **child_process**: FFmpeg spawning for video processing