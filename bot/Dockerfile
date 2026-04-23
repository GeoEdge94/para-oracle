# Challenger bot — image minimale, volontairement sans FastAPI/SQLAlchemy.
# Multi-stage: builder installs wheels (web3/eth-account need their native deps),
# runtime is distroless-ish with a non-root user + the bot source only.
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build
COPY requirements.txt .
RUN pip install --prefix=/install --no-warn-script-location -r requirements.txt

FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:${PATH}" \
    PYTHONPATH="/bot:/install/lib/python3.12/site-packages"

RUN groupadd -r challenger \
 && useradd -r -g challenger -u 10002 -m -d /home/challenger -s /sbin/nologin challenger \
 && mkdir -p /bot \
 && chown -R challenger:challenger /bot

COPY --from=builder /install /install
COPY --chown=challenger:challenger challenger.py dispute_client.py /bot/

WORKDIR /bot
USER challenger

CMD ["python", "challenger.py"]
