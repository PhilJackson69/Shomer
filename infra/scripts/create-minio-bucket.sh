#!/bin/bash
# Create MinIO bucket for development

echo "🪣 Creating MinIO bucket..."

# Wait for MinIO to be ready
until curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Install mc (MinIO Client) if not present
if ! command -v mc &> /dev/null; then
  echo "Installing MinIO Client..."
  docker run --rm --entrypoint sh minio/mc -c "
    mc alias set local http://minio:9000 minioadmin minioadmin
    mc mb local/shomer-uploads --ignore-existing
    mc anonymous set download local/shomer-uploads
    echo '✅ Bucket created and configured'
  "
else
  # Use local mc
  mc alias set local http://localhost:9000 minioadmin minioadmin
  mc mb local/shomer-uploads --ignore-existing
  mc anonymous set download local/shomer-uploads
  echo "✅ Bucket created and configured"
fi

