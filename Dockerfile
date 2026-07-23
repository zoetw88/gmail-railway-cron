FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY src ./src
COPY rules.json ./rules.json
ENV PYTHONPATH=/app/src
CMD ["sh", "-c", "if [ \"$START_MODE\" = \"manual-server\" ]; then exec python -m gmail_cron.manual_server; else exec python -m gmail_cron; fi"]
