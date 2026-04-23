# syntax=docker/dockerfile:1.7

# ---------- Builder : install Python deps into an isolated prefix ----------
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# rasterio / shapely / pyproj ship manylinux wheels with bundled GDAL/GEOS/PROJ.
# psycopg2-binary bundles libpq. No native toolchain or -dev headers needed.
WORKDIR /build
COPY requirements.txt .
RUN pip install --prefix=/install --no-warn-script-location -r requirements.txt

# ---------- Runtime base : minimal, non-root ----------
FROM python:3.12-slim-bookworm AS runtime-base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:${PATH}" \
    PYTHONPATH="/app:/install/lib/python3.12/site-packages"

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r para \
 && useradd -r -g para -u 10001 -m -d /home/para -s /sbin/nologin para \
 && mkdir -p /app /data \
 && chown -R para:para /app /data

COPY --from=builder /install /install
COPY --chown=para:para entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app

# ---------- Dev target : hot reload, source mounted as volume ----------
FROM runtime-base AS dev
USER para
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------- Prod target : source baked in, healthcheck ----------
FROM runtime-base AS prod
COPY --chown=para:para . /app
USER para
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/oracle/status || exit 1
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
