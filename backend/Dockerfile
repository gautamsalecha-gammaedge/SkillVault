# SkillVault backend — FastAPI + Postgres + Chroma
FROM python:3.12-slim

# poppler-utils -> pdf2image, tesseract-ocr -> pytesseract (see requirements.txt notes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so this layer is cached unless requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Persisted at runtime via volumes (see docker-compose.yml):
#   ./chroma_db  -> vector store (CHROMA_PATH in config.py)
#   ./uploads    -> videos / images / interview audio / manuals
RUN mkdir -p chroma_db uploads/videos uploads/images uploads/interview_audio

RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]