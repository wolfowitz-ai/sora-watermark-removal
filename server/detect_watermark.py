#!/usr/bin/env python3
"""
Sora Watermark Detection - Color and Opacity Based Approach

Detects Sora watermarks by looking for semi-transparent white/near-white text
in the top portion of the video frame. Sora watermarks are typically:
- Near-white color (#f4f4f4 to #ffffff)
- Semi-transparent (45-65% opacity)
- Located in top 35% of frame (usually top-center or top-right)
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


def detect_white_overlay_regions(frame: np.ndarray) -> List[Dict]:
    """
    Detect semi-transparent white overlay regions across the entire frame.
    
    Sora watermarks are near-white with low saturation and high value.
    We use HSV color space to isolate these pixels.
    """
    height, width = frame.shape[:2]
    
    # Analyze the full frame for watermarks at any position
    top_region = frame
    top_height = height
    
    # Convert to HSV for better color isolation
    hsv = cv2.cvtColor(top_region, cv2.COLOR_BGR2HSV)
    
    # Sora watermarks are near-white: low saturation, high value
    # H: any (white has no hue), S: 0-40 (low saturation), V: 180-255 (high brightness)
    lower_white = np.array([0, 0, 180])
    upper_white = np.array([180, 40, 255])
    white_mask = cv2.inRange(hsv, lower_white, upper_white)
    
    # Also check for slightly gray watermarks (common with opacity blending)
    lower_gray = np.array([0, 0, 150])
    upper_gray = np.array([180, 50, 220])
    gray_mask = cv2.inRange(hsv, lower_gray, upper_gray)
    
    combined_mask = cv2.bitwise_or(white_mask, gray_mask)
    
    # Apply background subtraction to isolate overlay
    # Blur the original and subtract to find overlaid text
    blurred = cv2.GaussianBlur(top_region, (51, 51), 0)
    diff = cv2.absdiff(top_region, blurred)
    diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    
    # Threshold the difference to find text-like regions
    _, diff_thresh = cv2.threshold(diff_gray, 15, 255, cv2.THRESH_BINARY)
    
    # Combine color mask with difference detection
    final_mask = cv2.bitwise_and(combined_mask, diff_thresh)
    
    # Apply morphological operations to clean up
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_CLOSE, kernel)
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_OPEN, kernel)
    
    # Dilate to connect nearby text characters
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 8))
    final_mask = cv2.dilate(final_mask, dilate_kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(final_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    regions = []
    min_area = (width * top_height) * 0.001  # Min 0.1% of top region
    max_area = (width * top_height) * 0.15   # Max 15% of top region
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if min_area < area < max_area:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Watermark text should be wider than tall (aspect ratio check)
            aspect_ratio = w / h if h > 0 else 0
            if aspect_ratio > 1.5 and aspect_ratio < 15:  # Text-like proportions
                # Add padding
                padding_x = int(w * 0.3)
                padding_y = int(h * 0.5)
                
                # Ensure coordinates are at least 1 (FFmpeg requirement)
                reg_x = max(1, x - padding_x)
                reg_y = max(1, y - padding_y)
                reg_w = min(width - reg_x - 2, w + 2 * padding_x)
                reg_h = min(top_height - reg_y - 2, h + 2 * padding_y)
                
                if reg_w > 10 and reg_h > 10:
                    regions.append({
                        'x': reg_x,
                        'y': reg_y,
                        'w': reg_w,
                        'h': reg_h,
                        'confidence': min(1.0, area / min_area / 10)
                    })
    
    return regions


def find_persistent_watermark(frames: List, timestamps: List, video_size: Tuple, duration: float) -> Dict:
    """
    Find watermark regions that persist across multiple frames.
    
    Watermarks should appear in similar positions across the video.
    """
    width, height = video_size
    all_detections = []
    
    for i, frame in enumerate(frames):
        regions = detect_white_overlay_regions(frame)
        for region in regions:
            region['timestamp'] = timestamps[i]
        all_detections.extend(regions)
    
    if not all_detections:
        # No detections - return a default center position
        # FFmpeg requires x,y to be at least 1
        return {
            'found': False,
            'fallback': True,
            'x': max(1, int(width * 0.1)),
            'y': max(1, int(height * 0.1)),
            'w': min(int(width * 0.8), width - 3),
            'h': min(int(height * 0.15), height - 3),
            'confidence': 0.3,
            'method': 'fallback_center'
        }
    
    # Cluster detections by position to find persistent watermarks
    clusters = []
    
    for det in all_detections:
        merged = False
        for cluster in clusters:
            # Check if detection overlaps with cluster center
            cx, cy, cw, ch = cluster['x'], cluster['y'], cluster['w'], cluster['h']
            dx, dy, dw, dh = det['x'], det['y'], det['w'], det['h']
            
            # Calculate overlap
            overlap_x = max(0, min(cx + cw, dx + dw) - max(cx, dx))
            overlap_y = max(0, min(cy + ch, dy + dh) - max(cy, dy))
            overlap_area = overlap_x * overlap_y
            
            det_area = dw * dh
            if det_area > 0 and overlap_area / det_area > 0.3:
                # Merge into cluster - expand bounds
                new_x = min(cx, dx)
                new_y = min(cy, dy)
                new_w = max(cx + cw, dx + dw) - new_x
                new_h = max(cy + ch, dy + dh) - new_y
                
                cluster['x'] = new_x
                cluster['y'] = new_y
                cluster['w'] = new_w
                cluster['h'] = new_h
                cluster['count'] += 1
                cluster['confidence'] = max(cluster['confidence'], det['confidence'])
                merged = True
                break
        
        if not merged:
            clusters.append({
                'x': det['x'],
                'y': det['y'],
                'w': det['w'],
                'h': det['h'],
                'count': 1,
                'confidence': det['confidence']
            })
    
    # Find the most persistent cluster (appears in most frames)
    if clusters:
        best_cluster = max(clusters, key=lambda c: c['count'] * c['confidence'])
        
        # Only use if detected in at least 20% of frames
        if best_cluster['count'] >= max(2, len(frames) * 0.2):
            return {
                'found': True,
                'fallback': False,
                'x': best_cluster['x'],
                'y': best_cluster['y'],
                'w': best_cluster['w'],
                'h': best_cluster['h'],
                'confidence': best_cluster['confidence'],
                'detections': best_cluster['count'],
                'method': 'color_opacity_detection'
            }
    
    # Fallback to default center position
    return {
        'found': False,
        'fallback': True,
        'x': max(1, int(width * 0.1)),
        'y': max(1, int(height * 0.1)),
        'w': min(int(width * 0.8), width - 3),
        'h': min(int(height * 0.15), height - 3),
        'confidence': 0.3,
        'method': 'fallback_center'
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No video path provided'}))
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    if not os.path.exists(video_path):
        print(json.dumps({'error': f'Video file not found: {video_path}'}))
        sys.exit(1)
    
    try:
        # Extract frames at 0.5 second intervals
        frames, timestamps, video_size, duration = extract_frames(video_path, 0.5)
        
        if len(frames) == 0:
            print(json.dumps({'error': 'No frames extracted from video'}))
            sys.exit(1)
        
        # Find persistent watermark
        result = find_persistent_watermark(frames, timestamps, video_size, duration)
        
        # Create segments for the full video duration
        segments = [{
            'x': result['x'],
            'y': result['y'],
            'w': result['w'],
            'h': result['h'],
            'start': 0,
            'end': duration
        }]
        
        output = {
            'success': True,
            'video_info': {
                'width': video_size[0],
                'height': video_size[1],
                'duration': duration
            },
            'watermark_detected': result['found'],
            'watermark': result,
            'segments': segments,
            'frames_analyzed': len(frames)
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
