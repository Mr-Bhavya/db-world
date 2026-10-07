# syntax=docker/dockerfile:1.7
#
# aria2 for the Pi: Ubuntu noble's aria2, run with the host's /app/db_world/conf/aria2/aria2.conf
# and session, writing only to the media disk and its own folders (compose.yml), as the app's
# account. ca-certificates for HTTPS downloads.
FROM ubuntu:24.04

ARG APT_STAMP=unset
RUN echo "${APT_STAMP}" > /dev/null \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get -y upgrade \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      aria2 ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /usr/share/dbworld-image \
 && dpkg-query -W -f '${Package} ${Version}\n' | sort > /usr/share/dbworld-image/packages.txt \
 && aria2c --version | head -1

# aria2.service ran with UMask=002, so downloads stay group-writable for the dbworld group.
# aria2 has no option for that, hence the shell.
RUN printf '#!/bin/sh\numask 002\nexec aria2c "$@"\n' > /usr/local/bin/aria2-entrypoint \
 && chmod 0755 /usr/local/bin/aria2-entrypoint

ENTRYPOINT ["/usr/local/bin/aria2-entrypoint"]
CMD ["--conf-path=/app/db_world/conf/aria2/aria2.conf"]
