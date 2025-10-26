# pip install flask flask-cors deepface opencv-python numpy
import os, base64, numpy as np, cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace

app = Flask(__name__)
CORS(app)

# --- load cascade once (same as your Moodify.py) ---
def _load_cascade():
    cv2_path = cv2.__path__[0]
    path = os.path.join(cv2_path, "data", "haarcascade_frontalface_default.xml")
    cas = cv2.CascadeClassifier(path)
    if cas.empty():  # fallback to local file (optional)
        cas = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")
    return cas

_FACE = _load_cascade()

# map to your 1–5 UI scale
MOOD_MAP = {
    "angry": 2, "disgust": 1, "fear": 1, "sad": 2,
    "neutral": 3, "surprise": 4, "happy": 5
}

@app.route("/api/mood/predict", methods=["POST"])
def predict():
    """
    Body: { "image": "data:image/jpeg;base64,..." }  (or raw base64)
    Returns: { dominant, moodValue, scores }
    """
    data = request.get_json(force=True)
    img_b64 = data.get("image", "")
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]

    try:
        arr = np.frombuffer(base64.b64decode(img_b64), np.uint8)
        frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame_bgr is None:
            return jsonify({"error": "Invalid image"}), 400

        # face detect (largest face)
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        faces = _FACE.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
            x, y, w, h = faces[0]
            face_region = frame_bgr[y:y+h, x:x+w]
        else:
            face_region = frame_bgr  # fallback: whole frame

        res = DeepFace.analyze(
            img_path=face_region,
            actions=["emotion"],
            enforce_detection=False,
            silent=True
        )
        if isinstance(res, list):
            res = res[0]

        dominant = (res.get("dominant_emotion") or "neutral").lower()
        scores = res.get("emotion", {})
        mood_value = MOOD_MAP.get(dominant, 3)

        return jsonify({"dominant": dominant, "moodValue": mood_value, "scores": scores})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5055, debug=False)
