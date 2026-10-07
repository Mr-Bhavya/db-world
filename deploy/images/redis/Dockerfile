# syntax=docker/dockerfile:1.7
#
# Redis for the Pi: Ubuntu noble's redis-server, run with the host's own /etc/redis/redis.conf and
# /var/lib/redis (compose.yml), as the host's redis account. redis-tools comes with it, for the
# healthcheck's redis-cli.
FROM ubuntu:24.04

ARG APT_STAMP=unset
RUN echo "${APT_STAMP}" > /dev/null \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get -y upgrade \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      redis-server tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /usr/share/dbworld-image \
 && dpkg-query -W -f '${Package} ${Version}\n' | sort > /usr/share/dbworld-image/packages.txt \
 && redis-server --version

CMD ["redis-server", "/etc/redis/redis.conf", "--daemonize", "no", "--supervised", "no"]
