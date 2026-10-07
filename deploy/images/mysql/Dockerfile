# syntax=docker/dockerfile:1.7
#
# MySQL for the Pi: Ubuntu noble's own mysqld build, run on the host's existing /var/lib/mysql
# with the host's /etc/mysql (compose.yml), as the host's mysql account. The point is that it is
# the SAME build the datadir was last opened with, so nothing is converted and the host's mysqld
# can open the same files again. dbworld-compose refuses an image whose mysql-server-core-8.0
# version differs from the one the datadir last ran (an upgrade is planned separately).
#
# Only the core server and the clients (mysqladmin for the healthcheck, mysql and mysqlcheck for
# the rehearsal). The mysql-server-8.0 package itself is left out: its postinst initialises a
# datadir and creates accounts, none of which belongs in an image.
#
# Temporary: the app is to move to PostgreSQL, which gets its own image when it does.
FROM ubuntu:24.04

ARG APT_STAMP=unset
RUN echo "${APT_STAMP}" > /dev/null \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get -y upgrade \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      mysql-server-core-8.0 mysql-client-8.0 tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /usr/share/dbworld-image \
 && dpkg-query -W -f '${Package} ${Version}\n' | sort > /usr/share/dbworld-image/packages.txt \
 && mysqld --version

CMD ["mysqld"]
