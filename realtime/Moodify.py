import cv2
from deepface import DeepFace
import os
import numpy as np

# --- Configuration for Display ---
WINDOW_NAME = 'Real-Time Emotion Detector (Press Q to Quit)'
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 1
TEXT_COLOR = (0, 255, 0) # Bright Green
TEXT_THICKNESS = 2
BOX_COLOR = (255, 0, 0) # Blue for face box
BOX_THICKNESS = 2

# --- Core Function ---

def process_frame_for_emotion(frame, face_cascade):
    """
    Detects emotion and annotates the frame.
    Returns: detected_emotion, annotated_frame
    """
    frame_bgr = frame.copy()
    emotion = "No Face Detected"

    try:
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # Process only the largest face
        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            x, y, w, h = faces[0]
            
            # Draw rectangle around the face
            cv2.rectangle(frame_bgr, (x, y), (x+w, y+h), BOX_COLOR, BOX_THICKNESS)
            
            # Extract face region for DeepFace
            face_region = frame_bgr[y:y+h, x:x+w]
            
            if face_region.size > 0:
                # Analyze emotion using DeepFace
                # We analyze on the face region directly to save processing time
                obj = DeepFace.analyze(img_path=face_region, actions=['emotion'], enforce_detection=False, silent=True)
                
                # Handle results
                if isinstance(obj, list) and len(obj) > 0:
                    # Get the dominant emotion
                    emotion = obj[0].get('dominant_emotion', 'Unknown')
                elif isinstance(obj, dict):
                    emotion = obj.get('dominant_emotion', 'Unknown')
                
                # Put emotion label right above the face box
                label_pos = (x, y - 10)
                cv2.putText(frame_bgr, emotion.upper(), label_pos, FONT, 0.7, TEXT_COLOR, TEXT_THICKNESS, cv2.LINE_AA)
                
    except Exception as e:
        # print(f"Processing error: {e}") # Uncomment for debugging
        emotion = "Error"

    return emotion, frame_bgr

# --- Main Application Loop ---

def main_realtime_emotion():
    """Main function to run the real-time emotion detection application."""
    
    # 1. Load the Cascade Classifier for Face Detection
    try:
        # Attempt to find the standard OpenCV Haarcascade path
        cv2_path = cv2.__path__[0]
        haarcascade_path = os.path.join(cv2_path, 'data', 'haarcascade_frontalface_default.xml')
        face_cascade = cv2.CascadeClassifier(haarcascade_path)
        if face_cascade.empty():
             # Fallback if path is wrong but file exists locally
            face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')
    except Exception:
        print("Error: Could not load haarcascade file. Ensure OpenCV data files are accessible.")
        return

    # 2. Initialize Video Capture
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("Real-time Emotion Detector started.")
    print(f"Look at the camera. Press 'q' to quit the '{WINDOW_NAME}' window.")

    # 3. Main Processing Loop
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Flip the frame for a mirror view
        frame = cv2.flip(frame, 1)

        # Process the frame to get emotion and annotated frame
        emotion, annotated_frame = process_frame_for_emotion(frame, face_cascade)

        # 4. Display the Frame
        cv2.imshow(WINDOW_NAME, annotated_frame)

        # Check for 'q' key press to exit the loop
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # 5. Release Resources
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    # Ensure you have the 'deepface' library installed: pip install deepface
    # And OpenCV: pip install opencv-python
    main_realtime_emotion()