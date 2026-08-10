FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
# --retries/--timeout: PyPI downloads can stall on slow connections; retry instead of failing the build.
RUN pip install --no-cache-dir --retries 5 --timeout 60 -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "backend.routes:app", "--host", "0.0.0.0", "--port", "8000"]
