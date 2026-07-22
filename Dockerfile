FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY src ./src
COPY rules.json ./rules.json
ENV PYTHONPATH=/app/src
CMD ["python", "-m", "gmail_cron"]

