
# Stage 1: build wheels. Compilers live here and never reach the final image.
FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Stage 2: the runtime image
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# libpq5: runtime library for psycopg2. tzdata: ZoneInfo("Asia/Ho_Chi_Minh") needs it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 app
WORKDIR /app

COPY requirements.txt .
RUN --mount=type=bind,from=builder,source=/wheels,target=/wheels \
    pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt

COPY --chown=app:app . .
# Uploaded posters land here; compose mounts a named volume on this path.
RUN mkdir -p static/posters && chown -R app:app static

USER app
EXPOSE 8000

# `exec` makes uvicorn PID 1 so `docker stop` reaches it and shuts down cleanly.
CMD ["sh", "-c", "python -m scripts.init_db && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]