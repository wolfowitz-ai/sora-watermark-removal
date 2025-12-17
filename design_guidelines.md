# Design Guidelines: Watermark Removal Web Application

## Design Approach
**Utility-Focused Design System** inspired by modern file processing tools (WeTransfer, Dropbox Paper, Linear). Professional, efficient interface prioritizing workflow clarity and status communication.

## Core Design Principles
- **Clarity First**: Every state (uploading, processing, complete) must be immediately obvious
- **Confidence Building**: Visual polish reassures marketing team they're using professional tooling
- **Workflow Optimization**: Minimal clicks from upload to download

---

## Typography
**Primary Font**: Inter (Google Fonts)
- Headings: 600 weight, 2.5rem (main title), 1.5rem (section headers)
- Body: 400 weight, 1rem (labels/descriptions), 0.875rem (status text)
- Monospace: JetBrains Mono for file names/technical details

---

## Layout System
**Spacing Units**: Tailwind 4, 6, 8, 12, 16 units (p-4, mb-8, gap-6, etc.)

**Container Structure**:
- Maximum width: max-w-4xl centered
- Vertical padding: py-12 (mobile), py-20 (desktop)
- Card padding: p-6 (mobile), p-8 (desktop)

---

## Component Library

### Upload Zone (Primary Component)
- Large dropzone area: min-h-64 with dashed border
- Icon: Upload cloud icon (Heroicons - use exclusively throughout)
- Primary text: "Drag & drop video files here"
- Secondary text: "or click to browse • MP4, MOV up to 500MB"
- Drag-over state: Solid border, subtle scale transform

### Processing Queue Card
Each file displays:
- Thumbnail preview (video first frame)
- File name with truncation
- File size and format badge
- Progress bar with percentage
- Status indicator (dot with text: "Uploading", "Processing", "Ready")
- Action buttons: Download (when ready) or Cancel (during processing)

### Status Indicators
- Uploading: Animated progress bar
- Processing: Pulsing icon with estimated time
- Complete: Checkmark with "Download" button
- Error: Alert icon with error message and "Retry" button

### Navigation Header
- Logo/app name on left
- "New Upload" button (secondary action) on right
- Clean, minimal: h-16 with border-bottom

### Empty State
When no files uploaded:
- Centered illustration placeholder
- "No files yet" heading
- "Upload your first video to get started" subtext

---

## Interactions & Microanimations
**Minimal Approach** - animations only where they communicate state:
- Upload zone: Scale on drag-over
- Progress bars: Smooth fill animation
- Success state: Single checkmark fade-in
- No decorative animations

---

## Images
**No hero image required** - This is a utility application focused on workflow.

**Icons**: Use Heroicons CDN throughout
- Upload: cloud-arrow-up
- Processing: cog-6-tooth (spinning)
- Complete: check-circle
- Error: exclamation-circle
- Download: arrow-down-tray

---

## Accessibility
- All states announced to screen readers
- Keyboard navigation for upload trigger
- Clear focus states on interactive elements
- ARIA labels for status indicators and progress bars

---

## Page Structure

**Single-Page Layout**:
1. **Header** (h-16): Logo + New Upload button
2. **Main Container** (max-w-4xl, centered):
   - Upload dropzone (always visible at top)
   - Processing queue (stacked cards, newest first)
   - Empty state (when queue empty)
3. **Footer** (minimal): Usage info or company branding

**Workflow States**:
- Initial: Large dropzone, empty state message
- Active: Dropzone compressed (min-h-32), queue visible below
- Multiple files: Scrollable queue with latest on top

---

## Professional Polish Elements
- Subtle shadows on cards (shadow-sm)
- Rounded corners: rounded-lg for cards, rounded-xl for main container
- Border treatment: border with neutral tone
- File badges: Small pills with format/size info
- Hover states: Subtle background transitions on interactive elements

This utility application prioritizes functional clarity over visual spectacle, ensuring marketing teams can efficiently process files with confidence in a professional, polished interface.