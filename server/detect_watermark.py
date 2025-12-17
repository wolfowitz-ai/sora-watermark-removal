#!/usr/bin/env python3
"""
Watermark detection script for Sora watermarks.
Uses OpenCV to detect watermark positions across video frames.
Outputs JSON with time-based position segments for FFmpeg processing.
"""

import cv2
import numpy as np
import json
import sys
import os
from typing import List, Dict, Tuple, Optional

def extract_frames(video_path: str, sample_interval: float = 0.5) -> List[Tuple[float, np.ndarray]]:
    """Extract frames from video at given interval (in seconds)."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    frames = []
    frame_interval = int(fps * sample_interval) if fps > 0 else 15
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / fps if fps > 0 else frame_idx / 30
            frames.append((timestamp, frame))
        
        frame_idx += 1
    
    cap.release()
    return frames

def detect_watermark_region(frame: np.ndarray, search_margin: int = 100) -> Optional[Dict]:
    """
    Detect potential watermark region in frame.
    Sora watermarks are typically semi-transparent text in corners.
    Returns bounding box if found, None otherwise.
    """
    height, width = frame.shape[:2]
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    corners = [
        ("bottom_right", gray[height-search_margin:, width-search_margin*2:]),
        ("bottom_left", gray[height-search_margin:, :search_margin*2]),
        ("top_right", gray[:search_margin, width-search_margin*2:]),
        ("top_left", gray[:search_margin, :search_margin*2]),
    ]
    
    best_detection = None
    best_score = 0
    
    for corner_name, roi in corners:
        if roi.size == 0:
            continue
            
        edges = cv2.Canny(roi, 50, 150)
        
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=2)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            continue
            
        text_like_contours = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = w / h if h > 0 else 0
            area = cv2.contourArea(cnt)
            
            if 0.5 < aspect_ratio < 10 and area > 100 and w > 30:
                text_like_contours.append((x, y, w, h, area))
        
        if text_like_contours:
            all_x = [c[0] for c in text_like_contours]
            all_y = [c[1] for c in text_like_contours]
            all_w = [c[0] + c[2] for c in text_like_contours]
            all_h = [c[1] + c[3] for c in text_like_contours]
            
            min_x, min_y = min(all_x), min(all_y)
            max_x, max_y = max(all_w), max(all_h)
            
            combined_area = (max_x - min_x) * (max_y - min_y)
            score = sum(c[4] for c in text_like_contours)
            
            if score > best_score and combined_area > 500:
                if corner_name == "bottom_right":
                    abs_x = width - search_margin * 2 + min_x
                    abs_y = height - search_margin + min_y
                elif corner_name == "bottom_left":
                    abs_x = min_x
                    abs_y = height - search_margin + min_y
                elif corner_name == "top_right":
                    abs_x = width - search_margin * 2 + min_x
                    abs_y = min_y
                else:
                    abs_x = min_x
                    abs_y = min_y
                
                best_detection = {
                    "x": max(0, abs_x - 10),
                    "y": max(0, abs_y - 10),
                    "w": min(max_x - min_x + 20, width - abs_x),
                    "h": min(max_y - min_y + 20, height - abs_y),
                    "corner": corner_name
                }
                best_score = score
    
    return best_detection

def detect_text_regions(frame: np.ndarray) -> List[Dict]:
    """
    Detect text-like regions using MSER (Maximally Stable Extremal Regions).
    Good for finding watermark text anywhere in frame.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    
    mser = cv2.MSER_create()
    mser.setMinArea(50)
    mser.setMaxArea(5000)
    
    regions, _ = mser.detectRegions(gray)
    
    text_regions = []
    for region in regions:
        x, y, w, h = cv2.boundingRect(region)
        aspect_ratio = w / h if h > 0 else 0
        
        if 0.2 < aspect_ratio < 15 and 10 < w < 300 and 5 < h < 100:
            margin = (height - 150, width - 200)
            if y > margin[0] or x > margin[1] or y < 100 or x < 150:
                text_regions.append({"x": x, "y": y, "w": w, "h": h})
    
    return text_regions

def cluster_detections(detections: List[Dict], threshold: int = 50) -> List[Dict]:
    """Cluster nearby detections into single bounding boxes."""
    if not detections:
        return []
    
    sorted_detections = sorted(detections, key=lambda d: (d["y"], d["x"]))
    
    clusters = []
    used = set()
    
    for i, d1 in enumerate(sorted_detections):
        if i in used:
            continue
            
        cluster = [d1]
        used.add(i)
        
        for j, d2 in enumerate(sorted_detections):
            if j in used:
                continue
            
            if (abs(d1["y"] - d2["y"]) < threshold and 
                abs(d1["x"] - d2["x"]) < threshold * 3):
                cluster.append(d2)
                used.add(j)
        
        min_x = min(d["x"] for d in cluster) - 10
        min_y = min(d["y"] for d in cluster) - 10
        max_x = max(d["x"] + d["w"] for d in cluster) + 10
        max_y = max(d["y"] + d["h"] for d in cluster) + 10
        
        clusters.append({
            "x": max(0, min_x),
            "y": max(0, min_y),
            "w": max_x - min_x,
            "h": max_y - min_y
        })
    
    return clusters

