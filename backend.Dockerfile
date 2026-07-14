FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    sane-utils \
    libsane-dev \
    libgl1 \
    gcc \
    sane-airscan \
    avahi-daemon \
    avahi-utils \
    nmap \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY backend .

# Make startup script executable
RUN chmod +x /app/docker-start.sh

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8000

# Run the app (startup script starts dbus + avahi first)
CMD ["/app/docker-start.sh"]
