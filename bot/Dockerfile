# Challenger bot — image minimale, volontairement sans FastAPI/SQLAlchemy.
FROM python:3.12-slim-bookworm

WORKDIR /bot

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY challenger.py .

ENV PYTHONUNBUFFERED=1

CMD ["python", "challenger.py"]