def clamp_bbox(bbox: Dict, width: int, height: int, min_size: int = 20) -> Optional[Dict]:
    """Clamp bounding box to frame bounds and validate dimensions."""
    x = max(0, int(bbox.get("x", 0)))
    y = max(0, int(bbox.get("y", 0)))
    w = int(bbox.get("w", 0))
    h = int(bbox.get("h", 0))
    
    if x >= width or y >= height:
        return None
    
    w = min(w, width - x)
    h = min(h, height - y)
    
    if w < min_size or h < min_size:
        return None
    
    result = {"x": x, "y": y, "w": w, "h": h}
    if "timestamp" in bbox:
        result["timestamp"] = bbox["timestamp"]
    if "corner" in bbox:
        result["corner"] = bbox["corner"]
    return result

def analyze_video(video_path: str) -> Dict:
    """
    Analyze video and detect watermark positions throughout.
    Returns segments with watermark positions for FFmpeg processing.
    """
    if not os.path.exists(video_path):
        return {"error": f"Video file not found: {video_path}"}
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Could not open video: {video_path}"}
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0
    cap.release()
    
    frames = extract_frames(video_path, sample_interval=0.25)
    
    if not frames:
        return {"error": "No frames extracted from video"}
    
    detections = []
    for timestamp, frame in frames:
        corner_detection = detect_watermark_region(frame)
        
        if corner_detection:
            corner_detection["timestamp"] = timestamp
            clamped = clamp_bbox(corner_detection, width, height)
            if clamped:
                detections.append(clamped)
            continue
        
        text_regions = detect_text_regions(frame)
        if text_regions:
            clusters = cluster_detections(text_regions)
            for cluster in clusters:
                cluster["timestamp"] = timestamp
                clamped = clamp_bbox(cluster, width, height)
                if clamped:
                    detections.append(clamped)
    
    if not detections:
        return {
            "success": True,
            "video_info": {
                "width": width,
                "height": height,
                "duration": duration,
                "fps": fps
            },
            "watermark_detected": False,
            "segments": [],
            "default_position": {
                "x": 10,
                "y": 10,
                "w": 200,
                "h": 50
            }
        }
    
    segments = create_segments(detections, duration)
    
    return {
        "success": True,
        "video_info": {
            "width": width,
            "height": height,
            "duration": duration,
            "fps": fps
        },
        "watermark_detected": True,
        "segments": segments
    }

def create_segments(detections: List[Dict], duration: float) -> List[Dict]:
    """
    Create time-based segments from detections.
    Each segment has a start time, end time, and watermark position.
    """
    if not detections:
        return []
    
    sorted_detections = sorted(detections, key=lambda d: d["timestamp"])
    
    segments = []
    current_segment = None
    position_threshold = 30
    
    for i, detection in enumerate(sorted_detections):
        if current_segment is None:
            current_segment = {
                "start": max(0, detection["timestamp"] - 0.25),
                "end": detection["timestamp"] + 0.25,
                "x": detection["x"],
                "y": detection["y"],
                "w": detection["w"],
                "h": detection["h"]
            }
        else:
            x_diff = abs(detection["x"] - current_segment["x"])
            y_diff = abs(detection["y"] - current_segment["y"])
            
            if x_diff < position_threshold and y_diff < position_threshold:
                current_segment["end"] = detection["timestamp"] + 0.25
                current_segment["x"] = (current_segment["x"] + detection["x"]) // 2
                current_segment["y"] = (current_segment["y"] + detection["y"]) // 2
                current_segment["w"] = max(current_segment["w"], detection["w"])
                current_segment["h"] = max(current_segment["h"], detection["h"])
            else:
                segments.append(current_segment)
                current_segment = {
                    "start": detection["timestamp"] - 0.25,
                    "end": detection["timestamp"] + 0.25,
                    "x": detection["x"],
                    "y": detection["y"],
                    "w": detection["w"],
                    "h": detection["h"]
                }
    
    if current_segment:
        segments.append(current_segment)
    
    if segments:
        segments[0]["start"] = 0
        segments[-1]["end"] = duration
    
    merged = []
    for seg in segments:
        if merged and seg["start"] <= merged[-1]["end"]:
            if (abs(seg["x"] - merged[-1]["x"]) < position_threshold and 
                abs(seg["y"] - merged[-1]["y"]) < position_threshold):
                merged[-1]["end"] = max(merged[-1]["end"], seg["end"])
                merged[-1]["w"] = max(merged[-1]["w"], seg["w"])
                merged[-1]["h"] = max(merged[-1]["h"], seg["h"])
            else:
                merged[-1]["end"] = seg["start"]
                merged.append(seg)
        else:
            merged.append(seg)
    
    return merged

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: detect_watermark.py <video_path>"}))
        sys.exit(1)
    
    video_path = sys.argv[1]
    result = analyze_video(video_path)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
