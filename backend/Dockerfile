FROM python:3.12-slim

# System deps for rasterio/GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev \
    libgeos-dev libproj-dev \
    build-essential \
    curl \
 && rm -rf /var/lib/apt/lists/*

ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
