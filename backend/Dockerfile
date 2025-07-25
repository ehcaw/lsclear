# ───────── Web-IDE sandbox, root user ─────────
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm-256color

# Install essential packages including full bash
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        bash \
        bash-completion \
        build-essential \
        curl wget jq \
        git vim nano less procps \
        iputils-ping \
        nodejs npm \
        # Add these for better bash support
        ca-certificates \
        util-linux && \
    rm -rf /var/lib/apt/lists/*

# Configure bash properly for hooks
RUN echo "set +h" >> /root/.bashrc && \
    echo "shopt -s expand_aliases" >> /root/.bashrc && \
    echo "set -o functrace" >> /root/.bashrc && \
    echo "export HISTCONTROL=ignoreboth" >> /root/.bashrc && \
    echo "export HISTSIZE=1000" >> /root/.bashrc && \
    echo "export HISTFILESIZE=2000" >> /root/.bashrc

# Ensure bash is the default shell
RUN ln -sf /bin/bash /bin/sh

# Popular Python/data libs (optional—drop any you don't need)
RUN pip install --no-cache-dir \
        ipykernel \
        pandas numpy scipy matplotlib 

WORKDIR /workspace
VOLUME ["/workspace"]

# Set bash as the default command interpreter
SHELL ["/bin/bash", "-c"]

# Keep the container alive; your backend still exec-starts /bin/bash -i
CMD ["tail", "-f", "/dev/null"]
# ───────────────────────────────────────────────