#!/usr/bin/env python3
"""
Sora Watermark Detection - Strict Size-Limited Approach

Detects Sora watermarks by looking for small semi-transparent white/near-white text.
Key constraints:
- Watermarks are SMALL (typically ~100-150px wide, ~30-50px tall)
- Maximum size is strictly limited to prevent over-blurring
- Uses color/opacity detection with strict size filtering
"""

import cv2
import numpy as np
import sys
import json
import os
from typing import List, Dict, Tuple, Optional


def extract_frames(video_path: str, sample_interval: float = 0.5) -> Tuple[List, List, Tuple, float]:
    """Extract frames from video at regular intervals."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0
    
    frame_interval = int(fps * sample_interval) if fps > 0 else 15
    if frame_interval < 1:
        frame_interval = 1
    
    frames = []
    timestamps = []
    frame_idx = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_idx % frame_interval == 0:
            frames.append(frame)
            timestamps.append(frame_idx / fps if fps > 0 else 0)
        
        frame_idx += 1
    
    cap.release()
    return frames, timestamps, (width, height), duration


def detect_watermark_text(frame: np.ndarray) -> List[Dict]:
    """
    Detect small semi-transparent text regions that could be watermarks.
    Uses strict size limits to avoid detecting large bright areas.
    """
    height, width = frame.shape[:2]
    
    # Maximum watermark dimensions - Sora watermarks are small
    max_watermark_w = min(200, int(width * 0.6))  # Max 60% of width or 200px
    max_watermark_h = min(80, int(height * 0.15))  # Max 15% of height or 80px
    min_watermark_w = 30  # At least 30px wide
    min_watermark_h = 10  # At least 10px tall
    
    # Convert to HSV
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # Detect near-white pixels (low saturation, high value)
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 30, 255])
    white_mask = cv2.inRange(hsv, lower_white, upper_white)
    
    # Use edge detection to find text-like structures
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    
    # Combine white mask with edges - watermarks have both
    combined = cv2.bitwise_and(white_mask, edges)
    
    # Dilate slightly to connect text characters
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (8, 4))
    dilated = cv2.dilate(combined, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    regions = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        
        # Strict size filtering
        if w < min_watermark_w or h < min_watermark_h:
            continue
        if w > max_watermark_w or h > max_watermark_h:
            continue
            
        # Aspect ratio check - text is wider than tall
        aspect_ratio = w / h if h > 0 else 0
        if aspect_ratio < 1.5 or aspect_ratio > 12:
            continue
        
        # Add small padding
        padding_x = min(15, int(w * 0.2))
        padding_y = min(10, int(h * 0.3))
        
        reg_x = max(1, x - padding_x)
        reg_y = max(1, y - padding_y)
        reg_w = min(width - reg_x - 2, w + 2 * padding_x)
        reg_h = min(height - reg_y - 2, h + 2 * padding_y)
        
        # Final size check after padding
        if reg_w <= max_watermark_w and reg_h <= max_watermark_h:
            regions.append({
                'x': reg_x,
                'y': reg_y,
                'w': reg_w,
                'h': reg_h,
                'area': w * h
            })
    
    return regions


def find_watermarks(frames: List, timestamps: List, video_size: Tuple, duration: float) -> List[Dict]:
    """
    Find all watermark regions across frames.
    Returns multiple small regions instead of one large merged region.
    """
    width, height = video_size
    all_detections = []
    
    for i, frame in enumerate(frames):
        regions = detect_watermark_text(frame)
        for region in regions:
            region['timestamp'] = timestamps[i]
        all_detections.extend(regions)
    
    if not all_detections:
        return []
    
    # Group similar detections by position (for tracking moving watermarks)
    # But DON'T merge them into one big region
    clusters = []
    
    for det in all_detections:
        matched = False
        for cluster in clusters:
            # Check if detection is close to cluster center
            cx = cluster['x'] + cluster['w'] / 2
            cy = cluster['y'] + cluster['h'] / 2
            dx = det['x'] + det['w'] / 2
            dy = det['y'] + det['h'] / 2
            
            # If centers are close, it's the same watermark
            if abs(cx - dx) < 50 and abs(cy - dy) < 30:
                cluster['count'] += 1
                matched = True
                break
        
        if not matched:
            clusters.append({
                'x': det['x'],
                'y': det['y'],
                'w': det['w'],
                'h': det['h'],
                'count': 1
            })
    
    # Keep only clusters that appear in multiple frames (persistent watermarks)
    persistent = [c for c in clusters if c['count'] >= max(2, len(frames) * 0.15)]
    
    # If no persistent clusters, use the most frequent one
    if not persistent and clusters:
        persistent = [max(clusters, key=lambda c: c['count'])]
    
    return persistent


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No video path provided'}))
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    if not os.path.exists(video_path):
        print(json.dumps({'error': f'Video file not found: {video_path}'}))
        sys.exit(1)
    
    try:
        frames, timestamps, video_size, duration = extract_frames(video_path, 0.5)
        
        if len(frames) == 0:
            print(json.dumps({'error': 'No frames extracted from video'}))
            sys.exit(1)
        
        watermarks = find_watermarks(frames, timestamps, video_size, duration)
        
        # Create segments for each detected watermark
        segments = []
        for wm in watermarks:
            segments.append({
                'x': wm['x'],
                'y': wm['y'],
                'w': wm['w'],
                'h': wm['h'],
                'start': 0,
                'end': duration
            })
        
        output = {
            'success': True,
            'video_info': {
                'width': video_size[0],
                'height': video_size[1],
                'duration': duration
            },
            'watermark_detected': len(segments) > 0,
            'segments': segments,
            'frames_analyzed': len(frames),
            'watermarks_found': len(segments)
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
