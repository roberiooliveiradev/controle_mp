FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        curl \
        unixodbc \
        unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["sh", "-c", "gunicorn app.main:app --bind 0.0.0.0:${API_CONTAINER_PORT:-5000} --workers ${GUNICORN_WORKERS:-1} -k eventlet --worker-connections ${GUNICORN_WORKER_CONNECTIONS:-1000} --access-logfile - --error-logfile -"]