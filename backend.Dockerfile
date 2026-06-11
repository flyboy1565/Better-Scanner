FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    sane-utils \
    libsane-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY backend .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8000

# Run the app
CMD ["python", "main.py"]
