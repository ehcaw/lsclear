# ───────── Web-IDE sandbox, root user ─────────
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        bash-completion \
        build-essential \
        curl wget jq \
        git vim nano less procps \
        iputils-ping \
        nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Popular Python/data libs (optional—drop any you don’t need)
RUN pip install --no-cache-dir \
        ipykernel jupyterlab \
        pandas numpy scipy matplotlib \
        fastapi uvicorn[standard]

WORKDIR /workspace
VOLUME ["/workspace"]

# Keep the container alive; your backend still exec-starts /bin/bash -i
CMD ["tail", "-f", "/dev/null"]
# ───────────────────────────────────────────────
  