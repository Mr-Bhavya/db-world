# syntax=docker/dockerfile:1.7
#
# nginx for the Pi: Ubuntu noble's nginx and its stream module, nothing else. /etc/nginx,
# /etc/letsencrypt, /var/www and the media are the host's, mounted at the same paths (compose.yml),
# so this is the same nginx running the same config. nginx.conf loads the stream module by name
# (load_module), because the host's modules-enabled/ names nine more that this image does not have.
FROM ubuntu:24.04

# Changes every scheduled build, so the apt layer runs again and picks up the week's fixes.
ARG APT_STAMP=unset
RUN echo "${APT_STAMP}" > /dev/null \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get -y upgrade \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      nginx libnginx-mod-stream tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /usr/share/dbworld-image \
 && dpkg-query -W -f '${Package} ${Version}\n' | sort > /usr/share/dbworld-image/packages.txt \
 && nginx -v

STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
